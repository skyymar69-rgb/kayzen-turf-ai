import { formatOdds } from "@/lib/format";
import { placePositionsFor } from "@/lib/bet-recommendations";
import { simulateTopOrders, ticketProbability } from "@/lib/probability";
import type { RaceSelection } from "@/lib/selection";

/**
 * UN TICKET PAR STRATÉGIE — Sécurisé, Équilibré, Outsiders.
 *
 * La stratégie choisit le ticket, jamais le classement : les trois tickets
 * puisent dans la même sélection. Chaque ticket porte sa probabilité estimée de
 * passer (tirages Plackett-Luce sur les probabilités affichées) et la clé du
 * signal dont le backtest mesure le rendement, quand elle existe.
 */

export type Strategy = "securise" | "equilibre" | "outsiders";

export const STRATEGY_LABELS: Record<Strategy, string> = {
  securise: "Sécurisé",
  equilibre: "Équilibré",
  outsiders: "Outsiders",
};

export type StrategyTicket = {
  strategy: Strategy;
  betLabel: string;
  numbers: number[];
  /** Probabilité estimée que le ticket passe, en %. */
  probability: number;
  /** Signal du backtest correspondant (`signals[].key`), si le rendement est mesuré. */
  signalKey: string | null;
  rationale: string;
};

export function strategyTicket(selection: RaceSelection, strategy: Strategy): StrategyTicket | null {
  const field = selection.field;
  if (field.length < 2) return null;

  const pWin = field.map((s) => s.horse.winProbability / 100);
  const orders = simulateTopOrders(pWin, 3, 4000);
  const places = placePositionsFor(field.length);
  const idx = (n: number) => field.findIndex((s) => s.horse.number === n);

  if (strategy === "securise") {
    const pick = field[0];
    return {
      strategy,
      betLabel: places > 1 ? "Simple placé" : "Simple gagnant",
      numbers: [pick.horse.number],
      probability: ticketProbability(orders, [idx(pick.horse.number)], places, false),
      signalKey: places > 1 ? "rank1-sp" : "rank1-sg",
      rationale: places > 1 ? `Le premier de la sélection doit finir dans les ${places} premiers.` : "Le premier de la sélection doit gagner.",
    };
  }

  if (strategy === "equilibre") {
    const [a, b] = field;
    const couplePlace = field.length >= 8;
    return {
      strategy,
      betLabel: couplePlace ? "Couplé placé" : "Couplé gagnant",
      numbers: [a.horse.number, b.horse.number],
      probability: ticketProbability(orders, [idx(a.horse.number), idx(b.horse.number)], couplePlace ? 3 : 2, false),
      signalKey: null,
      rationale: couplePlace ? "Les deux premiers de la sélection dans les 3 premiers, dans n'importe quel ordre." : "Les deux premiers de la sélection aux deux premières places.",
    };
  }

  const outsider =
    field.find((s) => (s.profile === "cache" || s.profile === "outsider" || s.profile === "value") && s.horse.odds >= 8) ??
    field.slice(3).find((s) => s.horse.odds >= 8) ??
    null;
  if (!outsider) return null;
  return {
    strategy,
    betLabel: places > 1 ? "Simple placé" : "Simple gagnant",
    numbers: [outsider.horse.number],
    probability: ticketProbability(orders, [idx(outsider.horse.number)], places, false),
    signalKey: outsider.profile === "cache" ? "cache-sp" : outsider.profile === "outsider" ? "outsider-sp" : null,
    rationale: `Le cheval à cote de 8/1 ou plus le mieux classé (cote ${formatOdds(outsider.horse.odds)}), ${places > 1 ? `dans les ${places} premiers` : "gagnant"}.`,
  };
}
