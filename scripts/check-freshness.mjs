#!/usr/bin/env node
/**
 * Contrôle quotidien : une course est-elle partie sans cote fraîche ?
 *
 * C'est la « porte » des fondations de la roadmap : deux semaines sans course
 * partie sans relevé de cote ni de pool dans les 20 minutes précédant le départ.
 * Le script échoue (code 1) au-delà du seuil toléré ; GitHub envoie alors son
 * courriel d'échec habituel — c'est l'alerte.
 *
 * Usage : node scripts/check-freshness.mjs [--date AAAA-MM-JJ] [--tolerance 0.1]
 */

import { neon } from "@neondatabase/serverless";
import { loadLocalEnv } from "./lib/pmu-fetch.mjs";

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? fallback : process.argv[i + 1];
}

async function main() {
  await loadLocalEnv();
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
  const sql = neon(process.env.DATABASE_URL);
  const tolerance = Number(arg("tolerance", "0.1"));
  const date = arg("date", null);

  const rows = await sql.query(
    `with day_races as (
       select r.id, r.start_time,
              ((r.race_date + replace(r.start_time, 'h', ':')::time) at time zone 'Europe/Paris') as off
         from races r
        where r.race_date = coalesce($1::date, (now() at time zone 'Europe/Paris')::date)
          and ((r.race_date + replace(r.start_time, 'h', ':')::time) at time zone 'Europe/Paris') < now()
     )
     select d.id, d.start_time,
            exists (select 1 from odds_snapshots o where o.race_id = d.id
                     and o.observed_at between d.off - interval '20 minutes' and d.off) as odds_fresh,
            exists (select 1 from pool_snapshots p where p.race_id = d.id
                     and p.observed_at between d.off - interval '20 minutes' and d.off) as pools_fresh,
            exists (select 1 from prediction_snapshots s where s.race_id = d.id and s.stage = 'H-2') as frozen
       from day_races d
      order by d.off`,
    [date],
  );

  const stale = rows.filter((r) => !r.odds_fresh && !r.pools_fresh);
  const unfrozen = rows.filter((r) => !r.frozen);
  console.log(`[fraîcheur] ${rows.length} courses parties — ${stale.length} sans relevé dans les 20 min avant le départ, ${unfrozen.length} sans pronostic gelé`);
  for (const r of stale) console.log(`  · ${r.id} (${r.start_time}) : aucun relevé de cote ni de pool récent`);

  if (rows.length > 0 && stale.length / rows.length > tolerance) {
    console.error(`[fraîcheur] ÉCHEC : ${Math.round((100 * stale.length) / rows.length)} % des courses parties sans cote fraîche (toléré : ${tolerance * 100} %)`);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
