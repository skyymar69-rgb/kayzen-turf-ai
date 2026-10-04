import { probableArrival, raceToContext } from "@/lib/bet-recommendations";
import type { RaceAnalysis } from "@/lib/types";
import { VALUE_THRESHOLD } from "./race-signals";

/**
 * APERÇU D'UNE COURSE — le Top 3 de l'IA (ordre de `probableArrival`, celui de
 * la page course) et le partant à la meilleure value, pour la bulle affichée
 * au survol ou au focus, sans quitter l'accueil.
 */

export type PeekHorse = { number: number; name: string; top3Probability: number };

export type RacePeek = {
  top3: PeekHorse[];
  /** Meilleure value au-delà du seuil de l'accueil, `null` sans cote publiée ou sans value. */
  valueBet: { number: number; name: string; valueIndex: number } | null;
};

export function racePeek(race: RaceAnalysis): RacePeek {
  const top3 = probableArrival(race.horses, raceToContext(race))
    .slice(0, 3)
    .map((h) => ({ number: h.number, name: h.horse, top3Probability: h.top3Probability }));
  const best = race.oddsAvailable === false ? undefined : [...race.horses].sort((a, b) => b.valueIndex - a.valueIndex)[0];
  const valueBet = best && best.valueIndex > VALUE_THRESHOLD
    ? { number: best.number, name: best.horse, valueIndex: best.valueIndex }
    : null;
  return { top3, valueBet };
}
