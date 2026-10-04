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
cp .env.example .env.local   # optional: every variable is documented there, all commented out
npm run dev
```

No variable is required locally: without `DATABASE_URL` the app runs in demo mode on fictitious races. `.env.example` lists every environment variable read by `src/` and `scripts/`; uncomment only the ones you need (an empty value is not the same as an absent one).

Tests (Node's built-in `node:test` run through `tsx`, no framework — they cover the pure helpers of `scripts/lib/` and `src/lib/`: profiles, market reading, strategies, live cadence, payouts, rate limiting):

```bash
npm test
```

Coverage of `src/lib/` (Node's experimental built-in coverage, no extra dependency):

```bash
npm run test:coverage
```

Target: **80 % of lines on `src/lib/`**. It is not enforced in CI yet (about 66 % today); only files imported by at least one test appear in the report, so an untested module lowers nothing until it gets its first test.

End-to-end tests (Playwright, Chromium only, in `e2e/` — separate from `npm test`). They build and start the production server on port 3100 in demo mode (or reuse one already running there), walk the main flows (programme → race → table tabs, `/pronostics`, content pages, push-alerts toggle) and run an axe-core accessibility audit that fails on serious or critical violations:

```bash
npx playwright install chromium   # once
npm run test:e2e
```

CI runs them in a separate `e2e` job after the main `verify` job and uploads the HTML report when they fail.

Server errors are reported without any third-party service: `src/instrumentation.ts` (`onRequestError`) writes one JSON line per error (`"kind":"request-error"`, route, method, path without query string, digest, truncated message) to the runtime logs.

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

The market is the best predictor we have, but only close to the start (37.6 % of winners found with the starting price versus 31.0 % with odds 6-12 h old, see `scripts/evaluate-freshness.mjs`). GitHub does not guarantee scheduled-run times (8 real runs out of 60 planned between 30/09 and 02/10/2026), so each `live_refresh.yml` run executes a 5.5-hour loop (`scripts/live-refresh.ts`) and then dispatches the next run itself; the cron (every 2 h) only restarts the chain if it breaks. Outside race hours the loop sleeps without querying the database. Each race starting within 90 minutes is refreshed through `src/lib/live/refresh-race.ts` — odds, pool shares, speed figures, declared non-runners — at most every 15 min beyond H-60, every 4 min until H-15, every 45 s in the last quarter of an hour. The same module serves the "Relancer l'analyse IA" button on race pages (available until the off, automatic every minute in the last ten), after which the page shows what changed (`src/lib/analysis-diff.ts`). History is written sparingly (`odds_snapshots`, `pool_snapshots`) and the prediction displayed at H-60, H-15 and just before the off is frozen in `prediction_snapshots`. It never creates races.

```bash
npm run data:refresh:live -- --once          # one pass, locally
npm run data:refresh:live -- --minutes 30    # 30-minute loop
```

A weekly `compact_storage.yml` (Sunday 02:00 UTC) runs `npm run db:compact -- --apply`; it shares a concurrency group with the import so the two never overlap.

## Prediction, proof and tracking (October 2026)

Two independent opinions are compared on every runner:

- **the market** — PMU odds, overround removed (`devig` in `src/lib/probability.ts`);
- **the AI** — `src/lib/fundamental/`, a conditional logit per discipline that never sees the odds (form, earnings, age, sex, jockey and trainer strike rates, trot handicap distance, draw). Trained by `npx tsx scripts/train-fundamental.ts` on races before the cutoff stored in `model.json`, measured on the following months.

The displayed probability blends both (`MODEL_WEIGHT = 0.10`). `src/lib/profiles.ts` is the single source for runner profiles (Base, Caché, Value, Favori, Outsider, Tocard, À éviter) and the race reading (lisible / ouverte / piège); the course page, the dashboard, the frozen predictions and the backtest all read it. Every rule and threshold is published on `/methode`.

Proof:

```bash
npx tsx scripts/backtest.ts --dry-run            # odds known 15 min before the off, official PMU payouts, 90 % bootstrap
npx tsx scripts/backtest.ts --dry-run --dump f.json   # every evaluated runner, to explore thresholds
node scripts/backfill-payouts.mjs --from 2026-04-01   # official payouts for past races
node scripts/check-freshness.mjs                 # did a race start without fresh odds today?
```

`track_record.yml` stores a report every night in `track_record_reports`; `/track-record` publishes it, negative results included, with the live tracking of frozen predictions (`prediction_snapshots`, stage H-2). `freshness_check.yml` fails — and GitHub emails — when more than 10 % of the day's races started without odds observed in the 20 minutes before the off.

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
