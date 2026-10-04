import { classifyStance } from "@/lib/confrontation";
import { hasOdds } from "@/lib/format";
import type { RaceReading } from "@/lib/profiles";
import { raceStatus, type BetHighlight, type RaceStatus } from "@/lib/race-status";

/**
 * PAGE /pronostics — filtres, tris, regroupements, sans React.
 *
 * Le serveur calcule une fois par course ce qui coûte cher (ordre probable,
 * tickets, lecture) et livre au navigateur des `PronosticRace` sérialisables.
 * Tout ce qui suit ne fait que trier et filtrer ces objets : aucune
 * probabilité n'est recalculée côté client.
 */

export type Discipline = "Plat" | "Trot" | "Obstacle";
export const DISCIPLINES: Discipline[] = ["Plat", "Trot", "Obstacle"];

export type PronosticHorse = {
  number: number;
  horse: string;
  jockey: string;
  trainer: string;
  finishPosition: number | null;
};

export type PronosticRace = {
  id: string;
  /** Ancre de la carte dans la page : « R1C3 ». */
  anchor: string;
  name: string;
  raceDate: string;
  startTime: string;
  reunionNumber: number;
  courseNumber: number;
  racecourse: string;
  discipline: Discipline;
  /** « Attelé · 2700 m · 14 partants ». */
  details: string;
  bets: BetHighlight[];
  reading: RaceReading;
  /** Ordre probable de l'IA (numéros), cinq premiers. */
  arrival: number[];
  base: { number: number; name: string } | null;
  valueBet: { number: number; name: string; valueIndex: number } | null;
  /** Trois premiers de l'ordre probable, avec leur probabilité de victoire (%). */
  top3: Array<{ number: number; name: string; winProbability: number }>;
  favoriIa: FavoriIa | null;
  tickets: Array<{ type: string; label: string; ticket: string }>;
  moreTickets: number;
  horses: PronosticHorse[];
};

/* ─── Favori IA ──────────────────────────────────────────────────── */

export type FavoriIa = { number: number; name: string; ai: number; market: number };

type StanceInput = {
  number: number;
  horse: string;
  odds: number;
  fundamentalProbability?: number | null;
  marketProbability?: number;
};

/**
 * Le cheval que l'IA (modèle sans cote) préfère le plus nettement au marché,
 * au sens de `classifyStance`. Sans cote publiée, il n'y a pas de marché à
 * contredire : aucun favori IA.
 */
export function pickFavoriIa(horses: StanceInput[]): FavoriIa | null {
  let best: FavoriIa | null = null;
  for (const h of horses) {
    const ai = h.fundamentalProbability ?? null;
    const market = hasOdds(h.odds) && h.marketProbability !== undefined ? h.marketProbability : null;
    if (ai === null || market === null || classifyStance(ai, market) !== "ia") continue;
    if (!best || ai - market > best.ai - best.market) best = { number: h.number, name: h.horse, ai, market };
  }
  return best;
}

/* ─── Jour (?jour=) ──────────────────────────────────────────────── */

export type DayParam = "hier" | "aujourdhui" | "demain";
export type RelativeDay = "yesterday" | "today" | "tomorrow";

export const DAY_PARAMS: Array<{ param: DayParam; day: RelativeDay; label: string }> = [
  { param: "hier", day: "yesterday", label: "Hier" },
  { param: "aujourdhui", day: "today", label: "Aujourd’hui" },
  { param: "demain", day: "tomorrow", label: "Demain" },
];

/** Valeur inconnue, absente ou répétée : aujourd'hui. */
export function parseDayParam(value: string | string[] | undefined): { param: DayParam; day: RelativeDay } {
  const found = typeof value === "string" ? DAY_PARAMS.find((d) => d.param === value) : undefined;
  return found ? { param: found.param, day: found.day } : { param: "aujourdhui", day: "today" };
}

/* ─── Recherche ──────────────────────────────────────────────────── */

/** Minuscules, sans accents ni espaces superflus : « Éclair  d'Été » → « eclair d'ete ». */
export function normalizeText(value: string): string {
  return value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
}

/**
 * Chaque mot de la recherche doit se retrouver quelque part : hippodrome, nom
 * de course, code R1C3, cheval, jockey/driver ou entraîneur.
 */
export function matchesQuery(race: PronosticRace, query: string): boolean {
  const tokens = normalizeText(query).split(" ").filter(Boolean);
  if (tokens.length === 0) return true;
  const haystack = normalizeText(
    [race.racecourse, race.name, race.anchor, ...race.horses.flatMap((h) => [h.horse, h.jockey, h.trainer])].join(" | "),
  );
  return tokens.every((t) => haystack.includes(t));
}

/* ─── Filtres ────────────────────────────────────────────────────── */

export type PronosticFilters = {
  disciplines: Discipline[];
  quinte: boolean;
  value: boolean;
  lisible: boolean;
  upcoming: boolean;
  query: string;
};

export const DEFAULT_FILTERS: PronosticFilters = {
  disciplines: [],
  quinte: false,
  value: false,
  lisible: false,
  upcoming: false,
  query: "",
};

export function isUpcoming(status: RaceStatus): boolean {
  return status === "a-venir" || status === "imminente";
}

export function statusOf(race: PronosticRace, now: Date): RaceStatus {
  return raceStatus(race, now);
}

export function matchesFilters(race: PronosticRace, filters: PronosticFilters, now: Date): boolean {
  if (filters.disciplines.length > 0 && !filters.disciplines.includes(race.discipline)) return false;
  if (filters.quinte && !race.bets.includes("QUINTE_PLUS")) return false;
  if (filters.value && !race.valueBet) return false;
  if (filters.lisible && race.reading !== "lisible") return false;
  if (filters.upcoming && !isUpcoming(statusOf(race, now))) return false;
  return matchesQuery(race, filters.query);
}

export function applyFilters(races: PronosticRace[], filters: PronosticFilters, now: Date): PronosticRace[] {
  return races.filter((r) => matchesFilters(r, filters, now));
}

/** Nombre de courses obtenues si l'on ajoutait `patch` aux filtres actuels. */
export function countWith(races: PronosticRace[], filters: PronosticFilters, patch: Partial<PronosticFilters>, now: Date): number {
  return applyFilters(races, { ...filters, ...patch }, now).length;
}

export function activeFilterCount(filters: PronosticFilters): number {
  return filters.disciplines.length + [filters.quinte, filters.value, filters.lisible, filters.upcoming].filter(Boolean).length + (filters.query.trim() ? 1 : 0);
}

/* ─── Tris ───────────────────────────────────────────────────────── */

export type SortKey = "heure" | "reunion" | "value" | "lisibilite";

export const SORT_LABELS: Record<SortKey, string> = {
  heure: "Heure de départ",
  reunion: "Réunion",
  value: "Value bets d’abord",
  lisibilite: "Courses lisibles d’abord",
};

const READING_RANK: Record<RaceReading, number> = { lisible: 0, ouverte: 1, piege: 2 };

export function compareTime(a: PronosticRace, b: PronosticRace): number {
  return a.raceDate.localeCompare(b.raceDate) || a.startTime.localeCompare(b.startTime) || a.reunionNumber - b.reunionNumber || a.courseNumber - b.courseNumber;
}

function compareReunion(a: PronosticRace, b: PronosticRace): number {
  return a.reunionNumber - b.reunionNumber || a.courseNumber - b.courseNumber;
}

/** Plus fort indice value d'abord ; les courses sans value bet suivent, à l'heure. */
function compareValue(a: PronosticRace, b: PronosticRace): number {
  const va = a.valueBet?.valueIndex ?? -Infinity;
  const vb = b.valueBet?.valueIndex ?? -Infinity;
  return vb === va ? compareTime(a, b) : vb > va ? 1 : -1;
}

/** Lisible, ouverte, piège ; à lecture égale, la base IA la plus probable d'abord. */
function compareReading(a: PronosticRace, b: PronosticRace): number {
  const byReading = READING_RANK[a.reading] - READING_RANK[b.reading];
  if (byReading !== 0) return byReading;
  const pa = a.top3[0]?.winProbability ?? 0;
  const pb = b.top3[0]?.winProbability ?? 0;
  return pb - pa || compareTime(a, b);
}

const COMPARATORS: Record<SortKey, (a: PronosticRace, b: PronosticRace) => number> = {
  heure: compareTime,
  reunion: compareReunion,
  value: compareValue,
  lisibilite: compareReading,
};

export function sortRaces(races: PronosticRace[], sort: SortKey): PronosticRace[] {
  return [...races].sort(COMPARATORS[sort]);
}

/* ─── Regroupements ──────────────────────────────────────────────── */

export type ReunionGroup = { key: string; reunionNumber: number; racecourse: string; races: PronosticRace[] };

export function groupByReunion(races: PronosticRace[]): ReunionGroup[] {
  const groups = new Map<string, ReunionGroup>();
  for (const race of [...races].sort(compareReunion)) {
    const key = `R${race.reunionNumber}`;
    const group = groups.get(key);
    if (group) groups.set(key, { ...group, races: [...group.races, race] });
    else groups.set(key, { key, reunionNumber: race.reunionNumber, racecourse: race.racecourse, races: [race] });
  }
  return [...groups.values()];
}

/** Courses à venir d'un côté, parties ou arrivées de l'autre (ces dernières à l'heure). */
export function splitPast(races: PronosticRace[], now: Date): { active: PronosticRace[]; past: PronosticRace[] } {
  const active = races.filter((r) => isUpcoming(statusOf(r, now)));
  const past = races.filter((r) => !isUpcoming(statusOf(r, now))).sort(compareTime);
  return { active, past };
}

/** Prochaine course pas encore partie, dans l'ordre chronologique. */
export function nextUpcoming(races: PronosticRace[], now: Date): PronosticRace | null {
  return [...races].sort(compareTime).find((r) => isUpcoming(statusOf(r, now))) ?? null;
}

/** Ancre suivante (`step` = 1) ou précédente (−1) ; la première si rien n'est actif. */
export function adjacentAnchor(anchors: string[], current: string | null, step: 1 | -1): string | null {
  if (anchors.length === 0) return null;
  const index = current ? anchors.indexOf(current) : -1;
  if (index === -1) return step === 1 ? anchors[0] : anchors[anchors.length - 1];
  return anchors[Math.min(anchors.length - 1, Math.max(0, index + step))];
}

/* ─── Bilan de la base IA ────────────────────────────────────────── */

export type BaseOutcome = "gagnante" | "placee" | "perdue" | "hors-arrivee" | "en-attente" | "sans-base";

export const BASE_OUTCOME_LABELS: Record<BaseOutcome, string> = {
  gagnante: "Base IA gagnante",
  placee: "Base IA placée",
  perdue: "Base IA non placée",
  "hors-arrivee": "Base IA hors de l’arrivée publiée",
  "en-attente": "Arrivée non publiée",
  "sans-base": "Pas de base IA",
};

/**
 * Ce qu'est devenue la base IA (premier de l'ordre probable), lu sur la seule
 * place officielle : 1re gagnante, 2e ou 3e placée, au-delà non placée. Un
 * cheval absent d'une arrivée publiée (non-partant, arrêté, distancé) n'est
 * pas compté comme une réussite.
 */
export function baseOutcome(race: Pick<PronosticRace, "base" | "horses">): BaseOutcome {
  const arrived = race.horses.some((h) => h.finishPosition != null && h.finishPosition > 0);
  if (!arrived) return "en-attente";
  if (!race.base) return "sans-base";
  const position = race.horses.find((h) => h.number === race.base!.number)?.finishPosition ?? null;
  if (position == null || position <= 0) return "hors-arrivee";
  if (position === 1) return "gagnante";
  return position <= 3 ? "placee" : "perdue";
}

/* ─── Préférences mémorisées ─────────────────────────────────────── */

export type ViewMode = "cartes" | "compacte";

export type PronosticPrefs = { filters: PronosticFilters; sort: SortKey; view: ViewMode };

export const DEFAULT_PREFS: PronosticPrefs = { filters: DEFAULT_FILTERS, sort: "heure", view: "cartes" };

const SORT_KEYS = Object.keys(SORT_LABELS) as SortKey[];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Relit des préférences venues du stockage du navigateur : tout ce qui n'a pas
 * la forme attendue retombe sur la valeur par défaut, champ par champ.
 */
export function sanitizePrefs(raw: unknown): PronosticPrefs {
  if (!isRecord(raw)) return DEFAULT_PREFS;
  const f = isRecord(raw.filters) ? raw.filters : {};
  const bool = (v: unknown) => v === true;
  const filters: PronosticFilters = {
    disciplines: Array.isArray(f.disciplines) ? DISCIPLINES.filter((d) => (f.disciplines as unknown[]).includes(d)) : [],
    quinte: bool(f.quinte),
    value: bool(f.value),
    lisible: bool(f.lisible),
    upcoming: bool(f.upcoming),
    query: typeof f.query === "string" ? f.query.slice(0, 80) : "",
  };
  const sort = SORT_KEYS.includes(raw.sort as SortKey) ? (raw.sort as SortKey) : DEFAULT_PREFS.sort;
  const view: ViewMode = raw.view === "compacte" ? "compacte" : "cartes";
  return { filters, sort, view };
}
