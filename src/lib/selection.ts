import { calibrateField, type CalibratedHorse } from "@/lib/probability";
import { classifyField, raceVerdict, type Profile, type ProfiledHorse, type RaceVerdict } from "@/lib/profiles";
import type { HorsePrediction } from "@/lib/types";

/**
 * SÉLECTION — le seul classement de la page course.
 *
 * Huit chevaux au maximum, ordonnés par probabilité décroissante. Le Top 3 est
 * constitué des trois premiers de cette liste, sans autre calcul : c'est ce qui
 * garantit qu'aucun bloc de la page ne peut afficher un Top 3 différent.
 *
 * Le profil de chaque cheval (Base, Caché, Value, Favori, Outsider, Tocard,
 * À éviter, Second plan) vient de src/lib/profiles.ts, la source unique que
 * lisent aussi le bandeau, le tableau, la fiche cheval et le backtest.
 *
 * Octobre 2026 : la sélection ne « repêche » plus de tocard hors des huit
 * meilleures probabilités. Le backtest (juin-septembre 2026) donne un ROI de
 * −47 % aux tocards et de −32 % aux chevaux cachés en simple gagnant : faire
 * entrer l'un d'eux dans la sélection à la place d'un cheval plus probable
 * était une mise en avant que rien ne justifiait.
 */

export type SelectedHorse = {
  horse: CalibratedHorse;
  /** Rang dans la sélection, à partir de 1. */
  rank: number;
  profile: Profile;
  /** IA (sans cote) ÷ marché. > 1 : l'IA le juge sous-coté. */
  ratio: number | null;
};

export type RaceSelection = {
  /** Huit chevaux maximum, triés par probabilité décroissante. */
  horses: SelectedHorse[];
  /** Les trois premiers de `horses` — jamais recalculés ailleurs. */
  top3: SelectedHorse[];
  /** Le pivot : meilleure probabilité de la course. */
  base: SelectedHorse | null;
  /** Tout le peloton, profilé, dans l'ordre du classement. */
  field: Array<SelectedHorse>;
  verdict: RaceVerdict;
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
 * se joue.
 */
export const SELECTION_SIZE = 8;

export function buildSelection(input: HorsePrediction[]): RaceSelection {
  const horses: CalibratedHorse[] = input.every((h) => h.valueRatio !== undefined && h.marketProbability !== undefined)
    ? (input as CalibratedHorse[])
    : calibrateField(input);

  const profiled = classifyField(horses);
  const verdict = raceVerdict(horses, profiled);
  if (horses.length === 0) return { horses: [], top3: [], base: null, field: [], verdict };

  const byNumber = new Map(horses.map((h) => [h.number, h]));
  const field = profiled.map((p: ProfiledHorse) => ({ horse: byNumber.get(p.number)!, rank: p.rank, profile: p.profile, ratio: p.ratio }));
  const selected = field.slice(0, SELECTION_SIZE);

  return { horses: selected, top3: selected.slice(0, 3), base: selected[0] ?? null, field, verdict };
}
