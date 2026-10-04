import { tokenizeMusic } from "@/lib/prediction-math";

/**
 * COMPARATEUR ET DERNIÈRES COURSES — logique pure de la page course.
 */

/** Au plus trois chevaux côte à côte : au-delà, le panneau ne tient plus sur un téléphone. */
export const COMPARE_MAX = 3;

/**
 * Ajoute ou retire un numéro de la comparaison. Une liste pleine reste
 * inchangée : l'interface désactive les cases restantes plutôt que d'en
 * retirer une à l'insu du visiteur.
 */
export function toggleCompare(list: readonly number[], number: number, max = COMPARE_MAX): number[] {
  if (list.includes(number)) return list.filter((n) => n !== number);
  if (list.length >= max) return [...list];
  return [...list, number];
}

/** Retire de la comparaison les numéros qui ne sont plus au départ. */
export function pruneCompare(list: readonly number[], present: ReadonlySet<number>): number[] {
  return list.filter((n) => present.has(n));
}

export type MusicRun = {
  /** 1 = la plus récente. */
  order: number;
  /** Place d'arrivée, `null` pour un incident. */
  position: number | null;
  label: string;
};

const INCIDENTS: Record<string, string> = {
  D: "Disqualifié",
  A: "Arrêté",
  T: "Tombé",
  R: "Retiré",
};

/**
 * Dernières courses lues dans la musique, la plus récente en premier — le
 * seul historique disponible sur la page : ni date, ni hippodrome, ni course.
 * « 0 » couvre la 10e place et au-delà.
 */
export function musicRuns(music: string | null | undefined, max = 6): MusicRun[] {
  return tokenizeMusic(music, max).map((token, i) => {
    if (token.kind === "pos") {
      const label = token.value >= 10 ? "Au-delà de la 9e place" : token.value === 1 ? "1re place" : `${token.value}e place`;
      return { order: i + 1, position: token.value, label };
    }
    return { order: i + 1, position: null, label: INCIDENTS[token.code] ?? "Incident" };
  });
}
