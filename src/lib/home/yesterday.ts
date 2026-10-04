import { probableArrival, raceToContext } from "@/lib/bet-recommendations";
import { officialArrival } from "@/lib/race-status";
import type { RaceAnalysis } from "@/lib/types";

/**
 * HIER — ce qu'est devenue la base IA (premier de `probableArrival`) de chaque
 * course arrivée la veille : gagnée, placée (2e ou 3e) ou perdue.
 *
 * Limite assumée : la base est recalculée sur les données actuelles de la
 * course (cotes finales comprises), pas lue dans le pronostic gelé avant le
 * départ. Le suivi officiel, lui, part des pronostics gelés (page Suivi).
 */

export type BaseOutcome = "gagnee" | "placee" | "perdue";

export type YesterdayRow = {
  race: RaceAnalysis;
  baseNumber: number;
  baseName: string;
  finishPosition: number | null;
  outcome: BaseOutcome;
};

export type YesterdayReport = {
  rows: YesterdayRow[];
  won: number;
  placed: number;
  lost: number;
};

export function outcomeOf(position: number | null | undefined): BaseOutcome {
  if (position === 1) return "gagnee";
  if (position === 2 || position === 3) return "placee";
  return "perdue";
}

export function buildYesterdayReport(races: RaceAnalysis[]): YesterdayReport {
  const rows = races
    .filter((race) => race.relativeDay === "yesterday" && officialArrival(race).length > 0)
    .flatMap((race): YesterdayRow[] => {
      const base = probableArrival(race.horses, raceToContext(race))[0];
      if (!base) return [];
      const position = base.finishPosition != null && base.finishPosition > 0 ? base.finishPosition : null;
      return [{ race, baseNumber: base.number, baseName: base.horse, finishPosition: position, outcome: outcomeOf(position) }];
    })
    .sort((a, b) => a.race.startTime.localeCompare(b.race.startTime) || a.race.reunionNumber - b.race.reunionNumber);
  const count = (o: BaseOutcome) => rows.filter((r) => r.outcome === o).length;
  return { rows, won: count("gagnee"), placed: count("placee"), lost: count("perdue") };
}
