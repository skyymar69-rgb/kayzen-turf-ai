import { properName } from "@/lib/format";
import { READING_LABELS, READING_RULES } from "@/lib/profiles";
import { BET_HIGHLIGHT_LABELS, RACE_STATUS_LABELS, type BetHighlight, type RaceStatus } from "@/lib/race-status";
import { buildSelection } from "@/lib/selection";
import type { RaceAnalysis } from "@/lib/types";

/**
 * Pastilles et formateur de libellés partagés entre l'accueil et /pronostics.
 *
 * `TierBadge`, `DisciplinePill` et `titleCase` étaient dupliqués dans les deux
 * pages, avec deux palettes différentes pour le Plat (violet d'un côté, émeraude
 * de l'autre) : la même discipline changeait de couleur d'une page à l'autre.
 * Une seule définition, la palette de l'accueil.
 */

/** Voir `properName` : une seule règle de casse pour tout le site. */
export function titleCase(v: string) {
  return properName(v);
}

/**
 * Lecture de la course (lisible / ouverte / piège), tirée des profils réels.
 * Elle remplace les pastilles Focus / Value / Prudence, que l'import déduisait
 * du seul nombre de partants et de l'allocation : présentées comme un avis de
 * l'IA, elles n'en étaient pas un.
 */
export function ReadingBadge({ horses }: { horses: RaceAnalysis["horses"] }) {
  const reading = buildSelection(horses).verdict.reading;
  const cls =
    reading === "lisible" ? "bg-accent text-accent-fg" :
    reading === "ouverte" ? "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200" :
                            "bg-danger/10 text-danger";
  return (
    <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${cls}`} title={READING_RULES[reading]}>
      {READING_LABELS[reading]}
    </span>
  );
}

/** Couleurs de discipline, reprises partout (cartes, navigation, filtres). */
export const DISCIPLINE_STYLES: Record<string, string> = {
  Plat: "bg-disc-plat text-disc-plat-fg",
  Trot: "bg-disc-trot text-disc-trot-fg",
  Obstacle: "bg-disc-obst text-disc-obst-fg",
};

export function DisciplinePill({ discipline }: { discipline: string }) {
  const cls = DISCIPLINE_STYLES[discipline] ?? DISCIPLINE_STYLES.Plat;
  return <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${cls}`}>{discipline}</span>;
}

export const BET_STYLES: Record<BetHighlight, string> = {
  QUINTE_PLUS: "bg-bet-quinte text-bet-quinte-fg",
  QUARTE_PLUS: "bg-bet-quarte text-bet-quarte-fg",
  PICK5: "bg-bet-pick5 text-bet-pick5-fg",
};

/** Pastille de pari phare (Quinté+, Quarté+, Pick 5). */
export function BetBadge({ bet, className = "" }: { bet: BetHighlight; className?: string }) {
  return (
    <span className={`whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-bold ${BET_STYLES[bet]} ${className}`}>{BET_HIGHLIGHT_LABELS[bet]}</span>
  );
}

const STATUS_STYLES: Record<RaceStatus, string> = {
  "a-venir": "bg-surface-sub text-muted",
  imminente: "bg-warn-lo text-warn",
  partie: "bg-surface-inv text-white",
  arrivee: "bg-accent-lo text-accent-text",
};

/** État de la course : la couleur ne porte jamais seule le sens, le libellé est toujours écrit. */
export function RaceStatusPill({ status, className = "" }: { status: RaceStatus; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-bold ${STATUS_STYLES[status]} ${className}`}>
      {status === "imminente" && <span aria-hidden="true" className="size-1.5 animate-pulse rounded-full bg-current" />}
      {RACE_STATUS_LABELS[status]}
    </span>
  );
}
