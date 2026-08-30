#!/usr/bin/env node
/**
 * Confrontation des Quintés : ce que le site a annoncé, ce qui est arrivé.
 *
 * Le classement est reconstitué exactement comme `src/lib/probability.ts` le
 * calcule à l'affichage — cotes dé-viggées, mélange log-linéaire avec le modèle
 * à 10 %, tri par probabilité décroissante. Les colonnes brutes de la base ne
 * sont jamais utilisées : elles ne sont pas ce que l'utilisateur voit.
 *
 * Usage : node scripts/audit-quintes.mjs [--days 60] [--json fichier.json]
 */

import { neon } from "@neondatabase/serverless";
import { readFileSync, writeFileSync } from "node:fs";

function databaseUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const env = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
  return (env.match(/^DATABASE_URL=(.+)$/m)?.[1] ?? "").trim().replace(/^["']|["']$/g, "");
}

const args = process.argv.slice(2);
const DAYS = Number(args[args.indexOf("--days") + 1]) || 60;
const JSON_OUT = args.includes("--json") ? args[args.indexOf("--json") + 1] : null;

// ── Reproduction fidèle de src/lib/probability.ts ────────────────────────────

const MODEL_WEIGHT = 0.1;
const MODEL_SPREAD = 1.0;
const VALUE_RATIO = 1.3;
const TOCARD_MIN_ODDS = 12;

function devig(odds) {
  const raw = odds.map((o) => (Number.isFinite(o) && o > 1 ? 1 / o : 0));
  const known = raw.filter((r) => r > 0);
  if (known.length === 0) return odds.map(() => 1 / Math.max(odds.length, 1));
  const meanKnown = known.reduce((a, b) => a + b, 0) / known.length;
  const filled = raw.map((r) => (r > 0 ? r : meanKnown));
  const total = filled.reduce((a, b) => a + b, 0);
  return filled.map((r) => r / total);
}

function modelProbabilities(scores, spread = MODEL_SPREAD) {
  const n = scores.length;
  if (n === 0) return [];
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
  const total = exps.reduce((a, b) => a + b, 0);
  return exps.map((e) => e / total);
}

function blend(market, model, weight = MODEL_WEIGHT) {
  const eps = 1e-9;
  const raw = market.map((m, i) => Math.max(m, eps) ** (1 - weight) * Math.max(model[i] ?? eps, eps) ** weight);
  const total = raw.reduce((a, b) => a + b, 0);
  return total > 0 ? raw.map((r) => r / total) : market;
}

/** Sélection à six, règle du tocard repêché comprise (elle ne touche que le 6ᵉ rang). */
function buildSelection(entries) {
  const market = devig(entries.map((e) => e.odds));
  const model = modelProbabilities(entries.map((e) => e.kz));
  const pWin = blend(market, model);

  const horses = entries.map((entry, i) => ({
    ...entry,
    pWin: pWin[i] * 100,
    pMarket: market[i] * 100,
    valueRatio: market[i] > 0 ? pWin[i] / market[i] : 1,
  }));

  const ranked = horses.slice().sort((a, b) => b.pWin - a.pWin || a.odds - b.odds || a.number - b.number);
  const isTocard = (h) => Number.isFinite(h.odds) && h.odds >= TOCARD_MIN_ODDS && h.valueRatio >= VALUE_RATIO;

  let picked = ranked.slice(0, 6);
  let promoted = null;
  if (ranked.length > 6 && !picked.some(isTocard)) {
    const candidate = ranked.slice(5).filter(isTocard).sort((a, b) => b.pWin - a.pWin || b.valueRatio - a.valueRatio)[0];
    if (candidate) {
      promoted = candidate;
      picked = [...ranked.slice(0, 5), candidate];
    }
  }
  return { horses, market, picked, promoted, ranked };
}

/**
 * Plafond théorique du rapport Quinté.
 *
 * Même en supposant nos probabilités parfaites — c'est-à-dire égales à celles du
 * marché, qui est le meilleur estimateur connu — l'arrivée reste tirée au sort
 * selon ces probabilités. On simule donc des arrivées Plackett-Luce et on compte
 * combien de nos cinq premiers y figurent. C'est le rapport qu'obtiendrait un
 * pronostiqueur qui ne se trompe jamais sur les probabilités.
 */
function ceilingHits(probs, nSim = 4000) {
  const n = probs.length;
  const top5 = probs
    .map((p, i) => [p, i])
    .sort((a, b) => b[0] - a[0])
    .slice(0, 5)
    .map(([, i]) => i);
  const target = new Set(top5);

  let seed = 987654321 + n * 7919;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };

  let total = 0;
  const dist = [0, 0, 0, 0, 0, 0];
  const idx = new Array(n);
  const weights = new Array(n);
  for (let sim = 0; sim < nSim; sim += 1) {
    for (let i = 0; i < n; i += 1) {
      idx[i] = i;
      weights[i] = probs[i];
    }
    let remaining = n;
    let mass = weights.reduce((a, b) => a + b, 0);
    let hits = 0;
    for (let pos = 0; pos < 5 && remaining > 0 && mass > 0; pos += 1) {
      const draw = rand() * mass;
      let acc = 0;
      let picked = remaining - 1;
      for (let j = 0; j < remaining; j += 1) {
        acc += weights[j];
        if (acc >= draw) { picked = j; break; }
      }
      if (target.has(idx[picked])) hits += 1;
      mass -= weights[picked];
      idx[picked] = idx[remaining - 1];
      weights[picked] = weights[remaining - 1];
      remaining -= 1;
    }
    total += hits;
    dist[hits] += 1;
  }
  return { mean: total / nSim, dist: dist.map((d) => d / nSim) };
}

// ── Chargement ───────────────────────────────────────────────────────────────

const sql = neon(databaseUrl());

const raceRows = await sql`
  select r.id, r.race_date::text as race_date, r.name, r.discipline, r.distance,
         r.start_time, c.name as hippodrome
  from races r
  left join racecourses c on c.id = r.racecourse_id
  where r.race_date >= current_date - ${DAYS}::int
    and r.bet_types::text like '%QUINTE_PLUS%'
    and exists (select 1 from results res where res.race_id = r.id)
  order by r.race_date desc
`;

const quintes = [];
for (const race of raceRows) {
  const entries = await sql`
    select e.number, e.odds::float as odds, e.kz_score::float as kz,
           h.name as horse, res.finish_position
    from entries e
    join horses h on h.id = e.horse_id
    left join results res on res.race_id = e.race_id and res.horse_id = e.horse_id
    where e.race_id = ${race.id}
    order by e.number
  `;
  if (entries.length < 8) continue;

  const arrival = entries.filter((e) => Number(e.finish_position) > 0).sort((a, b) => a.finish_position - b.finish_position);
  if (arrival.length < 5) continue;

  const { market, picked, promoted, ranked } = buildSelection(entries);
  const ourTop5 = picked.slice(0, 5);
  const actualTop5 = arrival.slice(0, 5);
  const actualNumbers = new Set(actualTop5.map((e) => e.number));

  const hits = ourTop5.filter((h) => actualNumbers.has(h.number)).length;
  const ordered = ourTop5.every((h, i) => h.number === actualTop5[i]?.number);
  const rankOf = new Map(ranked.map((h, i) => [h.number, i + 1]));

  quintes.push({
    actualTop5: actualTop5.map((e) => ({ number: e.number, horse: e.horse, odds: e.odds, ourRank: rankOf.get(e.number) ?? null })),
    date: race.race_date,
    fieldSize: entries.length,
    hippodrome: race.hippodrome,
    hits,
    id: race.id,
    marketTop5: entries.slice().sort((a, b) => a.odds - b.odds).slice(0, 5).map((e) => e.number),
    name: race.name,
    ordered,
    ourTop5: ourTop5.map((h) => ({ number: h.number, horse: h.horse, odds: h.odds, pWin: Number(h.pWin.toFixed(1)) })),
    promotedTocard: promoted ? promoted.number : null,
    // Un « tocard » selon la convention presse : cote >= 12. La question posée
    // est de savoir s'il en apparaît dans le Top 3 affiché.
    tocardsInTop3: picked.slice(0, 3).filter((h) => h.odds >= TOCARD_MIN_ODDS).map((h) => h.number),
    winnerFound: ourTop5[0]?.number === actualTop5[0]?.number,
    winnerOdds: actualTop5[0]?.odds,
    winnerOurRank: rankOf.get(actualTop5[0].number) ?? null,
    ceiling: ceilingHits(market),
    coverage: [5, 6, 7, 8].map((k) => ranked.slice(0, k).filter((h) => actualNumbers.has(h.number)).length),
  });
}

// ── Restitution ──────────────────────────────────────────────────────────────

const pct = (n, d) => (d === 0 ? "—" : `${((n / d) * 100).toFixed(1)} %`);
console.log(`\n${quintes.length} Quintés arrivés sur les ${DAYS} derniers jours\n`);

console.log("date         course                              peloton  notre top 5           arrivée              rapport");
for (const q of quintes) {
  console.log(
    `${q.date}   ${(q.name ?? "").slice(0, 32).padEnd(34)} ${String(q.fieldSize).padStart(5)}   ` +
      `${q.ourTop5.map((h) => h.number).join("-").padEnd(20)} ` +
      `${q.actualTop5.map((h) => h.number).join("-").padEnd(20)} ${q.hits}/5`,
  );
}

const dist = [0, 1, 2, 3, 4, 5].map((k) => ({ k, n: quintes.filter((q) => q.hits === k).length }));
console.log("\nDistribution des rapports");
for (const d of dist) console.log(`  ${d.k}/5 : ${String(d.n).padStart(3)} ${pct(d.n, quintes.length)}`);

const totalHits = quintes.reduce((s, q) => s + q.hits, 0);
console.log(`\nMoyenne : ${(totalHits / quintes.length).toFixed(2)} chevaux trouvés sur 5`);
console.log(`Gagnant en tête de notre sélection : ${pct(quintes.filter((q) => q.winnerFound).length, quintes.length)}`);
console.log(`Gagnant présent dans notre top 5   : ${pct(quintes.filter((q) => q.winnerOurRank <= 5).length, quintes.length)}`);
console.log(`Gagnant présent dans notre top 3   : ${pct(quintes.filter((q) => q.winnerOurRank <= 3).length, quintes.length)}`);
console.log(`Quinté dans l'ordre                : ${quintes.filter((q) => q.ordered).length}`);

// Où se situent, dans notre classement, les cinq chevaux réellement arrivés ?
const rankBands = [[1, 3], [4, 5], [6, 8], [9, 12], [13, 99]];
console.log("\nRang que nous donnions aux chevaux effectivement arrivés dans les 5");
const placed = quintes.flatMap((q) => q.actualTop5.map((a) => a.ourRank)).filter((r) => r);
for (const [lo, hi] of rankBands) {
  const n = placed.filter((r) => r >= lo && r <= hi).length;
  console.log(`  rang ${String(lo).padStart(2)}-${String(hi).padStart(2)} : ${String(n).padStart(3)} ${pct(n, placed.length)}`);
}

// Profil de cote des chevaux arrivés que nous avions manqués.
const missed = quintes.flatMap((q) => q.actualTop5.filter((a) => a.ourRank > 5));
const oddsBands = [[0, 8], [8, 15], [15, 30], [30, 1000]];
console.log(`\nCote des ${missed.length} chevaux arrivés que nous avions hors du top 5`);
for (const [lo, hi] of oddsBands) {
  const n = missed.filter((m) => m.odds >= lo && m.odds < hi).length;
  console.log(`  cote ${String(lo).padStart(3)}-${String(hi).padStart(4)} : ${String(n).padStart(3)} ${pct(n, missed.length)}`);
}

const withTocardTop3 = quintes.filter((q) => q.tocardsInTop3.length > 0);
console.log(`\nQuintés dont le Top 3 affiché contient un cheval à cote >= 12 : ${withTocardTop3.length} (${pct(withTocardTop3.length, quintes.length)})`);
console.log(`Quintés où la règle du tocard repêché a modifié le 6ᵉ rang     : ${quintes.filter((q) => q.promotedTocard).length}`);

// Le tocard repêché ne touche que le 6ᵉ rang : le rapport Quinté (top 5) ne peut
// pas en dépendre. On le vérifie plutôt que de l'affirmer.
const hitsWithTocard = withTocardTop3.reduce((s, q) => s + q.hits, 0);
const withoutTocard = quintes.filter((q) => q.tocardsInTop3.length === 0);
const hitsWithout = withoutTocard.reduce((s, q) => s + q.hits, 0);
console.log(`\nRapport moyen quand le Top 3 contient une cote >= 12 : ${withTocardTop3.length ? (hitsWithTocard / withTocardTop3.length).toFixed(2) : "—"} (${withTocardTop3.length} courses)`);
console.log(`Rapport moyen sinon                                 : ${withoutTocard.length ? (hitsWithout / withoutTocard.length).toFixed(2) : "—"} (${withoutTocard.length} courses)`);

// Référence : le marché seul, cinq plus courtes cotes.
let marketHits = 0;
for (const q of quintes) {
  const actual = new Set(q.actualTop5.map((a) => a.number));
  marketHits += q.marketTop5.filter((n) => actual.has(n)).length;
}
console.log(`\nRéférence marché seul (5 plus courtes cotes) : ${(marketHits / quintes.length).toFixed(2)} sur 5`);

const avgField = quintes.reduce((s, q) => s + q.fieldSize, 0) / quintes.length;
console.log(`Peloton moyen : ${avgField.toFixed(1)} partants`);

const ceiling = quintes.reduce((s, q) => s + q.ceiling.mean, 0) / quintes.length;
const random = quintes.reduce((s, q) => s + (25 / q.fieldSize), 0) / quintes.length;
console.log(`
Plafond theorique (probabilites parfaites) : ${ceiling.toFixed(2)} sur 5`);
console.log(`Tirage au hasard de 5 chevaux              : ${random.toFixed(2)} sur 5`);
console.log(`Notre resultat                             : ${(totalHits / quintes.length).toFixed(2)} sur 5`);

const ceilDist = [0, 1, 2, 3, 4, 5].map((k) => quintes.reduce((s, q) => s + q.ceiling.dist[k], 0) / quintes.length);
console.log("\nDistribution du plafond théorique (probabilités parfaites)");
for (let k = 0; k <= 5; k += 1) {
  const obs = quintes.filter((q) => q.hits === k).length / quintes.length;
  console.log(`  ${k}/5 : plafond ${(ceilDist[k] * 100).toFixed(1).padStart(5)} %   observe ${(obs * 100).toFixed(1).padStart(5)} %`);
}

console.log("\nCouverture selon le nombre de chevaux joués");
for (const [i, k] of [5, 6, 7, 8].entries()) {
  const avg = quintes.reduce((s, q) => s + q.coverage[i], 0) / quintes.length;
  console.log(`  ${k} chevaux : ${avg.toFixed(2)} sur 5 trouves`);
}

if (JSON_OUT) {
  writeFileSync(JSON_OUT, JSON.stringify({ avgField, dist, generatedFor: DAYS, marketAverage: marketHits / quintes.length, quintes }, null, 2));
  console.log(`\nDonnées écrites dans ${JSON_OUT}`);
}
