import { betHighlights, type BetHighlight } from "@/lib/race-status";
import { buildSelection } from "@/lib/selection";
import type { RaceAnalysis } from "@/lib/types";
import { aiMarketGap, AI_MARKET_GAP_POINTS } from "@/lib/value-signal";
import { hasAiMarketGap } from "./race-signals";

export type MeetingDifficulty = "Facile" | "Ouverte" | "Complexe";

export type RaceMeeting = {
  key: string;
  reunionNumber: number;
  racecourse: string;
  startTime: string;
  score: number;
  difficulty: MeetingDifficulty;
  strategy: string;
  specialties: string[];
  highlights: BetHighlight[];
  races: RaceAnalysis[];
};

/**
 * Score de priorité d'une course (consensus, qualité, volatilité). La
 * « meilleure value » n'y entre plus : calculée contre la cote finale
 * attendue, elle est négative partout (src/lib/probability.ts).
 */
export function racePriorityScore(race: RaceAnalysis): number {
  return race.modelConsensus + race.raceQualityScore - race.marketVolatility - (race.riskLevel === "Speculatif" ? 10 : 0);
}

export function priorityLabel(race: RaceAnalysis): string {
  if (race.oddsAvailable !== false && race.horses.some((h) => (aiMarketGap(h) ?? 0) >= 2 * AI_MARKET_GAP_POINTS)) return "Écart IA / marché fort";
  if (race.raceQualityScore >= 75) return "Course prioritaire";
  return "Surveillance";
}

export function meetingScore(races: RaceAnalysis[]): number {
  if (!races.length) return 0;
  return Math.max(1, Math.min(100, Math.round(races.reduce((s, r) => s + racePriorityScore(r), 0) / races.length)));
}

export function meetingDifficulty(score: number, races: RaceAnalysis[]): MeetingDifficulty {
  const spec = races.filter((r) => r.riskLevel === "Speculatif").length;
  if (score >= 72 && spec <= 1) return "Facile";
  if (score < 55 || spec >= Math.ceil(races.length / 2)) return "Complexe";
  return "Ouverte";
}

export function meetingStrategy(score: number, races: RaceAnalysis[]): string {
  const d = meetingDifficulty(score, races);
  if (d === "Facile") return "Bases simples et couples";
  if (d === "Complexe") return "Mises réduites, prudence";
  return "Placés et tickets flexi";
}

function unique<T>(values: T[]): T[] {
  return Array.from(new Set(values.filter(Boolean)));
}

/** Réunions du jour, courses triées par numéro, réunions par numéro. */
export function groupRacesByMeeting(races: RaceAnalysis[]): RaceMeeting[] {
  const groups = new Map<string, RaceAnalysis[]>();
  for (const race of races) {
    const key = `${race.raceDate}-R${race.reunionNumber}`;
    groups.set(key, [...(groups.get(key) ?? []), race]);
  }
  return Array.from(groups, ([key, group]) => {
    const sorted = [...group].sort((a, b) => a.courseNumber - b.courseNumber);
    const score = meetingScore(sorted);
    return {
      key,
      reunionNumber: group[0].reunionNumber,
      racecourse: group[0].racecourse,
      startTime: group[0].startTime,
      score,
      difficulty: meetingDifficulty(score, sorted),
      strategy: meetingStrategy(score, sorted),
      highlights: unique(sorted.flatMap((r) => betHighlights(r.betTypes))),
      specialties: unique(sorted.map((r) => r.specialty)),
      races: sorted,
    };
  }).sort((a, b) => a.reunionNumber - b.reunionNumber);
}

/** Nombre de courses d'une réunion où l'IA et le marché divergent nettement sur un partant. */
export function gapRaceCount(meeting: Pick<RaceMeeting, "races">): number {
  return meeting.races.filter(hasAiMarketGap).length;
}

export type DayInsights = {
  gapRaces: number;
  topRaces: RaceAnalysis[];
  readable: number;
  open: number;
  traps: number;
  bestAlert: string;
  nextPriority: RaceAnalysis | undefined;
};

export function buildDayInsights(races: RaceAnalysis[]): DayInsights {
  const topRaces = [...races].sort((a, b) => racePriorityScore(b) - racePriorityScore(a)).slice(0, 3);
  const bestRace = topRaces[0];
  // Lecture réelle de chaque course (profils), et non plus les champs
  // « tier / risque / consensus » que l'import déduisait du nombre de partants.
  const readings = races.map((r) => buildSelection(r.horses).verdict.reading);
  const count = (reading: string) => readings.filter((x) => x === reading).length;
  return {
    gapRaces: races.filter(hasAiMarketGap).length,
    topRaces,
    readable: count("lisible"),
    open: count("ouverte"),
    traps: count("piege"),
    bestAlert: bestRace ? priorityLabel(bestRace) : "En attente",
    nextPriority: bestRace,
  };
}

/** Course phare : meilleur score de priorité du jour. */
export function featuredRace(races: RaceAnalysis[]): RaceAnalysis | undefined {
  return [...races].sort((a, b) => racePriorityScore(b) - racePriorityScore(a))[0];
}
