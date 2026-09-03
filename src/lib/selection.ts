import { TOCARD_MIN_ODDS, VALUE_RATIO, calibrateField, type CalibratedHorse } from "@/lib/probability";
import type { HorsePrediction } from "@/lib/types";

/**
 * SÉLECTION — le seul classement de la page course.
 *
 * Huit chevaux au maximum, ordonnés par probabilité décroissante. Le Top 3 est
 * constitué des trois premiers de cette liste, sans autre calcul : c'est ce qui
 * garantit qu'aucun bloc de la page ne peut afficher un Top 3 différent.
 *
 * Le rôle est déterminé par la tranche de cote (convention de la presse turf
 * française), la value est un signal séparé. Un cheval ne porte donc jamais deux
 * rôles contradictoires.
 */

export type SelectionRole = "base" | "favori" | "outsider" | "tocard";

export type SelectedHorse = {
  horse: CalibratedHorse;
  /** Rang dans la sélection, à partir de 1. */
  rank: number;
  role: SelectionRole;
  /** Le modèle lui donne nettement plus de chances que le marché. */
  isValue: boolean;
  /** Présent au titre du tocard repêché, hors des meilleures probabilités. */
  isPromotedTocard: boolean;
};

export type RaceSelection = {
  /** Huit chevaux maximum, triés par probabilité décroissante. */
  horses: SelectedHorse[];
  /** Les trois premiers de `horses` — jamais recalculés ailleurs. */
  top3: SelectedHorse[];
  /** Le pivot : meilleure probabilité de la course. */
  base: SelectedHorse | null;
  /** Le tocard mis en avant, s'il en existe un. */
  tocard: SelectedHorse | null;
};

/**
 * Taille de la sélection publiée.
 *
 * Portée de 6 à 8 le 30/08/2026, sur mesure et non par intuition. Confrontation
 * des 56 Quintés du 1er juillet au 30 août à leur arrivée réelle, part des
 * courses où au moins 4 des 5 arrivants figurent dans la sélection :
 *
 *     5 chevaux    3,6 %
 *     6 chevaux   21,4 %
 *     7 chevaux   32,1 %
 *     8 chevaux   53,6 %
 *
 * Le Top 3 reste inchangé — c'est toujours lui qu'on met en avant. Les chevaux
 * supplémentaires ne servent qu'à couvrir les tickets larges, là où le Quinté
 * se joue. Élargir n'améliore pas le classement : cela reconnaît la variance de
 * l'épreuve, qu'aucun modèle ne supprimera (même avec des probabilités
 * parfaites, 4 sur 5 ne sort que dans 24,9 % des courses).
 */
export const SELECTION_SIZE = 8;

const ROLE_LABELS: Record<SelectionRole, string> = {
  base: "Base",
  favori: "Favori",
  outsider: "Outsider",
  tocard: "Tocard",
};

export function roleLabel(role: SelectionRole): string {
  return ROLE_LABELS[role];
}

/** Tranche de cote — convention presse : favori < 6, outsider 6-12, tocard ≥ 12. */
function roleFromOdds(odds: number): Exclude<SelectionRole, "base"> {
  if (!Number.isFinite(odds) || odds < 6) return "favori";
  if (odds < TOCARD_MIN_ODDS) return "outsider";
  return "tocard";
}

function isValueHorse(horse: CalibratedHorse): boolean {
  return horse.valueRatio >= VALUE_RATIO;
}

/** Un tocard digne d'être signalé : cote haute ET le modèle le préfère au marché. */
function isTocardCandidate(horse: CalibratedHorse): boolean {
  return Number.isFinite(horse.odds) && horse.odds >= TOCARD_MIN_ODDS && isValueHorse(horse);
}

/**
 * Construit la sélection.
 *
 * Le Top 3 reste strictement probabiliste — aucun tocard n'y est imposé.
 * En revanche, si aucun tocard ne figure parmi les `SELECTION_SIZE` meilleures
 * probabilités, le meilleur tocard de la course prend la dernière place : la
 * promesse « un tocard signalé » est ainsi tenue sans jamais fausser le Top 3.
 */
export function buildSelection(input: HorsePrediction[]): RaceSelection {
  if (input.length === 0) {
    return { horses: [], top3: [], base: null, tocard: null };
  }

  // Les chevaux arrivent normalement déjà calibrés par le dépôt. On recalibre
  // seulement si les champs manquent, pour qu'un appelant direct (test, mock)
  // ne puisse pas produire une sélection sur des probabilités non normalisées.
  const horses: CalibratedHorse[] = input.every((h) => h.valueRatio !== undefined && h.marketProbability !== undefined)
    ? (input as CalibratedHorse[])
    : calibrateField(input);

  const ranked = [...horses].sort(
    (a, b) => b.winProbability - a.winProbability || a.odds - b.odds || a.number - b.number,
  );

  let picked = ranked.slice(0, SELECTION_SIZE);
  let promotedTocard: CalibratedHorse | null = null;

  if (ranked.length > SELECTION_SIZE && !picked.some(isTocardCandidate)) {
    // Meilleur tocard hors de la sélection, par probabilité puis par value.
    const candidate = ranked
      .slice(SELECTION_SIZE)
      .filter(isTocardCandidate)
      .sort((a, b) => b.winProbability - a.winProbability || b.valueRatio - a.valueRatio)[0];

    if (candidate) {
      promotedTocard = candidate;
      picked = [...ranked.slice(0, SELECTION_SIZE - 1), candidate];
    }
  }

  const selected: SelectedHorse[] = picked.map((horse, index) => ({
    horse,
    rank: index + 1,
    role: index === 0 ? "base" : roleFromOdds(horse.odds),
    isValue: isValueHorse(horse),
    isPromotedTocard: promotedTocard !== null && horse.id === promotedTocard.id,
  }));

  const tocard =
    selected.find((s) => s.isPromotedTocard) ??
    selected.filter((s) => s.role === "tocard" && s.isValue).sort((a, b) => a.rank - b.rank)[0] ??
    null;

  return {
    horses: selected,
    top3: selected.slice(0, 3),
    base: selected[0] ?? null,
    tocard,
  };
}
