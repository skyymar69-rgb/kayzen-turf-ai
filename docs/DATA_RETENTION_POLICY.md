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

