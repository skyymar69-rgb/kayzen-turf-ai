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
