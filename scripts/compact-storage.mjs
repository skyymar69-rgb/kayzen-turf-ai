// ─────────────────────────────────────────────────────────────────────────────
// Compaction du stockage Neon — suppression de la REDONDANCE, pas de l'histoire.
//
// Le workflow d'import tourne 3 fois par jour sur une fenêtre glissante de
// 3 jours : chaque journée de courses est donc réimportée ~9 fois. `entries` et
// `value_bets` sont en upsert, mais `predictions` et `odds_snapshots` étaient en
// insert sec — d'où 9 copies quasi identiques par partant. Résultat : la base a
// atteint le plafond de 512 Mo du projet Neon et TOUTE écriture échoue
// (« could not extend file because project size limit has been exceeded »).
//
// Ce script ne supprime AUCUNE course, AUCUN partant, AUCUN résultat et AUCUNE
// observation de marché. Il retire uniquement :
//   1. les prédictions périmées : pour chaque course, seule la prédiction du
//      dernier prediction_run est conservée (les précédentes sont remplacées) ;
//   2. les relevés de cote sans mouvement : une cote réenregistrée à l'identique
//      n'apporte pas d'information — on garde le premier relevé de chaque palier,
//      donc la courbe de dérive (première cote, dernière cote, paliers) est
//      strictement préservée ;
//   3. les prediction_runs devenus orphelins.
//
// Conforme à docs/DATA_RETENTION_POLICY.md : suppression explicite, documentée,
// sans limite d'âge et sans perte analytique.
//
//   node scripts/compact-storage.mjs            → simulation (aucune écriture)
//   node scripts/compact-storage.mjs --apply    → exécution
// ─────────────────────────────────────────────────────────────────────────────

import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { Pool, neonConfig } from "@neondatabase/serverless";

neonConfig.webSocketConstructor = globalThis.WebSocket;

const BATCH_SIZE = 40_000;

async function loadLocalEnv() {
  try {
    const content = await readFile(resolve(process.cwd(), ".env.local"), "utf8");
    for (const line of content.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const separator = trimmed.indexOf("=");
      if (separator === -1) continue;
      const key = trimmed.slice(0, separator);
      const value = trimmed.slice(separator + 1).replace(/^"|"$/g, "");
      process.env[key] ||= value;
    }
  } catch {
    // CI fournit DATABASE_URL directement.
  }
}

async function databaseSize(client) {
  const { rows } = await client.query(
    `select pg_size_pretty(pg_database_size(current_database())) as pretty,
            pg_database_size(current_database()) as bytes`,
  );
  return rows[0];
}

// ── 1. Prédictions périmées ─────────────────────────────────────────────────
// Un prediction_run couvre un import complet : garder le run le plus récent par
// course revient à garder la dernière prédiction de chaque partant.
async function latestRunPerRace(client) {
  const { rows } = await client.query(`
    with runs as (
      select distinct race_id, prediction_run_id from predictions
    ),
    ranked as (
      select runs.race_id,
             runs.prediction_run_id,
             row_number() over (
               partition by runs.race_id
               order by prediction_runs.generated_at desc, runs.prediction_run_id desc
             ) as rank
      from runs
      join prediction_runs on prediction_runs.id = runs.prediction_run_id
    )
    select race_id, prediction_run_id from ranked where rank = 1
  `);
  return rows;
}

async function countSupersededPredictions(client, keep) {
  const { rows } = await client.query(
    `select count(*)::int as count
     from predictions p
     join unnest($1::text[], $2::uuid[]) as k(race_id, keep_run) on k.race_id = p.race_id
     where p.prediction_run_id is distinct from k.keep_run`,
    [keep.map((row) => row.race_id), keep.map((row) => row.prediction_run_id)],
  );
  return rows[0].count;
}

async function deleteSupersededPredictions(client, keep) {
  let deleted = 0;
  // Découpage par paquets de courses : une seule requête sur 12 000 courses
  // tiendrait un verrou trop longtemps et gonflerait le WAL d'un coup, alors
  // que la base est déjà au plafond.
  for (let index = 0; index < keep.length; index += 500) {
    const slice = keep.slice(index, index + 500);
    const result = await client.query(
      `delete from predictions p
       using unnest($1::text[], $2::uuid[]) as k(race_id, keep_run)
       where p.race_id = k.race_id
         and p.prediction_run_id is distinct from k.keep_run`,
      [slice.map((row) => row.race_id), slice.map((row) => row.prediction_run_id)],
    );
    deleted += result.rowCount;
    process.stdout.write(`\r  prédictions périmées supprimées : ${deleted}`);
  }
  process.stdout.write("\n");
  return deleted;
}

// ── 2. Relevés de cote sans mouvement ───────────────────────────────────────
const STALE_ODDS_CTE = `
  with sequence as (
    select id,
           odds,
           lag(odds) over (
             partition by race_id, horse_id, source
             order by observed_at, id
           ) as previous_odds
    from odds_snapshots
  )
`;

async function countStaleOddsSnapshots(client) {
  const { rows } = await client.query(
    `${STALE_ODDS_CTE}
     select count(*)::int as count
     from sequence
     where previous_odds is not null and previous_odds = odds`,
  );
  return rows[0].count;
}

async function deleteStaleOddsSnapshots(client, expected) {
  let deleted = 0;
  for (;;) {
    const result = await client.query(
      `${STALE_ODDS_CTE}
       delete from odds_snapshots o
       using (
         select id from sequence
         where previous_odds is not null and previous_odds = odds
         limit ${BATCH_SIZE}
       ) stale
       where stale.id = o.id`,
    );
    deleted += result.rowCount;
    process.stdout.write(`\r  relevés de cote redondants supprimés : ${deleted}/${expected}`);
    if (result.rowCount === 0) break;
  }
  process.stdout.write("\n");
  return deleted;
}

// ── 3. Récupération effective de l'espace ───────────────────────────────────
// Un DELETE ne rend pas les pages au stockage : sans réécriture, la taille du
// projet Neon reste au plafond et les écritures continuent d'échouer.
async function rewrite(client, table) {
  const started = Date.now();
  await client.query(`vacuum (full, analyze) ${table}`);
  console.log(`  ${table} réécrite en ${Math.round((Date.now() - started) / 1000)} s`);
}

async function main() {
  await loadLocalEnv();
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");

  const apply = process.argv.includes("--apply");
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();
  // Vrai dès que l'index de dérive des cotes a été retiré : il DOIT être
  // recréé avant de rendre la connexion, même si la suite a échoué.
  let indexDropped = false;

  try {
    await client.query("set statement_timeout = '30min'");
    const before = await databaseSize(client);
    console.log(`Taille de la base avant : ${before.pretty}`);

    const keep = await latestRunPerRace(client);
    const supersededCount = await countSupersededPredictions(client, keep);
    const staleCount = await countStaleOddsSnapshots(client);

    console.log(`Prédictions périmées       : ${supersededCount}`);
    console.log(`Relevés de cote redondants : ${staleCount}`);

    if (!apply) {
      console.log("\nSimulation — relancer avec --apply pour exécuter.");
      return;
    }

    // L'index (race_id, horse_id, observed_at) pèse plus lourd que la table
    // elle-même. On le retire d'abord : c'est la seule façon de dégager assez de
    // marge pour que VACUUM FULL puisse écrire sa copie sans buter sur le
    // plafond Neon. Il est recréé à la fin, sur une table trois fois plus petite.
    console.log("\nSuppression temporaire de odds_snapshots_race_horse_observed_idx…");
    indexDropped = true;
    await client.query("drop index if exists odds_snapshots_race_horse_observed_idx");
    // Doublon strict du préfixe de value_bets_race_horse_unique_idx, jamais lu.
    await client.query("drop index if exists value_bets_race_id_idx");
    console.log(`  taille après libération des index : ${(await databaseSize(client)).pretty}`);

    console.log("\nNettoyage des prédictions périmées…");
    const deletedPredictions = await deleteSupersededPredictions(client, keep);
    await rewrite(client, "predictions");

    console.log("\nNettoyage des relevés de cote sans mouvement…");
    const deletedOdds = await deleteStaleOddsSnapshots(client, staleCount);
    await rewrite(client, "odds_snapshots");

    const orphanRuns = await client.query(`
      delete from prediction_runs r
      where not exists (select 1 from predictions p where p.prediction_run_id = r.id)
    `);
    console.log(`\nprediction_runs orphelins supprimés : ${orphanRuns.rowCount}`);

    // L'index est recréé dans le `finally` ci-dessous : une erreur pendant le
    // VACUUM laissait auparavant la base sans index de dérive des cotes, et
    // chaque lecture de `odds_snapshots` partait en balayage complet.
    await recreateOddsIndex(client);
    indexDropped = false;

    const after = await databaseSize(client);
    console.log("\n─────────────────────────────────────────────");
    console.log(`Prédictions supprimées : ${deletedPredictions}`);
    console.log(`Cotes supprimées       : ${deletedOdds}`);
    console.log(`Taille avant           : ${before.pretty}`);
    console.log(`Taille après           : ${after.pretty}`);
    console.log(`Espace récupéré        : ${Math.round((before.bytes - after.bytes) / 1024 / 1024)} MB`);
  } finally {
    if (indexDropped) {
      try {
        await recreateOddsIndex(client);
      } catch (error) {
        console.error(
          "\n!!! ÉCHEC DE LA RECRÉATION DE odds_snapshots_race_horse_observed_idx !!!\n" +
            "La base est sans index de dérive des cotes. À recréer à la main :\n" +
            "  create index if not exists odds_snapshots_race_horse_observed_idx\n" +
            "  on odds_snapshots (race_id, horse_id, observed_at desc);\n",
          error,
        );
        process.exitCode = 1;
      }
    }
    client.release();
    await pool.end();
  }
}

/** Idempotent (`if not exists`) : appelé en fin de parcours normal ET dans le `finally`. */
async function recreateOddsIndex(client) {
  console.log("\nRecréation de l'index de dérive des cotes…");
  await client.query(`
    create index if not exists odds_snapshots_race_horse_observed_idx
    on odds_snapshots (race_id, horse_id, observed_at desc)
  `);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
