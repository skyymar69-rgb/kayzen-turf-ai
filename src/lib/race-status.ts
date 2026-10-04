import { instantDepart } from "@/lib/paris-time";
import type { BetOffer, RaceAnalysis } from "@/lib/types";

/**
 * ÉTAT D'UNE COURSE — une seule définition pour la navigation, les cartes,
 * la page Direct et la page course.
 *
 *   a-venir    départ dans plus de IMMINENT_MINUTES
 *   imminente  départ dans IMMINENT_MINUTES ou moins
 *   partie     heure de départ passée, arrivée pas encore connue
 *   arrivee    au moins une place d'arrivée publiée
 *
 * Le temps se compte à partir de l'instant de départ en heure de Paris
 * (`instantDepart`), jamais de l'heure du navigateur.
 */

export type RaceStatus = "a-venir" | "imminente" | "partie" | "arrivee";

export const IMMINENT_MINUTES = 15;

export const RACE_STATUS_LABELS: Record<RaceStatus, string> = {
  "a-venir": "À venir",
  imminente: "Imminente",
  partie: "Partie",
  arrivee: "Arrivée",
};

type StatusInput = Pick<RaceAnalysis, "raceDate" | "startTime"> & { horses: Array<{ finishPosition?: number | null }> };

/** Minutes avant le départ (négatif une fois parti), `null` si l'heure est illisible. */
export function minutesToStart(race: Pick<RaceAnalysis, "raceDate" | "startTime">, now: Date = new Date()): number | null {
  const start = instantDepart(race.raceDate, race.startTime);
  return start ? (start.getTime() - now.getTime()) / 60_000 : null;
}

export function raceStatus(race: StatusInput, now: Date = new Date()): RaceStatus {
  if (race.horses.some((h) => h.finishPosition != null && h.finishPosition > 0)) return "arrivee";
  const minutes = minutesToStart(race, now);
  if (minutes === null) return "a-venir";
  if (minutes <= 0) return "partie";
  return minutes <= IMMINENT_MINUTES ? "imminente" : "a-venir";
}

/** Arrivée officielle, dans l'ordre (numéros), vide tant qu'elle n'est pas publiée. */
export function officialArrival(race: { horses: Array<{ number: number; finishPosition?: number | null }> }): number[] {
  return race.horses
    .filter((h) => h.finishPosition != null && h.finishPosition > 0)
    .sort((a, b) => a.finishPosition! - b.finishPosition!)
    .map((h) => h.number);
}

/** Ordre chronologique : heure, puis réunion, puis course. */
type TimeKey = Pick<RaceAnalysis, "raceDate" | "startTime" | "reunionNumber" | "courseNumber">;

export function compareRaceTime(a: TimeKey, b: TimeKey): number {
  return a.raceDate.localeCompare(b.raceDate) || a.startTime.localeCompare(b.startTime) || a.reunionNumber - b.reunionNumber || a.courseNumber - b.courseNumber;
}

/** Ancre stable d'une course dans une page (`#R1C3`). */
export function raceAnchor(race: Pick<RaceAnalysis, "reunionNumber" | "courseNumber">): string {
  return `R${race.reunionNumber}C${race.courseNumber}`;
}

/** Prochaine course pas encore partie, dans l'ordre chronologique. */
export function nextRace<T extends TimeKey & StatusInput>(races: T[], now: Date = new Date()): T | null {
  return [...races].sort(compareRaceTime).find((r) => {
    const s = raceStatus(r, now);
    return s === "a-venir" || s === "imminente";
  }) ?? null;
}

export type BetHighlight = "QUINTE_PLUS" | "QUARTE_PLUS" | "PICK5";

export const BET_HIGHLIGHT_LABELS: Record<BetHighlight, string> = {
  QUINTE_PLUS: "Quinté+",
  QUARTE_PLUS: "Quarté+",
  PICK5: "Pick 5",
};

/** Paris phares proposés sur une course (Quarté+ : seulement l'offre régionale, comme l'accueil). */
export function betHighlights(offers: BetOffer[]): BetHighlight[] {
  const out: BetHighlight[] = [];
  if (offers.some((o) => o.type === "QUINTE_PLUS")) out.push("QUINTE_PLUS");
  if (offers.some((o) => o.type === "QUARTE_PLUS" && o.audience === "REGIONAL")) out.push("QUARTE_PLUS");
  if (offers.some((o) => o.type === "PICK5")) out.push("PICK5");
  return out;
}
