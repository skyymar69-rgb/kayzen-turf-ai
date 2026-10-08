import { Sparkles } from "lucide-react";
import type { CourseViewModel, HorseRow } from "@/lib/course-view-model";
import { formatOdds } from "@/lib/format";
import type { SignalRecord } from "@/lib/race-repository";
import { SURPRISE_LEVEL_LABELS } from "@/lib/surprise";
import { Eyebrow, pct, roiLine, signedPts } from "@/components/course/shared";
import { ScoreBreakdown, ScoreCell, SurpriseBadge } from "@/components/course/surprise-cells";
import { Term } from "@/components/course/term";

/**
 * CHEVAUX CACHÉS · SURPRISE IA — les trois meilleures alertes de la course,
 * chacune avec son score détaillé, ses raisons et une conclusion d'une ligne.
 *
 * Le score (lib/surprise) dit où l'IA et le marché divergent et pourquoi ; il
 * n'annonce pas plus de gagnants que la cote finale. Le panneau le dit, et
 * affiche le rendement historique des alertes dès que le backtest l'a mesuré.
 */

/** Colonnes selon le nombre de cartes : une carte seule prend la largeur utile. */
const GRID_COLUMNS: Record<number, string> = { 1: "sm:grid-cols-[minmax(0,560px)]", 2: "sm:grid-cols-2", 3: "sm:grid-cols-2 xl:grid-cols-3" };

/** Signaux du backtest rappelés sous le panneau. */
export const SURPRISE_SIGNALS = ["surprise-sg", "surprise-sp"];

export function SurprisePanel({
  vm,
  signals,
  onSelect,
  selectedNumber,
}: {
  vm: CourseViewModel;
  signals: Map<string, SignalRecord>;
  onSelect: (number: number) => void;
  selectedNumber: number | null;
}) {
  const tracked = SURPRISE_SIGNALS.map((key) => signals.get(key)).filter((s): s is SignalRecord => !!s && s.bets > 0);
  const watched = vm.rows.filter((r) => r.surprise.alert?.level === "surveiller" && !vm.surprises.includes(r));

  return (
    <section aria-labelledby="titre-surprises" className="mt-4 overflow-hidden rounded-2xl border border-border bg-surface shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-surface-sub px-4 py-3 sm:px-5">
        <div className="flex items-center gap-2">
          <Sparkles aria-hidden="true" className="text-accent-text" size={16} />
          <h2 className="text-sm font-bold text-fg" id="titre-surprises">
            Chevaux cachés · Surprise IA
          </h2>
        </div>
        <p className="text-[11px] text-muted">
          <Term name="Score de surprise">Score de surprise</Term> : écart IA / marché, rang de l&apos;IA, forme, entourage et marché du jour
        </p>
      </div>

      {vm.surprises.length === 0 ? (
        <p className="px-4 py-5 text-sm text-muted sm:px-5">
          Aucune surprise nette dans cette course : l&apos;IA ne voit aucun cheval nettement au-dessus de sa cote.
        </p>
      ) : (
        <ol className={`grid gap-3 p-3 sm:p-4 ${GRID_COLUMNS[Math.min(vm.surprises.length, 3)]}`}>
          {vm.surprises.map((row) => (
            <SurpriseCard key={row.horse.id} onSelect={onSelect} row={row} selected={selectedNumber === row.horse.number} />
          ))}
        </ol>
      )}

      {watched.length > 0 && (
        <p className="border-t border-border px-4 py-2.5 text-xs text-muted sm:px-5">
          À surveiller aussi :{" "}
          {watched.map((r, i) => (
            <span key={r.horse.id}>
              {i > 0 && ", "}
              <button className="font-semibold text-fg underline-offset-2 hover:underline" onClick={() => onSelect(r.horse.number)} type="button">
                n° {r.horse.number} {r.horse.horse}
              </button>{" "}
              ({r.surprise.score}/100)
            </span>
          ))}
          .
        </p>
      )}

      <p className="border-t border-border px-4 py-3 text-[11px] leading-5 text-muted sm:px-5">
        Le score dit où l&apos;IA, qui ne voit jamais la cote, et le marché divergent, et pourquoi. Ce n&apos;est pas une probabilité de victoire :
        mesuré sur 1 571 courses, il ne trouve pas plus de gagnants que la cote finale, qui rattrape souvent ces chevaux avant le départ.
        {tracked.length > 0 && (
          <>
            {" "}Historique des alertes :{" "}
            {tracked.map((s, i) => (
              <span key={s.key}>
                {i > 0 && " · "}
                {s.betType === "SG" ? "simple gagnant" : "simple placé"}{" "}
                <span className={s.roi >= 0 ? "font-bold text-accent-text" : "font-bold text-danger"}>{roiLine(s.roi, s.bets)}</span>
              </span>
            ))}
            .
          </>
        )}
      </p>
    </section>
  );
}

function SurpriseCard({ row, selected, onSelect }: { row: HorseRow; selected: boolean; onSelect: (n: number) => void }) {
  const s = row.surprise;
  return (
    <li className={`flex flex-col rounded-xl border bg-surface p-3 ${selected ? "border-accent ring-1 ring-accent" : "border-border"}`}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="grid size-8 shrink-0 place-items-center rounded-full bg-surface-inv font-mono text-sm font-bold text-white">{row.horse.number}</span>
        <button
          aria-label={`Voir la fiche du n° ${row.horse.number}, ${row.horse.horse}`}
          className="min-w-0 flex-1 text-left font-bold leading-tight text-fg hover:underline"
          onClick={() => onSelect(row.horse.number)}
          type="button"
        >
          {row.horse.horse}
        </button>
        <SurpriseBadge alert={s.alert} />
      </div>

      <dl className="mt-3 grid grid-cols-4 gap-1 text-center">
        {[
          ["IA", pct(row.ai, 0)],
          ["Marché", pct(row.market, 0)],
          ["Écart", signedPts(row.gap, 0).replace(" pt", " pts")],
          ["Cote", formatOdds(row.horse.odds, 1)],
        ].map(([label, value]) => (
          <div key={label} className="rounded-lg bg-surface-sub px-1 py-1.5">
            <dt className="text-[9px] font-bold uppercase tracking-wider text-muted">{label}</dt>
            <dd className="font-mono text-xs font-bold text-fg">{value}</dd>
          </div>
        ))}
      </dl>

      <div className="mt-3 flex items-center justify-between gap-2">
        <Eyebrow>Score de surprise</Eyebrow>
        <ScoreCell surprise={s} />
      </div>
      <div className="mt-2">
        <ScoreBreakdown compact surprise={s} />
      </div>

      {s.reasons.length > 0 && (
        <ul className="mt-3 grid gap-1 text-xs leading-5 text-fg">
          {s.reasons.slice(0, 3).map((reason) => (
            <li key={reason} className="flex gap-1.5">
              <span aria-hidden="true" className="mt-2 size-1 shrink-0 rounded-full bg-accent" />
              {reason}
            </li>
          ))}
        </ul>
      )}

      {s.conclusion && s.alert && (
        <p className="mt-auto pt-3">
          <span className="block rounded-lg bg-accent-lo px-2.5 py-1.5 text-center text-xs font-semibold text-accent-text">
            {SURPRISE_LEVEL_LABELS[s.alert.level]} — {s.conclusion}
          </span>
        </p>
      )}
    </li>
  );
}
