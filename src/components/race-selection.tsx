"use client";

import { useMemo, useState } from "react";
import { formatOdds, hasOdds } from "@/lib/format";
import type { SignalRecord } from "@/lib/race-repository";
import type { RaceSelection, SelectedHorse } from "@/lib/selection";
import { STRATEGY_LABELS, strategyTicket, type Strategy } from "@/lib/strategy";
import { ProfileBadge, pct, roiLine } from "@/components/course/shared";

/**
 * LA SÉLECTION — unique classement de la page course.
 *
 * Huit chevaux, ordonnés par probabilité. Le Top 3 est constitué des trois
 * premiers de cette même liste : aucun autre bloc de la page ne reclasse le
 * peloton. La stratégie choisie change le ticket proposé, jamais l'ordre.
 */

function barWidth(value: number): number {
  // Arrondi : un flottant brut s'écrit différemment au rendu serveur et au client.
  return Number.isFinite(value) ? Math.round(Math.max(2, Math.min(100, value)) * 10) / 10 : 2;
}

export function RaceSelectionPanel({
  selection,
  signals,
  selectedNumber,
  onSelect,
}: {
  selection: RaceSelection;
  signals: Map<string, SignalRecord>;
  selectedNumber: number | null;
  onSelect: (number: number) => void;
}) {
  const [strategy, setStrategy] = useState<Strategy>("securise");
  const ticket = useMemo(() => strategyTicket(selection, strategy), [selection, strategy]);

  if (selection.horses.length === 0) {
    return (
      <section className="mt-4 rounded-2xl border border-border bg-surface p-6 text-sm text-muted">
        Sélection indisponible — partants non renseignés pour cette course.
      </section>
    );
  }

  const { top3 } = selection;
  const complements = selection.horses.slice(3);
  const signal = ticket?.signalKey ? signals.get(ticket.signalKey) : undefined;

  return (
    <section className="mt-4 overflow-hidden rounded-2xl border-2 border-accent/30 bg-surface shadow-sm" aria-label="Notre sélection">
      <header className="border-b border-border bg-accent-lo px-5 py-4 sm:px-6">
        <div className="flex flex-wrap items-start justify-between gap-x-8 gap-y-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-accent-text">Notre sélection — {selection.horses.length} chevaux</p>
            <div className="mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span className="font-mono text-4xl font-bold leading-none tracking-tight text-accent-text">
                {top3.map((s) => s.horse.number).join(" – ")}
              </span>
              {complements.length > 0 && (
                <span className="font-mono text-2xl font-bold leading-none tracking-tight text-accent-text/80">
                  – {complements.map((s) => s.horse.number).join(" – ")}
                </span>
              )}
            </div>
            <p className="mt-2 text-xs text-accent-text">
              <span className="font-bold">Top 3</span> en gras — les trois plus fortes probabilités
              {complements.length > 0 && <> · les {complements.length} suivants complètent les tickets larges</>}
            </p>
          </div>

          <div className="w-full max-w-sm rounded-xl border border-border bg-surface px-4 py-3 sm:w-auto">
            <div className="flex items-center justify-between gap-3">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted">Ticket</p>
              <div role="group" aria-label="Stratégie" className="flex overflow-hidden rounded-lg border border-border text-[11px] font-bold">
                {(Object.keys(STRATEGY_LABELS) as Strategy[]).map((s) => (
                  <button
                    key={s}
                    aria-pressed={strategy === s}
                    className={`min-h-7 px-2.5 py-1 transition ${strategy === s ? "bg-accent text-accent-fg" : "text-muted hover:bg-surface-sub"}`}
                    onClick={() => setStrategy(s)}
                    type="button"
                  >
                    {STRATEGY_LABELS[s]}
                  </button>
                ))}
              </div>
            </div>
            {ticket ? (
              <>
                <p className="mt-2 text-sm font-semibold text-fg">{ticket.betLabel}</p>
                <p className="font-mono text-2xl font-bold text-accent-text">{ticket.numbers.join(" – ")}</p>
                <p className="mt-1 text-xs text-muted">
                  Passe dans <span className="font-bold text-fg">{pct(ticket.probability)}</span> des cas selon nos probabilités. {ticket.rationale}
                </p>
                <p className="mt-1 text-[11px] text-muted">
                  {signal && signal.bets > 0 ? <>Historique : <span className={signal.roi >= 0 ? "font-bold text-accent-text" : "font-bold text-danger"}>{roiLine(signal.roi, signal.bets)}</span>.</> : "Rendement historique non encore mesuré."}
                </p>
              </>
            ) : (
              <p className="mt-2 text-sm text-muted">Aucun cheval ne correspond à cette stratégie dans cette course.</p>
            )}
          </div>
        </div>
      </header>

      <ol className="divide-y divide-border">
        {selection.horses.map((entry) => (
          <SelectionRow key={entry.horse.id} entry={entry} selected={selectedNumber === entry.horse.number} onSelect={onSelect} />
        ))}
      </ol>
    </section>
  );
}

function SelectionRow({ entry, selected, onSelect }: { entry: SelectedHorse; selected: boolean; onSelect: (n: number) => void }) {
  const { horse, rank, profile } = entry;
  const inTop3 = rank <= 3;

  return (
    <li>
      <button
        aria-pressed={selected}
        className={`flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-accent-lo/50 sm:px-6 ${selected ? "bg-accent-lo" : inTop3 ? "bg-surface" : "bg-surface-sub/40"}`}
        onClick={() => onSelect(horse.number)}
        type="button"
      >
        <span className={`flex size-9 shrink-0 items-center justify-center rounded-xl font-mono text-base font-bold ${inTop3 ? "bg-accent text-accent-fg" : "bg-surface-sub text-muted"}`}>
          {rank}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-lg font-bold text-fg">#{horse.number}</span>
            <span className="truncate font-semibold text-fg">{horse.horse}</span>
            <ProfileBadge profile={profile} />
          </span>
          <span className="mt-1 block truncate text-xs text-muted">
            {horse.jockey} · cote {formatOdds(horse.odds)} · marché {hasOdds(horse.odds) ? pct(horse.marketProbability) : "—"} · IA {pct(horse.fundamentalProbability ?? NaN)}
          </span>
          <span className="mt-2 block h-1.5 w-full overflow-hidden rounded-full bg-surface-sub">
            <span className="block h-full rounded-full bg-accent" style={{ width: `${barWidth(horse.top3Probability)}%` }} />
          </span>
        </span>
        <span className="shrink-0 text-right">
          <span className="block font-mono text-xl font-bold leading-none text-fg">{pct(horse.top3Probability)}</span>
          <span className="mt-1 block text-[10px] uppercase tracking-wide text-muted">Top 3</span>
          <span className="mt-1.5 block font-mono text-xs text-muted">{pct(horse.winProbability)} gagnant</span>
        </span>
      </button>
    </li>
  );
}
