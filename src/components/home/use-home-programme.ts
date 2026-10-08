"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { adjacentDay, racesOfDay, type ProgrammeDay } from "@/lib/home/days";
import { buildDayInsights, featuredRace, groupRacesByMeeting } from "@/lib/home/meetings";
import { hasAiMarketGap, raceOpportunity, selectTimelineRace } from "@/lib/home/race-signals";
import { minutesActuellesParis } from "@/lib/paris-time";
import { betHighlights } from "@/lib/race-status";
import type { RaceAnalysis } from "@/lib/types";
import type { DisciplineFilter, MeetingSort, RaceSignals } from "./types";

/**
 * État et données dérivées du programme de l'accueil : jour, réunion, filtres,
 * course active. Les composants d'affichage ne font que lire ce qui sort d'ici.
 */
export function useHomeProgramme(races: RaceAnalysis[], nowMs: number | null) {
  const [dayFilter, setDayFilter] = useState<ProgrammeDay>("today");
  const [disciplineFilter, setDisciplineFilterState] = useState<DisciplineFilter>("Tous");
  const [selectedMeetingKey, setSelectedMeetingKey] = useState("");
  const [query, setQuery] = useState("");
  const [valueBetsOnly, setValueBetsOnly] = useState(false);
  const [meetingSort, setMeetingSort] = useState<MeetingSort>("numero");
  const [compactView, setCompactView] = useState(false);

  // Minute de Paris ; 0 au rendu serveur, comme avant le découpage.
  const currentMinute = nowMs === null ? 0 : minutesActuellesParis(new Date(nowMs));
  const dayRaces = useMemo(() => racesOfDay(races, dayFilter), [dayFilter, races]);
  const meetings = useMemo(() => groupRacesByMeeting(dayRaces), [dayRaces]);
  const filteredMeetings = useMemo(() => {
    const base = disciplineFilter === "Tous" ? meetings : meetings.filter((m) => m.races.some((r) => r.discipline === disciplineFilter));
    return meetingSort === "score" ? [...base].sort((a, b) => b.score - a.score) : base;
  }, [meetings, disciplineFilter, meetingSort]);

  // Hier et demain ne se lisent pas à l'heure actuelle : la course « active »
  // de demain est la première de la journée, pas celle qui suit 15 h.
  const timelineRace = useMemo(
    () => selectTimelineRace(dayRaces, dayFilter === "today" ? currentMinute : -1),
    [currentMinute, dayRaces, dayFilter],
  );

  /* `raceOpportunity` recalcule un `probableArrival` complet (Plackett-Luce sur
     tout le peloton) : appelé plusieurs fois par course et par rendu entre le
     hero, le tableau, les cartes mobiles, la vue condensée et le Top 3. Calculé
     une fois par course, tant que le programme du jour ne change pas. */
  const raceSignals = useMemo(
    () => new Map<string, RaceSignals>(dayRaces.map((race) => [race.id, { signal: raceOpportunity(race), highlights: betHighlights(race.betTypes) }])),
    [dayRaces],
  );
  const signalsFor = useCallback(
    (race: RaceAnalysis): RaceSignals => raceSignals.get(race.id) ?? { signal: raceOpportunity(race), highlights: betHighlights(race.betTypes) },
    [raceSignals],
  );

  const insights = useMemo(() => buildDayInsights(dayRaces), [dayRaces]);
  const star = useMemo(() => featuredRace(dayRaces), [dayRaces]);

  const selectedMeeting =
    filteredMeetings.find((m) => m.key === selectedMeetingKey) ??
    filteredMeetings.find((m) => m.races.some((r) => r.id === timelineRace?.id)) ??
    filteredMeetings[0];
  const selectedRace =
    timelineRace && selectedMeeting?.races.some((r) => r.id === timelineRace.id) ? timelineRace : selectedMeeting?.races[0];

  const normalizedQuery = query.trim().toLowerCase();
  const visibleRaces = (selectedMeeting?.races ?? []).filter((r) => {
    // Le filtre discipline écartait les réunions sans la discipline, mais
    // laissait passer les courses des autres disciplines d'une réunion mixte.
    if (disciplineFilter !== "Tous" && r.discipline !== disciplineFilter) return false;
    if (valueBetsOnly && !hasAiMarketGap(r)) return false;
    if (!normalizedQuery) return true;
    return `${r.programCode} ${r.name} ${r.specialty} ${r.startTime}`.toLowerCase().includes(normalizedQuery);
  });

  const selectDay = useCallback((day: RaceAnalysis["relativeDay"]) => {
    if (day === "other") return;
    setDayFilter(day);
    setSelectedMeetingKey("");
    setQuery("");
    setDisciplineFilterState("Tous");
  }, []);

  const setDisciplineFilter = useCallback((d: DisciplineFilter) => {
    setDisciplineFilterState(d);
    setSelectedMeetingKey("");
  }, []);

  /* amélioration #22 — raccourcis clavier ←/→ pour changer de jour */
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const cible = e.target as HTMLElement | null;
      if (cible?.closest("input, select, textarea, [contenteditable='true']")) return;
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
      const next = adjacentDay(dayFilter, e.key === "ArrowRight" ? 1 : -1);
      if (next) selectDay(next);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [dayFilter, selectDay]);

  return {
    dayFilter, selectDay,
    disciplineFilter, setDisciplineFilter,
    selectedMeetingKey, setSelectedMeetingKey,
    query, setQuery,
    valueBetsOnly, toggleValueBets: () => setValueBetsOnly((v) => !v),
    meetingSort, toggleMeetingSort: () => setMeetingSort((s) => (s === "score" ? "numero" : "score")),
    compactView, toggleCompactView: () => setCompactView((v) => !v),
    dayRaces, meetings, filteredMeetings, selectedMeeting, selectedRace, visibleRaces,
    signalsFor, insights, star,
  };
}

export type HomeProgramme = ReturnType<typeof useHomeProgramme>;
