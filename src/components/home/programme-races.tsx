"use client";

import Link from "next/link";
import { ArrowRight, Star } from "lucide-react";
import { BetBadge, DisciplinePill, titleCase } from "@/components/badges";
import type { RaceAnalysis } from "@/lib/types";
import { useRacePeek } from "./race-peek";
import { raceHref, type SignalsFor } from "./types";
import { StatusChip } from "./ui";

type RacesProps = {
  races: RaceAnalysis[];
  activeId: string;
  signalsFor: SignalsFor;
  nowMs: number | null;
  favs: ReadonlySet<string>;
  onToggleFav: (id: string) => void;
};

function FavButton({ id, favs, onToggleFav, bordered }: { id: string; favs: ReadonlySet<string>; onToggleFav: (id: string) => void; bordered?: boolean }) {
  return (
    <button
      aria-label={favs.has(id) ? "Retirer des favoris" : "Ajouter aux favoris"}
      className={`flex h-8 w-8 items-center justify-center rounded-lg border border-border ${bordered ? "bg-surface transition hover:border-amber-300" : ""}`}
      onClick={(e) => { e.preventDefault(); onToggleFav(id); }}
      type="button"
    >
      <Star size={13} className={favs.has(id) ? "fill-amber-500 text-amber-700 dark:fill-amber-400 dark:text-amber-400" : "text-muted"} />
    </button>
  );
}

/* Vue condensée (#60) */
export function CompactRaces({ races, activeId, signalsFor }: Pick<RacesProps, "races" | "activeId" | "signalsFor">) {
  return (
    <div className="grid gap-px bg-border p-0 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {races.map((race) => {
        const active = race.id === activeId;
        const { signal } = signalsFor(race);
        return (
          <Link key={race.id} href={raceHref(race)} className={`flex items-center gap-3 bg-surface px-4 py-2.5 transition hover:bg-surface-sub ${active ? "bg-accent-lo" : ""}`}>
            <span className={`w-8 shrink-0 font-mono text-sm font-bold ${active ? "text-accent-text" : "text-muted"}`}>C{race.courseNumber}</span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold text-fg">{titleCase(race.name)}</p>
              <p className="text-[10px] text-muted">{race.startTime} · {race.discipline}</p>
            </div>
            <span className={`shrink-0 text-[10px] font-bold ${signal.startsWith("Value") || signal.startsWith("Base") ? "text-accent-text" : "text-muted"}`}>
              {signal.split(" ")[0]}
            </span>
          </Link>
        );
      })}
    </div>
  );
}

/* Tableau desktop */
export function RacesTable({ races, activeId, signalsFor, nowMs, favs, onToggleFav, racecourse, hidden }: RacesProps & { racecourse: string; hidden: boolean }) {
  const { peekProps, popover } = useRacePeek();
  return (
    <div className={`overflow-x-auto md:block ${hidden ? "hidden" : "hidden md:block"}`}>
      <table className="w-full min-w-[900px] border-collapse text-left">
        <caption className="sr-only">Courses de la réunion {racecourse}</caption>
        <thead>
          <tr className="border-b border-border bg-surface-sub text-xs font-bold uppercase tracking-widest text-muted">
            <th className="px-5 py-3" scope="col">Course</th>
            <th className="px-5 py-3" scope="col">Prix</th>
            <th className="px-5 py-3" scope="col">Départ</th>
            <th className="px-5 py-3" scope="col">Discipline</th>
            <th className="px-5 py-3" scope="col">Signal IA</th>
            <th className="px-5 py-3" scope="col">Paris ouverts</th>
            <th className="px-5 py-3 text-right" scope="col">Action</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {races.map((race) => {
            const active = race.id === activeId;
            const { signal, highlights } = signalsFor(race);
            return (
              <tr key={race.id} aria-current={active ? "true" : undefined} className={`transition ${active ? "bg-accent-lo" : "hover:bg-surface-sub"}`}>
                <td className="px-5 py-3.5">
                  <span className="inline-flex items-center gap-1.5">
                    <span className={`font-mono text-sm font-bold ${active ? "text-accent-text" : "text-fg"}`}>C{race.courseNumber}</span>
                    {active && <span className="h-1.5 w-1.5 rounded-full bg-accent" />}
                  </span>
                </td>
                <td className="px-5 py-3.5">
                  <Link href={raceHref(race)} className="font-semibold text-fg hover:text-accent-text" {...peekProps(race)}>
                    {titleCase(race.name)}
                  </Link>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {highlights.map((h) => <BetBadge key={h} bet={h} />)}
                  </div>
                </td>
                <td className="px-5 py-3.5"><StatusChip nowMs={nowMs} race={race} /></td>
                <td className="px-5 py-3.5"><DisciplinePill discipline={race.discipline} /></td>
                <td className="px-5 py-3.5 text-sm font-semibold text-accent-text">{signal}</td>
                <td className="px-5 py-3.5">
                  <div className="flex flex-wrap gap-1">
                    {highlights.length === 0 && <span className="text-xs text-muted">Classique</span>}
                    {highlights.map((h) => <BetBadge key={h} bet={h} />)}
                  </div>
                </td>
                <td className="px-5 py-3.5 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <FavButton bordered favs={favs} id={race.id} onToggleFav={onToggleFav} />
                    <Link
                      href={raceHref(race)}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-accent bg-surface px-3.5 py-2 text-xs font-bold text-accent-text transition hover:bg-accent hover:text-accent-fg"
                    >
                      Analyser <ArrowRight size={12} />
                    </Link>
                  </div>
                </td>
              </tr>
            );
          })}
          {races.length === 0 && (
            <tr>
              <td colSpan={7} className="px-5 py-8 text-center text-sm text-muted">Aucune course ne correspond à ce filtre.</td>
            </tr>
          )}
        </tbody>
      </table>
      {popover}
    </div>
  );
}

/* Cartes mobile */
export function RaceCards({ races, activeId, signalsFor, nowMs, favs, onToggleFav }: RacesProps) {
  return (
    <div className="grid gap-3 p-4 md:hidden">
      {races.map((race) => {
        const active = race.id === activeId;
        const { signal, highlights } = signalsFor(race);
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
                <p className="mt-0.5 text-xs font-semibold text-accent-text">{signal}</p>
              </div>
              <DisciplinePill discipline={race.discipline} />
            </div>
            <div className="mt-3 flex flex-wrap gap-1">
              {highlights.map((h) => <BetBadge key={h} bet={h} />)}
            </div>
            <div className="mt-3 flex items-center justify-between gap-3">
              <StatusChip nowMs={nowMs} race={race} />
              <div className="flex items-center gap-2">
                <FavButton favs={favs} id={race.id} onToggleFav={onToggleFav} />
                <Link href={raceHref(race)} className="inline-flex items-center gap-1.5 rounded-xl bg-cta px-3.5 py-2 text-xs font-bold text-cta-text">
                  Analyser <ArrowRight size={12} />
                </Link>
              </div>
            </div>
          </article>
        );
      })}
      {races.length === 0 && (
        <p className="rounded-xl border border-border p-4 text-center text-sm text-muted">Aucune course ne correspond à ce filtre.</p>
      )}
    </div>
  );
}
