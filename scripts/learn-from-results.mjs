import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { neon } from "@neondatabase/serverless";

const MODEL_VERSION = "kayzen-feedback-v0.2";

const CANDIDATES = [
  {
    name: "baseline",
    weights: { win: 1.35, top3: 0.35, top5: 0.0, edge: 0.25, edgeCap: 95, volatility: 0.0 },
  },
  {
    name: "place-top5",
    weights: { win: 0.8, top3: 0.75, top5: 0.35, edge: 0.06, edgeCap: 35, volatility: 0.0 },
  },
  {
    name: "quinte-coverage",
    weights: { win: 0.65, top3: 0.9, top5: 0.45, edge: 0.04, edgeCap: 25, volatility: 0.08 },
  },
  {
    name: "balanced",
    weights: { win: 1.0, top3: 0.6, top5: 0.25, edge: 0.1, edgeCap: 45, volatility: 0.04 },
  },
  {
    name: "value-capped",
    weights: { win: 1.05, top3: 0.55, top5: 0.25, edge: 0.14, edgeCap: 30, volatility: 0.06 },
  },
];

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
    // CI/Vercel can provide DATABASE_URL directly.
  }
}

function parseArgs() {
  const args = process.argv.slice(2);
  return {
    apply: args.includes("--apply"),
    segment: valueAfter(args, "--segment"),
  };
}

function valueAfter(args, key) {
  const index = args.indexOf(key);
  return index === -1 ? null : args[index + 1] ?? null;
}

async function ensureLearningSchema(sql) {
  await sql.query(`
    create table if not exists model_calibrations (
      id uuid primary key default gen_random_uuid(),
      segment text not null,
      model_version text not null,
      weights jsonb not null,
      metrics jsonb not null default '{}'::jsonb,
      learned_from_races integer not null default 0,
      active boolean not null default true,
      created_at timestamptz not null default now()
    )
  `);
  await sql.query(`
    create table if not exists race_feedback (
      id uuid primary key default gen_random_uuid(),
      race_id text not null references races(id) on delete cascade,
      segment text not null,
      predicted_top5 integer[] not null default '{}',
      actual_top5 integer[] not null default '{}',
      winner_hit boolean not null default false,
      top3_hits integer not null default 0,
      top5_hits integer not null default 0,
      average_position_error numeric,
      verdict text not null,
      lessons jsonb not null default '[]'::jsonb,
      created_at timestamptz not null default now(),
      unique (race_id, segment)
    )
  `);
  await sql.query("create index if not exists model_calibrations_active_idx on model_calibrations (segment, active, created_at desc)");
  await sql.query("create index if not exists race_feedback_race_id_idx on race_feedback (race_id)");
}

async function loadCompletedRaces(sql) {
  const rows = await sql`
    select
      r.id,
      r.race_date::text as race_date,
      r.reunion_number,
      r.course_number,
      r.name,
      r.market_volatility::float as market_volatility,
      r.bet_types,
      jsonb_agg(
        jsonb_build_object(
          'entryId', e.id,
          'horseId', e.horse_id,
          'number', e.number,
          'win', e.win_probability::float,
          'top3', e.top3_probability::float,
          'top5', e.top5_probability::float,
          'edge', e.market_edge::float,
          'kz', e.kz_score::float,
          'finish', res.finish_position
        )
        order by e.number
      ) as entries
    from races r
    join entries e on e.race_id = r.id
    join results res on res.race_id = r.id and res.horse_id = e.horse_id
    group by r.id
    having count(res.finish_position) >= 3
    order by r.race_date, r.reunion_number, r.course_number
  `;

  return rows.map((race) => ({
    ...race,
    betTypes: parseJson(race.bet_types),
    entries: parseJson(race.entries),
  }));
}

function parseJson(value) {
  if (Array.isArray(value)) return value;
  if (!value) return [];
  if (typeof value === "object") return value;
  try {
    return JSON.parse(value);
  } catch {
    return [];
  }
}

function segmentFor(race) {
  const offers = race.betTypes ?? [];
  if (offers.some((offer) => offer.type === "QUINTE_PLUS")) return "QUINTE_PLUS";
  if (offers.some((offer) => offer.type === "QUARTE_PLUS")) return "QUARTE_PLUS";
  return "DEFAULT";
}

function scoreEntry(entry, weights, race) {
  const cappedEdge = Math.min(Math.max(Number(entry.edge) || 0, 0), weights.edgeCap);
  const raw =
    Number(entry.win) * weights.win +
    Number(entry.top3) * weights.top3 +
    Number(entry.top5) * weights.top5 +
    cappedEdge * weights.edge -
    Number(race.market_volatility ?? 0) * weights.volatility;

  return Math.max(1, Math.min(99, Math.round(raw)));
}

function rankEntries(race, weights) {
  return race.entries
    .slice()
    .sort(
      (a, b) =>
        scoreEntry(b, weights, race) - scoreEntry(a, weights, race) ||
        Number(b.win) - Number(a.win) ||
        Number(b.top3) - Number(a.top3),
    );
}

function evaluateRace(race, weights) {
  const predicted = rankEntries(race, weights);
  const actual = race.entries
    .filter((entry) => Number(entry.finish) > 0)
    .sort((a, b) => Number(a.finish) - Number(b.finish));
  const predictedTop3 = predicted.slice(0, 3).map((entry) => Number(entry.number));
  const predictedTop5 = predicted.slice(0, 5).map((entry) => Number(entry.number));
  const actualTop3 = actual.slice(0, 3).map((entry) => Number(entry.number));
  const actualTop5 = actual.slice(0, 5).map((entry) => Number(entry.number));
  const winnerHit = predicted[0] && actual[0] && Number(predicted[0].number) === Number(actual[0].number);
  const top3Hits = intersectionCount(predictedTop3, actualTop3);
  const top5Hits = intersectionCount(predictedTop5, actualTop5);
  const predictedRanks = new Map(predicted.map((entry, index) => [Number(entry.number), index + 1]));
  const errors = actualTop5.map((number, index) => Math.abs((predictedRanks.get(number) ?? predicted.length + 1) - (index + 1)));
  const averagePositionError = errors.length ? round(errors.reduce((sum, value) => sum + value, 0) / errors.length, 2) : null;

  return {
    actualTop5,
    averagePositionError,
    predictedTop5,
    top3Hits,
    top5Hits,
    winnerHit,
  };
}

function intersectionCount(left, right) {
  const rightSet = new Set(right);
  return left.filter((value) => rightSet.has(value)).length;
}

function evaluateCandidate(races, candidate) {
  const evaluations = races.map((race) => evaluateRace(race, candidate.weights));
  const count = evaluations.length || 1;
  const winnerHitRate = evaluations.filter((item) => item.winnerHit).length / count;
  const avgTop3 = evaluations.reduce((sum, item) => sum + item.top3Hits, 0) / count;
  const avgTop5 = evaluations.reduce((sum, item) => sum + item.top5Hits, 0) / count;
  const avgError =
    evaluations.reduce((sum, item) => sum + (item.averagePositionError ?? 8), 0) / count;
  const objective = winnerHitRate * 2.2 + avgTop3 * 1.3 + avgTop5 * 1.8 - avgError * 0.22;

  return {
    ...candidate,
    metrics: {
      averagePositionError: round(avgError, 2),
      averageTop3Hits: round(avgTop3, 2),
      averageTop5Hits: round(avgTop5, 2),
      objective: round(objective, 4),
      races: evaluations.length,
      winnerHitRate: round(winnerHitRate, 3),
    },
  };
}

function bestCandidate(races) {
  return CANDIDATES.map((candidate) => evaluateCandidate(races, candidate))
    .sort((a, b) => b.metrics.objective - a.metrics.objective)[0];
}

async function saveFeedback(sql, races, candidate) {
  for (const race of races) {
    const feedback = evaluateRace(race, candidate.weights);
    const verdict = feedback.winnerHit && feedback.top5Hits >= 3 ? "Bon signal" : feedback.top5Hits >= 2 ? "Partiel" : "Erreur modèle";
    const lessons = lessonsFor(race, feedback);
    await sql`
      insert into race_feedback (
        race_id, segment, predicted_top5, actual_top5, winner_hit, top3_hits,
        top5_hits, average_position_error, verdict, lessons
      )
      values (
        ${race.id}, ${segmentFor(race)}, ${feedback.predictedTop5}, ${feedback.actualTop5},
        ${feedback.winnerHit}, ${feedback.top3Hits}, ${feedback.top5Hits},
        ${feedback.averagePositionError}, ${verdict}, ${JSON.stringify(lessons)}
      )
      on conflict (race_id, segment) do update set
        predicted_top5 = excluded.predicted_top5,
        actual_top5 = excluded.actual_top5,
        winner_hit = excluded.winner_hit,
        top3_hits = excluded.top3_hits,
        top5_hits = excluded.top5_hits,
        average_position_error = excluded.average_position_error,
        verdict = excluded.verdict,
        lessons = excluded.lessons,
        created_at = now()
    `;
  }
}

function lessonsFor(race, feedback) {
  const lessons = [];
  if (feedback.top5Hits < 2) {
    lessons.push("Réduire la confiance des tickets ordre et privilégier une couverture élargie.");
  }
  if (feedback.predictedTop5.length && feedback.actualTop5.some((number) => !feedback.predictedTop5.includes(number))) {
    lessons.push("Remonter le poids Top 3 / Top 5 lorsque le segment comporte des paris Quinté, Quarté ou Multi.");
  }
  if (Number(race.market_volatility) >= 24) {
    lessons.push("Course volatile : plafonner l'effet value bet pour éviter de surclasser des outsiders trop fragiles.");
  }
  if (lessons.length === 0) lessons.push("Calibration cohérente sur ce profil de course.");
  return lessons;
}

async function saveCalibration(sql, segment, candidate, learnedFromRaces) {
  await sql`
    update model_calibrations
    set active = false
    where segment = ${segment}
  `;
  await sql`
    insert into model_calibrations (segment, model_version, weights, metrics, learned_from_races, active)
    values (
      ${segment},
      ${MODEL_VERSION},
      ${JSON.stringify({ name: candidate.name, ...candidate.weights })},
      ${JSON.stringify(candidate.metrics)},
      ${learnedFromRaces},
      true
    )
  `;
}

async function applyCalibration(sql, segment, candidate) {
  const rows = await sql`
    select
      r.id as race_id,
      r.market_volatility::float as market_volatility,
      r.bet_types,
      e.id as entry_id,
      e.win_probability::float as win,
      e.top3_probability::float as top3,
      e.top5_probability::float as top5,
      e.market_edge::float as edge
    from races r
    join entries e on e.race_id = r.id
    where not exists (
      select 1
      from results res
      where res.race_id = r.id
    )
  `;

  const scopedRows = rows.filter((row) => segmentFor({ betTypes: parseJson(row.bet_types) }) === segment);

  for (const row of scopedRows) {
    const kzScore = scoreEntry(row, candidate.weights, row);
    await sql`
      update entries
      set
        kz_score = ${kzScore},
        value_index = least(greatest(market_edge, -40), ${candidate.weights.edgeCap})
      where id = ${row.entry_id}
    `;
  }

  return scopedRows.length;
}

function round(value, decimals) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function groupBySegment(races) {
  const groups = new Map();
  for (const race of races) {
    const segment = segmentFor(race);
    const group = groups.get(segment) ?? [];
    group.push(race);
    groups.set(segment, group);
  }

  const all = races.slice();
  if (!groups.has("DEFAULT")) groups.set("DEFAULT", all);
  return groups;
}

async function main() {
  await loadLocalEnv();
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");

  const { apply, segment: onlySegment } = parseArgs();
  const sql = neon(process.env.DATABASE_URL);
  await ensureLearningSchema(sql);
  const completedRaces = await loadCompletedRaces(sql);
  const groups = groupBySegment(completedRaces);
  const report = [];

  for (const [segment, races] of groups.entries()) {
    if (onlySegment && onlySegment !== segment) continue;
    if (races.length === 0) continue;
    const candidate = bestCandidate(races);
    await saveFeedback(sql, races, candidate);
    await saveCalibration(sql, segment, candidate, races.length);
    const updatedEntries = apply ? await applyCalibration(sql, segment, candidate) : 0;
    report.push({
      segment,
      candidate: candidate.name,
      learnedFromRaces: races.length,
      updatedEntries,
      ...candidate.metrics,
      weights: candidate.weights,
    });
  }

  console.table(
    report.map((item) => {
      const row = { ...item };
      delete row.weights;
      return row;
    }),
  );
  console.log(JSON.stringify(report, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
