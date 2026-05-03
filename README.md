# KAYZEN TURF AI

Open source SaaS starter for predictive horse racing analytics, value bet detection, bankroll simulation, and explainable AI recommendations.

## Stack

- Next.js App Router
- React
- TypeScript
- Tailwind CSS
- Recharts
- Lucide React
- Neon Postgres compatible data layer

The technical stack is based on open source packages. The product can still be commercialized through subscriptions, API access, and B2B licensing.

## Local Development

```bash
npm install
npm run dev
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

By default, imports keep French races only. Override with `KAYZEN_ALLOWED_COUNTRIES=FRA,GBR,AUS` only if the product scope changes later.

This connector uses the publicly reachable PMU JSON programme endpoint with a clear user agent, no bot evasion, and a short delay between race participant requests. For commercial scale, validate usage rights or replace it with an authorised PMU partner feed.

## Cloud Automation

The full PMU programme import runs from GitHub Actions, not from a local machine:

- `04:30 UTC`: morning import for J-1/J/J+1
- `10:30 UTC`: mid-day refresh
- `17:30 UTC`: evening refresh and result catch-up

Required GitHub secret:

- `DATABASE_URL`

Manual trigger:

```bash
gh workflow run import_pmu.yml -f date=03052026
```

## MVP API

- `GET /api/predictions`
- `GET /api/races`
- `GET /api/race-analysis`
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

## Responsible Gaming

KAYZEN TURF AI is a decision-support product, not a guarantee of profit. The application must keep clear risk disclaimers, responsible gaming messages, and transparent AI explanations.
