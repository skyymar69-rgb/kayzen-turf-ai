import { jourParis, minutesActuellesParis } from "@/lib/paris-time";
import type { RaceStatus } from "@/lib/race-status";
import type { RaceAnalysis } from "@/lib/types";
import { raceStatusAt, sortByStart, startMinutes } from "./race-signals";

/**
 * LIGNE DU TEMPS — les courses d'un jour dans l'ordre des départs, et la
 * position du curseur « maintenant ».
 *
 * Tout se compte à l'heure de Paris : l'état de chaque course vient de
 * `raceStatus` (instant de départ à Paris), la minute du curseur de
 * `minutesActuellesParis`. Le curseur n'existe que si le jour affiché est
 * aujourd'hui à Paris — hier et demain n'ont pas de « maintenant ».
 */

export type TimelineState = "passee" | "imminente" | "a-venir";

export type TimelineItem = { race: RaceAnalysis; status: RaceStatus; state: TimelineState };

export type Timeline = {
  items: TimelineItem[];
  /** Index de la première course pas encore partie (le curseur se place juste avant), `null` hors du jour. */
  cursorIndex: number | null;
  /** Avancement de la journée entre le premier et le dernier départ (0 à 1), `null` hors du jour. */
  progress: number | null;
  /** Minute de Paris du curseur, `null` hors du jour. */
  nowMinute: number | null;
  first: string | null;
  last: string | null;
};

function stateOf(status: RaceStatus): TimelineState {
  if (status === "imminente") return "imminente";
  return status === "a-venir" ? "a-venir" : "passee";
}

export function buildTimeline(races: RaceAnalysis[], now: Date | null): Timeline {
  const sorted = sortByStart(races);
  const items = sorted.map((race) => {
    const status = raceStatusAt(race, now);
    return { race, status, state: stateOf(status) };
  });
  const first = sorted[0]?.startTime ?? null;
  const last = sorted[sorted.length - 1]?.startTime ?? null;
  const isToday = now !== null && sorted.length > 0 && sorted[0].raceDate === jourParis(now);
  if (!isToday) return { items, cursorIndex: null, progress: null, nowMinute: null, first, last };

  const nowMinute = minutesActuellesParis(now);
  const pending = items.findIndex((i) => i.state !== "passee");
  const start = startMinutes(sorted[0].startTime);
  const end = startMinutes(sorted[sorted.length - 1].startTime);
  const span = Math.max(end - start, 1);
  const progress = Math.min(1, Math.max(0, (nowMinute - start) / span));
  return { items, cursorIndex: pending === -1 ? items.length : pending, progress, nowMinute, first, last };
}

/** « 905 » → « 15:05 ». */
export function formatMinute(minute: number): string {
  const h = Math.floor(minute / 60) % 24;
  return `${String(h).padStart(2, "0")}:${String(minute % 60).padStart(2, "0")}`;
}
