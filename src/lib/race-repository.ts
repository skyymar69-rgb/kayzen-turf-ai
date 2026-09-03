import { getSql, hasDatabase } from "@/lib/db";
import { probableArrival, raceToContext } from "@/lib/bet-recommendations";
import { raceCards, valueBets } from "@/lib/mock-data";
import { calibrateField } from "@/lib/probability";
import type { BetOffer, Confidence, HorsePrediction, RaceAnalysis } from "@/lib/types";

// Les jeux de démonstration passent par la même calibration que la base : sans
// ça, un environnement sans DB afficherait des probabilités d'une autre source.
const demoRaces: RaceAnalysis[] = raceCards.map((race) => ({ ...race, horses: calibrateField(race.horses) }));

/**
 * Vrai quand aucune base n'est configurée : le site tourne alors sur des
 * courses fictives.
 *
 * Ce drapeau existe parce que la substitution était jusqu'ici invisible. Toute
 * panne base renvoyait `demoRaces`, et le site affichait des chevaux, des
 * cotes et des pronostics inventés avec la même présentation que les vraies
 * courses PMU. Sur un service d'aide à la décision de pari, présenter des
 * données fabriquées comme authentiques relève de la pratique commerciale
 * trompeuse (code de la consommation, art. L. 121-2).
 *
 * Deux règles en découlent :
 *  - une panne base ne fabrique plus rien, elle remonte l'erreur ;
 *  - l'absence volontaire de base reste possible pour la démonstration, mais
 *    l'interface l'annonce (voir `BandeauDemonstration`).
 */
export function estModeDemonstration() {
  return !hasDatabase();
}

/** Panne de la source de données. Distincte d'un « aucun résultat ». */
export class ErreurSourceDonnees extends Error {
  constructor(operation: string, cause: unknown) {
    super(`Source de données indisponible (${operation})`);
    this.name = "ErreurSourceDonnees";
    this.cause = cause;
  }
}

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
  speed_figure: string | null;
  draw: number | null;
  equipment: string | null;
  silks_url: string | null;
  jockey: string;
  trainer: string;
  odds: string | null;
  fair_odds: string | null;
  market_edge: string | null;
  win_probability: string | null;
  top3_probability: string | null;
  top5_probability: string | null;
  kz_score: string | null;
  value_index: string | null;
  confidence: Confidence;
  factors: string[] | string;
  finish_position: number | null;
  won: boolean | null;
};

export async function getRaces(filters?: { date?: string | null; day?: string | null }) {
  const filterDate = filters?.date ?? (filters?.day ? dateForRelativeDay(filters.day) : null);
  const yesterdayDate = dateForRelativeDay("yesterday");
  const todayDate = dateForRelativeDay("today");
  const tomorrowDate = dateForRelativeDay("tomorrow");
  const rollingDates = [yesterdayDate, todayDate, tomorrowDate].filter((date): date is string => Boolean(date));

  if (!hasDatabase()) {
    return demoRaces.filter((race) => {
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
          and races.race_date in (${yesterdayDate}::date, ${todayDate}::date, ${tomorrowDate}::date)
        )
      order by races.race_date, races.start_time, races.reunion_number nulls last, races.course_number nulls last
    ` as RaceRow[];
  } catch (cause) {
    // Renvoyer `demoRaces` ici transformait une panne base en programme fictif
    // servi comme authentique. On remonte : la page conserve alors sa dernière
    // version valide en cache ISR, ou affiche la frontière d'erreur.
    console.error("Lecture des courses impossible", cause);
    throw new ErreurSourceDonnees("lecture des courses", cause);
  }

  // Une requête pour les partants de toutes les courses, au lieu d'une par
  // course : le chargement du programme passait 104 allers-retours en base
  // (1 + 103 courses), chacun payant la latence réseau du serverless Neon.
  let entriesByRace: Map<string, EntryRow[]>;
  try {
    entriesByRace = await fetchEntriesByRace(rows.map((row) => row.id));
  } catch (cause) {
    console.error("Lecture des partants impossible", cause);
    throw new ErreurSourceDonnees("lecture des partants", cause);
  }

  const hydratedRaces = rows.flatMap((row) => {
    const entries = entriesByRace.get(row.id);
    // Une course sans partant n'est pas affichable. L'ancien code lui
    // substituait la course de démonstration, qui apparaissait alors dans le
    // programme réel — autant de doublons que de courses vides.
    return entries?.length ? [mapRace(row, entries)] : [];
  });

  return sortByStartTime(hydratedRaces);
}

/**
 * Charge les partants d'un lot de courses et les regroupe par course.
 * Partagé entre le programme et la page course pour qu'une seule requête,
 * unique, décrive ce qu'est un partant.
 */
async function fetchEntriesByRace(raceIds: string[]) {
  const byRace = new Map<string, EntryRow[]>();
  if (raceIds.length === 0) return byRace;

  const sql = getSql();
  const rows = (await sql`
    select
      entries.race_id,
      entries.id,
      entries.number,
      horses.name as horse,
      coalesce(entries.age, horses.age) as age,
      entries.sex,
      entries.music,
      entries.earnings::text,
      entries.handicap_distance,
      entries.reduction_km,
      entries.speed_figure::text,
      entries.draw,
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
    where entries.race_id = any(${raceIds})
    order by entries.race_id, entries.kz_score desc nulls last, entries.number
  `) as Array<EntryRow & { race_id: string }>;

  for (const row of rows) {
    const liste = byRace.get(row.race_id);
    if (liste) liste.push(row);
    else byRace.set(row.race_id, [row]);
  }

  return byRace;
}

/**
 * Une course, ou `null` si l'identifiant est inconnu.
 *
 * L'option `fallback` a disparu : elle valait `true` par défaut et renvoyait la
 * course de démonstration pour n'importe quel identifiant inexistant. Une URL
 * `/races/nimporte-quoi` affichait donc une course complète — partants, cotes,
 * pronostics — au lieu d'un 404, et Google indexait autant de pages fantômes
 * qu'on lui en présentait.
 */
export async function getRaceById(id?: string | null): Promise<RaceAnalysis | null> {
  if (!id) return null;

  if (!hasDatabase()) {
    return demoRaces.find((race) => race.id === id) ?? null;
  }

  const sql = getSql();
  let row: RaceRow | undefined;

  try {
    row = (await sql`
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
      where races.id = ${id}
      limit 1
    ` as RaceRow[])[0];
  } catch (cause) {
    console.error("Lecture de la course %s impossible", id, cause);
    throw new ErreurSourceDonnees("lecture d'une course", cause);
  }

  if (!row) return null;

  const entries = (await fetchEntriesByRace([row.id])).get(row.id) ?? [];

  // Une course sans partant n'est pas affichable : elle vaut 404, pas une
  // page de démonstration.
  return entries.length > 0 ? mapRace(row, entries) : null;
}

export async function getPredictions() {
  const races = await getRaces();
  return races
    .flatMap((race) => probableArrival(race.horses, raceToContext(race)).map((horse, index) => ({ ...horse, raceId: race.id, raceName: race.name, arrivalRank: index + 1 })))
    .sort((a, b) => a.arrivalRank - b.arrivalRank || b.top3Probability - a.top3Probability);
}

export async function getValueBets() {
  if (!hasDatabase()) return valueBets;

  const predictions = await getPredictions();
  return predictions
    .filter((horse) => horse.valueIndex > 10 || (horse.odds >= 6 && horse.top3Probability >= 18))
    .sort((a, b) => b.valueIndex - a.valueIndex || a.arrivalRank - b.arrivalRank);
}

function mapRace(row: RaceRow, entries: EntryRow[]): RaceAnalysis {
  const horses = entries.map(mapHorse);
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
    // Recalibrage à l'échelle de la course : les probabilités stockées en base
    // sont calculées cheval par cheval, sans normalisation (Σ win ≈ 185 %).
    // On les remplace ici, une seule fois, pour que tous les consommateurs —
    // page course, dashboard, tickets, API — lisent les mêmes valeurs.
    horses: calibrateField(horses),
    oddsAvailable: horses.some((horse) => Number.isFinite(horse.odds) && horse.odds > 1),
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
    speedFigure: row.speed_figure != null ? Number(row.speed_figure) : null,
    draw: row.draw,
    equipment: row.equipment,
    silksUrl: row.silks_url,
    jockey: row.jockey,
    trainer: row.trainer,
    // `Number(null)` vaut 0, pas NaN : une cote absente passait pour une cote
    // de 0 et `devig` lui attribuait une probabilité. NaN dit « inconnu ».
    odds: row.odds != null ? Number(row.odds) : NaN,
    fairOdds: row.fair_odds != null ? Number(row.fair_odds) : NaN,
    marketEdge: row.market_edge != null ? Number(row.market_edge) : 0,
    winProbability: row.win_probability != null ? Number(row.win_probability) : 0,
    top3Probability: row.top3_probability != null ? Number(row.top3_probability) : 0,
    top5Probability: row.top5_probability != null ? Number(row.top5_probability) : 0,
    // La valeur spéciale PostgreSQL 'NaN' arrive sous forme de texte : Number()
    // la convertit bien en NaN, que `modelProbabilities` traite comme manquante.
    kzScore: row.kz_score != null ? Number(row.kz_score) : NaN,
    valueIndex: row.value_index != null ? Number(row.value_index) : 0,
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
