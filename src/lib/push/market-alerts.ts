import { classifyStance, marketSignals } from "@/lib/confrontation";
import { FLOW_TREND_PTS, MVT_NOISE_PCT, moneyFlow, type Movement, type PoolSnapshot } from "@/lib/market";

/**
 * ALERTES DE MARCHÉ ET D'ARRIVÉE — règles pures, sans base ni envoi.
 *
 *   smart-money  un cheval suivi court dans moins de 30 min et porte le signal
 *                « smart money » de la page course (argent qui entre ou
 *                accélère, cote en baisse, IA favorable ou d'accord) ;
 *   delaisse     un cheval suivi court dans moins de DELAISSE_ALERT_MINUTES et
 *                sa cote a monté d'au moins 10 % depuis le matin, sans argent
 *                qui entre (part des mises stable ou en baisse sur 15 min) ;
 *   arrivee      l'arrivée officielle d'une course où court un cheval suivi.
 *
 * Mêmes définitions que la page course : une alerte ne dit jamais autre chose
 * que ce que la page affiche.
 */

export type MarketAlertKind = "smart-money" | "delaisse";
export type AlertKind = "depart" | "non-partant" | MarketAlertKind | "arrivee";

export const DELAISSE_ALERT_MINUTES = 10;

export type MarketAlertInput = {
  number: number;
  minutesToStart: number;
  morningOdds: number | null;
  currentOdds: number | null;
  pools: PoolSnapshot[];
  /** Avis de l'IA sans cote, en %. */
  ai: number | null;
  /** Probabilité du marché, marge retirée, en %. */
  market: number | null;
};

export function oddsDirection(morning: number | null, current: number | null): Movement["direction"] {
  if (!morning || !(morning > 1) || !current || !(current > 1)) return "inconnu";
  const change = ((current - morning) / morning) * 100;
  return Math.abs(change) < MVT_NOISE_PCT ? "stable" : change < 0 ? "joue" : "delaisse";
}

/** Alerte de marché due pour ce cheval, ou `null`. Smart money prime sur délaissé. */
export function evaluateMarketAlert(input: MarketAlertInput): MarketAlertKind | null {
  if (!(input.minutesToStart > 0)) return null;
  const direction = oddsDirection(input.morningOdds, input.currentOdds);
  const flow = moneyFlow(input.pools, input.number);
  const stance = classifyStance(input.ai, input.market);
  if (marketSignals({ direction, flow, stance }).includes("smart")) return "smart-money";
  const noMoneyIn = flow.delta15 === null || flow.delta15 <= -FLOW_TREND_PTS;
  if (direction === "delaisse" && noMoneyIn && input.minutesToStart <= DELAISSE_ALERT_MINUTES) return "delaisse";
  return null;
}

export type ArrivalSummary = {
  /** Numéros dans l'ordre d'arrivée (5 premiers au plus). */
  arrival: number[];
  /** Place du cheval suivi, `null` s'il n'est pas classé. */
  position: number | null;
  /** Base de l'IA (premier du pronostic gelé), si connue. */
  aiBase: number | null;
};

function ordinal(position: number): string {
  return position === 1 ? "1er" : `${position}e`;
}

/** Corps du message d'arrivée : l'arrivée, la place du cheval suivi, le sort de la base IA. */
export function arrivalBody(horseNumber: number, summary: ArrivalSummary): string {
  const lines = [`Arrivée : ${summary.arrival.join(" – ")}`];
  lines.push(summary.position ? `Votre n° ${horseNumber} : ${ordinal(summary.position)}` : `Votre n° ${horseNumber} : non classé dans les 5 premiers`);
  if (summary.aiBase !== null) {
    const place = summary.arrival.indexOf(summary.aiBase);
    const verdict = place === 0 ? "gagnante" : place > 0 && place < 3 ? "placée" : "hors du podium";
    lines.push(`Base IA n° ${summary.aiBase} : ${verdict}`);
  }
  return lines.join("\n");
}
