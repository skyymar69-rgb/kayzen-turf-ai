# KAYZEN TURF AI - Data Retention Policy

## Principle

Race data is a long-term product asset. KAYZEN TURF AI must retain historical race, runner, odds, prediction and result data indefinitely unless a legal, contractual or privacy requirement forces removal.

This database is not a rolling cache.

## Neon Plan Clarification

Neon has two concepts that must not be confused:

- **Application data retention**: the rows stored in PostgreSQL tables such as `races`, `entries`, `results`, `predictions`, `value_bets`. These rows remain until we delete them.
- **Restore / time-travel window**: the period during which Neon can restore the database to an earlier point in time. This is backup/history functionality, not deletion of application rows.

The current schema and import scripts do not delete old races.

## Policy

- Keep all imported races by default.
- Keep all participants, odds snapshots, predictions and results by default.
- Never add an automatic deletion job based on age.
- If storage grows beyond the free tier, upgrade storage or move cold archives to cheaper object storage, but keep analytical access.
- Any deletion workflow must be explicit, reviewed and documented.

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

- `scripts/import-pmu-day.mjs` now replaces the previous `prediction_run` for a
  race instead of stacking a new one, and only records an odds snapshot when the
  odds actually moved.
- `npm run db:compact` removes the redundancy already stored, then rewrites the
  affected tables so the pages are returned to Neon.

```bash
npm run db:compact            # simulation, no write
npm run db:compact -- --apply # execution
```

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

