import { TOCARD_MIN_ODDS, VALUE_RATIO, calibrateField, type CalibratedHorse } from "@/lib/probability";
import type { HorsePrediction } from "@/lib/types";

/**
 * SÉLECTION — le seul classement de la page course.
 *
 * Six chevaux au maximum, ordonnés par probabilité décroissante. Le Top 3 est
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
  /** Présent au titre du tocard repêché, hors des 5 meilleures probabilités. */
  isPromotedTocard: boolean;
};

export type RaceSelection = {
  /** Six chevaux maximum, triés par probabilité décroissante. */
  horses: SelectedHorse[];
  /** Les trois premiers de `horses` — jamais recalculés ailleurs. */
  top3: SelectedHorse[];
  /** Le pivot : meilleure probabilité de la course. */
  base: SelectedHorse | null;
  /** Le tocard mis en avant, s'il en existe un. */
  tocard: SelectedHorse | null;
};

export const SELECTION_SIZE = 6;

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
 * En revanche, si aucun tocard ne figure parmi les cinq meilleures
 * probabilités, le meilleur tocard de la course prend la sixième place : la
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
    // Meilleur tocard hors des cinq premiers, par probabilité puis par value.
    const candidate = ranked
      .slice(SELECTION_SIZE - 1)
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
