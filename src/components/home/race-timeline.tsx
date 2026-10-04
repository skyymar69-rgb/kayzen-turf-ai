"use client";

import Link from "next/link";
import { Fragment, useEffect, useMemo, useRef } from "react";
import { DISCIPLINE_STYLES, titleCase } from "@/components/badges";
import { hasValueBet } from "@/lib/home/race-signals";
import { buildTimeline, formatMinute, type TimelineState } from "@/lib/home/timeline";
import type { RaceAnalysis } from "@/lib/types";
import { useRacePeek } from "./race-peek";
import { raceHref } from "./types";

const CARD_STYLES: Record<TimelineState, string> = {
  imminente: "border-cta/50 bg-cta/10 ring-1 ring-cta/30",
  // Estompée par le fond et la bordure, pas par l'opacité : le texte d'une
  // course passée doit rester lisible (contraste ≥ 4,5:1).
  passee: "border-dashed border-border bg-surface-sub",
  "a-venir": "border-border bg-surface hover:border-accent/40 hover:bg-accent-lo",
};

const STATE_LABELS: Record<TimelineState, string> = {
  imminente: "départ imminent",
  passee: "partie",
  "a-venir": "à venir",
};

/**
 * LIGNE DU TEMPS — les courses du jour dans l'ordre des départs. Pour le jour
 * même, un curseur « maintenant » (heure de Paris, mis à jour chaque minute)
 * s'insère entre les courses parties, estompées, et les suivantes ; la course
 * imminente est mise en avant. Un rail au-dessus situe l'heure entre le
 * premier et le dernier départ.
 */
export function RaceTimeline({ races, nowMs }: { races: RaceAnalysis[]; nowMs: number | null }) {
  const timeline = useMemo(() => buildTimeline(races, nowMs === null ? null : new Date(nowMs)), [races, nowMs]);
  const { peekProps, popover } = useRacePeek();
  const stripRef = useRef<HTMLOListElement>(null);
  const cursorRef = useRef<HTMLLIElement>(null);

  // Garde le curseur en vue quand il avance, sans faire défiler la page.
  useEffect(() => {
    const strip = stripRef.current;
    const cursor = cursorRef.current;
    if (!strip || !cursor) return;
    strip.scrollTo({ left: Math.max(0, cursor.offsetLeft - strip.clientWidth / 3) });
  }, [timeline.cursorIndex]);

  if (timeline.items.length === 0) return null;
  const { cursorIndex, progress, nowMinute } = timeline;
  const nowLabel = nowMinute === null ? "" : formatMinute(nowMinute);

  const cursor = (
    <li ref={cursorRef} aria-label={`Maintenant, ${nowLabel} à Paris`} className="flex shrink-0 flex-col items-center gap-1 self-stretch px-0.5">
      <span aria-hidden="true" className="rounded-full bg-accent px-1.5 py-0.5 font-mono text-[10px] font-bold text-accent-fg">{nowLabel}</span>
      <span aria-hidden="true" className="w-0.5 flex-1 rounded-full bg-accent" />
      <span aria-hidden="true" className="text-[9px] font-bold uppercase tracking-widest text-accent-text">maintenant</span>
    </li>
  );

  return (
    <section aria-labelledby="timeline-titre" className="mb-4 overflow-hidden rounded-2xl border border-border bg-surface shadow-sm">
      <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-3">
        <h2 id="timeline-titre" className="text-xs font-bold uppercase tracking-widest text-muted">Timeline · {timeline.items.length} courses</h2>
        <p className="text-xs text-muted">{timeline.first ?? "—"} → {timeline.last ?? "—"}</p>
      </div>

      {progress !== null && (
        <div className="px-5 pt-3" aria-hidden="true">
          <div className="relative h-1.5 rounded-full bg-surface-sub">
            <div className="absolute inset-y-0 left-0 rounded-full bg-accent/50" style={{ width: `${progress * 100}%` }} />
            <span className="absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-surface bg-accent" style={{ left: `${progress * 100}%` }} />
          </div>
        </div>
      )}

      <ol ref={stripRef} className="flex gap-2 overflow-x-auto kz-scroll px-4 py-3">
        {timeline.items.map(({ race, state }, index) => {
          const isValue = hasValueBet(race);
          const discipline = DISCIPLINE_STYLES[race.discipline] ?? DISCIPLINE_STYLES.Plat;
          return (
            <Fragment key={race.id}>
              {cursorIndex === index && cursor}
              <li className="shrink-0">
                <Link
                  href={raceHref(race)}
                  className={`group flex min-w-[90px] flex-col gap-1 rounded-xl border px-3 py-2.5 text-center transition ${CARD_STYLES[state]}`}
                  {...peekProps(race)}
                >
                  <span className={`font-mono text-[11px] font-bold text-muted ${state === "passee" ? "line-through" : ""}`}>{race.startTime}</span>
                  <span className={`mx-auto rounded px-1.5 py-0.5 text-[10px] font-bold ${discipline}`}>{race.programCode}</span>
                  <span className="max-w-[80px] truncate text-[10px] text-muted">{titleCase(race.name).split(" ")[0]}</span>
                  <span className="sr-only">{titleCase(race.name)}, {STATE_LABELS[state]}</span>
                  {state === "imminente" && <span aria-hidden="true" className="mx-auto h-1 w-1 animate-pulse rounded-full bg-cta" />}
                  {isValue && state !== "imminente" && <span className="text-[11px] font-bold text-warn">Value</span>}
                </Link>
              </li>
            </Fragment>
          );
        })}
        {cursorIndex === timeline.items.length && cursor}
      </ol>
      {popover}
    </section>
  );
}
