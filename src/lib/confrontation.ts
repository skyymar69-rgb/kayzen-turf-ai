/**
 * CONFRONTATION IA × MARCHÉ — qui préfère qui, et où l'argent entre.
 *
 * Définitions, publiées telles quelles sur la page /methode :
 *
 *   Familles   comparent la probabilité de l'IA (calculée sans jamais voir la
 *              cote) à celle du marché (cote PMU, marge retirée). Seuls les
 *              chevaux à au moins CONFRONT_MIN_PCT % pour l'un des deux avis
 *              sont classés : deux outsiders à 2 et 3 % ne font pas un
 *              « accord ».
 *                Accord IA + marché  écart ≤ 3 points, ou rapport entre 0,8 et 1,25
 *                Favori IA           l'IA au-dessus du marché, au-delà de ces bornes
 *                Favori marché       le marché au-dessus de l'IA, au-delà de ces bornes
 *
 *   Signaux    lus sur la part du cheval dans le pool simple gagnant :
 *                Argent entrant  +STRONG_MONEY_PTS points en 15 minutes
 *                Accélération    +FLOW_ACCEL_PTS point en 5 minutes, à un rythme
 *                                plus rapide que sur les 10 minutes précédentes
 *                Smart money     argent entrant ou accélération, cote en baisse
 *                                (MVT « joué ») ET IA favorable ou d'accord.
 *                Argent sortant  −STRONG_MONEY_PTS points en 15 minutes : le
 *                                miroir de l'argent entrant, le cheval est
 *                                délaissé par les parieurs.
 *              Le PMU ne publie pas les mises individuelles : « smart money »
 *              désigne un argent que le modèle indépendant confirme, jamais
 *              « l'argent des initiés ». Sa valeur est mesurée au backtest.
 */

import { FLOW_ACCEL_PTS, STRONG_MONEY_PTS, type Movement } from "@/lib/market";

export type Stance = "ia" | "marche" | "accord";

/** Un cheval n'est classé que si l'IA ou le marché lui donne au moins 8 %. */
export const CONFRONT_MIN_PCT = 8;
/** Accord : écart absolu de 3 points au plus… */
export const ACCORD_MAX_GAP_PTS = 3;
/** …ou rapport IA ÷ marché dans cette plage. */
export const ACCORD_RATIO_MIN = 0.8;
export const ACCORD_RATIO_MAX = 1.25;

/** Ordre d'affichage des familles. */
export const STANCE_ORDER: Stance[] = ["accord", "ia", "marche"];

export const STANCE_LABELS: Record<Stance, string> = {
  accord: "Accord IA + marché",
  ia: "Favori IA",
  marche: "Favori marché",
};

export function classifyStance(ai: number | null, market: number | null): Stance | null {
  if (ai === null || market === null || !Number.isFinite(ai) || !Number.isFinite(market)) return null;
  if (Math.max(ai, market) < CONFRONT_MIN_PCT) return null;
  const gap = ai - market;
  const ratio = market > 0 ? ai / market : Infinity;
  if (Math.abs(gap) <= ACCORD_MAX_GAP_PTS || (ratio >= ACCORD_RATIO_MIN && ratio <= ACCORD_RATIO_MAX)) return "accord";
  return gap > 0 ? "ia" : "marche";
}

export type MarketSignal = "argent" | "acceleration" | "smart" | "sortant";

export const SIGNAL_LABELS: Record<MarketSignal, string> = {
  argent: "Argent entrant",
  acceleration: "Accélération des mises",
  smart: "Smart money",
  sortant: "Argent sortant",
};

export function marketSignals(input: {
  direction: Movement["direction"];
  flow: { delta15: number | null; delta5: number | null };
  stance: Stance | null;
}): MarketSignal[] {
  const { delta15, delta5 } = input.flow;
  const signals: MarketSignal[] = [];
  const entering = delta15 !== null && delta15 >= STRONG_MONEY_PTS;
  const leaving = delta15 !== null && delta15 <= -STRONG_MONEY_PTS;
  // Les 5 dernières minutes vont plus vite que les 10 d'avant :
  // delta5 / 5 > (delta15 − delta5) / 10, soit 3 × delta5 > delta15.
  const accelerating = delta5 !== null && delta5 >= FLOW_ACCEL_PTS && (delta15 === null || 3 * delta5 > delta15);
  if (entering) signals.push("argent");
  if (accelerating) signals.push("acceleration");
  if ((entering || accelerating) && input.direction === "joue" && (input.stance === "ia" || input.stance === "accord")) {
    signals.push("smart");
  }
  if (leaving) signals.push("sortant");
  return signals;
}
