"use client";

import Link from "next/link";
import { CalendarDays, ChevronLeft, ChevronRight, Flag, Search, ShieldCheck, Sparkles } from "lucide-react";
import { useMemo, useState, useSyncExternalStore } from "react";
import { probableArrival } from "@/lib/bet-recommendations";
import type { BetOffer, RaceAnalysis } from "@/lib/types";

type DashboardProps = {
  races: RaceAnalysis[];
};

type RaceMeeting = {
  key: string;
  reunionNumber: number;
  racecourse: string;
  startTime: string;
  specialties: string[];
  highlights: string[];
  races: RaceAnalysis[];
};

const DAY_ORDER: RaceAnalysis["relativeDay"][] = ["yesterday", "today", "tomorrow"];

const BET_BADGE_COLORS: Record<string, string> = {
  QUINTE_PLUS: "bg-red-500 text-white",
  QUARTE_PLUS: "bg-sky-500 text-white",
  PICK5: "bg-yellow-300 text-red-600",
  DEUX_SUR_QUATRE: "bg-purple-600 text-white",
  TRIO: "bg-orange-400 text-white",
  MULTI: "bg-pink-600 text-white",
};

export function Dashboard({ races }: DashboardProps) {
  const currentMinute = useCurrentMinute();
  const [dayFilter, setDayFilter] = useState<RaceAnalysis["relativeDay"]>("today");
  const [selectedMeetingKey, setSelectedMeetingKey] = useState("");
  const [showRunners, setShowRunners] = useState(true);
  const [query, setQuery] = useState("");

  const dayRaces = useMemo(
    () =>
      races
        .filter((race) => race.relativeDay === dayFilter)
        .sort((a, b) => a.reunionNumber - b.reunionNumber || a.courseNumber - b.courseNumber),
    [dayFilter, races],
  );
  const meetings = useMemo(() => groupRacesByMeeting(dayRaces), [dayRaces]);
  const timelineRace = useMemo(() => selectTimelineRace(dayRaces, currentMinute), [currentMinute, dayRaces]);
  const selectedMeeting =
    meetings.find((meeting) => meeting.key === selectedMeetingKey) ??
    meetings.find((meeting) => meeting.races.some((race) => race.id === timelineRace?.id)) ??
    meetings[0];
  const selectedRace = timelineRace && selectedMeeting?.races.some((race) => race.id === timelineRace.id)
    ? timelineRace
    : selectedMeeting?.races[0];
  const normalizedQuery = query.trim().toLowerCase();
  const visibleMeetingRaces = selectedMeeting?.races.filter((race) => {
    if (!normalizedQuery) return true;
    return `${race.programCode} ${race.name} ${race.specialty} ${race.startTime}`.toLowerCase().includes(normalizedQuery);
  }) ?? [];

  if (!selectedMeeting || !selectedRace) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#f3f5f4] px-4 text-[#26312e]" id="contenu-principal">
        <div className="rounded-md border border-[#d9e1de] bg-white p-6 text-center shadow-sm">
          <Flag className="mx-auto text-emerald-700" size={34} />
          <h1 className="mt-4 text-2xl font-semibold">KAYZEN TURF AI</h1>
          <p className="mt-2 text-sm text-[#65746f]">Aucune course francaise disponible sur cette date.</p>
        </div>
      </main>
    );
  }

  const topArrival = probableArrival(selectedRace.horses).slice(0, 5);
  const dayRunnersCount = dayRaces.reduce((total, race) => total + race.horses.length, 0);
  const dayFeatureCount = dayRaces.filter((race) => raceHighlights(race.betTypes).length > 0).length;
  const todayDate = dateForDay(races, "today");

  function selectDay(day: RaceAnalysis["relativeDay"]) {
    if (day === "other") return;
    setDayFilter(day);
    setSelectedMeetingKey("");
    setQuery("");
  }

  return (
    <main className="min-h-screen bg-[#f3f5f4] px-3 py-20 text-[#26312e] sm:px-5 lg:px-8" id="contenu-principal">
      <section className="mx-auto max-w-[1480px]">
        <div className="inline-flex overflow-hidden rounded-t-sm shadow-sm">
          <div className="kz-brand-strong grid h-16 w-16 place-items-center">
            <Flag size={30} />
          </div>
          <h1 className="kz-brand flex h-16 items-center px-6 text-2xl font-bold uppercase tracking-normal sm:text-3xl" id="programme-title">
            Resultats PMU : Arrivees & Rapports
          </h1>
        </div>

        <div className="mb-3 mt-3 rounded-md border border-[#d9e1de] bg-white p-3 text-sm font-medium text-[#52615d] shadow-sm">
          Aujourd&apos;hui = <span className="font-mono font-bold text-[#26312e]">{formatShortDate(todayDate)}</span>. La navigation charge uniquement hier, aujourd&apos;hui et demain.
        </div>

        <section aria-labelledby="programme-title" className="overflow-hidden rounded-b-md border border-[#d9e1de] bg-white shadow-sm">
          <div className="grid border-b border-[#d9e1de] lg:grid-cols-[1fr_1fr]">
            <div className="grid min-h-20 grid-cols-[72px_1fr_72px] items-center border-r border-[#d9e1de]">
              <button
                aria-label="Jour precedent"
                className="grid h-full place-items-center text-[#9aa4a0] transition hover:bg-[#f7f8f8] hover:text-[#26312e]"
                onClick={() => selectDay(previousDay(dayFilter))}
                type="button"
              >
                <ChevronLeft aria-hidden="true" size={34} />
              </button>
              <div aria-live="polite" className="flex items-center justify-center gap-5 text-2xl text-[#52615d]">
                <CalendarDays aria-hidden="true" size={36} />
                <span>{formatShortDate(selectedRace.raceDate)}</span>
              </div>
              <button
                aria-label="Jour suivant"
                className="grid h-full place-items-center text-[#9aa4a0] transition hover:bg-[#f7f8f8] hover:text-[#26312e]"
                onClick={() => selectDay(nextDay(dayFilter))}
                type="button"
              >
                <ChevronRight aria-hidden="true" size={34} />
              </button>
            </div>

            <div aria-label="Choix de la date du programme" className="kz-dark-tabs grid grid-cols-3 text-lg font-semibold uppercase" role="group">
              {DAY_ORDER.map((day) => (
                <button
                  aria-pressed={dayFilter === day}
                  className={`min-h-20 transition ${dayFilter === day ? "kz-dark-tab-active" : "kz-dark-tab"}`}
                  key={day}
                  onClick={() => {
                    selectDay(day);
                  }}
                  type="button"
                >
                  <span className="block">{formatRelativeDay(day)}</span>
                  <span className="mt-1 block font-mono text-xs font-normal">{formatShortDate(dateForDay(races, day))}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-3 border-b border-[#d9e1de] bg-[#fbfcfc] p-3 lg:grid-cols-[1fr_auto] lg:items-center">
            <div className="grid gap-2 sm:grid-cols-4">
              <Metric label="Reunions" value={`${meetings.length}`} />
              <Metric label="Courses" value={`${dayRaces.length}`} />
              <Metric label="Partants" value={`${dayRunnersCount}`} />
              <Metric label="Temps forts" value={`${dayFeatureCount}`} />
            </div>
            <label className="flex min-h-12 min-w-[260px] items-center gap-2 rounded-sm border border-[#d9e1de] bg-white px-3 text-sm font-medium text-[#52615d]">
              <Search aria-hidden="true" size={18} />
              <span className="sr-only">Filtrer les courses de la reunion selectionnee</span>
              <input
                className="min-w-0 flex-1 bg-transparent text-[#26312e] outline-none"
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Filtrer C, prix, discipline"
                value={query}
              />
            </label>
          </div>

          <div className="grid grid-cols-[56px_1fr_56px] border-b border-[#d9e1de]">
            <div aria-hidden="true" className="grid min-h-28 place-items-center border-r border-[#d9e1de] text-[#65746f]">
              <ChevronLeft size={34} />
            </div>
            <div aria-label="Reunions disponibles" className="flex overflow-x-auto" role="group">
              {meetings.map((meeting) => {
                const active = meeting.key === selectedMeeting.key;
                return (
                  <button
                    aria-pressed={active}
                    className={`relative min-h-28 min-w-[220px] border-r border-[#d9e1de] px-4 py-3 text-left transition ${
                      active ? "kz-meeting-active" : "bg-white text-[#52615d] hover:bg-[#f7f8f8]"
                    }`}
                    key={meeting.key}
                    onClick={() => setSelectedMeetingKey(meeting.key)}
                    type="button"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-3xl">{meetingIcon(meeting.specialties)}</span>
                      <span>
                        <span className={`block text-2xl font-bold ${active ? "kz-meeting-active-title" : "text-[#3f403f]"}`}>R{meeting.reunionNumber}</span>
                        <span className="block text-xl leading-6">{titleCase(meeting.racecourse)}</span>
                      </span>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {meeting.highlights.slice(0, 2).map((highlight) => (
                        <span className="rounded-full bg-yellow-300 px-2 py-0.5 text-xs font-bold italic text-red-600" key={highlight}>
                          {highlight}
                        </span>
                      ))}
                    </div>
                  </button>
                );
              })}
            </div>
            <div aria-hidden="true" className="grid min-h-28 place-items-center border-l border-[#d9e1de] text-[#b0b8b5]">
              <ChevronRight size={34} />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] border-collapse text-left">
              <caption className="sr-only">
                Courses de la reunion {selectedMeeting.racecourse}, avec depart, type de pari important et lien vers l&apos;analyse.
              </caption>
              <thead>
                <tr className="kz-table-head text-sm uppercase">
                  <th className="px-7 py-4 font-bold" scope="col">Course</th>
                  <th className="px-5 py-4 font-bold" scope="col">Discipline</th>
                  <th className="px-5 py-4 font-bold" scope="col">Prix</th>
                  <th className="px-5 py-4 font-bold" scope="col">Depart & Arrivee</th>
                  <th className="px-5 py-4 text-center font-bold" scope="col">NP</th>
                  <th className="px-5 py-4 text-right font-bold" scope="col">Action</th>
                </tr>
              </thead>
              <tbody>
                {visibleMeetingRaces.map((race) => {
                  const active = race.id === selectedRace.id;
                  return (
                    <tr aria-current={active ? "true" : undefined} className={`${active ? "bg-emerald-50" : "even:bg-[#f5f6f6]"} border-b border-[#e0e5e3] text-lg`} key={race.id}>
                      <th className="px-7 py-4 font-bold text-[#26312e]" scope="row">C{race.courseNumber}</th>
                      <td className="px-5 py-4 text-2xl">{raceIcon(race)}</td>
                      <td className="px-5 py-4">
                        <Link className="font-bold text-[#26312e] hover:text-emerald-700" href={`/races/${encodeURIComponent(race.id)}`}>
                          {titleCase(race.name)}
                        </Link>
                        <span className="ml-2 inline-flex flex-wrap gap-1 align-middle">
                          {raceHighlights(race.betTypes).map((highlight) => (
                            <span className={`rounded-full px-2 py-0.5 text-xs font-bold italic ${highlight.className}`} key={highlight.label}>
                              {highlight.label}
                            </span>
                          ))}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <span className="font-medium">{raceStatus(race, currentMinute)}</span>
                      </td>
                      <td className="px-5 py-4 text-center text-[#65746f]">-</td>
                      <td className="px-5 py-3 text-right">
                        <Link
                          className="inline-flex h-12 min-w-40 items-center justify-center rounded-sm border-2 border-rose-400 bg-white px-6 text-lg font-semibold uppercase text-rose-500 transition hover:bg-rose-50"
                          href={`/races/${encodeURIComponent(race.id)}`}
                        >
                          Analyser
                        </Link>
                      </td>
                    </tr>
                  );
                })}
                {visibleMeetingRaces.length === 0 ? (
                  <tr>
                    <td className="px-7 py-6 text-center text-[#65746f]" colSpan={6}>
                      Aucune course ne correspond au filtre.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>

          <label className="flex items-center gap-3 px-3 py-3 text-xl italic text-[#26312e]">
            <input checked={showRunners} className="h-5 w-5 accent-emerald-700" onChange={(event) => setShowRunners(event.target.checked)} type="checkbox" />
            Afficher les partants/montes de cette reunion
          </label>
        </section>

        {showRunners ? (
          <section className="mt-5 grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
            <div className="rounded-md border border-[#d9e1de] bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm uppercase text-[#65746f]">Course active</p>
                  <h2 className="mt-1 text-2xl font-bold text-[#26312e]">
                    {selectedRace.programCode} - {titleCase(selectedRace.name)}
                  </h2>
                </div>
                <Link className="kz-primary-action rounded-sm px-5 py-3 text-sm font-bold uppercase" href={`/races/${encodeURIComponent(selectedRace.id)}`}>
                  Voir tous les partants
                </Link>
              </div>
              <div className="mt-4 overflow-x-auto">
                <table className="w-full min-w-[720px] border-collapse text-left">
                  <caption className="sr-only">Top 5 des chevaux reperes par KAYZEN pour la course active.</caption>
                  <thead>
                    <tr className="kz-table-head text-xs uppercase">
                      <th className="px-3 py-3" scope="col">N</th>
                      <th className="px-3 py-3" scope="col">Cheval</th>
                      <th className="px-3 py-3" scope="col">Driver</th>
                      <th className="px-3 py-3" scope="col">Cote</th>
                      <th className="px-3 py-3" scope="col">KZ</th>
                      <th className="px-3 py-3" scope="col">Top 3</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topArrival.map((horse) => (
                      <tr className="border-b border-[#e0e5e3] text-sm even:bg-[#f5f6f6]" key={horse.id}>
                        <th className="px-3 py-3 font-mono font-bold" scope="row">{horse.number}</th>
                        <td className="px-3 py-3 font-semibold uppercase">{horse.horse}</td>
                        <td className="px-3 py-3 text-[#65746f]">{horse.jockey}</td>
                        <td className="px-3 py-3 font-mono">{horse.odds}</td>
                        <td className="px-3 py-3 font-mono font-bold text-emerald-700">{horse.kzScore}</td>
                        <td className="px-3 py-3 font-mono">{horse.top3Probability}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="rounded-md border border-[#d9e1de] bg-white p-5 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-sm bg-emerald-50 text-emerald-700">
                  <Sparkles size={20} />
                </div>
                <div>
                  <p className="text-sm uppercase text-[#65746f]">Synthese IA</p>
                  <h2 className="text-xl font-bold">Lecture rapide</h2>
                </div>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <Metric label="Consensus" value={`${selectedRace.modelConsensus}%`} />
                <Metric label="Qualite course" value={`${selectedRace.raceQualityScore}`} />
                <Metric label="Risque" value={selectedRace.riskLevel} />
                <Metric label="Discipline" value={selectedRace.specialty} />
              </div>
              <div className="mt-4 rounded-md border border-amber-500/30 bg-amber-50 p-3 text-sm text-amber-950">
                <ShieldCheck className="mb-2 text-amber-700" size={18} />
                Outil d&apos;aide a la decision. Aucun pronostic ne garantit un gain.
              </div>
            </div>
          </section>
        ) : null}
      </section>
    </main>
  );
}

function groupRacesByMeeting(races: RaceAnalysis[]): RaceMeeting[] {
  const meetings = new Map<string, RaceMeeting>();

  for (const race of races) {
    const key = `${race.raceDate}-R${race.reunionNumber}`;
    const meeting = meetings.get(key);

    if (meeting) {
      meeting.races.push(race);
    } else {
      meetings.set(key, {
        key,
        reunionNumber: race.reunionNumber,
        racecourse: race.racecourse,
        startTime: race.startTime,
        specialties: [],
        highlights: [],
        races: [race],
      });
    }
  }

  return Array.from(meetings.values())
    .map((meeting) => ({
      ...meeting,
      highlights: unique(meeting.races.flatMap((race) => raceHighlights(race.betTypes).map((highlight) => highlight.label))),
      specialties: unique(meeting.races.map((race) => race.specialty)),
      races: meeting.races.sort((a, b) => a.courseNumber - b.courseNumber),
    }))
    .sort((a, b) => a.reunionNumber - b.reunionNumber);
}

function selectTimelineRace(races: RaceAnalysis[], currentMinute: number) {
  return (
    races
      .filter((race) => minutesFromStartTime(race.startTime) >= currentMinute)
      .sort((a, b) => minutesFromStartTime(a.startTime) - minutesFromStartTime(b.startTime))[0] ??
    races.sort((a, b) => minutesFromStartTime(a.startTime) - minutesFromStartTime(b.startTime))[0]
  );
}

function raceStatus(race: RaceAnalysis, currentMinute: number) {
  if (race.relativeDay === "yesterday") return race.horses.some((horse) => horse.finishPosition) ? "Arrivee disponible" : `Depart a ${race.startTime}`;
  if (race.relativeDay === "tomorrow") return `Depart a ${race.startTime}`;

  const startMinute = minutesFromStartTime(race.startTime);
  if (startMinute < currentMinute) return race.horses.some((horse) => horse.finishPosition) ? "Arrivee disponible" : `Depart a ${race.startTime}`;
  if (startMinute - currentMinute <= 30) return `Depart imminent ${race.startTime}`;
  return `Depart a ${race.startTime}`;
}

function minutesFromStartTime(startTime: string) {
  const [hours = "0", minutes = "0"] = startTime.split(":");
  return Number(hours) * 60 + Number(minutes);
}

function useCurrentMinute() {
  return useSyncExternalStore(
    (notify) => {
      const interval = window.setInterval(notify, 60_000);
      return () => window.clearInterval(interval);
    },
    () => {
      const now = new Date();
      return now.getHours() * 60 + now.getMinutes();
    },
    () => 0,
  );
}

function previousDay(day: RaceAnalysis["relativeDay"]) {
  if (day === "tomorrow") return "today";
  if (day === "today") return "yesterday";
  return "yesterday";
}

function nextDay(day: RaceAnalysis["relativeDay"]) {
  if (day === "yesterday") return "today";
  if (day === "today") return "tomorrow";
  return "tomorrow";
}

function formatRelativeDay(day: RaceAnalysis["relativeDay"]) {
  if (day === "yesterday") return "Hier";
  if (day === "tomorrow") return "Demain";
  if (day === "other") return "Autre";
  return "Aujourd'hui";
}

function formatShortDate(date: string) {
  const [year, month, day] = date.split("-");
  return `${day}-${month}-${year}`;
}

function dateForDay(races: RaceAnalysis[], day: RaceAnalysis["relativeDay"]) {
  const raceDate = races.find((race) => race.relativeDay === day)?.raceDate;
  if (raceDate) return raceDate;

  const offset = day === "yesterday" ? -1 : day === "tomorrow" ? 1 : 0;
  const parisDate = new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "Europe/Paris",
    year: "numeric",
  }).format(new Date());
  const [year, month, date] = parisDate.split("-").map(Number);
  const shifted = new Date(Date.UTC(year, month - 1, date + offset, 12));

  return new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "UTC",
    year: "numeric",
  }).format(shifted);
}

function titleCase(value: string) {
  return value
    .toLowerCase()
    .split(/(\s|-|')/)
    .map((part) => (part.length > 1 ? part.charAt(0).toUpperCase() + part.slice(1) : part))
    .join("");
}

function raceIcon(race: RaceAnalysis) {
  if (race.discipline === "Trot") return "Trot";
  if (race.discipline === "Obstacle") return "Obs.";
  return "Plat";
}

function meetingIcon(specialties: string[]) {
  if (specialties.some((specialty) => specialty.includes("Attele") || specialty.includes("Monte"))) return "T";
  return "P";
}

function raceHighlights(offers: BetOffer[]) {
  const highlights: Array<{ label: string; className: string }> = [];
  if (offers.some((offer) => offer.type === "QUINTE_PLUS")) highlights.push({ label: "Quinte+", className: BET_BADGE_COLORS.QUINTE_PLUS });
  if (offers.some((offer) => offer.type === "QUARTE_PLUS" && offer.audience === "REGIONAL")) {
    highlights.push({ label: "Quarte regional", className: BET_BADGE_COLORS.QUARTE_PLUS });
  }
  if (offers.some((offer) => offer.type === "PICK5")) highlights.push({ label: "Pick 5", className: BET_BADGE_COLORS.PICK5 });
  return highlights;
}

function unique(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-[#d9e1de] bg-[#fbfcfc] p-3">
      <p className="text-xs uppercase text-[#65746f]">{label}</p>
      <p className="mt-1 text-sm font-bold text-[#26312e]">{value}</p>
    </div>
  );
}
