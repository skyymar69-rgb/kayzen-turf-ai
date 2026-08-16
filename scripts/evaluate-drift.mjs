#!/usr/bin/env node
/**
 * La dérive de cote apporte-t-elle un signal que le marché final ne contient
 * pas déjà ?
 *
 * Intuition testée : quand l'argent afflue sur un cheval entre l'ouverture et le
 * départ, ce mouvement porte de l'information. Mais la cote finale intègre déjà
 * cet argent — la question est donc de savoir s'il reste quelque chose à
 * exploiter APRÈS avoir pris la cote finale comme référence.
 *
 * Protocole : on part de la probabilité de marché dé-viggée, on la corrige par
 * la dérive, et on ne conserve la variable que si le log loss passe sous celui
 * du marché seul. Toute autre issue signifie qu'on ajoute du bruit.
 *
 * Usage : node scripts/evaluate-drift.mjs
 */

import { neon } from "@neondatabase/serverless";
import { readFileSync } from "node:fs";

function databaseUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const env = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
  return (env.match(/^DATABASE_URL=(.+)$/m)?.[1] ?? "").trim().replace(/^["']|["']$/g, "");
}

function devig(odds) {
  const raw = odds.map((o) => (Number.isFinite(o) && o > 1 ? 1 / o : 0));
  const total = raw.reduce((a, b) => a + b, 0);
  return total > 0 ? raw.map((r) => r / total) : raw.map(() => 1 / raw.length);
}

function logLossOf(rows) {
  const eps = 1e-12;
  let sum = 0;
  for (const { probs, winner } of rows) sum += -Math.log(Math.max(probs[winner], eps));
  return sum / rows.length;
}

async function main() {
  const sql = neon(databaseUrl());

  // Première et dernière cote observée par cheval, avec la cote finale de
  // l'entry et le résultat.
  const rows = await sql`
    with bornes as (
      select race_id, horse_id,
             (array_agg(odds order by observed_at asc))[1]::float8  as premiere,
             (array_agg(odds order by observed_at desc))[1]::float8 as derniere,
             count(*) as n
      from odds_snapshots
      group by race_id, horse_id
      having count(*) >= 2
    )
    select e.race_id, e.odds::float8 as cote, b.premiere, b.derniere,
           coalesce(res.finish_position, 0) as pos
    from entries e
    join bornes b on b.race_id = e.race_id and b.horse_id = e.horse_id
    join results res on res.race_id = e.race_id and res.horse_id = e.horse_id
    where e.odds is not null
    order by e.race_id
  `;

  const races = new Map();
  for (const r of rows) {
    if (!races.has(r.race_id)) races.set(r.race_id, []);
    races.get(r.race_id).push(r);
  }

  // On ne garde que les courses dont TOUS les partants ont une dérive connue,
  // sinon la comparaison serait faussée par un champ partiel.
  const usable = [];
  for (const [id, horses] of races) {
    const winner = horses.findIndex((h) => h.pos === 1);
    if (winner < 0 || horses.length < 4) continue;
    usable.push({ id, horses, winner });
  }

  console.log(`\n${usable.length} courses avec dérive complète et gagnant identifié\n`);
  if (usable.length < 100) {
    console.log("Échantillon trop faible pour conclure. Il faut davantage de relevés de cotes.\n");
    return;
  }

  // Référence : marché final seul.
  const baseRows = usable.map(({ horses, winner }) => ({
    probs: devig(horses.map((h) => h.cote)),
    winner,
  }));
  const base = logLossOf(baseRows);
  console.log(`Référence — marché final seul : logLoss ${base.toFixed(4)}\n`);

  // Statistiques descriptives de la dérive.
  let raccourcis = 0, allonges = 0, stables = 0;
  for (const { horses } of usable) {
    for (const h of horses) {
      const d = Math.log(h.premiere / h.derniere);
      if (d > 0.05) raccourcis++;
      else if (d < -0.05) allonges++;
      else stables++;
    }
  }
  console.log(`Mouvements observés : ${raccourcis} raccourcissements, ${allonges} allongements, ${stables} stables\n`);

  console.log("Correction par la dérive : p ∝ p_marché · exp(beta · dérive centrée)\n");
  console.log(`  ${"beta".padStart(6)}${"logLoss".padStart(10)}${"écart".padStart(10)}   verdict`);

  let best = { beta: 0, ll: base };
  for (const beta of [-0.6, -0.4, -0.2, -0.1, 0.1, 0.2, 0.4, 0.6]) {
    const scored = usable.map(({ horses, winner }) => {
      const market = devig(horses.map((h) => h.cote));
      const drift = horses.map((h) => Math.log(h.premiere / h.derniere));
      // Centrage par course : seule la dérive RELATIVE aux concurrents compte.
      const mean = drift.reduce((a, b) => a + b, 0) / drift.length;
      const adj = market.map((p, i) => p * Math.exp(beta * (drift[i] - mean)));
      const total = adj.reduce((a, b) => a + b, 0);
      return { probs: adj.map((p) => p / total), winner };
    });

    const ll = logLossOf(scored);
    const gain = ((base - ll) / base) * 100;
    const verdict = gain > 0.3 ? "MIEUX" : gain < -0.3 ? "pire" : "équivalent";
    console.log(`  ${beta.toFixed(2).padStart(6)}${ll.toFixed(4).padStart(10)}${`${gain >= 0 ? "+" : ""}${gain.toFixed(2)} %`.padStart(10)}   ${verdict}`);
    if (ll < best.ll) best = { beta, ll };
  }

  console.log();
  if (best.beta === 0) {
    console.log("CONCLUSION : aucune valeur de beta ne bat le marché final.");
    console.log("La dérive n'apporte rien — la cote finale a déjà absorbé l'information.\n");
  } else {
    const gain = ((base - best.ll) / base) * 100;
    console.log(`CONCLUSION : beta = ${best.beta} améliore le log loss de ${gain.toFixed(2)} %.`);
    console.log(`À intégrer si le gain se confirme hors échantillon.\n`);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
