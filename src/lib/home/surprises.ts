import { buildCourseViewModel, type HorseRow } from "@/lib/course-view-model";
import { compareSurprise } from "@/lib/surprise";
import type { RaceAnalysis } from "@/lib/types";

/**
 * TOP SURPRISES DU JOUR — les meilleures alertes du score de surprise sur tout
 * le programme, une par course au plus (la meilleure), courses à venir d'abord.
 *
 * L'accueil n'a pas l'historique des cotes : la brique « marché du jour » y
 * reste neutre. La page course, elle, la calcule avec le MVT et l'argent ; un
 * même cheval peut donc y gagner ou perdre quelques points.
 */
export type DaySurprise = { race: RaceAnalysis; row: HorseRow; finished: boolean };

const EMPTY_HISTORY = { odds: {}, pools: [] };

export function daySurprises(races: RaceAnalysis[], limit = 3): DaySurprise[] {
  const picks: DaySurprise[] = [];
  for (const race of races) {
    const best = buildCourseViewModel(race, EMPTY_HISTORY).surprises[0];
    if (best) picks.push({ race, row: best, finished: race.horses.some((h) => h.finishPosition != null && h.finishPosition > 0) });
  }
  return picks.sort((a, b) => Number(a.finished) - Number(b.finished) || compareSurprise(a.row.surprise, b.row.surprise)).slice(0, limit);
}
