#!/usr/bin/env node
/**
 * Existe-t-il une variable qui batte le marché, et sur quelle discipline ?
 *
 * Le marché est notre prédicteur : le modèle actuel ne fait que le réencoder.
 * Pour progresser il faut une information que la cote ne contient pas encore.
 * Ce banc teste des variables candidates, discipline par discipline, selon un
 * protocole qui ne pardonne pas :
 *
 *   1. les courses sont coupées dans le temps — réglage sur le passé, contrôle
 *      sur les semaines suivantes, jamais vues ;
 *   2. la variable est centrée-réduite À L'INTÉRIEUR de chaque course, ce qui en
 *      fait une comparaison entre partants et non entre courses ;
 *   3. le modèle testé est p ∝ p_marché · exp(beta · x), beta réglé sur le seul
 *      lot de réglage ;
 *   4. n'est retenu que ce qui baisse le log loss SUR LE LOT DE CONTRÔLE.
 *
 * Un gain en réglage qui ne se confirme pas en contrôle est du sur-apprentissage,
 * pas une découverte.
 *
 * ATTENTION — `reduction_km` est volontairement absente de ce banc. Elle donnait
 * +18,8 % de log loss et 47 % de gagnants trouvés, ce qui aurait été la meilleure
 * variable jamais testée. C'est une fuite : le champ est renseigné pour 72,7 %
 * des courses arrivées mais 2,3 % des courses à venir, il change à chaque sortie
 * du cheval, et le meilleur temps de la course gagne dans 78,4 % des cas. C'est
 * le chrono réalisé PENDANT la course, écrit au passage d'import suivant. Une
 * validation hors échantillon ne detecte pas ce genre de piège : il faut aussi
 * verifier que la variable existe avant le départ.
 *
 * Usage : node scripts/evaluate-features.mjs [--cut 2026-06-01]
 */

import { neon } from "@neondatabase/serverless";
import { readFileSync } from "node:fs";

function databaseUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const env = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
  return (env.match(/^DATABASE_URL=(.+)$/m)?.[1] ?? "").trim().replace(/^["']|["']$/g, "");
}

const args = process.argv.slice(2);
const CUT = args.includes("--cut") ? args[args.indexOf("--cut") + 1] : "2026-06-01";

function devig(odds) {
  const raw = odds.map((o) => (Number.isFinite(o) && o > 1 ? 1 / o : 0));
  const known = raw.filter((r) => r > 0);
  if (!known.length) return odds.map(() => 1 / odds.length);
  const mean = known.reduce((a, b) => a + b, 0) / known.length;
  const filled = raw.map((r) => (r > 0 ? r : mean));
  const total = filled.reduce((a, b) => a + b, 0);
  return filled.map((r) => r / total);
}

/** Note de forme tirée de la musique : 1p = victoire, 0p/Dp/Ap = échec. */
function formScore(music) {
  if (!music) return null;
  const runs = String(music).match(/(\d+|[ADTR])[pmasch]/gi);
  if (!runs || !runs.length) return null;
  const recent = runs.slice(0, 5).map((r) => {
    const n = Number(r.slice(0, -1));
    return Number.isFinite(n) && n >= 1 && n <= 9 ? 10 - n : 0;
  });
  return recent.reduce((a, b) => a + b, 0) / recent.length;
}

/** Centre-réduit à l'intérieur d'une course ; les valeurs absentes valent la moyenne. */
function zWithinRace(values) {
  const known = values.filter((v) => v !== null && Number.isFinite(v));
  if (known.length < 2) return values.map(() => 0);
  const mean = known.reduce((a, b) => a + b, 0) / known.length;
  const sd = Math.sqrt(known.reduce((a, v) => a + (v - mean) ** 2, 0) / known.length);
  if (sd < 1e-9) return values.map(() => 0);
  return values.map((v) => (v === null || !Number.isFinite(v) ? 0 : (v - mean) / sd));
}

const sql = neon(databaseUrl());
const rows = await sql`
  select e.race_id, e.horse_id, r.race_date::text as race_date, r.discipline, r.specialty,
         e.odds::float as odds, e.age, e.earnings::float as earnings,
         e.handicap_distance, e.music, e.equipment,
         res.finish_position
  from entries e
  join races r on r.id = e.race_id
  left join results res on res.race_id = e.race_id and res.horse_id = e.horse_id
  where exists (select 1 from results x where x.race_id = r.id)
`;

const races = new Map();
for (const row of rows) {
  const list = races.get(row.race_id) ?? [];
  list.push(row);
  races.set(row.race_id, list);
}

// ─────────────────────────────────────────────────────────────────────────────
// HISTORIQUE PROPRE À CHAQUE CHEVAL
//
// La base contient 117 000 arrivées : de quoi construire, pour chaque partant,
// ce qu'il a fait AVANT cette course. C'est la seule information dont on dispose
// que la cote pourrait ne pas contenir entierement. Les courses sont parcourues
// dans l'ordre chronologique et l'historique n'est mis à jour qu'APRÈS avoir
// servi — sans quoi on rejouerait la fuite qu'on vient de debusquer.
// ─────────────────────────────────────────────────────────────────────────────

const ordered = [...races.entries()].sort((a, b) => (a[1][0].race_date < b[1][0].race_date ? -1 : 1));
const history = new Map(); // horse_id -> { runs, wins, sumRelFinish, sumSurprise, lastDate }

function histFeatures(horseId, raceDate) {
  const h = history.get(horseId);
  if (!h || h.runs === 0) return { experience: null, regularite: null, surprise: null, repos: null, victoires: null };
  const days = (new Date(raceDate) - new Date(h.lastDate)) / 86400000;
  return {
    experience: h.runs,
    // Position moyenne rapportée à la taille du peloton : 0 = toujours premier.
    regularite: -(h.sumRelFinish / h.runs),
    // Ecart entre ce que le marché lui donnait et ce qu'il a fait : positif = le
    // cheval sur-performe régulièrement ses cotes.
    surprise: h.sumSurprise / h.runs,
    repos: days > 0 && days < 400 ? -Math.abs(Math.log((days + 1) / 22)) : null,
    victoires: h.wins / h.runs,
  };
}

const prepared = [];
for (const [id, entries] of ordered) {
  const date = entries[0].race_date;
  const market = devig(entries.map((e) => e.odds));
  const winner = entries.findIndex((e) => Number(e.finish_position) === 1);

  if (entries.length >= 5 && winner >= 0) {
    const hist = entries.map((e) => histFeatures(e.horse_id, date));
    const segment = entries[0].discipline === "Trot"
      ? `Trot ${entries[0].specialty ?? ""}`.trim()
      : entries[0].discipline;

    prepared.push({
      date,
      id,
      market,
      segment,
      winner,
      z: {
        age: zWithinRace(entries.map((e) => (e.age ? Number(e.age) : null))),
        experience: zWithinRace(hist.map((h) => h.experience)),
        gains: zWithinRace(entries.map((e) => (e.earnings > 0 ? Math.log(Number(e.earnings)) : null))),
        handicap: zWithinRace(entries.map((e) => (e.handicap_distance ? -Number(e.handicap_distance) : null))),
        musique: zWithinRace(entries.map((e) => formScore(e.music))),
        oeilleres: zWithinRace(entries.map((e) => (e.equipment ? (e.equipment === "SANS_OEILLERES" ? 0 : 1) : null))),
        regularite: zWithinRace(hist.map((h) => h.regularite)),
        repos: zWithinRace(hist.map((h) => h.repos)),
        surprise: zWithinRace(hist.map((h) => h.surprise)),
        victoires: zWithinRace(hist.map((h) => h.victoires)),
      },
    });
  }

  // Mise à jour de l'historique APRÈS usage.
  const size = entries.length;
  for (const [i, entry] of entries.entries()) {
    const finish = Number(entry.finish_position);
    if (!finish || finish < 1) continue;
    const h = history.get(entry.horse_id) ?? { lastDate: date, runs: 0, sumRelFinish: 0, sumSurprise: 0, wins: 0 };
    h.runs += 1;
    h.sumRelFinish += finish / size;
    h.sumSurprise += (finish === 1 ? 1 : 0) - market[i];
    if (finish === 1) h.wins += 1;
    h.lastDate = date;
    history.set(entry.horse_id, h);
  }
}

const FEATURE_NAMES = ["age", "experience", "gains", "handicap", "musique", "oeilleres", "regularite", "repos", "surprise", "victoires"];

function logLoss(subset, feature, beta) {
  let sum = 0;
  for (const race of subset) {
    let total = 0;
    const scores = race.market.map((m, i) => {
      const v = beta === 0 ? m : m * Math.exp(beta * race.z[feature][i]);
      total += v;
      return v;
    });
    sum += -Math.log(Math.max(scores[race.winner] / total, 1e-12));
  }
  return sum / subset.length;
}

function top1(subset, feature, beta) {
  let hit = 0;
  for (const race of subset) {
    const scores = race.market.map((m, i) => (beta === 0 ? m : m * Math.exp(beta * race.z[feature][i])));
    if (scores.indexOf(Math.max(...scores)) === race.winner) hit += 1;
  }
  return (hit / subset.length) * 100;
}

const BETAS = [-0.4, -0.3, -0.2, -0.15, -0.1, -0.05, -0.02, 0.02, 0.05, 0.1, 0.15, 0.2, 0.3, 0.4];
const segments = [...new Set(prepared.map((r) => r.segment))].sort();

console.log(`\n${prepared.length} courses exploitables — réglage sur < ${CUT}, contrôle sur les suivantes.`);
console.log("Seul un gain visible sur le lot de contrôle compte.\n");

for (const segment of segments) {
  const all = prepared.filter((r) => r.segment === segment);
  const train = all.filter((r) => r.date < CUT);
  const test = all.filter((r) => r.date >= CUT);
  if (train.length < 300 || test.length < 150) {
    console.log(`${segment} — ${all.length} courses, trop peu pour un contrôle honnête. Ignoré.\n`);
    continue;
  }

  const baseTest = logLoss(test, "age", 0);
  console.log(`${segment} — ${train.length} courses de réglage, ${test.length} de contrôle`);
  console.log(`  marché seul : log loss ${baseTest.toFixed(4)}, gagnant trouvé ${top1(test, "age", 0).toFixed(1)} %`);

  const results = [];
  for (const feature of FEATURE_NAMES) {
    let best = { beta: 0, ll: logLoss(train, feature, 0) };
    for (const beta of BETAS) {
      const ll = logLoss(train, feature, beta);
      if (ll < best.ll) best = { beta, ll };
    }
    if (best.beta === 0) {
      results.push({ feature, beta: 0, gain: 0, verdict: "aucun réglage utile" });
      continue;
    }
    const gain = ((baseTest - logLoss(test, feature, best.beta)) / baseTest) * 100;
    results.push({
      beta: best.beta,
      feature,
      gain,
      top1: top1(test, feature, best.beta),
      verdict: gain > 0.15 ? "GAIN CONFIRME" : gain > 0 ? "gain dans le bruit" : "sur-apprentissage",
    });
  }

  results.sort((a, b) => b.gain - a.gain);
  for (const r of results) {
    const t1 = r.top1 === undefined ? "" : ` top1 ${r.top1.toFixed(1)} %`;
    console.log(
      `    ${r.feature.padEnd(11)} beta ${String(r.beta).padStart(5)}   ` +
        `log loss ${r.gain >= 0 ? "+" : ""}${r.gain.toFixed(2)} %${t1.padEnd(14)} ${r.verdict}`,
    );
  }
  console.log("");
}
