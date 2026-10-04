import { jourParis } from "@/lib/paris-time";
import type { RaceAnalysis } from "@/lib/types";

/** Jours du programme, dans l'ordre du sélecteur et des raccourcis ←/→. */
export type ProgrammeDay = Exclude<RaceAnalysis["relativeDay"], "other">;

export const DAY_ORDER: ProgrammeDay[] = ["yesterday", "today", "tomorrow"];

export function formatRelativeDay(day: RaceAnalysis["relativeDay"]): string {
  if (day === "yesterday") return "Hier";
  if (day === "tomorrow") return "Demain";
  if (day === "other") return "Autre";
  return "Aujourd'hui";
}

/** « 2026-10-04 » → « 04/10 ». */
export function formatShortDate(date: string): string {
  const [, m, d] = date.split("-");
  return `${d}/${m}`;
}

/**
 * Date d'un jour du programme : celle des courses chargées si elles existent,
 * sinon le jour calculé à Paris (jamais à l'heure du navigateur).
 */
export function dateForDay(races: RaceAnalysis[], day: RaceAnalysis["relativeDay"], now: Date = new Date()): string {
  const found = races.find((r) => r.relativeDay === day)?.raceDate;
  if (found) return found;
  const offset = day === "yesterday" ? -1 : day === "tomorrow" ? 1 : 0;
  const [year, month, d] = jourParis(now).split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, d + offset, 12)).toISOString().slice(0, 10);
}

/** Courses d'un jour, par réunion puis numéro de course (copie : l'entrée n'est jamais réordonnée). */
export function racesOfDay(races: RaceAnalysis[], day: RaceAnalysis["relativeDay"]): RaceAnalysis[] {
  return races
    .filter((r) => r.relativeDay === day)
    .sort((a, b) => a.reunionNumber - b.reunionNumber || a.courseNumber - b.courseNumber);
}

/** Jour voisin pour les raccourcis clavier, `null` en bout de liste. */
export function adjacentDay(day: ProgrammeDay, direction: 1 | -1): ProgrammeDay | null {
  return DAY_ORDER[DAY_ORDER.indexOf(day) + direction] ?? null;
}
