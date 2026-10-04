"use client";

import { BET_HIGHLIGHT_LABELS } from "@/lib/race-status";
import { titleCase } from "@/components/badges";
import { valueRaceCount, type RaceMeeting } from "@/lib/home/meetings";
import { DifficultyPip } from "./ui";

/** Tuiles des réunions du jour, défilement horizontal. */
export function MeetingTiles({ meetings, selectedKey, onSelect }: {
  meetings: RaceMeeting[];
  selectedKey: string | undefined;
  onSelect: (key: string) => void;
}) {
  return (
    <div className="border-b border-border">
      <div className="flex overflow-x-auto kz-scroll">
        {meetings.map((meeting) => {
          const active = meeting.key === selectedKey;
          const vbCount = valueRaceCount(meeting);
          return (
            <button
              key={meeting.key}
              aria-pressed={active}
              className={`relative flex min-w-[180px] flex-col gap-1 border-r border-border px-4 py-3 text-left transition sm:min-w-[210px] ${
                active ? "bg-accent text-accent-fg" : "bg-surface text-fg hover:bg-surface-sub"
              }`}
              onClick={() => onSelect(meeting.key)}
              type="button"
            >
              <div className="flex items-center gap-2">
                <span className={`text-2xl font-display font-bold ${active ? "text-accent-fg" : "text-fg"}`}>R{meeting.reunionNumber}</span>
                <DifficultyPip difficulty={meeting.difficulty} active={active} />
              </div>
              <span className={`text-sm font-semibold leading-tight ${active ? "text-accent-fg" : "text-fg"}`}>{titleCase(meeting.racecourse)}</span>
              <span className={`text-xs ${active ? "text-accent-fg/75" : "text-muted"}`}>
                {meeting.races.length} course{meeting.races.length > 1 ? "s" : ""} · score {meeting.score}
              </span>
              <div className="mt-1 flex flex-wrap gap-1">
                {meeting.highlights.slice(0, 2).map((h) => (
                  <span key={h} className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${active ? "bg-accent-fg/15 text-accent-fg" : "bg-accent-lo text-accent-text"}`}>
                    {BET_HIGHLIGHT_LABELS[h]}
                  </span>
                ))}
                {vbCount > 0 && (
                  <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${active ? "bg-accent-fg/15 text-accent-fg" : "bg-warn-lo text-warn"}`}>
                    {vbCount} value
                  </span>
                )}
              </div>
              {active && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-accent-fg/40" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Sélecteur de réunion collant : reste sous l'en-tête du site pendant qu'on
 * parcourt le programme. Choisir une réunion l'affiche et ramène le haut de
 * la liste des courses en vue.
 */
export function StickyMeetingChips({ meetings, selectedKey, onSelect, targetId }: {
  meetings: RaceMeeting[];
  selectedKey: string | undefined;
  onSelect: (key: string) => void;
  targetId: string;
}) {
  if (meetings.length < 2) return null;
  function choose(key: string) {
    onSelect(key);
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    document.getElementById(targetId)?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
  }
  return (
    <nav aria-label="Aller à une réunion" className="sticky top-[65px] z-30 border-b border-border bg-surface/95 backdrop-blur-sm">
      <div className="flex min-w-0 items-center gap-2 overflow-x-auto kz-scroll px-4 py-2">
        <span className="shrink-0 text-[10px] font-bold uppercase tracking-widest text-muted">Réunions</span>
        {meetings.map((meeting) => {
          const active = meeting.key === selectedKey;
          return (
            <button
              key={meeting.key}
              aria-pressed={active}
              className={`flex min-h-9 shrink-0 items-center gap-1.5 rounded-full border px-3 text-xs font-bold transition ${
                active ? "border-accent bg-accent text-accent-fg" : "border-border bg-surface text-fg hover:border-accent/40 hover:bg-accent-lo"
              }`}
              onClick={() => choose(meeting.key)}
              title={titleCase(meeting.racecourse)}
              type="button"
            >
              R{meeting.reunionNumber}
              <span className={`hidden font-semibold sm:inline ${active ? "text-accent-fg/80" : "text-muted"}`}>{titleCase(meeting.racecourse)}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
