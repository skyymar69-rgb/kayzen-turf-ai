import type { BetHighlight } from "@/lib/race-status";
import type { RaceAnalysis } from "@/lib/types";

export const DISCIPLINES = ["Tous", "Plat", "Trot", "Obstacle"] as const;
export type DisciplineFilter = (typeof DISCIPLINES)[number];

export type MeetingSort = "numero" | "score";

/** Signaux dérivés d'une course, calculés une fois par rendu du programme. */
export type RaceSignals = { signal: string; highlights: BetHighlight[] };

export type SignalsFor = (race: RaceAnalysis) => RaceSignals;

/** Chiffres réels du suivi de performance (dernier rapport), pour la section « Performances de l'IA ». */
export type DashboardPerformance = {
  generatedAt: string;
  racesEvaluated: number;
  top3HitsPerRace: number;
  rank1WinRate: number | null;
  rank1Roi: number | null;
  rank1Bets: number;
};

export const raceHref = (race: Pick<RaceAnalysis, "id">) => `/races/${encodeURIComponent(race.id)}`;
