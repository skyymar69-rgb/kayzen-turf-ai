"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { RaceStatusPill } from "@/components/badges";
import { properName } from "@/lib/format";
import { adjacentRaces, indexStatus, meetingRaces, type RaceIndexItem } from "@/lib/race-navigation";
import { RACE_STATUS_LABELS, type RaceStatus } from "@/lib/race-status";

/**
 * NAVIGATION ENTRE COURSES — précédente et suivante du jour, carte de la
 * réunion (R1C1 … Cn). L'état de chaque course dépend de l'heure : il est
 * calculé dans le navigateur, une fois la page hydratée, et relu toutes les
 * 30 secondes. Avant, seule l'arrivée (connue du serveur) est affichée.
 */

const TICK_MS = 30_000;

function subscribe(onChange: () => void) {
  const id = setInterval(onChange, TICK_MS);
  return () => clearInterval(id);
}
const tickSnapshot = () => Math.floor(Date.now() / TICK_MS);
const serverSnapshot = () => null;

function useNow(): Date | null {
  const tick = useSyncExternalStore(subscribe, tickSnapshot, serverSnapshot);
  return tick === null ? null : new Date(tick * TICK_MS);
}

function statusOf(item: RaceIndexItem, now: Date | null): RaceStatus | null {
  if (item.arrived) return "arrivee";
  return now ? indexStatus(item, now) : null;
}

const CHIP_STYLES: Record<RaceStatus, string> = {
  "a-venir": "bg-surface-sub text-fg",
  imminente: "bg-warn-lo text-warn",
  partie: "bg-surface-inv text-white",
  arrivee: "bg-accent-lo text-accent-text",
};

function AdjacentLink({ item, direction, now }: { item: RaceIndexItem | null; direction: "prev" | "next"; now: Date | null }) {
  if (!item) return <span aria-hidden="true" className="hidden sm:block" />;
  const status = statusOf(item, now);
  const Icon = direction === "prev" ? ChevronLeft : ChevronRight;
  return (
    <Link
      className={`flex min-h-12 min-w-0 items-center gap-2 rounded-xl border border-border bg-surface px-3 py-2 text-sm shadow-sm transition hover:border-accent ${direction === "next" ? "justify-end text-right" : ""}`}
      href={`/races/${encodeURIComponent(item.id)}`}
      rel={direction}
    >
      {direction === "prev" && <Icon aria-hidden="true" className="shrink-0 text-muted" size={16} />}
      <span className="min-w-0">
        <span className="block text-[10px] font-bold uppercase tracking-widest text-muted">{direction === "prev" ? "Course précédente" : "Course suivante"}</span>
        <span className="flex flex-wrap items-center gap-1.5 font-semibold text-fg">
          {direction === "next" && status && <RaceStatusPill status={status} />}
          <span className="font-mono">{item.programCode}</span>
          <span className="text-muted">{item.startTime}</span>
          {direction === "prev" && status && <RaceStatusPill status={status} />}
        </span>
        <span className="block truncate text-xs text-muted">{properName(item.racecourse)}</span>
      </span>
      {direction === "next" && <Icon aria-hidden="true" className="shrink-0 text-muted" size={16} />}
    </Link>
  );
}

export function RaceNavigation({ index, current }: { index: RaceIndexItem[]; current: Pick<RaceIndexItem, "id" | "raceDate" | "reunionNumber"> }) {
  const now = useNow();
  if (index.length === 0) return null;
  const { previous, next } = adjacentRaces(index, current.id);
  const meeting = meetingRaces(index, current);

  return (
    <div className="mt-3 grid gap-3">
      {(previous || next) && (
        <nav aria-label="Courses du jour" className="grid grid-cols-2 gap-2">
          <AdjacentLink direction="prev" item={previous} now={now} />
          <AdjacentLink direction="next" item={next} now={now} />
        </nav>
      )}
      {meeting.length > 1 && (
        <nav aria-label={`Réunion R${current.reunionNumber}`} className="flex flex-wrap items-center gap-1.5">
          <span className="mr-1 text-[10px] font-bold uppercase tracking-widest text-muted">Réunion R{current.reunionNumber}</span>
          {meeting.map((item) => {
            const status = statusOf(item, now);
            const here = item.id === current.id;
            const label = `${item.programCode}, ${item.startTime}${status ? `, ${RACE_STATUS_LABELS[status]}` : ""}`;
            return (
              <Link
                key={item.id}
                aria-current={here ? "page" : undefined}
                aria-label={label}
                className={`inline-flex min-h-8 min-w-11 items-center justify-center rounded-lg px-2 font-mono text-xs font-bold transition hover:ring-2 hover:ring-accent/50 ${
                  status ? CHIP_STYLES[status] : "bg-surface-sub text-fg"
                } ${here ? "ring-2 ring-accent ring-offset-1 ring-offset-bg" : ""}`}
                href={`/races/${encodeURIComponent(item.id)}`}
                title={label}
              >
                C{item.courseNumber}
              </Link>
            );
          })}
        </nav>
      )}
    </div>
  );
}
