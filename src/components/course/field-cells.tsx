import { ArrowDownRight, ArrowRight, ArrowUpRight, Banknote, BanknoteArrowDown, Brain, Flame, Zap, type LucideIcon } from "lucide-react";
import { SIGNAL_LABELS, STANCE_LABELS, type MarketSignal, type Stance } from "@/lib/confrontation";
import type { HorseRow } from "@/lib/course-view-model";
import { FLOW_ACCEL_PTS, FLOW_TREND_PTS } from "@/lib/market";
import { signedPts } from "@/components/course/shared";

/**
 * Cellules et pastilles du tableau des partants, partagées avec le nuage
 * IA × marché et le comparateur : une famille ou un signal a la même couleur
 * partout où il apparaît.
 */

export const STANCE_STYLES: Record<Stance, string> = {
  accord: "bg-purple-100 text-purple-900 dark:bg-purple-950 dark:text-purple-200",
  ia: "bg-sky-100 text-sky-900 dark:bg-sky-950 dark:text-sky-200",
  marche: "bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200",
};

/** Mêmes teintes que les pastilles, pour les points du nuage IA × marché. */
export const STANCE_DOT_STYLES: Record<Stance, string> = {
  accord: "fill-purple-600 dark:fill-purple-400",
  ia: "fill-sky-600 dark:fill-sky-400",
  marche: "fill-emerald-600 dark:fill-emerald-400",
};

export const STANCE_HINTS: Record<Stance, string> = {
  accord: "L'IA et le marché convergent.",
  ia: "Plus haut chez l'IA que sur le marché.",
  marche: "Plus soutenu par le marché que par l'IA.",
};

export function StanceBadge({ stance }: { stance: Stance }) {
  return (
    <span className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${STANCE_STYLES[stance]}`}>
      {STANCE_LABELS[stance]}
    </span>
  );
}

const SIGNAL_ICONS: Record<MarketSignal, LucideIcon> = { argent: Banknote, acceleration: Flame, smart: Brain, sortant: BanknoteArrowDown };
const SIGNAL_STYLES: Record<MarketSignal, string> = {
  argent: "bg-accent-lo text-accent-text",
  acceleration: "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200",
  smart: "bg-surface-inv text-white",
  sortant: "bg-danger/10 text-danger",
};

export function SignalBadges({ row }: { row: HorseRow }) {
  if (row.signals.length === 0) return <span className="text-muted">—</span>;
  return (
    <span className="flex flex-wrap gap-1">
      {row.signals.map((s) => {
        const Icon = SIGNAL_ICONS[s];
        return (
          <span key={s} className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-bold ${SIGNAL_STYLES[s]}`}>
            <Icon aria-hidden="true" size={11} />
            {SIGNAL_LABELS[s]}
          </span>
        );
      })}
    </span>
  );
}

export function gapClass(gap: number | null) {
  if (gap === null) return "text-muted";
  if (gap >= 2) return "font-bold text-accent-text";
  if (gap <= -2) return "font-bold text-danger";
  return "text-muted";
}

export function MoveCell({ row }: { row: HorseRow }) {
  const m = row.movement;
  if (m.direction === "inconnu") return <span className="text-muted">—</span>;
  const Icon = m.direction === "joue" ? ArrowDownRight : m.direction === "delaisse" ? ArrowUpRight : ArrowRight;
  const cls = m.direction === "joue" ? "text-accent-text" : m.direction === "delaisse" ? "text-danger" : "text-muted";
  const label = m.direction === "joue" ? "Joué" : m.direction === "delaisse" ? "Délaissé" : "Stable";
  return (
    <span className={`inline-flex items-center gap-1 font-sans text-xs font-bold ${cls}`}>
      <Icon aria-hidden="true" size={14} />
      {label}
    </span>
  );
}

export function FlowCell({ row }: { row: HorseRow }) {
  const d = row.flow.delta15;
  if (d === null) return <span className="text-muted">—</span>;
  const up = d >= FLOW_TREND_PTS;
  const down = d <= -FLOW_TREND_PTS;
  const Icon = up ? ArrowUpRight : down ? ArrowDownRight : ArrowRight;
  return (
    <span className={`inline-flex items-center justify-end gap-1 ${row.flow.strong ? "font-bold text-accent-text" : up ? "text-accent-text" : down ? "text-danger" : "text-muted"}`}>
      <Icon aria-hidden="true" size={13} />
      {signedPts(d)}
    </span>
  );
}

export function AccelCell({ row }: { row: HorseRow }) {
  const d = row.flow.delta5;
  if (d === null) return <span className="text-muted">—</span>;
  const accelerating = d >= FLOW_ACCEL_PTS;
  return (
    <span className={`inline-flex items-center justify-end gap-1 ${accelerating ? "font-bold text-accent-text" : "text-muted"}`}>
      {accelerating && <Zap aria-label="Accélération" className="fill-current" size={12} />}
      {signedPts(d)}
    </span>
  );
}

/** Réussite d'un jockey ou d'un entraîneur : « 18 % (240) ». */
export function rate(wins?: number | null, runs?: number | null) {
  if (!runs) return "—";
  return `${Math.round((100 * (wins ?? 0)) / runs)} % (${runs})`;
}
