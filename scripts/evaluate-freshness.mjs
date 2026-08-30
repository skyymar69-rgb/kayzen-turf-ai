#!/usr/bin/env node
/**
 * Combien coûte une cote périmée ?
 *
 * Le marché est, de loin, le meilleur prédicteur dont dispose le site : le banc
 * `evaluate-model.mjs` montre que le modèle ne fait pas mieux que les cotes
 * dé-viggées. Mais « les cotes » n'est pas une donnée figée — elles convergent
 * vers la vérité à mesure que l'argent rentre, et l'import ne tourne que trois
 * fois par jour.
 *
 * Ce script reconstitue, pour chaque tranche d'ancienneté, le classement que le
 * site aurait publié avec les cotes disponibles à ce moment-là, et le confronte
 * à l'arrivée réelle. Il répond donc à une question d'exploitation, pas de
 * modélisation : à quelle heure faut-il rafraîchir pour ne pas publier un
 * pronostic déjà périmé ?
 *
 * Usage : node scripts/evaluate-freshness.mjs
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

const sql = neon(databaseUrl());

// Seuls les relevés pris autour de la course ont un horodatage exploitable :
// l'archive historique a été rattrapée a posteriori, ses `observed_at` sont des
// heures d'import, pas des heures de marché.
const rows = await sql`
  select
    o.race_id,
    o.horse_id,
    o.odds::float as odds,
    extract(epoch from (((r.race_date + r.start_time::time) at time zone 'Europe/Paris') - o.observed_at)) / 3600 as heures_avant,
    res.finish_position
  from odds_snapshots o
  join races r on r.id = o.race_id
  join results res on res.race_id = o.race_id and res.horse_id = o.horse_id
  where r.start_time ~ '^[0-9]{2}:[0-9]{2}$'
    and o.observed_at::date - r.race_date between -3 and 1
`;

const races = new Map();
for (const row of rows) {
  const race = races.get(row.race_id) ?? new Map();
  const horse = race.get(row.horse_id) ?? { finish: row.finish_position, snaps: [] };
  horse.snaps.push({ hours: Number(row.heures_avant), odds: row.odds });
  race.set(row.horse_id, horse);
  races.set(row.race_id, race);
}

const BANDS = [
  [-1, 0.5, "cote de départ"],
  [0.5, 1.5, "30 min à 1 h 30"],
  [1.5, 3, "1 h 30 à 3 h"],
  [3, 6, "3 h à 6 h"],
  [6, 12, "6 h à 12 h"],
  [12, 30, "12 h à 30 h"],
  [30, 100, "plus de 30 h"],
];

const bands = BANDS.map(([lo, hi, label]) => ({ lo, hi, label, courses: 0, hits: 0, logLoss: 0 }));

for (const [, race] of races) {
  const horses = [...race.values()];
  if (horses.length < 5) continue;
  const winner = horses.findIndex((h) => Number(h.finish) === 1);
  if (winner < 0) continue;

  for (const band of bands) {
    // Cote la plus proche du départ à l'intérieur de la tranche, pour chaque cheval.
    const odds = horses.map((horse) => {
      const snap = horse.snaps.filter((s) => s.hours >= band.lo && s.hours < band.hi).sort((a, b) => a.hours - b.hours)[0];
      return snap?.odds ?? null;
    });
    if (odds.some((o) => o === null || o <= 1)) continue;

    const probs = devig(odds);
    band.courses += 1;
    if (probs.indexOf(Math.max(...probs)) === winner) band.hits += 1;
    band.logLoss += -Math.log(Math.max(probs[winner], 1e-9));
  }
}

const usable = bands.filter((b) => b.courses > 30);
const reference = usable[0];

console.log(`\nAncienneté des cotes et pouvoir prédictif — ${races.size} courses relevées\n`);
console.log("  cotes datant de        courses   gagnant trouvé   log loss   écart");
for (const band of usable) {
  const top1 = (band.hits / band.courses) * 100;
  const ll = band.logLoss / band.courses;
  const gap = top1 - (reference.hits / reference.courses) * 100;
  console.log(
    `  ${band.label.padEnd(20)}  ${String(band.courses).padStart(6)}   ${top1.toFixed(1).padStart(11)} %   ${ll.toFixed(4).padStart(8)}   ${gap >= 0 ? "référence" : `${gap.toFixed(1)} pts`}`,
  );
}

// Ce que le site a réellement publié : la cote la plus fraîche connue avant le départ.
const age = await sql`
  select tranche, count(*)::int as courses from (
    select case
      when h < 1 then 'moins de 1 h'
      when h < 2 then '1 h à 2 h'
      when h < 4 then '2 h à 4 h'
      when h < 8 then '4 h à 8 h'
      else 'plus de 8 h' end as tranche
    from (
      select (
        select min(extract(epoch from (((r.race_date + r.start_time::time) at time zone 'Europe/Paris') - o.observed_at)) / 3600)
        from odds_snapshots o
        where o.race_id = r.id
          and o.observed_at < ((r.race_date + r.start_time::time) at time zone 'Europe/Paris')
      ) as h
      from races r
      where r.start_time ~ '^[0-9]{2}:[0-9]{2}$'
        and exists (select 1 from results res where res.race_id = r.id)
        and exists (select 1 from odds_snapshots o2 where o2.race_id = r.id and o2.observed_at::date - r.race_date between -3 and 0)
    ) t
    where h is not null
  ) u group by tranche
`;

console.log("\nAncienneté des cotes réellement disponibles au moment de publier :\n");
const order = ["moins de 1 h", "1 h à 2 h", "2 h à 4 h", "4 h à 8 h", "plus de 8 h"];
const total = age.reduce((sum, row) => sum + row.courses, 0);
for (const label of order) {
  const row = age.find((a) => a.tranche === label);
  if (!row) continue;
  console.log(`  ${label.padEnd(14)} ${String(row.courses).padStart(6)} courses  (${((row.courses / total) * 100).toFixed(0)} %)`);
}
