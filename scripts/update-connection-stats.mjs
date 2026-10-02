#!/usr/bin/env node
/**
 * Recalcule `connection_stats` : courses, victoires et places de chaque
 * jockey/driver et entraîneur sur tout l'historique arrivé. Lu par le modèle
 * fondamental (src/lib/fundamental). Quelques secondes, idempotent.
 */

import { neon } from "@neondatabase/serverless";
import { loadLocalEnv } from "./lib/pmu-fetch.mjs";

async function main() {
  await loadLocalEnv();
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
  const sql = neon(process.env.DATABASE_URL);

  const statements = ["jockey", "trainer"].map((kind) =>
    sql.query(
      `insert into connection_stats (kind, person_id, runs, wins, places, updated_at)
       select $1, e.${kind}_id, count(*)::int,
              count(*) filter (where res.finish_position = 1)::int,
              count(*) filter (where res.finish_position between 1 and 3)::int,
              now()
         from entries e
         join results res on res.race_id = e.race_id and res.horse_id = e.horse_id
        where e.${kind}_id is not null
        group by e.${kind}_id
       on conflict (kind, person_id) do update
         set runs = excluded.runs, wins = excluded.wins, places = excluded.places, updated_at = excluded.updated_at`,
      [kind],
    ),
  );
  await sql.transaction(statements);
  const [{ n }] = await sql`select count(*)::int as n from connection_stats`;
  console.log(`[entourage] ${n} jockeys et entraîneurs à jour`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
