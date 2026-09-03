/**
 * Formateurs d'affichage partagés entre les pages et les composants.
 *
 * `formatMeters` existait en copie locale dans la page course et la distance
 * était affichée brute (« 2100 », « 2 100 m », « 2100m » selon la source PMU)
 * sur l'accueil et dans les métadonnées : trois rendus pour une même donnée.
 */

/** Distance en mètres, telle qu'on l'écrit : « 2100 m ». Chaîne vide si absente. */
export function formatMeters(distance: string | number | null | undefined): string {
  if (distance === null || distance === undefined) return "";
  const chiffres = String(distance).replace(/\D/g, "");
  if (!chiffres) return typeof distance === "string" ? distance.trim() : "";
  return `${Number(chiffres)} m`;
}

/**
 * Une cote n'est exploitable que finie et supérieure à 1 : le PMU stocke
 * 0/NULL tant que le marché n'est pas ouvert, et l'import livre alors `NaN`
 * plutôt que la cote juste du modèle — l'afficher ferait passer une
 * estimation pour un prix de marché.
 */
export function hasOdds(odds: number | null | undefined): boolean {
  return typeof odds === "number" && Number.isFinite(odds) && odds > 1;
}

/** Cote affichable : « 8.82 », ou « — » tant que le marché n'a rien publié. */
export function formatOdds(odds: number | null | undefined, digits = 2): string {
  return hasOdds(odds) ? (odds as number).toFixed(digits) : "—";
}

/** Clé de tri croissant : une cote absente part en fin de liste. */
export function oddsSortValue(odds: number | null | undefined): number {
  return hasOdds(odds) ? (odds as number) : Infinity;
}
