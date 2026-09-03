#!/usr/bin/env node
/**
 * Évaluation du pouvoir prédictif, modèle contre marché.
 *
 * La question à laquelle ce script répond : nos probabilités font-elles mieux
 * que les cotes PMU dé-viggées ? Si non, l'algorithme n'apporte rien et toute
 * « amélioration » du KZ Score est du bruit.
 *
 * Métriques, toutes calculées sur le gagnant réel :
 *   - log loss : pénalise lourdement une forte confiance erronée. Plus bas = mieux.
 *   - Brier    : erreur quadratique moyenne sur la probabilité. Plus bas = mieux.
 *   - calibration : quand on annonce 30 %, observe-t-on 30 % de victoires ?
 *   - Top 3    : le gagnant est-il dans nos trois premiers ?
 *
 * Le marché sert de référence : c'est le meilleur prédicteur gratuit disponible.
 *
 * Usage : node scripts/evaluate-model.mjs [--from AAAA-MM-JJ] [--to AAAA-MM-JJ]
 */

import { neon } from "@neondatabase/serverless";
import { readFileSync } from "node:fs";

function databaseUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const env = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
  return (env.match(/^DATABASE_URL=(.+)$/m)?.[1] ?? "").trim().replace(/^["']|["']$/g, "");
}

/** Probabilités implicites du marché, overround retiré. */
function devig(odds) {
  const raw = odds.map((o) => (Number.isFinite(o) && o > 1 ? 1 / o : 0));
  const total = raw.reduce((a, b) => a + b, 0);
  return total > 0 ? raw.map((r) => r / total) : raw.map(() => 1 / raw.length);
}

/** Softmax sur scores centrés-réduits. */
function modelProbs(scores, spread) {
  const n = scores.length;
  const known = scores.filter((s) => Number.isFinite(s));
  if (known.length === 0) return scores.map(() => 1 / n);
  const knownMean = known.reduce((a, b) => a + b, 0) / known.length;
  const usable = scores.map((s) => (Number.isFinite(s) ? s : knownMean));

  const mean = usable.reduce((a, b) => a + b, 0) / n;
  const sd = Math.sqrt(usable.reduce((a, s) => a + (s - mean) ** 2, 0) / n);
  if (sd < 1e-9) return usable.map(() => 1 / n);

  const logits = usable.map((s) => (spread * (s - mean)) / sd);
  const max = Math.max(...logits);
  const exps = logits.map((l) => Math.exp(l - max));
  const sum = exps.reduce((a, b) => a + b, 0);
  return exps.map((e) => e / sum);
}

function blend(market, model, w) {
  const eps = 1e-9;
  const raw = market.map((m, i) => Math.max(m, eps) ** (1 - w) * Math.max(model[i], eps) ** w);
  const total = raw.reduce((a, b) => a + b, 0);
  return raw.map((r) => r / total);
}

/** Accumulateur de métriques. */
function makeScorer(label) {
  return {
    label, logLoss: 0, brier: 0, n: 0, top1: 0, top3: 0,
    buckets: Array.from({ length: 10 }, () => ({ sum: 0, wins: 0, n: 0 })),
    add(probs, winnerIdx) {
      const eps = 1e-12;
      this.n++;
      this.logLoss += -Math.log(Math.max(probs[winnerIdx], eps));
      // Brier multiclasse : somme des écarts quadratiques sur tout le champ.
      this.brier += probs.reduce((acc, p, i) => acc + (p - (i === winnerIdx ? 1 : 0)) ** 2, 0);

      const order = probs.map((p, i) => [p, i]).sort((a, b) => b[0] - a[0]);
      if (order[0][1] === winnerIdx) this.top1++;
      if (order.slice(0, 3).some(([, i]) => i === winnerIdx)) this.top3++;

      probs.forEach((p, i) => {
        const b = this.buckets[Math.min(9, Math.floor(p * 10))];
        b.sum += p; b.n++; if (i === winnerIdx) b.wins++;
      });
    },
    report() {
      return {
        label: this.label,
        logLoss: this.logLoss / this.n,
        brier: this.brier / this.n,
        top1: (100 * this.top1) / this.n,
        top3: (100 * this.top3) / this.n,
      };
    },
  };
}

async function main() {
  const args = process.argv.slice(2);
  const get = (n) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : null; };
  const from = get("from") ?? "2020-01-01";
  const to = get("to") ?? "2026-12-31";

  const sql = neon(databaseUrl());

  const rows = await sql`
    select e.race_id, e.odds::float8 as odds, e.kz_score::float8 as kz,
           coalesce(res.finish_position, 0) as pos
    from entries e
    join races r on r.id = e.race_id
    join results res on res.race_id = e.race_id and res.horse_id = e.horse_id
    where r.race_date between ${from} and ${to} and e.odds is not null
    order by e.race_id
  `;

  // Regroupement par course.
  const races = new Map();
  for (const row of rows) {
    if (!races.has(row.race_id)) races.set(row.race_id, []);
    races.get(row.race_id).push(row);
  }

  const scorers = {
    marche: makeScorer("Marché seul (cotes dé-viggées)"),
    modele: makeScorer("Modèle seul (KZ Score)"),
    // `MODEL_WEIGHT = 0.10` dans src/lib/probability.ts : c'est le mélange servi.
    w30: makeScorer("Mélange w=0.10 (en production)"),
  };
  const sweep = [0.1, 0.2, 0.3, 0.4, 0.5, 0.7].map((w) => ({ w, s: makeScorer(`w=${w}`) }));

  let used = 0, skipped = 0;
  for (const [, horses] of races) {
    const winner = horses.findIndex((h) => h.pos === 1);
    // Sans gagnant identifié (arrivée absente) ou champ trop petit, on n'apprend rien.
    if (winner < 0 || horses.length < 4) { skipped++; continue; }
    used++;

    const market = devig(horses.map((h) => h.odds));
    const model = modelProbs(horses.map((h) => h.kz), 1.0);

    scorers.marche.add(market, winner);
    scorers.modele.add(model, winner);
    scorers.w30.add(blend(market, model, 0.1), winner);
    for (const { w, s } of sweep) s.add(blend(market, model, w), winner);
  }

  console.log(`\nPériode ${from} → ${to} — ${used} courses évaluées (${skipped} écartées : pas de gagnant ou < 4 partants)\n`);

  console.log(`${"".padEnd(34)}${"logLoss".padStart(9)}${"Brier".padStart(9)}${"Top1 %".padStart(9)}${"Top3 %".padStart(9)}`);
  for (const key of ["marche", "modele", "w30"]) {
    const r = scorers[key].report();
    console.log(`${r.label.padEnd(34)}${r.logLoss.toFixed(4).padStart(9)}${r.brier.toFixed(4).padStart(9)}${r.top1.toFixed(1).padStart(9)}${r.top3.toFixed(1).padStart(9)}`);
  }

  console.log(`\nBalayage du poids modèle (référence marché : logLoss ${(scorers.marche.logLoss / scorers.marche.n).toFixed(4)})`);
  const base = scorers.marche.logLoss / scorers.marche.n;
  for (const { w, s } of sweep) {
    const r = s.report();
    const gain = ((base - r.logLoss) / base) * 100;
    const verdict = gain > 0.5 ? "MIEUX que le marché" : gain < -0.5 ? "PIRE que le marché" : "équivalent";
    console.log(`  w=${w.toFixed(2)}  logLoss ${r.logLoss.toFixed(4)}  (${gain >= 0 ? "+" : ""}${gain.toFixed(2)} %)  Top1 ${r.top1.toFixed(1)} %  ${verdict}`);
  }

  console.log(`\nCalibration du mélange en production (w=0.10)`);
  console.log(`  ${"annoncé".padStart(12)}${"observé".padStart(10)}${"n".padStart(9)}   écart`);
  scorers.w30.buckets.forEach((b, i) => {
    if (b.n < 50) return;
    const annonce = (b.sum / b.n) * 100;
    const observe = (b.wins / b.n) * 100;
    const ecart = observe - annonce;
    const flag = Math.abs(ecart) > 3 ? (ecart > 0 ? "  sous-estimé" : "  sur-estimé") : "";
    console.log(`  ${`${i * 10}-${i * 10 + 10} %`.padStart(12)}${annonce.toFixed(1).padStart(9)}%${observe.toFixed(1).padStart(9)}%${String(b.n).padStart(9)}   ${ecart >= 0 ? "+" : ""}${ecart.toFixed(1)} pp${flag}`);
  });
  console.log();
}

main().catch((e) => { console.error(e); process.exit(1); });
