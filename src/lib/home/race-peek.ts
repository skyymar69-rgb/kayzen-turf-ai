import { probableArrival, raceToContext } from "@/lib/bet-recommendations";
import type { RaceAnalysis } from "@/lib/types";
import { bestAiMarketGap } from "@/lib/value-signal";

/**
 * APERÇU D'UNE COURSE — le Top 3 de l'IA (ordre de `probableArrival`, celui de
 * la page course) et le partant au plus fort écart IA / marché, pour la bulle affichée
 * au survol ou au focus, sans quitter l'accueil.
 */

export type PeekHorse = { number: number; name: string; top3Probability: number };

export type RacePeek = {
  top3: PeekHorse[];
  /** Plus fort écart IA − marché (points) au-delà du seuil, `null` sans cote publiée ou sans écart. */
  aiGap: { number: number; name: string; points: number } | null;
};

export function racePeek(race: RaceAnalysis): RacePeek {
  const top3 = probableArrival(race.horses, raceToContext(race))
    .slice(0, 3)
    .map((h) => ({ number: h.number, name: h.horse, top3Probability: h.top3Probability }));
  const best = race.oddsAvailable === false ? null : bestAiMarketGap(race.horses);
  const aiGap = best ? { number: best.horse.number, name: best.horse.horse, points: best.points } : null;
  return { top3, aiGap };
}
