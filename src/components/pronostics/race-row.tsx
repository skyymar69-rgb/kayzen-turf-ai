import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { BetBadge, RaceStatusPill, titleCase } from "@/components/badges";
import { formatGap } from "@/lib/value-signal";
import type { PronosticRace } from "@/lib/pronostics-filters";
import type { RaceStatus } from "@/lib/race-status";
import { DisciplineDot, ReadingPill } from "./race-bits";
import { raceHref } from "./race-card";

type Props = { race: PronosticRace; status: RaceStatus; active: boolean };

/**
 * Vue compacte : une ligne par course, pour parcourir une grosse journée d'un
 * coup d'œil. Sur mobile la ligne passe sur deux niveaux plutôt que de
 * déborder.
 */
export function RaceRow({ race, status, active }: Props) {
  return (
    <li
      id={race.anchor}
      tabIndex={-1}
      className={`scroll-mt-24 grid grid-cols-[3rem_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 border-b border-border px-3 py-2.5 last:border-b-0 sm:grid-cols-[3rem_3.25rem_minmax(0,1fr)_minmax(0,9rem)_auto_auto_auto] ${active ? "bg-accent-lo" : ""}`}
    >
      <span className="order-1 font-mono text-sm font-bold text-fg sm:order-none">{race.startTime}</span>
      <span className="flex min-w-0 items-center gap-1.5 order-2 font-mono text-xs font-bold text-muted sm:order-none">
        <DisciplineDot discipline={race.discipline} />
        {race.anchor}
      </span>
      <div className="order-4 col-span-3 flex min-w-0 flex-wrap items-center gap-1.5 sm:order-none sm:col-span-1">
        <span className="min-w-0 truncate text-sm font-semibold text-fg">{titleCase(race.name)}</span>
        <span className="text-xs text-muted">· {titleCase(race.racecourse)}</span>
        {race.bets.map((bet) => <BetBadge key={bet} bet={bet} />)}
        <RaceStatusPill status={status} />
      </div>
      <span className="order-5 col-span-2 min-w-0 truncate text-xs text-muted sm:order-none sm:col-span-1">
        Base <span className="font-semibold text-fg">{race.base ? `n° ${race.base.number} ${titleCase(race.base.name)}` : "—"}</span>
      </span>
      <span className={`order-6 whitespace-nowrap text-xs sm:order-none ${race.aiGap ? "font-bold text-accent-text" : "text-muted"}`}>
        {race.aiGap ? `Écart IA n° ${race.aiGap.number} ${formatGap(race.aiGap.points)}` : "Pas d'écart IA"}
      </span>
      <span className="hidden sm:inline">
        <ReadingPill reading={race.reading} />
      </span>
      <Link
        href={raceHref(race)}
        className="order-3 inline-flex items-center gap-1 justify-self-end rounded-lg sm:order-none px-2 py-1 text-xs font-bold text-accent-text hover:bg-accent-lo"
      >
        Analyse <span className="sr-only">de la course {race.anchor}</span>
        <ArrowRight aria-hidden="true" size={12} />
      </Link>
    </li>
  );
}
