/**
 * Balayage hors ligne des seuils de la confrontation IA × marché.
 *
 * Reproduit `classifyStance` (lib/confrontation) avec des seuils passés en
 * paramètre, pour mesurer ce que chaque réglage aurait donné. Un test vérifie
 * qu'avec les seuils de production, les deux fonctions coïncident.
 */

import { ACCORD_MAX_GAP_PTS, ACCORD_RATIO_MAX, ACCORD_RATIO_MIN, CONFRONT_MIN_PCT, type Stance } from "@/lib/confrontation";
import type { Bet } from "./signal-stats";

export type StanceThresholds = {
  minPct: number;
  maxGapPts: number;
  ratioMin: number;
  ratioMax: number;
};

export const PRODUCTION_THRESHOLDS: StanceThresholds = {
  minPct: CONFRONT_MIN_PCT,
  maxGapPts: ACCORD_MAX_GAP_PTS,
  ratioMin: ACCORD_RATIO_MIN,
  ratioMax: ACCORD_RATIO_MAX,
};

export function classifyStanceWith(ai: number | null, market: number | null, t: StanceThresholds): Stance | null {
  if (ai === null || market === null || !Number.isFinite(ai) || !Number.isFinite(market)) return null;
  if (Math.max(ai, market) < t.minPct) return null;
  const gap = ai - market;
  const ratio = market > 0 ? ai / market : Infinity;
  if (Math.abs(gap) <= t.maxGapPts || (ratio >= t.ratioMin && ratio <= t.ratioMax)) return "accord";
  return gap > 0 ? "ia" : "marche";
}

/** Grille de réglages : produit cartésien, réglage de production inclus. */
export function thresholdGrid(axes: {
  minPct: number[];
  maxGapPts: number[];
  ratioBounds: Array<[number, number]>;
}): StanceThresholds[] {
  const grid = axes.minPct.flatMap((minPct) =>
    axes.maxGapPts.flatMap((maxGapPts) => axes.ratioBounds.map(([ratioMin, ratioMax]) => ({ minPct, maxGapPts, ratioMin, ratioMax }))),
  );
  const hasProduction = grid.some((g) => sameThresholds(g, PRODUCTION_THRESHOLDS));
  return hasProduction ? grid : [PRODUCTION_THRESHOLDS, ...grid];
}

export function sameThresholds(a: StanceThresholds, b: StanceThresholds) {
  return a.minPct === b.minPct && a.maxGapPts === b.maxGapPts && a.ratioMin === b.ratioMin && a.ratioMax === b.ratioMax;
}

/** Un partant évalué : avis en %, rapports officiels pour 1 € (0 si perdu). */
export type ScanRunner = {
  race: number;
  day: string;
  odds: number;
  ai: number;
  market: number;
  sg: number;
  sp: number;
  /** Faux si la course n'a pas de rapports placés : pas de pari placé. */
  hasSp: boolean;
};

export type ScanBets = Record<`${Stance}-${"sg" | "sp"}`, Bet[]>;

/** Paris de chaque famille pour un réglage donné. */
export function betsForThresholds(runners: ScanRunner[], t: StanceThresholds): ScanBets {
  const out: ScanBets = { "accord-sg": [], "accord-sp": [], "ia-sg": [], "ia-sp": [], "marche-sg": [], "marche-sp": [] };
  for (const r of runners) {
    const stance = classifyStanceWith(r.ai, r.market, t);
    if (!stance) continue;
    out[`${stance}-sg`].push({ race: r.race, day: r.day, odds: r.odds, hit: r.sg > 0, dividend: r.sg });
    if (r.hasSp) out[`${stance}-sp`].push({ race: r.race, day: r.day, odds: r.odds, hit: r.sp > 0, dividend: r.sp });
  }
  return out;
}
