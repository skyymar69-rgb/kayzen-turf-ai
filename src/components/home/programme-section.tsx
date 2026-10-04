"use client";

import { ArrowUpDown, BarChart3 } from "lucide-react";
import { dateForDay, formatRelativeDay, formatShortDate } from "@/lib/home/days";
import type { RaceAnalysis } from "@/lib/types";
import { MeetingTiles, StickyMeetingChips } from "./meetings-list";
import { PdfDownloadButton } from "./pdf-download-button";
import { ProgrammeFilters } from "./programme-filters";
import { CompactRaces, RaceCards, RacesTable } from "./programme-races";
import type { HomeProgramme } from "./use-home-programme";

const LIST_ID = "programme-courses";

/** Programme complet : en-tête, réunions, filtres, puis courses de la réunion choisie. */
export function ProgrammeSection({ races, programme, nowMs, favs, onToggleFav }: {
  races: RaceAnalysis[];
  programme: HomeProgramme;
  nowMs: number | null;
  favs: ReadonlySet<string>;
  onToggleFav: (id: string) => void;
}) {
  const { dayFilter, meetings, dayRaces, filteredMeetings, selectedMeeting, selectedRace, visibleRaces, signalsFor } = programme;
  if (!selectedMeeting || !selectedRace) return null;
  const featureCount = dayRaces.filter((r) => signalsFor(r).highlights.length > 0).length;
  const date = dateForDay(races, dayFilter);
  const toggleCls = (on: boolean) =>
    `flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-bold transition ${on ? "border-accent bg-accent-lo text-accent-text" : "border-border bg-surface text-muted hover:border-accent/40"}`;
  const listProps = { races: visibleRaces, activeId: selectedRace.id, signalsFor, nowMs, favs, onToggleFav };

  return (
    <section className="rounded-2xl border border-border bg-surface shadow-sm" aria-label="Programme des réunions">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-muted">{formatRelativeDay(dayFilter)} · {formatShortDate(date)}</p>
          <h2 className="font-display text-xl font-bold text-fg">Programme PMU</h2>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-4 text-sm text-muted">
            <span><strong className="text-fg">{meetings.length}</strong> réunion{meetings.length > 1 ? "s" : ""}</span>
            <span><strong className="text-fg">{dayRaces.length}</strong> courses</span>
            <span><strong className="text-fg">{featureCount}</strong> temps fort{featureCount > 1 ? "s" : ""}</span>
          </div>
          <button
            aria-label={programme.meetingSort === "score" ? "Trier par numéro de réunion" : "Trier par score"}
            className={toggleCls(programme.meetingSort === "score")}
            onClick={programme.toggleMeetingSort}
            type="button"
            title="Trier les réunions"
          >
            <ArrowUpDown size={12} /> {programme.meetingSort === "score" ? "Par score" : "Par R#"}
          </button>
          <button
            aria-label={programme.compactView ? "Vue étendue" : "Vue condensée"}
            className={toggleCls(programme.compactView)}
            onClick={programme.toggleCompactView}
            type="button"
            title="Changer la densité d'affichage"
          >
            <BarChart3 size={12} /> {programme.compactView ? "Condensé" : "Étendu"}
          </button>
          <PdfDownloadButton date={date} />
        </div>
      </div>

      <MeetingTiles meetings={filteredMeetings} onSelect={programme.setSelectedMeetingKey} selectedKey={selectedMeeting.key} />

      <ProgrammeFilters
        disciplineFilter={programme.disciplineFilter}
        onDiscipline={programme.setDisciplineFilter}
        onQuery={programme.setQuery}
        onToggleValue={programme.toggleValueBets}
        query={programme.query}
        resultCount={visibleRaces.length}
        strategy={selectedMeeting.strategy}
        valueBetsOnly={programme.valueBetsOnly}
      />

      <StickyMeetingChips meetings={filteredMeetings} onSelect={programme.setSelectedMeetingKey} selectedKey={selectedMeeting.key} targetId={LIST_ID} />

      <div id={LIST_ID} className="scroll-mt-[120px]">
        {programme.compactView && <CompactRaces activeId={selectedRace.id} races={visibleRaces} signalsFor={signalsFor} />}
        <RacesTable {...listProps} hidden={programme.compactView} racecourse={selectedMeeting.racecourse} />
        <RaceCards {...listProps} />
      </div>
    </section>
  );
}
