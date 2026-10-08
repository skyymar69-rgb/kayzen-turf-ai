/**
 * Règles de déclenchement des signaux de marché du backtest, pures et testées.
 * Mêmes règles que la page course (lib/market, lib/confrontation).
 */

import { classifyStance, marketSignals } from "@/lib/confrontation";
import type { FundamentalInput } from "@/lib/fundamental/features";
import { MVT_NOISE_PCT, moneyFlow, type Movement, type PoolSnapshot } from "@/lib/market";
import { scoreField } from "@/lib/surprise";

/** Numéro du cheval le plus joué depuis le matin, si sa cote a baissé d'au moins MVT_NOISE_PCT. */
export function mostBacked(raceId: string, numbers: number[], odds: Array<number | null>, morning: Map<string, number>): number | null {
  let best: { number: number; change: number } | null = null;
  numbers.forEach((number, i) => {
    const ref = morning.get(`${raceId}|${number}`);
    const now = odds[i];
    if (!ref || !(ref > 1) || now == null || !(now > 1)) return;
    const change = ((now - ref) / ref) * 100;
    if (!best || change < best.change) best = { number, change };
  });
  const found = best as { number: number; change: number } | null;
  return found && found.change <= -MVT_NOISE_PCT ? found.number : null;
}

/**
 * Signaux de la confrontation IA × marché (lib/confrontation), avec les mêmes
 * règles que la page course : familles, argent entrant, smart money.
 * Probabilités en %, cotes et parts lues avant la décision.
 *
 * Les familles « Accord » et « Favori IA » ont aussi leur version simple placé
 * (`conf-accord-sp`, `conf-ia-sp`), payée sur les rapports placés officiels.
 */
type MarketInput = {
  number: number;
  odds: number | null;
  market: number;
  ai: number | null;
  morning: number | undefined;
  pools: PoolSnapshot[];
};

/** Famille, MVT et signaux d'argent d'un partant, lus comme sur la page course. */
function marketReading(input: MarketInput) {
  const hasOdds = input.odds != null && input.odds > 1;
  const stance = classifyStance(input.ai, hasOdds ? input.market : null);
  const change = hasOdds && input.morning && input.morning > 1 ? ((input.odds! - input.morning) / input.morning) * 100 : null;
  const direction: Movement["direction"] = change === null ? "inconnu" : Math.abs(change) < MVT_NOISE_PCT ? "stable" : change < 0 ? "joue" : "delaisse";
  const signals = marketSignals({ direction, flow: moneyFlow(input.pools, input.number), stance });
  return { hasOdds, stance, change, direction, signals };
}

export function confrontationKeys(input: MarketInput): string[] {
  const { stance, signals } = marketReading(input);
  const keys: string[] = [];
  if (stance) keys.push(`conf-${stance}-sg`);
  if (stance === "accord" || stance === "ia") keys.push(`conf-${stance}-sp`);
  if (signals.includes("argent")) keys.push("argent-entrant-sg");
  if (signals.includes("sortant")) keys.push("argent-sortant-sg");
  if (signals.includes("smart")) keys.push("smart-money-sg");
  return keys;
}

/**
 * Numéros signalés par le score de surprise (lib/surprise) au niveau « fort »
 * ou « possible » — les alertes que la page course met en avant. Mêmes
 * entrées que la page : avis de l'IA, marché, musique, entourage, MVT, argent.
 */
export function surpriseNumbers(field: Array<MarketInput & FundamentalInput>): number[] {
  const scored = scoreField(
    field.map((h) => {
      const m = marketReading(h);
      return {
        number: h.number,
        odds: m.hasOdds ? h.odds : null,
        ai: h.ai,
        market: m.hasOdds ? h.market : null,
        music: h.music,
        jockeyWins: h.jockeyWins,
        jockeyRuns: h.jockeyRuns,
        trainerWins: h.trainerWins,
        trainerRuns: h.trainerRuns,
        movement: { direction: m.direction, changePct: m.change },
        signals: m.signals,
      };
    }),
  );
  return [...scored].filter(([, s]) => s.alert && s.alert.level !== "surveiller").map(([n]) => n);
}
