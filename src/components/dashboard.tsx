"use client";

import Link from "next/link";
import { CalendarDays, ChevronLeft, ChevronRight, Flag, ShieldCheck, Sparkles } from "lucide-react";
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

  if (!selectedMeeting || !selectedRace) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#f3f5f4] px-4 text-[#26312e]">
        <div className="rounded-md border border-[#d9e1de] bg-white p-6 text-center shadow-sm">
          <Flag className="mx-auto text-emerald-700" size={34} />
          <h1 className="mt-4 text-2xl font-semibold">KAYZEN TURF AI</h1>
          <p className="mt-2 text-sm text-[#65746f]">Aucune course francaise disponible sur cette date.</p>
        </div>
      </main>
    );
  }

  const topArrival = probableArrival(selectedRace.horses).slice(0, 5);

  return (
    <main className="min-h-screen bg-[#f3f5f4] px-3 py-5 text-[#26312e] sm:px-5 lg:px-8">
      <section className="mx-auto max-w-[1480px]">
        <div className="inline-flex overflow-hidden rounded-t-sm shadow-sm">
          <div className="grid h-16 w-16 place-items-center bg-emerald-800 text-white">
            <Flag size={30} />
          </div>
          <h1 className="flex h-16 items-center bg-emerald-700 px-6 text-2xl font-bold uppercase tracking-normal text-white sm:text-3xl">
            Resultats PMU : Arrivees & Rapports
          </h1>
        </div>

        <section className="overflow-hidden rounded-b-md border border-[#d9e1de] bg-white shadow-sm">
          <div className="grid border-b border-[#d9e1de] lg:grid-cols-[1fr_1fr]">
            <div className="grid min-h-20 grid-cols-[72px_1fr_72px] items-center border-r border-[#d9e1de]">
              <button
                aria-label="Jour precedent"
                className="grid h-full place-items-center text-[#9aa4a0] transition hover:bg-[#f7f8f8] hover:text-[#26312e]"
                onClick={() => setDayFilter(previousDay(dayFilter))}
                type="button"
              >
                <ChevronLeft size={34} />
              </button>
              <div className="flex items-center justify-center gap-5 text-2xl text-[#52615d]">
                <CalendarDays size={36} />
                <span>{formatShortDate(selectedRace.raceDate)}</span>
              </div>
              <button
                aria-label="Jour suivant"
                className="grid h-full place-items-center text-[#9aa4a0] transition hover:bg-[#f7f8f8] hover:text-[#26312e]"
                onClick={() => setDayFilter(nextDay(dayFilter))}
                type="button"
              >
                <ChevronRight size={34} />
              </button>
            </div>

            <div className="grid grid-cols-3 bg-[#3f403f] text-lg font-semibold uppercase text-white">
              {DAY_ORDER.map((day) => (
                <button
                  className={`min-h-20 transition ${dayFilter === day ? "bg-[#3f403f]" : "bg-[#565756] hover:bg-[#4b4c4b]"}`}
                  key={day}
                  onClick={() => {
                    setDayFilter(day);
                    setSelectedMeetingKey("");
                  }}
                  type="button"
                >
                  {formatRelativeDay(day)}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-[56px_1fr_56px] border-b border-[#d9e1de]">
            <button className="grid min-h-28 place-items-center border-r border-[#d9e1de] text-[#65746f]" type="button">
              <ChevronLeft size={34} />
            </button>
            <div className="flex overflow-x-auto">
              {meetings.map((meeting) => {
                const active = meeting.key === selectedMeeting.key;
                return (
                  <button
                    className={`relative min-h-28 min-w-[220px] border-r border-[#d9e1de] px-4 py-3 text-left transition ${
                      active ? "bg-emerald-700 text-white" : "bg-white text-[#52615d] hover:bg-[#f7f8f8]"
                    }`}
                    key={meeting.key}
                    onClick={() => setSelectedMeetingKey(meeting.key)}
                    type="button"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-3xl">{meetingIcon(meeting.specialties)}</span>
                      <span>
                        <span className={`block text-2xl font-bold ${active ? "text-white" : "text-[#3f403f]"}`}>R{meeting.reunionNumber}</span>
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
            <button className="grid min-h-28 place-items-center border-l border-[#d9e1de] text-[#b0b8b5]" type="button">
              <ChevronRight size={34} />
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] border-collapse text-left">
              <thead>
                <tr className="bg-[#3f403f] text-sm uppercase text-white">
                  <th className="px-7 py-4 font-bold">Course</th>
                  <th className="px-5 py-4 font-bold">Discipline</th>
                  <th className="px-5 py-4 font-bold">Prix</th>
                  <th className="px-5 py-4 font-bold">Depart & Arrivee</th>
                  <th className="px-5 py-4 text-center font-bold">NP</th>
                  <th className="px-5 py-4 text-right font-bold">Action</th>
                </tr>
              </thead>
              <tbody>
                {selectedMeeting.races.map((race) => {
                  const active = race.id === selectedRace.id;
                  return (
                    <tr className={`${active ? "bg-emerald-50" : "even:bg-[#f5f6f6]"} border-b border-[#e0e5e3] text-lg`} key={race.id}>
                      <td className="px-7 py-4 font-bold text-[#26312e]">C{race.courseNumber}</td>
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
                <Link className="rounded-sm bg-emerald-700 px-5 py-3 text-sm font-bold uppercase text-white" href={`/races/${encodeURIComponent(selectedRace.id)}`}>
                  Voir tous les partants
                </Link>
              </div>
              <div className="mt-4 overflow-x-auto">
                <table className="w-full min-w-[720px] border-collapse text-left">
                  <thead>
                    <tr className="bg-[#3f403f] text-xs uppercase text-white">
                      <th className="px-3 py-3">N</th>
                      <th className="px-3 py-3">Cheval</th>
                      <th className="px-3 py-3">Driver</th>
                      <th className="px-3 py-3">Cote</th>
                      <th className="px-3 py-3">KZ</th>
                      <th className="px-3 py-3">Top 3</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topArrival.map((horse) => (
                      <tr className="border-b border-[#e0e5e3] text-sm even:bg-[#f5f6f6]" key={horse.id}>
                        <td className="px-3 py-3 font-mono font-bold">{horse.number}</td>
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
  return "Aujourd'hui";
}

function formatShortDate(date: string) {
  const [year, month, day] = date.split("-");
  return `${day}-${month}-${year}`;
}

function titleCase(value: string) {
  return value
    .toLowerCase()
    .split(/(\s|-|')/)
    .map((part) => (part.length > 1 ? part.charAt(0).toUpperCase() + part.slice(1) : part))
    .join("");
}

function raceIcon(race: RaceAnalysis) {
  if (race.discipline === "Trot") return "♞";
  if (race.discipline === "Obstacle") return "♘";
  return "♞";
}

function meetingIcon(specialties: string[]) {
  if (specialties.some((specialty) => specialty.includes("Attele") || specialty.includes("Monte"))) return "♞";
  return "♘";
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
