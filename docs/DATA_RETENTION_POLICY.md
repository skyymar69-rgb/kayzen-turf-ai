# KAYZEN TURF AI - Data Retention Policy

## Principle

Race data is a long-term product asset. KAYZEN TURF AI must retain historical race, runner, odds, prediction and result data indefinitely unless a legal, contractual or privacy requirement forces removal.

This database is not a rolling cache.

## Neon Plan Clarification

Neon has two concepts that must not be confused:

- **Application data retention**: the rows stored in PostgreSQL tables such as `races`, `entries`, `results`, `predictions`, `value_bets`. These rows remain until we delete them.
- **Restore / time-travel window**: the period during which Neon can restore the database to an earlier point in time. This is backup/history functionality, not deletion of application rows.

No script deletes races because of their age. The deletions that do exist are
listed exhaustively in "Deletions that do happen" below.

## Policy

- Keep all imported races by default.
- Keep all participants, odds snapshots, predictions and results by default.
- Never add an automatic deletion job based on age.
- If storage grows beyond the free tier, upgrade storage or move cold archives to cheaper object storage, but keep analytical access.
- Any deletion workflow must be explicit, reviewed and documented.

## Deletions that do happen

Every write path that removes rows, and the guard that bounds it:

- **`scripts/prune-race-scope.mjs`** (`npm run data:prune:scope`, run after
  each import by `import_pmu.yml`) deletes races whose country
  (`races.source_country`, falling back to `racecourses.country`) is outside
  the France/Equidia allowlist (`KAYZEN_ALLOWED_COUNTRIES`, default `FRA`),
  together with their entries and results through `on delete cascade`.
  Guards: an empty allowlist is refused (nothing is deleted), and a run that
  would remove more than 5 % of the races in the database aborts instead of
  deleting. An out-of-scope race is one the product never displays, so this is
  a scope decision, not retention.
- **`scripts/refresh-odds.mjs`** (`npm run data:refresh:odds`, every 30 min
  before the off) removes from `entries` the runners the PMU API no longer
  lists as `PARTANT` — declared non-runners. A phantom runner distorts the
  de-vigged probabilities of every real runner, so it must go. Guard: if the
  API returns fewer than 70 % of the runners known in the database for that
  race, the response is treated as truncated and nothing is deleted.
- **`scripts/import-pmu-day.mjs`** replaces the `results` rows of a race, in a
  single transaction, each time the API publishes an arrival (provisional then
  final). Positions are replaced, never lost.
- **`scripts/compact-storage.mjs`**, described below, removes redundancy only.

## Storage Strategy

Phase 1:

- Store all production data in Neon Postgres.
- Monitor database size, race counts and min/max race dates.

Phase 2:

- Add monthly partitions or archive tables if query volume grows.
- Keep recent data in hot tables and older data in read-optimized historical tables.

Phase 3:

- Export immutable raw source snapshots to object storage.
- Keep normalized analytical tables in Postgres.
- Train models from full historical exports.

## Redundancy Compaction (approved deletion workflow)

Retaining history is not the same as retaining duplicates. The import workflow
runs three times a day over a rolling three-day window, so every race day is
re-imported about nine times. `entries` and `value_bets` are upserted, but
`predictions` and `odds_snapshots` used to be inserted blindly — producing nine
near-identical copies per runner. On 2026-08-16 this filled the 512 MB Neon
project limit and every write started failing with
`could not extend file because project size limit has been exceeded`.

Two changes address it:

- `scripts/import-pmu-day.mjs` no longer writes `prediction_runs`,
  `predictions` or `value_bets` at all (nothing in the application reads
  them), and only records an odds snapshot when the odds actually moved.
- `npm run db:compact` removes the redundancy already stored, then rewrites the
  affected tables so the pages are returned to Neon.

```bash
npm run db:compact            # simulation, no write
npm run db:compact -- --apply # execution
```

The compaction runs automatically every Sunday at 02:00 UTC through
`.github/workflows/compact_storage.yml`. It shares the `pmu-database`
concurrency group with `import_pmu.yml`, so the two never overlap: the
compaction temporarily drops the odds-drift index and holds a `VACUUM FULL`.
The index is recreated in a `finally` block even if the compaction fails
midway, and the job exits non-zero if that recreation itself fails.

The compaction deletes **no race, no runner, no result and no distinct market
observation**. It removes superseded predictions, odds re-recorded at an
unchanged value, and orphan `prediction_runs`. First odds, last odds and every
price level are preserved, so drift analysis is unaffected.

This is the explicit, reviewed and documented deletion workflow the policy
requires. It is not age-based and must never become one.

## Monitoring

Use:

```bash
npm run db:stats
```

The script reports:

- database size
- race count
- entry count
- odds snapshot count
- results count
- earliest race date
- latest race date

## Non-Goals

- No 30/60/90-day retention limit.
- No automatic pruning of old races.
- No reliance on local machine storage.

