import { compareRaceTime, raceStatus, type RaceStatus } from "@/lib/race-status";
import type { RaceAnalysis } from "@/lib/types";

/**
 * NAVIGATION ENTRE COURSES — précédente, suivante, carte de la réunion.
 *
 * Lit le programme allégé du jour (`getDayRaceIndex`) : quelques champs par
 * course, sans partants. L'ordre chronologique est celui de tout le site
 * (`compareRaceTime`), l'état celui de `raceStatus`.
 */

export type RaceIndexItem = Pick<
  RaceAnalysis,
  "id" | "raceDate" | "startTime" | "reunionNumber" | "courseNumber" | "programCode" | "racecourse" | "name" | "discipline"
> & {
  arrived: boolean;
};

/**
 * `compareRaceTime` est typé sur une course complète mais ne lit que la date,
 * l'heure, la réunion et la course : l'élément d'index les porte tous.
 */
function compareItems(a: RaceIndexItem, b: RaceIndexItem): number {
  return compareRaceTime(a as unknown as RaceAnalysis, b as unknown as RaceAnalysis);
}

export function sortRaceIndex(items: RaceIndexItem[]): RaceIndexItem[] {
  return [...items].sort(compareItems);
}

/** Course précédente et suivante du même jour, dans l'ordre chronologique. */
export function adjacentRaces(items: RaceIndexItem[], currentId: string): { previous: RaceIndexItem | null; next: RaceIndexItem | null } {
  const sorted = sortRaceIndex(items);
  const index = sorted.findIndex((item) => item.id === currentId);
  if (index === -1) return { previous: null, next: null };
  return { previous: sorted[index - 1] ?? null, next: sorted[index + 1] ?? null };
}

/** Courses de la même réunion (même jour, même numéro R), dans l'ordre des numéros C. */
export function meetingRaces(items: RaceIndexItem[], current: Pick<RaceIndexItem, "raceDate" | "reunionNumber">): RaceIndexItem[] {
  return items
    .filter((item) => item.raceDate === current.raceDate && item.reunionNumber === current.reunionNumber)
    .sort((a, b) => a.courseNumber - b.courseNumber);
}

/** État d'une course de l'index : l'arrivée publiée suffit, sinon l'heure de Paris. */
export function indexStatus(item: RaceIndexItem, now: Date = new Date()): RaceStatus {
  return raceStatus({ raceDate: item.raceDate, startTime: item.startTime, horses: item.arrived ? [{ finishPosition: 1 }] : [] }, now);
}
