import { Flame, ShieldCheck, Sparkles, TrendingUp } from "lucide-react";

import { SELECTION_SIZE, buildSelection, roleLabel, type SelectedHorse, type SelectionRole } from "@/lib/selection";
import type { HorsePrediction } from "@/lib/types";

/**
 * LA SÉLECTION — unique classement de la page course.
 *
 * Huit chevaux, ordonnés par probabilité. Le Top 3 est constitué des trois
 * premiers de cette même liste : aucun autre bloc de la page ne doit reclasser
 * le peloton, sous peine de réintroduire les contradictions d'affichage.
 */

const ROLE_STYLES: Record<SelectionRole, string> = {
  base: "bg-accent text-white",
  favori: "bg-surface-inv text-white",
  outsider: "bg-accent-lo text-accent-text",
  tocard: "bg-surface-sub text-fg border border-border-strong",
};

const ROLE_ICONS: Record<SelectionRole, typeof ShieldCheck> = {
  base: ShieldCheck,
  favori: TrendingUp,
  outsider: Sparkles,
  tocard: Flame,
};

function pct(value: number): string {
  return Number.isFinite(value) ? `${Math.round(value)}%` : "—";
}

function barWidth(value: number): number {
  return Number.isFinite(value) ? Math.max(2, Math.min(100, value)) : 2;
}

export function RaceSelectionPanel({
  horses,
  recommendedTicket,
}: {
  horses: HorsePrediction[];
  recommendedTicket?: { label: string; ticket: string } | null;
}) {
  const selection = buildSelection(horses);
  if (selection.horses.length === 0) {
    return (
      <section className="mt-4 rounded-2xl border border-border bg-surface p-6 text-sm text-muted">
        Sélection indisponible — partants non renseignés pour cette course.
      </section>
    );
  }

  const { top3, tocard } = selection;
  const complements = selection.horses.slice(3);

  return (
    <section className="mt-4 overflow-hidden rounded-2xl border-2 border-accent/30 bg-surface shadow-sm">
      {/* En-tête : les chevaux à jouer, Top 3 détaché du reste.
          C'est la seule chose à lire pour décider — tout le reste de la page
          n'est là que pour justifier ces numéros. */}
      <header className="border-b border-border bg-accent-lo px-5 py-4 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-accent-text">
              Notre sélection — {selection.horses.length} chevaux
            </p>

            <div className="mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span className="font-mono text-4xl font-bold leading-none tracking-tight text-accent-text">
                {top3.map((s) => s.horse.number).join(" – ")}
              </span>
              {complements.length > 0 && (
                <span className="font-mono text-2xl font-bold leading-none tracking-tight text-accent-text/55">
                  – {complements.map((s) => s.horse.number).join(" – ")}
                </span>
              )}
            </div>

            <p className="mt-2 text-xs text-accent-text/80">
              <span className="font-bold">Top 3</span> en gras — les trois plus fortes probabilités
              {complements.length > 0 && <> · les {complements.length} suivants complètent les tickets larges</>}
            </p>
          </div>

          {recommendedTicket && (
            <div className="rounded-xl border border-border bg-surface px-4 py-3">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted">Ticket recommandé</p>
              <p className="mt-0.5 text-sm font-semibold text-fg">{recommendedTicket.label}</p>
              <p className="mt-1 font-mono text-2xl font-bold text-accent-text">{recommendedTicket.ticket}</p>
            </div>
          )}
        </div>
      </header>

      {/* La sélection entière, un seul classement */}
      <ol className="divide-y divide-border">
        {selection.horses.map((entry) => (
          <SelectionRow key={entry.horse.id} entry={entry} />
        ))}
      </ol>

      <footer className="border-t border-border bg-surface-sub px-5 py-3 sm:px-6">
        {tocard ? (
          <p className="text-xs text-fg">
            <span className="font-bold text-accent-text">Tocard signalé</span> — #{tocard.horse.number}{" "}
            {tocard.horse.horse} à {tocard.horse.odds}, que le modèle estime{" "}
            {tocard.horse.valueRatio?.toFixed(2)}× plus probable que ne le dit le marché.
            {tocard.isPromotedTocard && ` Retenu en ${SELECTION_SIZE}ᵉ place à ce titre, hors des ${SELECTION_SIZE - 1} meilleures probabilités.`}
          </p>
        ) : (
          <p className="text-xs text-muted">
            Aucun tocard signalé sur cette course : le marché ne sous-évalue aucune grosse cote.
          </p>
        )}
      </footer>
    </section>
  );
}

function SelectionRow({ entry }: { entry: SelectedHorse }) {
  const { horse, rank, role, isValue } = entry;
  const Icon = ROLE_ICONS[role];
  const inTop3 = rank <= 3;

  return (
    <li className={`flex items-center gap-3 px-4 py-3 sm:px-6 ${inTop3 ? "bg-surface" : "bg-surface-sub/40"}`}>
      {/* Rang */}
      <span
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl font-mono text-base font-bold ${
          inTop3 ? "bg-accent text-white" : "bg-surface-sub text-muted"
        }`}
      >
        {rank}
      </span>

      {/* Numéro + nom + rôle */}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-lg font-bold text-fg">#{horse.number}</span>
          <span className="truncate font-semibold text-fg">{horse.horse}</span>
          <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${ROLE_STYLES[role]}`}>
            <Icon size={11} />
            {roleLabel(role)}
          </span>
          {isValue && (
            <span className="rounded-full bg-accent-lo px-2 py-0.5 text-[10px] font-bold uppercase text-accent-text">
              Value
            </span>
          )}
        </div>
        <p className="mt-1 truncate text-xs text-muted">
          {horse.jockey} · cote {horse.odds} · marché {pct(horse.marketProbability ?? NaN)}
        </p>
        {/* Barre = probabilité Top 3 */}
        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-surface-sub">
          <div className="h-full rounded-full bg-accent" style={{ width: `${barWidth(horse.top3Probability)}%` }} />
        </div>
      </div>

      {/* Probabilités */}
      <div className="shrink-0 text-right">
        <p className="font-mono text-xl font-bold leading-none text-fg">{pct(horse.top3Probability)}</p>
        <p className="mt-1 text-[10px] uppercase tracking-wide text-muted">Top 3</p>
        <p className="mt-1.5 font-mono text-xs text-muted">{pct(horse.winProbability)} gagnant</p>
      </div>
    </li>
  );
}
