/**
 * BLOCS DE L'ACCUEIL que le visiteur peut masquer (« Personnaliser »).
 * Le programme lui-même n'en fait pas partie : c'est la raison d'être de la page.
 * Les préférences vivent dans le navigateur, sous forme de liste d'identifiants
 * masqués ; toute valeur illisible ou inconnue est ignorée.
 */

export const HOME_BLOCKS = [
  { id: "summary", label: "Résumé du jour" },
  { id: "followed", label: "Vos chevaux suivis" },
  { id: "yesterday", label: "Bilan d'hier" },
  { id: "timeline", label: "Ligne du temps" },
  { id: "featured", label: "Course phare" },
  { id: "surprises", label: "Top surprises du jour" },
  { id: "indicators", label: "Indicateurs et top courses" },
  { id: "profiles", label: "Profils et value bets" },
] as const;

export type HomeBlockId = (typeof HOME_BLOCKS)[number]["id"];

export const HOME_BLOCKS_STORAGE_KEY = "kz-accueil-blocs-masques";

const KNOWN = new Set<string>(HOME_BLOCKS.map((b) => b.id));

export function parseHiddenBlocks(raw: string | null): ReadonlySet<HomeBlockId> {
  if (!raw) return new Set();
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((id): id is HomeBlockId => typeof id === "string" && KNOWN.has(id)));
  } catch {
    return new Set();
  }
}

export function serializeHiddenBlocks(hidden: ReadonlySet<HomeBlockId>): string {
  return JSON.stringify(HOME_BLOCKS.map((b) => b.id).filter((id) => hidden.has(id)));
}

/** Nouvel ensemble avec le bloc basculé ; l'ensemble reçu n'est pas modifié. */
export function toggleHiddenBlock(hidden: ReadonlySet<HomeBlockId>, id: HomeBlockId): ReadonlySet<HomeBlockId> {
  const next = new Set(hidden);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  return next;
}
