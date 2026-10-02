#!/usr/bin/env node
/**
 * Rattrapage des rapports officiels PMU pour les courses déjà arrivées.
 *
 * L'import ne relève les rapports que depuis octobre 2026. Le suivi de
 * performance a besoin de l'historique : ce script parcourt les courses
 * arrivées sans rapport et les complète, une requête par course.
 *
 * Usage : node scripts/backfill-payouts.mjs [--from 2026-05-01] [--limit 500]
 */

import { neon } from "@neondatabase/serverless";
import { PMU_BASE, delay, fetchJson, loadLocalEnv } from "./lib/pmu-fetch.mjs";
import { storePayouts } from "./lib/payouts.mjs";

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? fallback : process.argv[i + 1];
}

async function main() {
  await loadLocalEnv();
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
  const sql = neon(process.env.DATABASE_URL);
  const from = arg("from", "2026-05-01");
  const limit = Number(arg("limit", "100000"));

  const races = await sql`
    select r.id from races r
     where r.race_date >= ${from}::date
       and r.race_date < (now() at time zone 'Europe/Paris')::date
       and exists (select 1 from results res where res.race_id = r.id and res.finish_position = 1)
       and not exists (select 1 from race_payouts p where p.race_id = r.id)
     order by r.race_date desc
     limit ${limit}
  `;
  console.log(`[rapports] ${races.length} courses à compléter depuis le ${from}`);

  let stored = 0;
  let missing = 0;
  for (const [index, { id }] of races.entries()) {
    const [, y, m, d, r, c] = id.match(/^(\d{4})-(\d{2})-(\d{2})-R(\d+)-C(\d+)$/) ?? [];
    if (!y) continue;
    try {
      const rapports = await fetchJson(`${PMU_BASE}/${d}${m}${y}/R${r}/C${c}/rapports-definitifs`);
      if ((await storePayouts(sql, id, rapports)) > 0) stored += 1;
      else missing += 1;
    } catch (error) {
      missing += 1;
      if (!error?.permanent) console.warn(`[rapports] ${id} : ${error.message}`);
    }
    if ((index + 1) % 250 === 0) console.log(`[rapports] ${index + 1}/${races.length} — ${stored} complétées, ${missing} sans rapport`);
    await delay(150);
  }
  console.log(`[rapports] terminé : ${stored} courses complétées, ${missing} sans rapport publié`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
