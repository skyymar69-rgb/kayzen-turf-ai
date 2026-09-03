# KAYZEN TURF AI

Open source SaaS starter for predictive horse racing analytics, value bet detection, bankroll simulation, and explainable AI recommendations.

## Stack

- Next.js App Router
- React
- TypeScript
- Tailwind CSS
- Lucide React
- Neon Postgres compatible data layer

The technical stack is based on open source packages. The product can still be commercialized through subscriptions, API access, and B2B licensing.

## Local Development

```bash
npm install
npm run dev
```

Tests (Node's built-in `node:test`, no framework — they cover the pure helpers of `scripts/lib/`):

```bash
npm test
```

## Database

The app is ready for Neon Postgres through `DATABASE_URL`.

- Schema: `db/schema.sql`
- Demo seed placeholder: `db/seed-demo.sql`
- Runtime data access: `src/lib/race-repository.ts`
- Retention policy: `docs/DATA_RETENTION_POLICY.md`

If `DATABASE_URL` is missing, the app falls back to the built-in mock dataset so development and Vercel previews keep working.

Database stats:

```bash
npm run db:stats
```

## Real Data Import

Experimental PMU import:

```bash
npm run data:import:pmu -- --date 03052026 --max-races 10
```

Full PMU programme import for a day:

```bash
npm run data:import:pmu -- --date 03052026
```

Race scope cleanup:

```bash
npm run data:prune:scope
```

Auto-learning from official arrivals:

```bash
npm run model:learn
```

By default, imports keep French races only. Override with `KAYZEN_ALLOWED_COUNTRIES=FRA,GBR,AUS` only if the product scope changes later.

This connector uses the publicly reachable PMU JSON programme endpoint with a clear user agent, no bot evasion, and a short delay between race participant requests. For commercial scale, validate usage rights or replace it with an authorised PMU partner feed.

## Cloud Automation

The full PMU programme import runs from GitHub Actions, not from a local machine:

- `04:30 UTC`: morning import for J-1/J/J+1
- `10:30 UTC`: mid-day refresh
- `17:30 UTC`: evening refresh and result catch-up

After each import, the workflow prunes out-of-scope races, stores post-race feedback, selects the best active scoring profile by segment (`DEFAULT`, `QUARTE_PLUS`, `QUINTE_PLUS`) and applies it only to races without official results.

Required GitHub secret:

- `DATABASE_URL`

Manual trigger:

```bash
gh workflow run import_pmu.yml -f date=03052026
```

### Odds refresh before the off

The market is the best predictor we have, but only close to the start (37.6 % of winners found with the starting price versus 31.0 % with odds 6-12 h old, see `scripts/evaluate-freshness.mjs`). `refresh_odds.yml` therefore runs every 30 minutes from 07:05 to 22:35 UTC and refreshes `entries.odds` for the races starting within the next 45 minutes — plus the late-published speed figures and pool shares — and removes declared non-runners. It never creates races.

```bash
npm run data:refresh:odds -- --window 90   # locally, 90-minute window
npm run data:refresh:odds -- --dry-run     # no write
```

A weekly `compact_storage.yml` (Sunday 02:00 UTC) runs `npm run db:compact -- --apply`; it shares a concurrency group with the import so the two never overlap.

## MVP API

- `GET /api/predictions`
- `GET /api/races`
- `GET /api/race-analysis`
- `GET /api/bet-recommendations`
- `GET /api/post-race-analysis`
- `GET /api/value-bets`
- `POST /api/simulate`
- `POST /api/simulate-bet`
- `GET /api/model-card`

## Product Principles Borrowed From Research

- Separate race pre-filtering from horse-level prediction.
- Use fair odds and market edge instead of raw rankings.
- Use fractional Kelly sizing with drawdown throttling.
- Validate models with temporal splits and leakage checks before using live data.
- Keep responsible gaming and uncertainty visible in the product.

## Architecture

See [`docs/INSTITUTIONAL_SYSTEM_DESIGN.md`](docs/INSTITUTIONAL_SYSTEM_DESIGN.md) for the full institutional-grade system design: data engine, AI engine, scoring, database structure, API/MCP, compliance, and roadmap.

## Archived research code

`research/` holds the former Python tree (agents, pace, portfolio, drift models, `promote_challenger.py`). It is not deployed, not maintained and not wired to the site; see `research/README.md` before running any of it — never against production.

## Responsible Gaming

KAYZEN TURF AI is a decision-support product, not a guarantee of profit. The application must keep clear risk disclaimers, responsible gaming messages, and transparent AI explanations.
