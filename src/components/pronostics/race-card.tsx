import Link from "next/link";
import { ArrowRight, Clock3, TrendingUp } from "lucide-react";
import { BetBadge, DisciplinePill, RaceStatusPill, titleCase } from "@/components/badges";
import { formatPct } from "@/lib/format";
import type { PronosticRace } from "@/lib/pronostics-filters";
import type { RaceStatus } from "@/lib/race-status";
import { FavoriIaChip, ProbabilityBars, ReadingPill } from "./race-bits";

type Props = { race: PronosticRace; status: RaceStatus; active: boolean };

export function raceHref(race: Pick<PronosticRace, "id">): string {
  return `/races/${encodeURIComponent(race.id)}`;
}

/** Carte complète d'une course : ordre probable, base, value bet, top 3, tickets. */
export function RaceCard({ race, status, active }: Props) {
  const headingId = `titre-${race.anchor}`;
  return (
    <article
      id={race.anchor}
      tabIndex={-1}
      aria-labelledby={headingId}
      // content-visibility : les cartes hors écran ne sont ni mises en page ni
      // peintes — les gros jours (plus de 50 courses) restent fluides sans
      // liste virtualisée, et la recherche du navigateur trouve toujours tout.
      className={`scroll-mt-24 overflow-hidden rounded-2xl border bg-surface shadow-sm transition [contain-intrinsic-size:auto_280px] [content-visibility:auto] hover:shadow-md ${active ? "border-accent/60" : "border-border"}`}
    >
      {/* Barre haute */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-border bg-surface-sub px-4 py-3 sm:px-5">
        <span className="font-mono text-sm font-bold text-fg">{race.anchor}</span>
        <span aria-hidden="true" className="h-3.5 w-px bg-border-strong" />
        <span className="flex items-center gap-1 font-mono text-sm font-semibold text-fg">
          <Clock3 aria-hidden="true" size={13} className="text-muted" />
          {race.startTime}
        </span>
        <span aria-hidden="true" className="h-3.5 w-px bg-border-strong" />
        <span className="min-w-0 truncate text-sm text-muted">{titleCase(race.racecourse)}</span>
        <RaceStatusPill status={status} />
        <div className="ml-auto flex flex-wrap gap-1.5">
          {race.bets.map((bet) => <BetBadge key={bet} bet={bet} />)}
          <DisciplinePill discipline={race.discipline} />
        </div>
      </div>

      {/* Corps */}
      <div className="grid gap-4 p-4 sm:p-5 md:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
        <div className="min-w-0">
          <h2 id={headingId} className="font-display text-xl font-bold text-fg">{titleCase(race.name)}</h2>
          <p className="mt-1 text-sm text-muted">{race.details}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <ReadingPill reading={race.reading} />
            {race.favoriIa && <FavoriIaChip favori={race.favoriIa} />}
          </div>
          <div className="mt-4">
            <ProbabilityBars top3={race.top3} />
          </div>
        </div>

        <div className="flex min-w-0 flex-col gap-3">
          <div className="grid grid-cols-2 gap-2 min-[420px]:grid-cols-3">
            <RecapBox label="Ordre probable" value={race.arrival.join(" – ") || "—"} mono className="col-span-2 min-[420px]:col-span-1" />
            <RecapBox label="Base IA" value={race.base ? `n° ${race.base.number} ${titleCase(race.base.name)}` : "—"} />
            <RecapBox
              label="Value bet"
              value={race.valueBet ? `n° ${race.valueBet.number} · ${formatPct(race.valueBet.valueIndex, 0, true)}` : "—"}
              accent={!!race.valueBet}
            />
          </div>

          <Link
            href={raceHref(race)}
            className="inline-flex items-center justify-center gap-2 self-stretch rounded-xl bg-accent px-5 py-3 text-sm font-bold text-accent-fg transition hover:bg-accent-hi sm:self-end"
          >
            Analyse <span className="sr-only">de la course {race.anchor}</span>
            <ArrowRight aria-hidden="true" size={14} />
          </Link>
        </div>
      </div>

      {race.tickets.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 border-t border-border bg-surface-sub px-4 py-3 sm:px-5">
          <span className="mr-1 flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-muted">
            <TrendingUp aria-hidden="true" size={11} /> Tickets IA :
          </span>
          {race.tickets.map((item) => (
            <span key={item.type} className="max-w-full break-words rounded-full border border-accent/20 bg-accent-lo px-2.5 py-1 text-xs font-bold text-accent-text">
              {item.label} : {item.ticket}
            </span>
          ))}
          {race.moreTickets > 0 && <span className="text-xs text-muted">+{race.moreTickets} autres</span>}
        </div>
      )}
    </article>
  );
}

function RecapBox({ label, value, mono, accent, className = "" }: { label: string; value: string; mono?: boolean; accent?: boolean; className?: string }) {
  return (
    <div className={`min-w-0 rounded-xl border p-3 ${className} ${accent ? "border-accent/30 bg-accent-lo" : "border-border bg-surface-sub"}`}>
      <p className="text-[10px] font-bold uppercase tracking-widest text-muted">{label}</p>
      <p className={`mt-1 break-words text-sm font-bold ${mono ? "font-mono" : ""} ${accent ? "text-accent-text" : "text-fg"}`}>
        {value}
      </p>
    </div>
  );
}
