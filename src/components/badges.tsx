import type { RaceAnalysis } from "@/lib/types";

/**
 * Pastilles et formateur de libellés partagés entre l'accueil et /pronostics.
 *
 * `TierBadge`, `DisciplinePill` et `titleCase` étaient dupliqués dans les deux
 * pages, avec deux palettes différentes pour le Plat (violet d'un côté, émeraude
 * de l'autre) : la même discipline changeait de couleur d'une page à l'autre.
 * Une seule définition, la palette de l'accueil.
 */

/** « PRIX DE L'ARC DE TRIOMPHE » → « Prix De L'Arc De Triomphe ». */
export function titleCase(v: string) {
  return v.toLowerCase().split(/(\s|-|')/)
    .map((p) => (p.length > 1 ? p.charAt(0).toUpperCase() + p.slice(1) : p)).join("");
}

export function TierBadge({ tier }: { tier: RaceAnalysis["bettingTier"] | string }) {
  if (tier === "Focus") return <span className="rounded-full bg-accent px-2 py-0.5 text-[10px] font-bold text-white">Focus</span>;
  if (tier === "Value") return <span className="rounded-full bg-amber-400 px-2 py-0.5 text-[10px] font-bold text-amber-950">Value</span>;
  return <span className="rounded-full bg-surface-inv px-2 py-0.5 text-[10px] font-bold text-white">Prudence</span>;
}

export function DisciplinePill({ discipline }: { discipline: string }) {
  const cls =
    discipline === "Trot"     ? "bg-sky-100 text-sky-800" :
    discipline === "Obstacle" ? "bg-orange-100 text-orange-800" :
                                "bg-violet-100 text-violet-800";
  return <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${cls}`}>{discipline}</span>;
}
