/**
 * Teinte stable par hippodrome, pour repérer une réunion d'un coup d'œil
 * (pastille dans la navigation, les cartes, la timeline).
 *
 * La teinte se déduit du nom normalisé (sans accents, casse, ni « hippodrome
 * de ») : le même hippodrome garde la même couleur sur toutes les pages et
 * tous les jours, sans table à maintenir. Elle n'est qu'un repère : le nom est
 * toujours écrit à côté.
 */

export function normalizeRacecourse(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/^hippodrome (de |d'|du |des )?/, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Teinte HSL (0-359) dérivée du nom. */
export function racecourseHue(name: string): number {
  const key = normalizeRacecourse(name);
  let hash = 2166136261;
  for (let i = 0; i < key.length; i++) {
    hash ^= key.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) % 360;
}
