import { probableArrival, raceToContext } from "@/lib/bet-recommendations";
import { formatOdds, hasOdds, oddsSortValue } from "@/lib/format";
import { minutesDepuisHeure } from "@/lib/paris-time";
import { raceStatus, type RaceStatus } from "@/lib/race-status";
import type { RaceAnalysis } from "@/lib/types";
import { aiMarketGap, AI_MARKET_GAP_POINTS, bestAiMarketGap, formatGap } from "@/lib/value-signal";

/**
 * Course où l'IA et le marché divergent nettement sur au moins un partant
 * (src/lib/value-signal.ts). Ce n'est PAS une « value » : l'accueil ne connaît
 * pas l'heure de consultation et ne revendique aucune espérance de gain.
 */
export function hasAiMarketGap(race: Pick<RaceAnalysis, "horses" | "oddsAvailable">): boolean {
  return race.oddsAvailable !== false && bestAiMarketGap(race.horses) != null;
}

/**
 * Minutes depuis minuit (heure de Paris) d'une heure de départ.
 *
 * Une heure illisible renvoyait NaN, et toute comparaison avec NaN étant
 * fausse, la course était traitée comme partant à minuit — donc toujours
 * « déjà courue ». On la repousse en fin de journée : elle reste visible plutôt
 * que de disparaître silencieusement de la ligne du temps.
 */
export function startMinutes(startTime: string): number {
  return minutesDepuisHeure(startTime) ?? 24 * 60;
}

/** Tri par heure de départ, sans toucher au tableau reçu. */
export function sortByStart<T extends Pick<RaceAnalysis, "startTime">>(races: T[]): T[] {
  return [...races].sort((a, b) => startMinutes(a.startTime) - startMinutes(b.startTime));
}

/**
 * Course « active » de la ligne du temps : la prochaine à partir de la minute
 * courante (Paris), sinon la première de la journée. Hier et demain ne se
 * lisent pas à l'heure actuelle : l'appelant passe alors -1.
 */
export function selectTimelineRace(races: RaceAnalysis[], currentMinute: number): RaceAnalysis | undefined {
  const sorted = sortByStart(races);
  return sorted.find((r) => startMinutes(r.startTime) >= currentMinute) ?? sorted[0];
}

/**
 * Libellé d'état affiché dans les listes de l'accueil. L'état lui-même vient
 * de `raceStatus` (src/lib/race-status.ts), compté depuis l'instant de départ
 * à Paris : seul le texte reste propre à l'accueil.
 */
export function statusLabel(status: RaceStatus, startTime: string): string {
  if (status === "arrivee") return "Arrivée disponible";
  if (status === "imminente") return `Départ imminent ${startTime}`;
  return `Départ à ${startTime}`;
}

/**
 * État d'une course à un instant donné. Sans instant (rendu serveur, avant que
 * l'horloge du client ne soit lue), seule l'arrivée publiée fait foi : la
 * course reste « à venir » plutôt que d'afficher un état deviné.
 */
export function raceStatusAt(race: RaceAnalysis, now: Date | null): RaceStatus {
  if (now) return raceStatus(race, now);
  return race.horses.some((h) => h.finishPosition != null && h.finishPosition > 0) ? "arrivee" : "a-venir";
}

/** Signal IA court d'une course (« Écart IA / marché #4 (+6 pts) », « Favori fragile #2 »…). */
export function raceOpportunity(race: RaceAnalysis): string {
  const arrival = probableArrival(race.horses, raceToContext(race));
  const best = arrival[0];
  if (!best) return "Signal indisponible";

  // Sans marché ouvert, « favori », « écart » et « outsider » n'ont pas de
  // sens : le signal le dit plutôt que d'afficher une cote qui n'existe pas.
  if (race.oddsAvailable === false) return `Cotes à venir — base #${best.number}`;

  const fav = [...race.horses].sort((a, b) => oddsSortValue(a.odds) - oddsSortValue(b.odds))[0];
  const favIsFragile = fav && hasOdds(fav.odds) && fav.odds < 3 && fav.top3Probability < 40;
  const gap = bestAiMarketGap(arrival.slice(0, 5));
  const outsider = arrival.find((h) => hasOdds(h.odds) && h.odds >= 7 && (aiMarketGap(h) ?? 0) >= AI_MARKET_GAP_POINTS);

  if (favIsFragile) return `Favori fragile #${fav.number}`;
  if (gap) return `Écart IA / marché #${gap.horse.number} (${formatGap(gap.points)})`;
  if (outsider) return `Outsider #${outsider.number} (${formatOdds(outsider.odds)})`;
  if (best.top3Probability >= 35) return `À surveiller #${best.number}`;
  return "Signal faible";
}
