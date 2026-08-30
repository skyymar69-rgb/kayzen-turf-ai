#!/usr/bin/env node
/**
 * Le poids du modèle doit-il dépendre de la taille du peloton ?
 *
 * `evaluate-model.mjs` montre que le modèle ne bat pas le marché en moyenne.
 * Reste à savoir si cette moyenne cache des situations opposées : le modèle
 * pourrait aider sur les petits pelotons et nuire sur les grands, auquel cas un
 * poids unique est le mauvais réglage.
 *
 * On compare donc, par tranche de peloton, le classement obtenu avec le poids en
 * production (0,10) et sans modèle du tout (0).
 *
 * Usage : node scripts/evaluate-weight-by-field.mjs
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
  const known = raw.filter((r) => r > 0);
  if (!known.length) return odds.map(() => 1 / odds.length);
  const mean = known.reduce((a, b) => a + b, 0) / known.length;
  const filled = raw.map((r) => (r > 0 ? r : mean));
  const total = filled.reduce((a, b) => a + b, 0);
  return filled.map((r) => r / total);
}

function modelProbabilities(scores) {
  const n = scores.length;
  const known = scores.filter(Number.isFinite);
  if (!known.length) return scores.map(() => 1 / n);
  const km = known.reduce((a, b) => a + b, 0) / known.length;
  const usable = scores.map((s) => (Number.isFinite(s) ? s : km));
  const mean = usable.reduce((a, b) => a + b, 0) / n;
  const sd = Math.sqrt(usable.reduce((a, s) => a + (s - mean) ** 2, 0) / n);
  if (sd < 1e-9) return usable.map(() => 1 / n);
  const logits = usable.map((s) => (s - mean) / sd);
  const max = Math.max(...logits);
  const exps = logits.map((l) => Math.exp(l - max));
  const total = exps.reduce((a, b) => a + b, 0);
  return exps.map((e) => e / total);
}

function blend(market, model, w) {
  if (w === 0) return market;
  const raw = market.map((m, i) => Math.max(m, 1e-9) ** (1 - w) * Math.max(model[i], 1e-9) ** w);
  const total = raw.reduce((a, b) => a + b, 0);
  return raw.map((r) => r / total);
}

const sql = neon(databaseUrl());
const rows = await sql`
  select e.race_id, e.odds::float as odds, e.kz_score::float as kz, res.finish_position
  from entries e
  join races r on r.id = e.race_id
  left join results res on res.race_id = e.race_id and res.horse_id = e.horse_id
  where r.race_date >= current_date - 400
    and exists (select 1 from results x where x.race_id = r.id)
`;

const races = new Map();
for (const row of rows) {
  const list = races.get(row.race_id) ?? [];
  list.push(row);
  races.set(row.race_id, list);
}

const BANDS = [[5, 8], [9, 11], [12, 13], [14, 15], [16, 17], [18, 40]];
const stats = BANDS.map(([lo, hi]) => ({ lo, hi, n: 0, hit0: 0, hit10: 0, ll0: 0, ll10: 0 }));

for (const [, entries] of races) {
  if (entries.length < 5) continue;
  const arrival = entries.filter((e) => Number(e.finish_position) === 1);
  if (arrival.length !== 1) continue;
  const winner = entries.indexOf(arrival[0]);
  const band = stats.find((b) => entries.length >= b.lo && entries.length <= b.hi);
  if (!band) continue;

  const market = devig(entries.map((e) => e.odds));
  const model = modelProbabilities(entries.map((e) => e.kz));
  const p10 = blend(market, model, 0.1);

  band.n += 1;
  if (market.indexOf(Math.max(...market)) === winner) band.hit0 += 1;
  if (p10.indexOf(Math.max(...p10)) === winner) band.hit10 += 1;
  band.ll0 += -Math.log(Math.max(market[winner], 1e-9));
  band.ll10 += -Math.log(Math.max(p10[winner], 1e-9));
}

console.log("\nPeloton        courses   gagnant w=0   gagnant w=0.10   log-loss w=0   log-loss w=0.10   verdict");
for (const b of stats.filter((x) => x.n > 50)) {
  const a0 = (b.hit0 / b.n) * 100;
  const a10 = (b.hit10 / b.n) * 100;
  const l0 = b.ll0 / b.n;
  const l10 = b.ll10 / b.n;
  const verdict = l10 < l0 - 0.002 ? "le modele aide" : l10 > l0 + 0.002 ? "le modele nuit" : "equivalent";
  console.log(
    `${String(b.lo).padStart(2)}-${String(b.hi).padEnd(2)} partants ${String(b.n).padStart(7)}   ` +
      `${a0.toFixed(1).padStart(9)} %   ${a10.toFixed(1).padStart(12)} %   ` +
      `${l0.toFixed(4).padStart(12)}   ${l10.toFixed(4).padStart(15)}   ${verdict}`,
  );
}
