"use client";

import { useRouter } from "next/navigation";
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import type { HorseRow } from "@/lib/course-view-model";
import { formatOdds } from "@/lib/format";
import { announceOdds, diffOdds, swipeDirection } from "@/lib/odds-changes";
import { adjacentRaces, type RaceIndexItem } from "@/lib/race-navigation";
import { minutesToStart } from "@/lib/race-status";
import type { RaceAnalysis } from "@/lib/types";

/**
 * VIE DE LA PAGE COURSE — ce qui réagit au temps et aux rafraîchissements :
 *   - éclair sur une cote qui vient de bouger (contexte lu par <OddsCell>) ;
 *   - annonce polie, limitée aux plus gros mouvements, pour lecteur d'écran ;
 *   - compte à rebours dans le titre d'onglet dans la dernière heure ;
 *   - glissement horizontal sur mobile vers la course précédente / suivante.
 */

type Flash = ReadonlyMap<number, "up" | "down">;
const FlashContext = createContext<Flash>(new Map());
const FLASH_MS = 1_800;

export function OddsFlashProvider({ rows, children }: { rows: HorseRow[]; children: ReactNode }) {
  const previous = useRef<Map<number, number> | null>(null);
  const [flash, setFlash] = useState<Flash>(new Map());
  const [message, setMessage] = useState("");

  useEffect(() => {
    const current = rows.map((r) => ({ number: r.horse.number, odds: r.horse.odds }));
    const before = previous.current;
    previous.current = new Map(current.filter((h) => Number.isFinite(h.odds)).map((h) => [h.number, h.odds]));
    if (!before) return;
    const changes = diffOdds(before, current);
    if (changes.length === 0) return;
    // État mis à jour en réponse au rafraîchissement serveur des données.
    setFlash(new Map(changes.map((c) => [c.number, c.to > c.from ? "up" : "down"])));
    setMessage(announceOdds(changes));
    const timer = window.setTimeout(() => setFlash(new Map()), FLASH_MS);
    return () => window.clearTimeout(timer);
  }, [rows]);

  return (
    <FlashContext.Provider value={flash}>
      {children}
      <p aria-live="polite" className="sr-only">
        {message}
      </p>
    </FlashContext.Provider>
  );
}

/** Cote d'un partant ; s'éclaire brièvement quand elle vient de changer (flèche comprise). */
export function OddsCell({ number, odds }: { number: number; odds: number }) {
  const move = useContext(FlashContext).get(number);
  return (
    <span className={`rounded px-1 ${move === "down" ? "kz-flash-down" : move === "up" ? "kz-flash-up" : ""}`}>
      {move && <span aria-hidden="true" className={move === "down" ? "text-accent-text" : "text-danger"}>{move === "down" ? "↓ " : "↑ "}</span>}
      {formatOdds(odds, 1)}
    </span>
  );
}

/** « 12 min · R1C3 » dans le titre d'onglet, dans l'heure qui précède le départ. */
export function TabCountdown({ race }: { race: Pick<RaceAnalysis, "raceDate" | "startTime" | "programCode"> }) {
  useEffect(() => {
    const original = document.title;
    let shown = original;
    function tick() {
      const minutes = minutesToStart(race);
      shown = minutes !== null && minutes > 0 && minutes <= 60 ? `${Math.max(1, Math.round(minutes))} min — ${original}` : original;
      document.title = shown;
    }
    tick();
    const id = window.setInterval(tick, 30_000);
    return () => {
      window.clearInterval(id);
      // Ne restaure que si le titre est encore le nôtre (navigation client).
      if (document.title === shown) document.title = original;
    };
  }, [race]);
  return null;
}

/** Zones où un glissement horizontal sert déjà à faire défiler un contenu. */
const NO_SWIPE = ".overflow-x-auto, .kz-scroll, [data-no-swipe], input, textarea, select";

export function SwipeNavigation({ dayIndex, raceId }: { dayIndex: RaceIndexItem[]; raceId: string }) {
  const router = useRouter();
  useEffect(() => {
    const { previous, next } = adjacentRaces(dayIndex, raceId);
    if (!previous && !next) return;
    let start: { x: number; y: number } | null = null;

    function onStart(e: TouchEvent) {
      const target = e.target as Element | null;
      start = e.touches.length === 1 && !target?.closest(NO_SWIPE) ? { x: e.touches[0].clientX, y: e.touches[0].clientY } : null;
    }
    function onEnd(e: TouchEvent) {
      if (!start) return;
      const touch = e.changedTouches[0];
      const direction = swipeDirection(touch.clientX - start.x, touch.clientY - start.y);
      start = null;
      const target = direction === "next" ? next : direction === "previous" ? previous : null;
      if (target) router.push(`/races/${encodeURIComponent(target.id)}`);
    }
    window.addEventListener("touchstart", onStart, { passive: true });
    window.addEventListener("touchend", onEnd, { passive: true });
    return () => {
      window.removeEventListener("touchstart", onStart);
      window.removeEventListener("touchend", onEnd);
    };
  }, [dayIndex, raceId, router]);
  return null;
}
