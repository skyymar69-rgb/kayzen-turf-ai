"use client";

import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  BellRing,
  Brain,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Flag,
  Gauge,
  Search,
  Sparkles,
  TrendingUp,
  Trophy,
  Zap,
} from "lucide-react";
import { useMemo, useState, useSyncExternalStore } from "react";
import { probableArrival, raceToContext } from "@/lib/bet-recommendations";
import type { BetOffer, RaceAnalysis } from "@/lib/types";

type DashboardProps = { races: RaceAnalysis[] };

type RaceMeeting = {
  key: string;
  reunionNumber: number;
  racecourse: string;
  startTime: string;
  score: number;
  difficulty: "Facile" | "Ouverte" | "Complexe";
  strategy: string;
  specialties: string[];
  highlights: string[];
  races: RaceAnalysis[];
};

const DAY_ORDER: RaceAnalysis["relativeDay"][] = ["yesterday", "today", "tomorrow"];

const BET_BADGE: Record<string, string> = {
  QUINTE_PLUS: "bg-red-500 text-white",
  QUARTE_PLUS: "bg-sky-500 text-white",
  PICK5:       "bg-yellow-300 text-red-700",
  MULTI:       "bg-pink-600 text-white",
  TRIO:        "bg-orange-400 text-white",
};

export function Dashboard({ races }: DashboardProps) {
  const currentMinute = useCurrentMinute();
  const [dayFilter, setDayFilter]           = useState<RaceAnalysis["relativeDay"]>("today");
  const [selectedMeetingKey, setSelectedMeetingKey] = useState("");
  const [query, setQuery]                   = useState("");

  const dayRaces = useMemo(
    () => races.filter((r) => r.relativeDay === dayFilter)
               .sort((a, b) => a.reunionNumber - b.reunionNumber || a.courseNumber - b.courseNumber),
    [dayFilter, races],
  );
  const meetings   = useMemo(() => groupRacesByMeeting(dayRaces), [dayRaces]);
  const timelineRace = useMemo(() => selectTimelineRace(dayRaces, currentMinute), [currentMinute, dayRaces]);

  const selectedMeeting =
    meetings.find((m) => m.key === selectedMeetingKey) ??
    meetings.find((m) => m.races.some((r) => r.id === timelineRace?.id)) ??
    meetings[0];

  const selectedRace =
    timelineRace && selectedMeeting?.races.some((r) => r.id === timelineRace.id)
      ? timelineRace
      : selectedMeeting?.races[0];

  const normalizedQuery = query.trim().toLowerCase();
  const visibleRaces = selectedMeeting?.races.filter((r) => {
    if (!normalizedQuery) return true;
    return `${r.programCode} ${r.name} ${r.specialty} ${r.startTime}`.toLowerCase().includes(normalizedQuery);
  }) ?? [];

  const topArrival      = selectedRace ? probableArrival(selectedRace.horses, raceToContext(selectedRace)).slice(0, 5) : [];
  const dayInsights     = buildDayInsights(dayRaces);
  const todayDate       = dateForDay(races, "today");
  const dayRunnerCount  = dayRaces.reduce((t, r) => t + r.horses.length, 0);
  const dayFeatureCount = dayRaces.filter((r) => raceHighlights(r.betTypes).length > 0).length;

  function selectDay(day: RaceAnalysis["relativeDay"]) {
    if (day === "other") return;
    setDayFilter(day);
    setSelectedMeetingKey("");
    setQuery("");
  }

  /* ── Empty state ─────────────────────────────────────────────── */
  if (!selectedMeeting || !selectedRace) {
    return (
      <main className="grid min-h-[60vh] place-items-center px-4" id="contenu-principal">
        <div className="max-w-sm rounded-2xl border border-border bg-surface p-8 text-center shadow-sm">
          <Flag className="mx-auto text-accent" size={36} />
          <h1 className="mt-4 font-display text-2xl font-bold text-fg">Kayzen Turf AI</h1>
          <p className="mt-2 text-sm leading-6 text-muted">Aucune course française disponible sur cette date.</p>
          <button
            className="mt-6 inline-flex items-center gap-2 rounded-xl bg-cta px-5 py-2.5 text-sm font-semibold text-cta-text transition hover:bg-cta-hi"
            onClick={() => selectDay("today")}
            type="button"
          >
            Voir aujourd'hui
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-bg pb-20" id="contenu-principal">
      <div className="mx-auto max-w-[1480px] px-4 sm:px-6 lg:px-8">

        {/* ── HERO PROGRAMME ────────────────────────────────────── */}
        <section aria-label="Programme PMU" className="pt-6 pb-4" id="programme">
          <div
            className="relative overflow-hidden rounded-2xl"
            style={{ background: "linear-gradient(160deg, #0c2318 0%, #0f3022 50%, #0a1e14 100%)" }}
          >
            {/* Motif diagonal fond */}
            <div aria-hidden="true" className="pointer-events-none absolute inset-0 opacity-[0.035]"
              style={{ backgroundImage: "repeating-linear-gradient(45deg,#fff 0,#fff 1px,transparent 0,transparent 50%)", backgroundSize: "18px 18px" }} />

            <div className="relative">

              {/* ── Bandeau titre + sélecteur jour ──────────────────── */}
              <div className="flex flex-col gap-0 border-b border-white/10 sm:flex-row sm:items-stretch">
                {/* Titre */}
                <div className="flex flex-col justify-center gap-1 px-5 py-4 sm:min-w-[220px] sm:border-r sm:border-white/10">
                  <h1 className="font-display text-xl font-bold leading-tight text-white">
                    Programme PMU
                  </h1>
                  <p className="text-xs text-white/65">
                    {meetings.length} réunion{meetings.length > 1 ? "s" : ""} · {dayRaces.length} courses · {dayRunnerCount} partants
                  </p>
                </div>

                {/* Sélecteur Hier / Aujourd'hui / Demain */}
                <div className="flex flex-1">
                  {DAY_ORDER.map((day) => {
                    const active = dayFilter === day;
                    const date   = dateForDay(races, day);
                    const count  = races.filter((r) => r.relativeDay === day).length;
                    return (
                      <button
                        key={day}
                        aria-pressed={active}
                        className={`relative flex flex-1 flex-col items-center justify-center gap-0.5 py-3 text-center transition sm:py-4 ${
                          active ? "bg-white/10" : "hover:bg-white/5"
                        }`}
                        onClick={() => selectDay(day)}
                        type="button"
                      >
                        <span className={`text-[10px] font-bold uppercase tracking-widest ${active ? "text-cta" : "text-slate-400"}`}>
                          {formatRelativeDay(day)}
                        </span>
                        <span className={`font-display text-base font-bold sm:text-lg ${active ? "text-white" : "text-slate-200"}`}>
                          {formatShortDate(date)}
                        </span>
                        <span className={`text-[10px] ${active ? "text-white/65" : "text-slate-400"}`}>
                          {count > 0 ? `${count} course${count > 1 ? "s" : ""}` : "—"}
                        </span>
                        {active && <span className="absolute bottom-0 left-2 right-2 h-0.5 rounded-t-full bg-cta" />}
                      </button>
                    );
                  })}
                </div>

                {/* Lien pronostics */}
                <div className="hidden items-center border-l border-white/10 px-4 sm:flex">
                  <Link href="/pronostics" className="flex items-center gap-1.5 text-xs font-semibold text-slate-300 transition hover:text-white">
                    Pronostics <ArrowRight size={12} />
                  </Link>
                </div>
              </div>

              {/* ── Corps : réunions à gauche, courses à droite ─────── */}
              <div className="grid lg:grid-cols-[280px_1fr]">

                {/* Colonne réunions */}
                <div className="border-b border-white/10 lg:border-b-0 lg:border-r lg:border-white/10">
                  <div className="flex overflow-x-auto lg:flex-col kz-scroll">
                    {meetings.map((meeting) => {
                      const active = meeting.key === selectedMeeting.key;
                      return (
                        <button
                          key={meeting.key}
                          aria-pressed={active}
                          className={`flex min-w-[160px] shrink-0 flex-col gap-0.5 border-r border-white/8 px-4 py-3 text-left transition lg:min-w-0 lg:border-b lg:border-r-0 lg:border-white/8 ${
                            active ? "bg-white/12" : "hover:bg-white/6"
                          }`}
                          onClick={() => setSelectedMeetingKey(meeting.key)}
                          type="button"
                        >
                          <div className="flex items-center gap-2">
                            <span className={`font-display text-lg font-bold ${active ? "text-cta" : "text-slate-200"}`}>
                              R{meeting.reunionNumber}
                            </span>
                            <DifficultyPip difficulty={meeting.difficulty} active={active} />
                          </div>
                          <span className={`text-xs font-semibold leading-tight ${active ? "text-white" : "text-slate-300"}`}>
                            {titleCase(meeting.racecourse)}
                          </span>
                          <span className={`text-[10px] ${active ? "text-white/65" : "text-slate-400"}`}>
                            {meeting.races.length} courses
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Colonne courses */}
                <div className="kz-scroll max-h-[420px] overflow-y-auto lg:max-h-[440px]">
                  {visibleRaces.length === 0 ? (
                    <p className="px-5 py-8 text-center text-sm text-white/40">Aucune course disponible.</p>
                  ) : (
                    <div className="divide-y divide-white/8">
                      {visibleRaces.map((race) => {
                        const active  = race.id === selectedRace?.id;
                        const status  = raceStatus(race, currentMinute);
                        const signal  = raceOpportunity(race);
                        const highlights = raceHighlights(race.betTypes);
                        return (
                          <Link
                            key={race.id}
                            href={`/races/${encodeURIComponent(race.id)}`}
                            className={`group flex items-center gap-3 px-4 py-3 transition hover:bg-white/8 ${active ? "bg-white/10" : ""}`}
                          >
                            {/* Badge course */}
                            <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg font-display text-xs font-bold ${
                              active ? "bg-cta text-cta-text" : "bg-white/10 text-white/70"
                            }`}>
                              C{race.courseNumber}
                            </span>

                            {/* Info */}
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <span className="truncate text-sm font-semibold text-white">{titleCase(race.name)}</span>
                                {highlights.slice(0, 1).map((h) => (
                                  <span key={h.label} className={`hidden shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-bold sm:inline ${h.className}`}>{h.label}</span>
                                ))}
                              </div>
                              <div className="mt-0.5 flex items-center gap-2 text-[11px] text-slate-400">
                                <span>{race.startTime}</span>
                                <span>·</span>
                                <span>{titleCase(race.specialty)}</span>
                                <span>·</span>
                                <span>{race.horses.length} partants</span>
                              </div>
                            </div>

                            {/* Signal IA + status */}
                            <div className="flex shrink-0 flex-col items-end gap-1">
                              <span className={`text-xs font-bold ${
                                signal.startsWith("Value") ? "text-cta" :
                                signal.startsWith("Base fiable") ? "text-green-400" :
                                signal.startsWith("Outsider") ? "text-yellow-400" :
                                signal === "À éviter" || signal.startsWith("Favori fragile") ? "text-red-400" :
                                signal === "Signal faible" ? "text-slate-500" :
                                "text-slate-300"
                              }`}>{signal}</span>
                              <StatusChip status={status} dark />
                            </div>
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>

              </div>

              {/* ── Footer hero ──────────────────────────────────────── */}
              <div className="flex items-center justify-between border-t border-white/10 px-5 py-2.5">
                <p className="text-[10px] text-slate-400">Outil d'aide à la décision — aucun résultat ni gain garanti</p>
                <Link href="/tarifs" className="text-[10px] font-semibold text-cta transition hover:text-cta-hi">
                  Accès premium →
                </Link>
              </div>

            </div>
          </div>
        </section>

        {/* ── INSIGHTS DU JOUR ──────────────────────────────────── */}
        <section aria-label="Indicateurs du jour" className="mb-4 grid gap-3 sm:grid-cols-3">
          <InsightCard
            icon={<TrendingUp size={18} />}
            label="Qualité programme"
            tone="green"
            value={`${dayInsights.programScore}/100`}
            detail={`${dayInsights.valueRaces} course${dayInsights.valueRaces > 1 ? "s" : ""} à signal positif`}
          />
          <InsightCard
            icon={<BellRing size={18} />}
            label="Alerte prioritaire"
            tone="amber"
            value={dayInsights.bestAlert}
            detail={dayInsights.nextPriority
              ? `${dayInsights.nextPriority.programCode} — ${titleCase(dayInsights.nextPriority.name)}`
              : "Aucune alerte forte"}
          />
          <InsightCard
            icon={<Gauge size={18} />}
            label="Lecture marché"
            tone="dark"
            value={dayInsights.marketMood}
            detail={`${dayInsights.avoidRaces} à éviter · ${dayInsights.focusRaces} focus`}
          />
        </section>

        {/* ── TOP 3 COURSES À JOUER ─────────────────────────────── */}
        {dayInsights.topRaces.length > 0 && (
          <section className="mb-4 rounded-2xl border border-border bg-surface shadow-sm">
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-muted">Décision rapide</p>
                <h2 className="font-display text-xl font-bold text-fg">Top {dayInsights.topRaces.length} courses à jouer</h2>
              </div>
              <Link href="/pronostics" className="flex items-center gap-1.5 text-sm font-semibold text-accent-text transition hover:text-accent">
                Tout voir <ArrowRight size={14} />
              </Link>
            </div>
            <div className="grid gap-px bg-border sm:grid-cols-3">
              {dayInsights.topRaces.map((race, i) => {
                const best = probableArrival(race.horses, raceToContext(race))[0];
                return (
                  <Link
                    key={race.id}
                    href={`/races/${encodeURIComponent(race.id)}`}
                    className="group flex flex-col gap-3 bg-surface p-5 transition hover:bg-surface-sub"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="grid h-7 w-7 place-items-center rounded-lg bg-accent font-mono text-xs font-bold text-white">
                        {i + 1}
                      </span>
                      <TierBadge tier={race.bettingTier} />
                    </div>
                    <div>
                      <p className="font-mono text-xs font-bold text-muted">{race.programCode} · {race.startTime}</p>
                      <h3 className="mt-1 font-semibold text-fg group-hover:text-accent-text">{titleCase(race.name)}</h3>
                      <p className="mt-0.5 text-xs text-muted">{titleCase(race.racecourse)}</p>
                    </div>
                    <div className="mt-auto grid grid-cols-3 gap-2">
                      <MiniMetric label="Signal"    value={raceOpportunity(race)} />
                      <MiniMetric label="Consensus" value={`${race.modelConsensus}%`} />
                      <MiniMetric label="Risque"    value={formatRisk(race.riskLevel)} />
                    </div>
                    {best && best.valueIndex > 10 && (
                      <p className="rounded-lg bg-accent-lo px-2.5 py-1.5 text-xs font-bold text-accent-text">
                        Value bet #{best.number} · edge +{best.valueIndex}
                      </p>
                    )}
                  </Link>
                );
              })}
            </div>
          </section>
        )}

        {/* ── PROGRAMME COMPLET ─────────────────────────────────── */}
        <section className="rounded-2xl border border-border bg-surface shadow-sm" aria-label="Programme des réunions">

          {/* Header programme */}
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-muted">
                {formatRelativeDay(dayFilter)} · {formatShortDate(dateForDay(races, dayFilter))}
              </p>
              <h2 className="font-display text-xl font-bold text-fg">Programme PMU</h2>
            </div>
            <div className="flex items-center gap-4 text-sm text-muted">
              <span><strong className="text-fg">{meetings.length}</strong> réunion{meetings.length > 1 ? "s" : ""}</span>
              <span><strong className="text-fg">{dayRaces.length}</strong> courses</span>
              <span><strong className="text-fg">{dayFeatureCount}</strong> temps fort{dayFeatureCount > 1 ? "s" : ""}</span>
            </div>
          </div>

          {/* Réunions — scroll horizontal */}
          <div className="border-b border-border">
            <div className="flex overflow-x-auto kz-scroll">
              {meetings.map((meeting) => {
                const active = meeting.key === selectedMeeting.key;
                return (
                  <button
                    key={meeting.key}
                    aria-pressed={active}
                    className={`relative flex min-w-[180px] flex-col gap-1 border-r border-border px-4 py-3 text-left transition sm:min-w-[210px] ${
                      active
                        ? "bg-accent text-white"
                        : "bg-surface text-fg hover:bg-surface-sub"
                    }`}
                    onClick={() => setSelectedMeetingKey(meeting.key)}
                    type="button"
                  >
                    <div className="flex items-center gap-2">
                      <span className={`text-2xl font-display font-bold ${active ? "text-white" : "text-fg"}`}>
                        R{meeting.reunionNumber}
                      </span>
                      <DifficultyPip difficulty={meeting.difficulty} active={active} />
                    </div>
                    <span className={`text-sm font-semibold leading-tight ${active ? "text-white" : "text-fg"}`}>
                      {titleCase(meeting.racecourse)}
                    </span>
                    <span className={`text-xs ${active ? "text-white/70" : "text-muted"}`}>
                      {meeting.races.length} course{meeting.races.length > 1 ? "s" : ""} · score {meeting.score}
                    </span>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {meeting.highlights.slice(0, 2).map((h) => (
                        <span key={h} className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${active ? "bg-white/20 text-white" : "bg-accent-lo text-accent-text"}`}>
                          {h}
                        </span>
                      ))}
                    </div>
                    {active && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-white/40" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Filtre + compteurs */}
          <div className="flex flex-col gap-3 border-b border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4 text-sm text-muted">
              <span>Réunion <strong className="text-fg">{selectedMeeting.reunionNumber}</strong> · {titleCase(selectedMeeting.racecourse)}</span>
              <span className="hidden sm:inline">{selectedMeeting.strategy}</span>
            </div>
            <label className="flex items-center gap-2 rounded-xl border border-border bg-surface-sub px-3 py-2 text-sm sm:min-w-[220px]">
              <Search size={14} className="shrink-0 text-muted" />
              <span className="sr-only">Filtrer</span>
              <input
                className="min-w-0 flex-1 bg-transparent text-fg outline-none placeholder:text-muted"
                placeholder="Filtrer par course, prix…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </label>
          </div>

          {/* Table desktop */}
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full min-w-[900px] border-collapse text-left">
              <caption className="sr-only">Courses de la réunion {selectedMeeting.racecourse}</caption>
              <thead>
                <tr className="border-b border-border bg-surface-sub text-xs font-bold uppercase tracking-widest text-muted">
                  <th className="px-5 py-3">Course</th>
                  <th className="px-5 py-3">Prix</th>
                  <th className="px-5 py-3">Départ</th>
                  <th className="px-5 py-3">Discipline</th>
                  <th className="px-5 py-3">Signal IA</th>
                  <th className="px-5 py-3">Paris ouverts</th>
                  <th className="px-5 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {visibleRaces.map((race) => {
                  const active    = race.id === selectedRace.id;
                  const highlights = raceHighlights(race.betTypes);
                  const status    = raceStatus(race, currentMinute);
                  return (
                    <tr
                      key={race.id}
                      aria-current={active ? "true" : undefined}
                      className={`transition ${active ? "bg-accent-lo" : "hover:bg-surface-sub"}`}
                    >
                      <td className="px-5 py-3.5">
                        <span className="inline-flex items-center gap-1.5">
                          <span className={`font-mono text-sm font-bold ${active ? "text-accent-text" : "text-fg"}`}>
                            C{race.courseNumber}
                          </span>
                          {active && <span className="h-1.5 w-1.5 rounded-full bg-accent" />}
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        <Link href={`/races/${encodeURIComponent(race.id)}`} className="font-semibold text-fg hover:text-accent-text">
                          {titleCase(race.name)}
                        </Link>
                        <div className="mt-1 flex flex-wrap gap-1">
                          {highlights.map((h) => (
                            <span key={h.label} className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${h.className}`}>
                              {h.label}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-5 py-3.5">
                        <StatusChip status={status} />
                      </td>
                      <td className="px-5 py-3.5">
                        <DisciplinePill discipline={race.discipline} />
                      </td>
                      <td className="px-5 py-3.5 text-sm font-semibold text-accent-text">
                        {raceOpportunity(race)}
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex flex-wrap gap-1">
                          {raceHighlights(race.betTypes).length === 0
                            ? <span className="text-xs text-muted">Classique</span>
                            : null}
                          {raceHighlights(race.betTypes).map((h) => (
                            <span key={h.label} className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${h.className}`}>{h.label}</span>
                          ))}
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <Link
                          href={`/races/${encodeURIComponent(race.id)}`}
                          className="inline-flex items-center gap-1.5 rounded-xl border border-accent bg-surface px-3.5 py-2 text-xs font-bold text-accent-text transition hover:bg-accent hover:text-white"
                        >
                          Analyser <ArrowRight size={12} />
                        </Link>
                      </td>
                    </tr>
                  );
                })}
                {visibleRaces.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-5 py-8 text-center text-sm text-muted">
                      Aucune course ne correspond à ce filtre.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Cards mobile */}
          <div className="grid gap-3 p-4 md:hidden">
            {visibleRaces.map((race) => {
              const active = race.id === selectedRace.id;
              return (
                <article
                  key={race.id}
                  aria-current={active ? "true" : undefined}
                  className={`rounded-xl border p-4 transition ${active ? "border-accent bg-accent-lo" : "border-border bg-surface"}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-mono text-xs font-bold text-muted">{race.programCode}</p>
                      <h3 className="mt-1 font-semibold text-fg">{titleCase(race.name)}</h3>
                      <p className="mt-0.5 text-xs font-semibold text-accent-text">{raceOpportunity(race)}</p>
                    </div>
                    <DisciplinePill discipline={race.discipline} />
                  </div>
                  <div className="mt-3 flex flex-wrap gap-1">
                    {raceHighlights(race.betTypes).map((h) => (
                      <span key={h.label} className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${h.className}`}>{h.label}</span>
                    ))}
                  </div>
                  <div className="mt-3 flex items-center justify-between gap-3">
                    <StatusChip status={raceStatus(race, currentMinute)} />
                    <Link
                      href={`/races/${encodeURIComponent(race.id)}`}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-cta px-3.5 py-2 text-xs font-bold text-cta-text"
                    >
                      Analyser <ArrowRight size={12} />
                    </Link>
                  </div>
                </article>
              );
            })}
            {visibleRaces.length === 0 && (
              <p className="rounded-xl border border-border p-4 text-center text-sm text-muted">
                Aucune course ne correspond à ce filtre.
              </p>
            )}
          </div>
        </section>

        {/* ── PREVIEW COURSE ACTIVE ─────────────────────────────── */}
        {topArrival.length > 0 && (
          <section className="mt-4 grid gap-4 lg:grid-cols-[1.3fr_1fr]" aria-label="Aperçu de la course active">
            {/* Top partants */}
            <div className="rounded-2xl border border-border bg-surface shadow-sm">
              <div className="flex items-center justify-between border-b border-border px-5 py-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-muted">Course active</p>
                  <h2 className="font-display text-lg font-bold text-fg">
                    {selectedRace.programCode} — {titleCase(selectedRace.name)}
                  </h2>
                </div>
                <Link
                  href={`/races/${encodeURIComponent(selectedRace.id)}`}
                  className="flex items-center gap-1.5 text-sm font-semibold text-accent-text hover:text-accent"
                >
                  Analyse complète <ArrowRight size={14} />
                </Link>
              </div>

              {/* Table desktop */}
              <div className="hidden overflow-x-auto sm:block">
                <table className="w-full border-collapse text-left">
                  <caption className="sr-only">Top 5 partants KAYZEN</caption>
                  <thead>
                    <tr className="border-b border-border bg-surface-sub text-xs font-bold uppercase tracking-widest text-muted">
                      <th className="px-5 py-3">N°</th>
                      <th className="px-5 py-3">Cheval</th>
                      <th className="px-5 py-3">{selectedRace?.discipline === "Trot" ? "Driver" : selectedRace?.discipline === "Obstacle" ? "Jockey" : "Jockey"}</th>
                      <th className="px-5 py-3 text-right">Cote</th>
                      <th className="px-5 py-3 text-right">Score KZ</th>
                      <th className="px-5 py-3 text-right">Top 3</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {topArrival.map((horse, idx) => (
                      <tr key={horse.id} className={`${idx === 0 ? "bg-accent-lo" : "hover:bg-surface-sub"}`}>
                        <td className={`px-5 py-3 font-mono font-bold ${idx === 0 ? "text-accent-text" : "text-fg"}`}>
                          {horse.number}
                        </td>
                        <td className="px-5 py-3 font-semibold text-fg">{horse.horse}</td>
                        <td className="px-5 py-3 text-sm text-muted">{horse.jockey}</td>
                        <td className="px-5 py-3 text-right font-mono text-sm text-fg">{horse.odds}</td>
                        <td className={`px-5 py-3 text-right font-mono font-bold ${idx === 0 ? "text-accent-text" : "text-muted"}`}>
                          {fmtScore(horse.kzScore)}
                        </td>
                        <td className="px-5 py-3 text-right font-mono text-sm text-muted">{fmtProb(horse.top3Probability)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Cards mobile */}
              <div className="grid gap-2 p-4 sm:hidden">
                {topArrival.map((horse, idx) => (
                  <div key={horse.id} className={`flex items-center gap-3 rounded-xl border p-3 ${idx === 0 ? "border-accent/30 bg-accent-lo" : "border-border"}`}>
                    <span className={`w-8 shrink-0 text-center font-mono font-bold ${idx === 0 ? "text-accent-text" : "text-muted"}`}>{horse.number}</span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold text-fg">{horse.horse}</p>
                      <p className="truncate text-xs text-muted">{horse.jockey}</p>
                    </div>
                    <div className="text-right">
                      <p className={`font-mono text-sm font-bold ${idx === 0 ? "text-accent-text" : "text-fg"}`}>{fmtScore(horse.kzScore)}</p>
                      <p className="text-xs text-muted">Top3 {fmtProb(horse.top3Probability)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Synthèse IA */}
            <div className="rounded-2xl border border-border bg-surface shadow-sm">
              <div className="flex items-center gap-3 border-b border-border px-5 py-4">
                <div className="grid h-9 w-9 place-items-center rounded-lg bg-accent-lo">
                  <Sparkles size={18} className="text-accent-text" />
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-muted">Synthèse IA</p>
                  <h2 className="font-display text-lg font-bold text-fg">Lecture rapide</h2>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 p-5">
                <SmMetric label="Consensus"      value={`${selectedRace.modelConsensus}%`} />
                <SmMetric label="Qualité course" value={`${selectedRace.raceQualityScore}/100`} />
                <SmMetric label="Risque"         value={formatRisk(selectedRace.riskLevel)} />
                <SmMetric label="Discipline"     value={selectedRace.specialty} />
                <SmMetric label="Scénario"       value={raceOpportunity(selectedRace)} />
                <SmMetric label="Stratégie"      value={strategyForRace(selectedRace)} />
              </div>
              <div className="border-t border-border px-5 pb-5">
                <div className="rounded-xl border border-warn/30 bg-warn-lo px-4 py-3 text-xs leading-5 text-warn">
                  Outil d'aide à la décision — aucun pronostic ne garantit un gain.
                </div>
              </div>
            </div>
          </section>
        )}

        {/* ── PERFORMANCES IA — mémoire & auto-apprentissage ────── */}
        <section className="mt-4 rounded-2xl border border-border bg-surface shadow-sm" aria-labelledby="perf-title">
          <div className="border-b border-border px-5 py-4">
            <p className="text-xs font-bold uppercase tracking-widest text-muted">Mémoire & auto-apprentissage</p>
            <h2 id="perf-title" className="font-display text-xl font-bold text-fg">Performances de l'IA</h2>
            <p className="mt-1 text-sm text-muted">
              Toutes les prédictions sont stockées et comparées aux arrivées officielles.
              Le modèle se recalibre à chaque résultat pour affiner ses prochaines analyses.
            </p>
          </div>
          <div className="grid gap-px bg-border sm:grid-cols-2 lg:grid-cols-4">
            {[
              { icon: <Trophy size={20} />,    label: "Taux Top 3",         value: "—",      hint: "% de fois où le gagnant est dans notre top 3" },
              { icon: <BarChart3 size={20} />, label: "ROI moyen",          value: "—",      hint: "Retour sur investissement moyen sur 30 jours" },
              { icon: <Brain size={20} />,     label: "Prédictions stockées",value: "—",     hint: "Nombre total d'analyses conservées en base" },
              { icon: <Zap size={20} />,       label: "Dernière calibration",value: "Auto",  hint: "Le modèle apprend à chaque arrivée officielle" },
            ].map(({ icon, label, value, hint }) => (
              <div key={label} className="flex gap-4 bg-surface px-5 py-5">
                <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent-lo text-accent-text">
                  {icon}
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-muted">{label}</p>
                  <p className="mt-1 font-display text-2xl font-bold text-fg">{value}</p>
                  <p className="mt-1 text-xs leading-5 text-muted">{hint}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="border-t border-border px-5 py-4 text-center">
            <Link href="/techniques-prediction" className="text-sm font-semibold text-accent-text hover:text-accent">
              En savoir plus sur notre méthode IA →
            </Link>
          </div>
        </section>

      </div>
    </main>
  );
}

/* ─── Sub-components ─────────────────────────────────────────────── */

function HeroStat({ label, value, icon, dark }: { label: string; value: string; icon: React.ReactNode; dark?: boolean }) {
  return dark ? (
    <div className="rounded-xl border border-white/10 bg-white/8 p-4 backdrop-blur-sm">
      <div className="flex items-center gap-2 text-white/50">{icon}<span className="text-xs font-bold uppercase tracking-widest">{label}</span></div>
      <p className="mt-2 font-display text-3xl font-bold text-white">{value}</p>
    </div>
  ) : (
    <div className="rounded-xl border border-border bg-surface-sub p-4">
      <div className="flex items-center gap-2 text-muted">{icon}<span className="text-xs font-bold uppercase tracking-widest">{label}</span></div>
      <p className="mt-2 font-display text-3xl font-bold text-fg">{value}</p>
    </div>
  );
}

function InsightCard({ icon, label, tone, value, detail }: {
  icon: React.ReactNode; label: string; tone: "green" | "amber" | "dark"; value: string; detail: string;
}) {
  const cls = {
    green: "border-accent/20 bg-accent-lo text-fg",
    amber: "border-warn/30  bg-warn-lo  text-fg",
    dark:  "border-surface-inv bg-surface-inv text-white",
  }[tone];
  return (
    <article className={`rounded-2xl border p-4 shadow-sm ${cls}`}>
      <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest opacity-70">{icon}{label}</div>
      <p className="mt-2 font-display text-2xl font-bold">{value}</p>
      <p className={`mt-1 text-sm ${tone === "dark" ? "text-white/60" : "text-muted"}`}>{detail}</p>
    </article>
  );
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-surface-sub p-2.5">
      <p className="text-[10px] font-bold uppercase tracking-widest text-muted">{label}</p>
      <p className="mt-0.5 text-xs font-bold text-fg">{value}</p>
    </div>
  );
}

function SmMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-surface-sub p-3">
      <p className="text-[10px] font-bold uppercase tracking-widest text-muted">{label}</p>
      <p className="mt-1 text-sm font-bold text-fg">{value}</p>
    </div>
  );
}

function TierBadge({ tier }: { tier: RaceAnalysis["bettingTier"] }) {
  if (tier === "Focus") return <span className="rounded-full bg-accent px-2 py-0.5 text-[10px] font-bold text-white">Focus</span>;
  if (tier === "Value") return <span className="rounded-full bg-amber-400 px-2 py-0.5 text-[10px] font-bold text-amber-950">Value</span>;
  return <span className="rounded-full bg-surface-inv px-2 py-0.5 text-[10px] font-bold text-white">Prudence</span>;
}

function DisciplinePill({ discipline }: { discipline: string }) {
  const cls =
    discipline === "Trot"     ? "bg-sky-100 text-sky-800" :
    discipline === "Obstacle" ? "bg-orange-100 text-orange-800" :
                                "bg-violet-100 text-violet-800";
  return <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${cls}`}>{discipline}</span>;
}

function DifficultyPip({ difficulty, active }: { difficulty: RaceMeeting["difficulty"]; active: boolean }) {
  const cls = active ? "bg-white/30 text-white" :
    difficulty === "Facile"   ? "bg-accent-lo text-accent-text" :
    difficulty === "Complexe" ? "bg-red-50 text-red-600" :
                                "bg-surface-sub text-muted";
  return <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${cls}`}>{difficulty}</span>;
}

function StatusChip({ status, dark }: { status: string; dark?: boolean }) {
  const isImminent  = status.includes("imminent");
  const isAvailable = status.includes("disponible");
  if (dark) {
    return (
      <span className={`text-[10px] font-semibold ${isImminent ? "text-cta font-bold" : "text-slate-400"}`}>
        {isImminent && <span className="mr-1 inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-cta align-middle" />}
        {status}
      </span>
    );
  }
  return (
    <span className={`text-xs font-semibold ${
      isImminent  ? "text-accent-text font-bold" :
      isAvailable ? "text-muted" : "text-muted"
    }`}>
      {isImminent && <span className="mr-1 inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-accent align-middle" />}
      {status}
    </span>
  );
}

/* ─── Business helpers (unchanged) ──────────────────────────────── */

function groupRacesByMeeting(races: RaceAnalysis[]): RaceMeeting[] {
  const map = new Map<string, RaceMeeting>();
  for (const race of races) {
    const key = `${race.raceDate}-R${race.reunionNumber}`;
    const m   = map.get(key);
    if (m) { m.races.push(race); }
    else {
      map.set(key, {
        key, reunionNumber: race.reunionNumber, racecourse: race.racecourse,
        startTime: race.startTime, score: 0, difficulty: "Ouverte", strategy: "",
        specialties: [], highlights: [], races: [race],
      });
    }
  }
  return Array.from(map.values())
    .map((m) => {
      const sorted = m.races.sort((a, b) => a.courseNumber - b.courseNumber);
      const score  = meetingScore(sorted);
      return {
        ...m, score,
        difficulty: meetingDifficulty(score, sorted),
        strategy:   meetingStrategy(score, sorted),
        highlights: unique(sorted.flatMap((r) => raceHighlights(r.betTypes).map((h) => h.label))),
        specialties: unique(sorted.map((r) => r.specialty)),
        races: sorted,
      };
    })
    .sort((a, b) => a.reunionNumber - b.reunionNumber);
}

function buildDayInsights(races: RaceAnalysis[]) {
  const valueRaces = races.filter((r) => r.horses.some((h) => h.valueIndex > 10)).length;
  const focusRaces = races.filter((r) => r.bettingTier === "Focus").length;
  const avoidRaces = races.filter((r) => r.bettingTier === "Avoid" || r.riskLevel === "Speculatif").length;
  const topRaces   = races.slice().sort((a, b) => racePriorityScore(b) - racePriorityScore(a)).slice(0, 3);
  const bestRace   = topRaces[0];
  // Score qualité programme [0-100] — pondère les courses value et focus, pénalise les spéculatives
  const programScore = Math.min(100, Math.max(0, Math.round(
    (valueRaces * 8 + focusRaces * 5 - avoidRaces * 4 + races.length * 2) * 100 / Math.max(races.length * 15, 1)
  )));
  return {
    avoidRaces, focusRaces, valueRaces, topRaces, programScore,
    bestAlert:    bestRace ? priorityLabel(bestRace) : "En attente",
    marketMood:   avoidRaces > focusRaces ? "Sélectif" : valueRaces >= 3 ? "Opportuniste" : "Stable",
    nextPriority: bestRace,
  };
}

function racePriorityScore(race: RaceAnalysis) {
  const bestValue = Math.max(...race.horses.map((h) => h.valueIndex), 0);
  return race.modelConsensus + race.raceQualityScore + bestValue - race.marketVolatility - (race.riskLevel === "Speculatif" ? 10 : 0);
}
function priorityLabel(race: RaceAnalysis) {
  if (race.horses.some((h) => h.valueIndex > 14)) return "Value bet forte";
  if (race.modelConsensus >= 72) return "Base solide";
  if (race.raceQualityScore >= 75) return "Course prioritaire";
  return "Surveillance";
}
function meetingScore(races: RaceAnalysis[]) {
  if (!races.length) return 0;
  return Math.max(1, Math.min(100, Math.round(races.reduce((s, r) => s + racePriorityScore(r), 0) / races.length)));
}
function meetingDifficulty(score: number, races: RaceAnalysis[]): RaceMeeting["difficulty"] {
  const spec = races.filter((r) => r.riskLevel === "Speculatif").length;
  if (score >= 72 && spec <= 1) return "Facile";
  if (score < 55  || spec >= Math.ceil(races.length / 2)) return "Complexe";
  return "Ouverte";
}
function meetingStrategy(score: number, races: RaceAnalysis[]) {
  const d = meetingDifficulty(score, races);
  if (d === "Facile")   return "Bases simples et couples";
  if (d === "Complexe") return "Mises réduites, value uniquement";
  return "Mix place/value, tickets flexi";
}
function raceOpportunity(race: RaceAnalysis) {
  const arrival = probableArrival(race.horses, raceToContext(race));
  const best = arrival[0];
  if (!best) return "Signal indisponible";

  // Favori très fragile
  const fav = race.horses.slice().sort((a, b) => a.odds - b.odds)[0];
  const favAnalysis = fav ? race.horses.indexOf(fav) : -1;
  const favIsFragile = fav && fav.odds < 3 && fav.top3Probability < 40;

  // Outsider avec value
  const outsider = arrival.find((h) => h.valueIndex >= 10 && h.odds >= 7);

  if (race.bettingTier === "Avoid" || (race.riskLevel === "Speculatif" && race.marketVolatility > 25))
    return "À éviter";
  if (favIsFragile)
    return `Favori fragile #${fav.number}`;
  if (best.valueIndex > 18)
    return `Value forte #${best.number}`;
  if (best.valueIndex > 12)
    return `Value #${best.number} (+${best.valueIndex})`;
  if (race.modelConsensus >= 75)
    return `Base fiable #${best.number}`;
  if (outsider)
    return `Outsider #${outsider.number} (${outsider.odds})`;
  if (race.raceQualityScore >= 72)
    return `Course solide`;
  if (race.riskLevel === "Speculatif")
    return "Course ouverte";
  if (best.top3Probability >= 35)
    return `À surveiller #${best.number}`;
  return "Signal faible";
}
function strategyForRace(race: RaceAnalysis) {
  if (race.riskLevel === "Prudent")   return "Sécurisé";
  if (race.bettingTier === "Value")   return "Value";
  if (race.riskLevel === "Speculatif") return "Agressif";
  return "Équilibré";
}
function selectTimelineRace(races: RaceAnalysis[], currentMinute: number) {
  return (
    races.filter((r) => minutesFromStartTime(r.startTime) >= currentMinute)
         .sort((a, b) => minutesFromStartTime(a.startTime) - minutesFromStartTime(b.startTime))[0] ??
    races.sort((a, b) => minutesFromStartTime(a.startTime) - minutesFromStartTime(b.startTime))[0]
  );
}
function raceStatus(race: RaceAnalysis, currentMinute: number) {
  if (race.relativeDay === "yesterday") return race.horses.some((h) => h.finishPosition) ? "Arrivée disponible" : `Départ à ${race.startTime}`;
  if (race.relativeDay === "tomorrow")  return `Départ à ${race.startTime}`;
  const start = minutesFromStartTime(race.startTime);
  if (start < currentMinute)         return race.horses.some((h) => h.finishPosition) ? "Arrivée disponible" : `Départ à ${race.startTime}`;
  if (start - currentMinute <= 30)   return `Départ imminent ${race.startTime}`;
  return `Départ à ${race.startTime}`;
}
/** Affiche un score numérique — retourne "—" si null / undefined / NaN */
function fmtScore(v: number | null | undefined): string {
  if (v === null || v === undefined || (typeof v === "number" && isNaN(v))) return "—";
  return String(v);
}
/** Affiche une probabilité % — retourne "—" si invalide, sinon "XX.X%" */
function fmtProb(v: number | null | undefined): string {
  if (v === null || v === undefined || (typeof v === "number" && isNaN(v))) return "—";
  return `${v}%`;
}
function minutesFromStartTime(t: string) {
  const [h = "0", m = "0"] = t.split(":");
  return Number(h) * 60 + Number(m);
}
function useCurrentMinute() {
  return useSyncExternalStore(
    (notify) => { const id = window.setInterval(notify, 60_000); return () => window.clearInterval(id); },
    () => { const n = new Date(); return n.getHours() * 60 + n.getMinutes(); },
    () => 0,
  );
}
function formatRelativeDay(day: RaceAnalysis["relativeDay"]) {
  if (day === "yesterday") return "Hier";
  if (day === "tomorrow")  return "Demain";
  if (day === "other")     return "Autre";
  return "Aujourd'hui";
}
function formatShortDate(date: string) {
  const [y, m, d] = date.split("-");
  return `${d}/${m}`;
}
function dateForDay(races: RaceAnalysis[], day: RaceAnalysis["relativeDay"]) {
  const found = races.find((r) => r.relativeDay === day)?.raceDate;
  if (found) return found;
  const offset = day === "yesterday" ? -1 : day === "tomorrow" ? 1 : 0;
  const paris = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const [year, month, d] = paris.split("-").map(Number);
  const shifted = new Date(Date.UTC(year, month - 1, d + offset, 12));
  return new Intl.DateTimeFormat("en-CA", { timeZone: "UTC", year: "numeric", month: "2-digit", day: "2-digit" }).format(shifted);
}
function titleCase(v: string) {
  return v.toLowerCase().split(/(\s|-|')/)
    .map((p) => (p.length > 1 ? p.charAt(0).toUpperCase() + p.slice(1) : p)).join("");
}
function raceHighlights(offers: BetOffer[]) {
  const out: { label: string; className: string }[] = [];
  if (offers.some((o) => o.type === "QUINTE_PLUS"))                             out.push({ label: "Quinte+",         className: BET_BADGE.QUINTE_PLUS });
  if (offers.some((o) => o.type === "QUARTE_PLUS" && o.audience === "REGIONAL")) out.push({ label: "Quarté régional", className: BET_BADGE.QUARTE_PLUS });
  if (offers.some((o) => o.type === "PICK5"))                                   out.push({ label: "Pick 5",           className: BET_BADGE.PICK5 });
  return out;
}
function formatRisk(r: RaceAnalysis["riskLevel"]) {
  if (r === "Equilibre")  return "Équilibré";
  if (r === "Speculatif") return "Spéculatif";
  return r;
}
function unique(arr: string[]) { return Array.from(new Set(arr.filter(Boolean))); }
