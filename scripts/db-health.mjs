#!/usr/bin/env node
/**
 * Diagnostic de santé de la base, en lecture seule.
 *
 * Répond aux questions d'exploitation qu'on se pose quand une page rame ou que
 * la base grossit : quelles requêtes coûtent le plus cher, quels index ne
 * servent à rien, quelles tables sont parcourues séquentiellement alors
 * qu'elles sont volumineuses, où s'accumulent les tuples morts.
 *
 * Aucune écriture, aucune création d'index : le script recommande, il n'applique
 * pas. Les décisions de schéma restent explicites et versionnées dans db/schema.sql.
 *
 * Usage : node scripts/db-health.mjs
 */

import { neon } from "@neondatabase/serverless";
import { readFileSync } from "node:fs";

function databaseUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const env = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
  return (env.match(/^DATABASE_URL=(.+)$/m)?.[1] ?? "").trim().replace(/^["']|["']$/g, "");
}

const sql = neon(databaseUrl());

function section(title) {
  console.log(`\n${"─".repeat(72)}\n${title}\n${"─".repeat(72)}`);
}

section("Volumétrie et tuples morts");
console.table(
  (await sql`
    select
      relname as table,
      n_live_tup as lignes,
      n_dead_tup as tuples_morts,
      case when n_live_tup > 0 then round(100.0 * n_dead_tup / n_live_tup, 1) else 0 end as pct_morts,
      pg_size_pretty(pg_total_relation_size(relid)) as taille,
      pg_size_pretty(pg_indexes_size(relid)) as index
    from pg_stat_user_tables
    order by pg_total_relation_size(relid) desc
    limit 15
  `).map((r) => ({ ...r, pct_morts: `${r.pct_morts} %` })),
);

section("Index jamais utilisés (candidats à la suppression)");
const unused = await sql`
  select
    s.relname as table,
    s.indexrelname as index,
    s.idx_scan as lectures,
    pg_size_pretty(pg_relation_size(s.indexrelid)) as taille
  from pg_stat_user_indexes s
  join pg_index i on i.indexrelid = s.indexrelid
  where s.idx_scan = 0
    and not i.indisunique
    and not i.indisprimary
  order by pg_relation_size(s.indexrelid) desc
`;
console.table(unused.length ? unused : [{ résultat: "aucun index inutilisé" }]);

section("Tables lues séquentiellement alors qu'elles sont volumineuses");
console.table(await sql`
  select
    relname as table,
    seq_scan as parcours_complets,
    idx_scan as parcours_index,
    n_live_tup as lignes,
    case when seq_scan + coalesce(idx_scan, 0) > 0
      then round(100.0 * seq_scan / (seq_scan + coalesce(idx_scan, 0)), 1)
      else 0 end as pct_sequentiel
  from pg_stat_user_tables
  where n_live_tup > 5000
  order by seq_scan desc
  limit 10
`);

section("Index existants par table");
console.table(await sql`
  select
    tablename as table,
    count(*)::int as index,
    string_agg(indexname, ', ' order by indexname) as noms
  from pg_indexes
  where schemaname = 'public'
  group by tablename
  order by count(*) desc
  limit 12
`);

section("Requêtes les plus coûteuses");
const hasStatements = await sql`select count(*)::int as n from pg_extension where extname = 'pg_stat_statements'`;
if (hasStatements[0].n === 0) {
  console.log("  pg_stat_statements n'est pas activée — pas de classement des requêtes.");
  console.log("  Sur Neon : activer l'extension puis relancer (create extension pg_stat_statements).");
} else {
  console.table(await sql`
    select
      round(total_exec_time::numeric) as ms_total,
      calls as appels,
      round(mean_exec_time::numeric, 1) as ms_moyen,
      left(regexp_replace(query, '\\s+', ' ', 'g'), 90) as requete
    from pg_stat_statements
    order by total_exec_time desc
    limit 12
  `);
}

section("Réglages de maintenance automatique");
console.table(await sql`
  select name, setting, unit
  from pg_settings
  where name in ('autovacuum', 'autovacuum_vacuum_scale_factor', 'autovacuum_analyze_scale_factor', 'statement_timeout', 'idle_in_transaction_session_timeout')
  order by name
`);
