/**
 * Tickets que le site propose sur une course, reconstitués avec le code de
 * production à partir des seules informations connues à la décision, puis
 * chiffrés sur les rapports officiels (tests/backtest-tickets.test.ts).
 *
 *   - « Tickets proposés » : `buildBetRecommendations` (ticket principal par type) ;
 *   - tickets à X : `buildXTickets` ;
 *   - un ticket par stratégie : `strategyTicket` (Sécurisé, Équilibré, Outsiders).
 *
 * Les chevaux sont reconstruits avec la cote de décision et l'avis du modèle
 * fondamental, puis calibrés par `calibrateField`, comme sur la page course.
 * Les scores annexes de l'import (`kzScore`, confiance), calculés avec des
 * cotes plus récentes que la décision, ne sont PAS repris : ils ne servent
 * qu'aux départages et au choix du tocard des Quarté+/Quinté+, non chiffrables.
 *
 * Mise : 1 € par combinaison, quelle que soit la mise de base de l'offre PMU —
 * le ROI ne dépend pas du multiple joué.
 */

import { buildBetRecommendations, buildXTickets } from "@/lib/bet-recommendations";
import type { FundamentalInput } from "@/lib/fundamental/features";
import { calibrateField } from "@/lib/probability";
import { buildSelection } from "@/lib/selection";
import { STRATEGY_LABELS, strategyTicket, type Strategy } from "@/lib/strategy";
import type { BetOffer, HorsePrediction, RaceAnalysis } from "@/lib/types";
import { BET_TYPE_LABELS, PRICEABLE_BET_TYPES, isPriceable, priceTicket, type PayoutBook } from "./ticket-pricing";

export type TicketRunner = FundamentalInput & { horseId: string; odds: number; fundamental: number };

export type TicketRaceContext = Partial<Pick<RaceAnalysis, "discipline" | "specialty" | "distance" | "going" | "raceDate">>;

export type PricedRaceTicket = {
  key: string;
  label: string;
  source: "propose" | "x" | "strategie";
  betType: string;
  stake: number;
  returned: number;
  hit: boolean;
};

/**
 * Formats proposés par le site mais impossibles à chiffrer sur les rapports
 * conservés. Publiés tels quels dans le rapport.
 */
export const UNPRICEABLE_FORMATS: ReadonlyArray<{ label: string; reason: string }> = [
  { label: "Couplé ordre, Trio ordre, Tiercé, Super 4, Tic Trois", reason: "rapports non conservés dans race_payouts" },
  { label: "2 sur 4, Multi, Mini-Multi", reason: "rapports non conservés dans race_payouts" },
  { label: "Quarté+, Quinté+, Pick 5 (et leurs tickets à X)", reason: "rapports non conservés dans race_payouts" },
  { label: "Carré magique (alignements joués en 2 sur 4 ou Quarté+ désordre)", reason: "rapports 2 sur 4 et Quarté+ non conservés dans race_payouts" },
  { label: "Tiercé à X", reason: "rapports non conservés dans race_payouts" },
];

const REQUIRED: Record<string, number> = { SIMPLE_GAGNANT: 1, SIMPLE_PLACE: 1, COUPLE_GAGNANT: 2, COUPLE_PLACE: 2, TRIO: 3 };

/** Offre synthétique pour un type de pari dont la course a des rapports (preuve qu'il était proposé). */
function offerFor(type: string): BetOffer {
  return {
    type,
    label: BET_TYPE_LABELS[type] ?? type,
    audience: null,
    baseStake: 1,
    ordered: false,
    combined: (REQUIRED[type] ?? 1) > 1,
    requiredHorses: REQUIRED[type] ?? 1,
    flexi: [],
    riskOptions: [],
    online: true,
    spotAllowed: true,
  };
}

/** Partant tel que la page course le verrait à la décision, avant calibration. */
function toPrediction(r: TicketRunner): HorsePrediction {
  return {
    id: r.horseId,
    horseId: r.horseId,
    number: r.number,
    horse: `n° ${r.number}`,
    age: r.age ?? null,
    sex: r.sex ?? null,
    music: r.music ?? null,
    earnings: r.earnings ?? null,
    handicapDistance: r.handicapDistance ?? null,
    equipment: r.equipment ?? null,
    jockey: "",
    trainer: "",
    odds: r.odds,
    fairOdds: NaN,
    marketEdge: 0,
    winProbability: 0,
    top3Probability: 0,
    top5Probability: 0,
    kzScore: NaN,
    valueIndex: 0,
    confidence: "Moyenne",
    factors: [],
    fundamentalProbability: r.fundamental * 100,
    jockeyRuns: r.jockeyRuns ?? null,
    jockeyWins: r.jockeyWins ?? null,
    trainerRuns: r.trainerRuns ?? null,
    trainerWins: r.trainerWins ?? null,
  };
}

const STRATEGY_BET_TYPES: Record<string, string> = {
  "Simple placé": "SIMPLE_PLACE",
  "Simple gagnant": "SIMPLE_GAGNANT",
  "Couplé placé": "COUPLE_PLACE",
  "Couplé gagnant": "COUPLE_GAGNANT",
};

/** Tickets chiffrables d'une course. Aucun si la course n'a aucun rapport chiffrable. */
export function raceTickets(runners: TicketRunner[], book: PayoutBook | undefined, context: TicketRaceContext): PricedRaceTicket[] {
  if (!book || runners.length < 2) return [];
  const offered = PRICEABLE_BET_TYPES.filter((t) => (book.get(t)?.size ?? 0) > 0);
  if (offered.length === 0) return [];

  const horses = calibrateField(runners.map(toPrediction));
  const offers = offered.map(offerFor);
  const n = runners.length;
  const out: PricedRaceTicket[] = [];
  const push = (ticket: Omit<PricedRaceTicket, "stake" | "returned" | "hit">, bases: number[], xPositions: number) => {
    const priced = priceTicket(book, ticket.betType, bases, xPositions, n);
    if (priced) out.push({ ...ticket, ...priced });
  };

  for (const rec of buildBetRecommendations(horses, offers, context)) {
    if (!isPriceable(rec.type)) continue;
    push({ key: `propose-${rec.type}`, label: `Ticket proposé · ${BET_TYPE_LABELS[rec.type]}`, source: "propose", betType: rec.type }, rec.horses.map((h) => h.number), 0);
  }

  for (const x of buildXTickets(horses, offers, context)) {
    if (!isPriceable(x.betType)) continue;
    const label = x.xPositions === 0 ? `${BET_TYPE_LABELS[x.betType]} à X · ${x.bases.length} chevaux fixés` : `${BET_TYPE_LABELS[x.betType]} à X · ${x.bases.length} base${x.bases.length > 1 ? "s" : ""} + ${x.xPositions} X`;
    push({ key: `x-${x.betType}-${x.bases.length}b${x.xPositions}x`, label, source: "x", betType: x.betType }, x.bases, x.xPositions);
  }

  const selection = buildSelection(horses);
  for (const strategy of Object.keys(STRATEGY_LABELS) as Strategy[]) {
    const ticket = strategyTicket(selection, strategy);
    const betType = ticket ? STRATEGY_BET_TYPES[ticket.betLabel] : undefined;
    if (!ticket || !betType) continue;
    push({ key: `strategie-${strategy}-${betType}`, label: `Stratégie ${STRATEGY_LABELS[strategy]} · ${BET_TYPE_LABELS[betType]}`, source: "strategie", betType }, ticket.numbers, 0);
  }
  return out;
}
