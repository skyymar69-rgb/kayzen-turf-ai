import { getSql, hasDatabase } from "@/lib/db";
import { raceAnalysis, raceCards, valueBets } from "@/lib/mock-data";
import type { BetOffer, Confidence, HorsePrediction, RaceAnalysis } from "@/lib/types";

type RaceRow = {
  id: string;
  race_date: string;
  relative_day: RaceAnalysis["relativeDay"];
  reunion_number: number | null;
  course_number: number | null;
  source_country: string | null;
  name: string;
  racecourse: string;
  start_time: string;
  discipline: RaceAnalysis["discipline"];
  specialty: string | null;
  distance: string;
  going: string;
  weather: string;
  market_volatility: string;
  model_consensus: string;
  race_quality_score: string;
  betting_tier: RaceAnalysis["bettingTier"];
  risk_level: RaceAnalysis["riskLevel"];
  bet_types: BetOffer[] | string | null;
};

type EntryRow = {
  id: string;
  number: number;
  horse: string;
  age: number | null;
  sex: string | null;
  music: string | null;
  earnings: string | null;
  handicap_distance: number | null;
  reduction_km: string | null;
  equipment: string | null;
  silks_url: string | null;
  jockey: string;
  trainer: string;
  odds: string;
  fair_odds: string;
  market_edge: string;
  win_probability: string;
  top3_probability: string;
  top5_probability: string;
  kz_score: string;
  value_index: string;
  confidence: Confidence;
  factors: string[] | string;
  finish_position: number | null;
  won: boolean | null;
};

export async function getRaces(filters?: { date?: string | null; day?: string | null }) {
  const filterDate = filters?.date ?? (filters?.day ? dateForRelativeDay(filters.day) : null);
  const rollingDates = [dateForRelativeDay("yesterday"), dateForRelativeDay("today"), dateForRelativeDay("tomorrow")].filter(Boolean);

  if (!hasDatabase()) {
    return raceCards.filter((race) => {
      if (filterDate && race.raceDate !== filterDate) return false;
      if (!filterDate && !filters?.day && !rollingDates.includes(race.raceDate)) return false;
      if (filters?.day && relativeDayFromDate(race.raceDate) !== filters.day) return false;
      return true;
    });
  }

  let rows: RaceRow[] = [];

  try {
    const sql = getSql();
    rows = await sql`
      select
        races.id,
        races.race_date::text,
        races.relative_day,
        races.reunion_number,
        races.course_number,
        coalesce(races.source_country, racecourses.country, 'N/A') as source_country,
        races.name,
        racecourses.name as racecourse,
        races.start_time,
        races.discipline,
        races.specialty,
        races.distance,
        races.going,
        races.weather,
        races.market_volatility::text,
        races.model_consensus::text,
        races.race_quality_score::text,
        races.betting_tier,
        races.risk_level,
        races.bet_types
      from races
      left join racecourses on racecourses.id = races.racecourse_id
      where
        (${filterDate ?? null}::text is not null and races.race_date = ${filterDate ?? null}::date)
        or (
          ${filterDate ?? null}::text is null
          and races.race_date = any(${rollingDates}::date[])
        )
      order by races.race_date, races.start_time, races.reunion_number nulls last, races.course_number nulls last
    ` as RaceRow[];
  } catch {
    return raceCards;
  }

  const races = await Promise.all(rows.map((row) => getRaceById(row.id, row)));
  const hydratedRaces = races.filter((race): race is RaceAnalysis => Boolean(race));

  return sortByStartTime(hydratedRaces);
}

export async function getRaceById(id?: string | null, baseRow?: RaceRow, options: { fallback?: boolean } = {}) {
  const fallback = options.fallback ?? true;

  if (!hasDatabase()) {
    if (!id) return fallback ? raceAnalysis : null;
    return raceCards.find((race) => race.id === id) ?? (fallback ? raceAnalysis : null);
  }

  const sql = getSql();
  let row: RaceRow | undefined = baseRow;

  try {
    row ??= (await sql`
      select
        races.id,
        races.race_date::text,
        races.relative_day,
        races.reunion_number,
        races.course_number,
        coalesce(races.source_country, racecourses.country, 'N/A') as source_country,
        races.name,
        racecourses.name as racecourse,
        races.start_time,
        races.discipline,
        races.specialty,
        races.distance,
        races.going,
        races.weather,
        races.market_volatility::text,
        races.model_consensus::text,
        races.race_quality_score::text,
        races.betting_tier,
        races.risk_level,
        races.bet_types
      from races
      left join racecourses on racecourses.id = races.racecourse_id
      where races.id = ${id ?? raceAnalysis.id}
      limit 1
    ` as RaceRow[])[0];
  } catch {
    return raceCards.find((race) => race.id === id) ?? (fallback ? raceAnalysis : null);
  }

  if (!row) return raceCards.find((race) => race.id === id) ?? (fallback ? raceAnalysis : null);

  const entries = await sql`
    select
      entries.id,
      entries.number,
      horses.name as horse,
      coalesce(entries.age, horses.age) as age,
      entries.sex,
      entries.music,
      entries.earnings::text,
      entries.handicap_distance,
      entries.reduction_km,
      entries.equipment,
      entries.silks_url,
      jockeys.name as jockey,
      trainers.name as trainer,
      entries.odds::text,
      entries.fair_odds::text,
      entries.market_edge::text,
      entries.win_probability::text,
      entries.top3_probability::text,
      entries.top5_probability::text,
      entries.kz_score::text,
      entries.value_index::text,
      entries.confidence,
      entries.factors,
      results.finish_position,
      results.won
    from entries
    join horses on horses.id = entries.horse_id
    left join jockeys on jockeys.id = entries.jockey_id
    left join trainers on trainers.id = entries.trainer_id
    left join results on results.race_id = entries.race_id and results.horse_id = entries.horse_id
    where entries.race_id = ${row.id}
    order by entries.kz_score desc
  ` as EntryRow[];

  return entries.length > 0 ? mapRace(row, entries) : raceCards.find((race) => race.id === row.id) ?? (fallback ? raceAnalysis : null);
}

export async function getPredictions() {
  const races = await getRaces();
  return races
    .flatMap((race) => race.horses.map((horse) => ({ ...horse, raceId: race.id, raceName: race.name })))
    .sort((a, b) => b.kzScore - a.kzScore);
}

export async function getValueBets() {
  if (!hasDatabase()) return valueBets;

  const predictions = await getPredictions();
  return predictions.filter((horse) => horse.valueIndex > 10).sort((a, b) => b.valueIndex - a.valueIndex);
}

function mapRace(row: RaceRow, entries: EntryRow[]): RaceAnalysis {
  return {
    id: row.id,
    name: row.name,
    raceDate: row.race_date,
    relativeDay: relativeDayFromDate(row.race_date),
    reunionNumber: row.reunion_number ?? programNumber(row.id, "R"),
    courseNumber: row.course_number ?? programNumber(row.id, "C"),
    programCode: `R${row.reunion_number ?? programNumber(row.id, "R")}C${row.course_number ?? programNumber(row.id, "C")}`,
    sourceCountry: row.source_country ?? "N/A",
    racecourse: row.racecourse,
    startTime: row.start_time,
    discipline: row.discipline,
    specialty: row.specialty ?? row.discipline,
    distance: row.distance,
    going: row.going,
    weather: row.weather,
    marketVolatility: Number(row.market_volatility),
    modelConsensus: Number(row.model_consensus),
    raceQualityScore: Number(row.race_quality_score),
    bettingTier: row.betting_tier,
    riskLevel: row.risk_level,
    betTypes: parseJsonArray<BetOffer>(row.bet_types),
    horses: entries.map(mapHorse),
  };
}

function dateForRelativeDay(day: string) {
  if (day !== "yesterday" && day !== "today" && day !== "tomorrow") return null;

  if (day === "yesterday") return parisDateOffset(-1);
  if (day === "tomorrow") return parisDateOffset(1);
  return parisDateOffset(0);
}

function relativeDayFromDate(date: string): RaceAnalysis["relativeDay"] {
  if (date === dateForRelativeDay("yesterday")) return "yesterday";
  if (date === dateForRelativeDay("today")) return "today";
  if (date === dateForRelativeDay("tomorrow")) return "tomorrow";
  return "other";
}

function parisDateOffset(offset: number) {
  const parisDate = new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "Europe/Paris",
    year: "numeric",
  }).format(new Date());
  const [year, month, day] = parisDate.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + offset, 12));

  return new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "UTC",
    year: "numeric",
  }).format(date);
}

function programNumber(id: string, marker: "R" | "C") {
  const pattern = marker === "R" ? /-R(\d+)-C\d+$/ : /-R\d+-C(\d+)$/;
  return Number(id.match(pattern)?.[1] ?? 0);
}

function sortByStartTime(races: RaceAnalysis[]) {
  return races.sort(
    (a, b) =>
      a.raceDate.localeCompare(b.raceDate) ||
      a.startTime.localeCompare(b.startTime) ||
      a.reunionNumber - b.reunionNumber ||
      a.courseNumber - b.courseNumber,
  );
}

function mapHorse(row: EntryRow): HorsePrediction {
  return {
    id: row.id,
    number: row.number,
    horse: row.horse,
    age: row.age,
    sex: row.sex,
    music: row.music,
    earnings: row.earnings === null ? null : Number(row.earnings),
    handicapDistance: row.handicap_distance,
    reductionKm: row.reduction_km,
    equipment: row.equipment,
    silksUrl: row.silks_url,
    jockey: row.jockey,
    trainer: row.trainer,
    odds: Number(row.odds),
    fairOdds: Number(row.fair_odds),
    marketEdge: Number(row.market_edge),
    winProbability: Number(row.win_probability),
    top3Probability: Number(row.top3_probability),
    top5Probability: Number(row.top5_probability),
    kzScore: Number(row.kz_score),
    valueIndex: Number(row.value_index),
    confidence: row.confidence,
    factors: parseJsonArray<string>(row.factors),
    finishPosition: row.finish_position,
    won: row.won,
  };
}

function parseJsonArray<T>(value: T[] | string | null | undefined): T[] {
  if (Array.isArray(value)) return value;
  if (!value) return [];

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
