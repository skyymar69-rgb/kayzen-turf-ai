"use client";

import Link from "next/link";
import { Star } from "lucide-react";
import { useMemo } from "react";
import { RaceStatusPill, titleCase } from "@/components/badges";
import { useFollowedHorses } from "@/hooks/use-followed-horses";
import type { ProgrammeDay } from "@/lib/home/days";
import { followedRunners } from "@/lib/home/followed";
import { raceStatusAt } from "@/lib/home/race-signals";
import type { RaceAnalysis } from "@/lib/types";
import { raceHref } from "./types";

const TITLES: Record<ProgrammeDay, string> = {
  today: "Vos chevaux suivis courent aujourd'hui",
  tomorrow: "Vos chevaux suivis courent demain",
  yesterday: "Vos chevaux suivis couraient hier",
};

/**
 * Rappel en tête d'accueil : les chevaux suivis (mémorisés dans ce navigateur)
 * engagés dans les courses du jour affiché. Rien ne s'affiche s'il n'y en a
 * aucun — ni au rendu serveur, où le suivi n'est pas encore lu.
 */
export function FollowedToday({ races, day, nowMs }: { races: RaceAnalysis[]; day: ProgrammeDay; nowMs: number | null }) {
  const { followed } = useFollowedHorses();
  const runners = useMemo(() => followedRunners(races, followed), [races, followed]);
  if (runners.length === 0) return null;
  const now = nowMs === null ? null : new Date(nowMs);

  return (
    <section aria-labelledby="suivis-du-jour" className="mt-6 rounded-2xl border border-accent/30 bg-accent-lo shadow-sm">
      <div className="flex items-center gap-2 px-5 pt-4">
        <Star aria-hidden="true" className="fill-amber-500 text-amber-700 dark:fill-amber-400 dark:text-amber-400" size={16} />
        <h2 id="suivis-du-jour" className="font-display text-base font-bold text-fg">{TITLES[day]}</h2>
      </div>
      <ul className="grid gap-2 p-4 sm:grid-cols-2 lg:grid-cols-3">
        {runners.map(({ race, horseId, number, name }) => (
          <li key={`${race.id}-${horseId}`}>
            <Link
              href={raceHref(race)}
              className="flex items-center gap-3 rounded-xl border border-border bg-surface px-3 py-2.5 transition hover:border-accent/40"
            >
              <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-surface-sub font-mono text-xs font-bold text-fg">{number}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-fg">{titleCase(name)}</span>
                <span className="block truncate font-mono text-[11px] text-muted">{race.programCode} · {race.startTime} · {titleCase(race.racecourse)}</span>
              </span>
              <RaceStatusPill status={raceStatusAt(race, now)} className="shrink-0" />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
