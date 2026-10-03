import { properName } from "@/lib/format";
import { READING_LABELS, READING_RULES } from "@/lib/profiles";
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

export function DisciplinePill({ discipline }: { discipline: string }) {
  const cls =
    discipline === "Trot"     ? "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-200" :
    discipline === "Obstacle" ? "bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-200" :
                                "bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-200";
  return <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${cls}`}>{discipline}</span>;
}
