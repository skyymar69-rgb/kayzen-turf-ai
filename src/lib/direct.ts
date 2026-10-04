import { probableArrival, raceToContext } from "@/lib/bet-recommendations";
import { classifyStance, type Stance } from "@/lib/confrontation";
import { minutesToStart, officialArrival, raceAnchor, raceStatus, type RaceStatus } from "@/lib/race-status";
import type { RaceAnalysis } from "@/lib/types";

/**
 * PAGE DIRECT — les courses des prochaines minutes, et rien d'autre.
 *
 * Fenêtre : de DIRECT_PAST_MINUTES après le départ (le temps que l'arrivée
 * tombe) jusqu'à DIRECT_AHEAD_MINUTES avant. Le résumé de chaque course est
 * calculé côté serveur ; le client ne fait que filtrer selon l'heure.
 */

export const DIRECT_AHEAD_MINUTES = 30;
export const DIRECT_PAST_MINUTES = 10;

export type DirectRunner = { number: number; name: string; win: number; odds: number | null; stance: Stance | null };

export type DirectRace = {
  id: string;
  anchor: string;
  name: string;
  racecourse: string;
  raceDate: string;
  startTime: string;
  discipline: string;
  runners: number;
  /** Trois premiers de l'ordre probable de l'IA. */
  top: DirectRunner[];
  arrival: number[];
};

function runner(horse: RaceAnalysis["horses"][number]): DirectRunner {
  const hasOdds = Number.isFinite(horse.odds) && horse.odds > 1;
  const ai = Number.isFinite(Number(horse.fundamentalProbability)) ? Number(horse.fundamentalProbability) : null;
  return {
    number: horse.number,
    name: horse.horse,
    win: horse.winProbability,
    odds: hasOdds ? horse.odds : null,
    stance: classifyStance(ai, hasOdds ? (horse.marketProbability ?? null) : null),
  };
}

export function summarizeForDirect(race: RaceAnalysis): DirectRace {
  return {
    id: race.id,
    anchor: raceAnchor(race),
    name: race.name,
    racecourse: race.racecourse,
    raceDate: race.raceDate,
    startTime: race.startTime,
    discipline: race.discipline,
    runners: race.horses.length,
    top: probableArrival(race.horses, raceToContext(race)).slice(0, 3).map(runner),
    arrival: officialArrival(race).slice(0, 5),
  };
}

/** État d'une course résumée : l'arrivée publiée prime sur l'horloge. */
export function directStatus(race: Pick<DirectRace, "raceDate" | "startTime" | "arrival">, now: Date = new Date()): RaceStatus {
  return raceStatus({ ...race, horses: race.arrival.map((_, i) => ({ finishPosition: i + 1 })) }, now);
}

/** Prochaine course pas encore partie, hors fenêtre comprise. */
export function nextDirectRace<T extends Pick<DirectRace, "raceDate" | "startTime" | "arrival">>(races: T[], now: Date = new Date()): T | null {
  return races
    .map((race) => ({ race, minutes: minutesToStart(race, now) }))
    .filter((x): x is { race: T; minutes: number } => x.minutes !== null && x.minutes > 0 && x.race.arrival.length === 0)
    .sort((a, b) => a.minutes - b.minutes)[0]?.race ?? null;
}

/** Courses dans la fenêtre du direct, de la plus proche du départ à la plus lointaine. */
export function inDirectWindow<T extends Pick<DirectRace, "raceDate" | "startTime">>(races: T[], now: Date = new Date()): T[] {
  return races
    .map((race) => ({ race, minutes: minutesToStart(race, now) }))
    .filter((x): x is { race: T; minutes: number } => x.minutes !== null && x.minutes <= DIRECT_AHEAD_MINUTES && x.minutes > -DIRECT_PAST_MINUTES)
    .sort((a, b) => a.minutes - b.minutes)
    .map((x) => x.race);
}
