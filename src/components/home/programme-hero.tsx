"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { BetBadge, titleCase } from "@/components/badges";
import type { RaceAnalysis } from "@/lib/types";
import { DaySwitcher } from "./day-switcher";
import { useRacePeek } from "./race-peek";
import { raceHref } from "./types";
import { DifficultyPip, StatusChip } from "./ui";
import type { HomeProgramme } from "./use-home-programme";

/** Couleur du signal IA sur le bandeau vert (fond sombre dans les deux thèmes). */
function signalTone(signal: string): string {
  if (signal.startsWith("Value")) return "text-cta";
  if (signal.startsWith("Base fiable")) return "text-green-400";
  if (signal.startsWith("Outsider")) return "text-yellow-400";
  if (signal === "À éviter" || signal.startsWith("Favori fragile")) return "text-red-400";
  if (signal === "Signal faible") return "text-slate-400";
  return "text-slate-300";
}

/** Bandeau programme : titre, sélecteur de jour, réunions à gauche, courses à droite. */
export function ProgrammeHero({ races, programme, favCount, nowMs }: {
  races: RaceAnalysis[];
  programme: HomeProgramme;
  favCount: number;
  nowMs: number | null;
}) {
  const { meetings, dayRaces, filteredMeetings, selectedMeeting, selectedRace, visibleRaces, signalsFor } = programme;
  const { peekProps, popover } = useRacePeek();
  const runnerCount = dayRaces.reduce((t, r) => t + r.horses.length, 0);

  return (
    <section aria-label="Programme PMU" className="pt-6 pb-4" id="programme">
      <div className="relative overflow-hidden rounded-2xl" style={{ background: "linear-gradient(160deg, #0c2318 0%, #0f3022 50%, #0a1e14 100%)" }}>
        {/* Motif diagonal fond */}
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 opacity-[0.035]"
          style={{ backgroundImage: "repeating-linear-gradient(45deg,#fff 0,#fff 1px,transparent 0,transparent 50%)", backgroundSize: "18px 18px" }} />

        <div className="relative">
          {/* ── Bandeau titre + sélecteur jour ──────────────────── */}
          <div className="flex flex-col gap-0 border-b border-white/10 sm:flex-row sm:items-stretch">
            <div className="flex flex-col justify-center gap-1 px-5 py-4 sm:min-w-[220px] sm:border-r sm:border-white/10">
              <h1 className="font-display text-xl font-bold leading-tight text-white">Programme PMU</h1>
              <p className="text-xs text-white/65">
                {meetings.length} réunion{meetings.length > 1 ? "s" : ""} · {dayRaces.length} courses · {runnerCount} partants
                {favCount > 0 && (
                  <span className="ml-2 inline-flex items-center gap-0.5 rounded-full bg-amber-400/20 px-1.5 py-0.5 text-[10px] font-bold text-amber-300">
                    ★ {favCount}
                  </span>
                )}
              </p>
            </div>
            <DaySwitcher dayFilter={programme.dayFilter} onSelect={programme.selectDay} races={races} />
            <div className="hidden items-center border-l border-white/10 px-4 sm:flex">
              <Link href="/pronostics" className="flex items-center gap-1.5 text-xs font-semibold text-slate-300 transition hover:text-white">
                Pronostics <ArrowRight size={12} />
              </Link>
            </div>
          </div>

          {/* Les pistes de grille valent `auto` par défaut, soit la largeur du
              contenu : les tuiles de réunion (160 px chacune) étiraient la
              colonne à 640 px en mobile. `min-w-0` laisse la piste se réduire et
              rend la main au défilement horizontal interne. */}
          <div className="grid min-w-0 lg:grid-cols-[280px_1fr]">
            <div className="min-w-0 border-b border-white/10 lg:border-b-0 lg:border-r lg:border-white/10">
              <div className="flex overflow-x-auto lg:flex-col kz-scroll">
                {filteredMeetings.map((meeting) => {
                  const active = meeting.key === selectedMeeting?.key;
                  return (
                    <button
                      key={meeting.key}
                      aria-pressed={active}
                      className={`flex min-w-[160px] shrink-0 flex-col gap-0.5 border-r border-white/8 px-4 py-3 text-left transition lg:min-w-0 lg:border-b lg:border-r-0 lg:border-white/8 ${
                        active ? "bg-white/12" : "hover:bg-white/6"
                      }`}
                      onClick={() => programme.setSelectedMeetingKey(meeting.key)}
                      type="button"
                    >
                      <div className="flex items-center gap-2">
                        <span className={`font-display text-lg font-bold ${active ? "text-cta" : "text-slate-200"}`}>R{meeting.reunionNumber}</span>
                        <DifficultyPip difficulty={meeting.difficulty} active={active} />
                      </div>
                      <span className={`text-xs font-semibold leading-tight ${active ? "text-white" : "text-slate-300"}`}>{titleCase(meeting.racecourse)}</span>
                      <span className={`text-[10px] ${active ? "text-white/65" : "text-slate-400"}`}>{meeting.races.length} courses</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="kz-scroll min-w-0 max-h-[420px] overflow-y-auto lg:max-h-[440px]">
              {visibleRaces.length === 0 ? (
                <p className="px-5 py-8 text-center text-sm text-white/70">Aucune course ne correspond à ces filtres.</p>
              ) : (
                <div className="divide-y divide-white/8">
                  {visibleRaces.map((race) => {
                    const active = race.id === selectedRace?.id;
                    const { signal, highlights } = signalsFor(race);
                    return (
                      <Link
                        key={race.id}
                        href={raceHref(race)}
                        className={`group flex items-center gap-3 px-4 py-3 transition hover:bg-white/8 ${active ? "bg-white/10" : ""}`}
                        {...peekProps(race)}
                      >
                        <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg font-display text-xs font-bold ${
                          active ? "bg-cta text-cta-text" : "bg-white/10 text-white/70"
                        }`}>
                          C{race.courseNumber}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="truncate text-sm font-semibold text-white">{titleCase(race.name)}</span>
                            {highlights.slice(0, 1).map((h) => <BetBadge key={h} bet={h} className="hidden shrink-0 sm:inline" />)}
                          </div>
                          <div className="mt-0.5 flex items-center gap-2 text-[11px] text-slate-400">
                            <span>{race.startTime}</span>
                            <span>·</span>
                            <span>{race.specialty || race.discipline}</span>
                            <span>·</span>
                            <span className="whitespace-nowrap">{race.horses.length} partants</span>
                          </div>
                        </div>
                        <div className="flex shrink-0 flex-col items-end gap-1">
                          <span className={`text-xs font-bold ${signalTone(signal)}`}>{signal}</span>
                          <StatusChip dark nowMs={nowMs} race={race} />
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between border-t border-white/10 px-5 py-2.5">
            <p className="text-[10px] text-slate-400">Outil d’aide à la décision — aucun résultat ni gain garanti</p>
            <Link href="/track-record" className="text-[10px] font-semibold text-cta transition hover:text-cta-hi">
              Résultats mesurés →
            </Link>
          </div>
        </div>
      </div>
      {popover}
    </section>
  );
}
