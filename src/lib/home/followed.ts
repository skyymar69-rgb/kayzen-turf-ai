import type { RaceAnalysis } from "@/lib/types";
import { startMinutes } from "./race-signals";

/** Engagement d'un cheval suivi dans une course du jour affiché. */
export type FollowedRunner = {
  race: RaceAnalysis;
  horseId: string;
  number: number;
  name: string;
};

/**
 * Chevaux suivis (identifiants stables `horseId`) engagés dans les courses
 * reçues, dans l'ordre des départs. Même règle de rapprochement que le panneau
 * « Mes chevaux suivis » : l'identifiant du cheval, jamais son nom.
 */
export function followedRunners(races: RaceAnalysis[], followedIds: ReadonlySet<string> | ReadonlyMap<string, unknown>): FollowedRunner[] {
  if (followedIds.size === 0) return [];
  return races
    .flatMap((race) =>
      race.horses
        .filter((h) => h.horseId && followedIds.has(h.horseId))
        .map((h) => ({ race, horseId: h.horseId!, number: h.number, name: h.horse })),
    )
    .sort((a, b) => startMinutes(a.race.startTime) - startMinutes(b.race.startTime) || a.number - b.number);
}
