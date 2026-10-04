import { unstable_cache } from "next/cache";
import { buildBetRecommendations, probableArrival, raceToContext } from "@/lib/bet-recommendations";
import { formatMeters } from "@/lib/format";
import { jourParis } from "@/lib/paris-time";
import { pickFavoriIa, type PronosticRace, type RelativeDay } from "@/lib/pronostics-filters";
import { betHighlights, compareRaceTime, raceAnchor } from "@/lib/race-status";
import { getRaces } from "@/lib/race-repository";
import { buildSelection } from "@/lib/selection";
import type { RaceAnalysis } from "@/lib/types";

/** Tickets montrés sur la carte ; le reste est résumé en « +N autres ». */
const TICKETS_SHOWN = 6;

/**
 * Tout ce que la page affiche, calculé une fois par course côté serveur.
 * Le navigateur ne reçoit ni le peloton complet ni les profils : seulement les
 * noms utiles à la recherche et les places d'arrivée.
 */
function toPronosticRace(race: RaceAnalysis): PronosticRace {
  const ctx = raceToContext(race);
  const arrival = probableArrival(race.horses, ctx);
  const recommendations = buildBetRecommendations(race.horses, race.betTypes, ctx);
  const valueBet = arrival.find((h) => h.valueIndex > 10) ?? null;
  const base = arrival[0] ?? null;

  return {
    id: race.id,
    anchor: raceAnchor(race),
    name: race.name,
    raceDate: race.raceDate,
    startTime: race.startTime,
    reunionNumber: race.reunionNumber,
    courseNumber: race.courseNumber,
    racecourse: race.racecourse,
    discipline: race.discipline,
    details: [race.specialty || race.discipline, formatMeters(race.distance), `${race.horses.length} partants`].filter(Boolean).join(" · "),
    bets: betHighlights(race.betTypes),
    reading: buildSelection(race.horses).verdict.reading,
    arrival: arrival.slice(0, 5).map((h) => h.number),
    base: base ? { number: base.number, name: base.horse } : null,
    valueBet: valueBet ? { number: valueBet.number, name: valueBet.horse, valueIndex: valueBet.valueIndex } : null,
    top3: arrival.slice(0, 3).map((h) => ({ number: h.number, name: h.horse, winProbability: h.winProbability })),
    favoriIa: pickFavoriIa(race.horses),
    tickets: recommendations.slice(0, TICKETS_SHOWN).map((r) => ({ type: r.type, label: r.label, ticket: r.ticket })),
    moreTickets: Math.max(0, recommendations.length - TICKETS_SHOWN),
    horses: race.horses.map((h) => ({
      number: h.number,
      horse: h.horse,
      jockey: h.jockey,
      trainer: h.trainer,
      finishPosition: h.finishPosition ?? null,
    })),
  };
}

/**
 * TTFB mesuré à 4,6 s quand buildBetRecommendations tournait pour les 25
 * courses à chaque visite. Le paramètre `?jour=` rend la page dynamique : le
 * calcul est donc mis en cache ici, 60 s par jour demandé. La date de Paris
 * entre dans la clé pour qu'« aujourd'hui » ne serve pas la veille après minuit.
 */
const loadCached = unstable_cache(
  async (day: RelativeDay, parisDate: string) => {
    void parisDate; // n'influe que sur la clé de cache
    const races = (await getRaces({ day })).sort(compareRaceTime);
    return races.map(toPronosticRace);
  },
  ["pronostics-du-jour"],
  { revalidate: 60 },
);

export function loadPronostics(day: RelativeDay): Promise<PronosticRace[]> {
  return loadCached(day, jourParis());
}
