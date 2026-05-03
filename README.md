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

If `DATABASE_URL` is missing, the app falls back to the built-in mock dataset so development and Vercel previews keep working.

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
