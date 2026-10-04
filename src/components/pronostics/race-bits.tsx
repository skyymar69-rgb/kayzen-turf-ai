import { Sparkles } from "lucide-react";
import { titleCase } from "@/components/badges";
export { ReadingPill } from "@/components/badges";
import { formatPct } from "@/lib/format";
import type { FavoriIa, PronosticRace } from "@/lib/pronostics-filters";

/**
 * Petites pièces communes aux cartes, à la vue compacte et à la navigation.
 */

/** Point de couleur de discipline ; le nom reste lisible pour les lecteurs d'écran. */
const DOT_STYLES: Record<string, string> = {
  Plat: "bg-disc-plat-fg",
  Trot: "bg-disc-trot-fg",
  Obstacle: "bg-disc-obst-fg",
};

export function DisciplineDot({ discipline }: { discipline: string }) {
  return (
    <>
      <span aria-hidden="true" className={`inline-block size-2 shrink-0 rounded-full ${DOT_STYLES[discipline] ?? DOT_STYLES.Plat}`} />
      <span className="sr-only">{discipline}</span>
    </>
  );
}

/** L'IA (sans cote) place ce cheval nettement au-dessus du marché. */
export function FavoriIaChip({ favori }: { favori: FavoriIa }) {
  return (
    <span
      className="inline-flex max-w-full items-center gap-1 rounded-full border border-accent/30 bg-accent-lo px-2 py-0.5 text-[11px] font-bold text-accent-text"
      title={`Probabilité IA ${formatPct(favori.ai, 0)} contre ${formatPct(favori.market, 0)} pour le marché`}
    >
      <Sparkles aria-hidden="true" size={11} className="shrink-0" />
      <span className="truncate">
        Favori IA : n° {favori.number} {titleCase(favori.name)}
      </span>
      <span className="sr-only">
        , {formatPct(favori.ai, 0)} pour l’IA contre {formatPct(favori.market, 0)} pour le marché
      </span>
    </span>
  );
}

/**
 * Probabilité de victoire des trois premiers de l'ordre probable. La barre
 * représente l'échelle 0–100 % ; la valeur est toujours écrite.
 */
export function ProbabilityBars({ top3 }: { top3: PronosticRace["top3"] }) {
  if (top3.length === 0) return null;
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-widest text-muted">Top 3 IA · chance de gagner</p>
      <ol className="mt-1.5 space-y-1">
        {top3.map((h) => (
          <li key={h.number} className="grid grid-cols-[minmax(0,1fr)_3.25rem] items-center gap-2 text-xs">
            <div className="min-w-0">
              <span className="block truncate font-semibold text-fg">
                n° {h.number} {titleCase(h.name)}
              </span>
              <span aria-hidden="true" className="mt-0.5 block h-1.5 overflow-hidden rounded-full bg-surface-sub">
                <span className="block h-full rounded-full bg-accent" style={{ width: `${Math.min(100, Math.max(0, h.winProbability))}%` }} />
              </span>
            </div>
            <span className="text-right font-mono font-bold tabular-nums text-fg">{formatPct(h.winProbability, 0)}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
