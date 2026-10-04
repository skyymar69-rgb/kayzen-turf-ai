import type { MarketHistory } from "@/lib/market";

/**
 * COTES DE TOUS LES PARTANTS SUR UN MÊME AXE — géométrie du graphique.
 *
 * L'axe des cotes est logarithmique : de 2/1 à 4/1, la probabilité implicite
 * est divisée par deux, comme de 10/1 à 20/1. Sur un axe linéaire, les
 * outsiders écraseraient les favoris dans le bas du graphique.
 */

export type OddsSeries = { number: number; points: Array<{ t: number; odds: number }> };

export type OddsChartData = {
  series: OddsSeries[];
  t0: number;
  t1: number;
  lo: number;
  hi: number;
};

/** Séries tracables (deux relevés valides au moins) et bornes communes, `null` sinon. */
export function buildOddsChart(odds: MarketHistory["odds"], numbers: number[]): OddsChartData | null {
  const series: OddsSeries[] = numbers
    .map((number) => ({
      number,
      points: (odds[number] ?? [])
        .map((p) => ({ t: Date.parse(p.t), odds: p.odds }))
        .filter((p) => Number.isFinite(p.t) && Number.isFinite(p.odds) && p.odds > 1),
    }))
    .filter((s) => s.points.length >= 2);
  if (series.length === 0) return null;
  const ts = series.flatMap((s) => s.points.map((p) => p.t));
  const vs = series.flatMap((s) => s.points.map((p) => p.odds));
  return { series, t0: Math.min(...ts), t1: Math.max(...ts), lo: Math.min(...vs), hi: Math.max(...vs) };
}

/** Position verticale d'une cote entre `top` (cote la plus haute) et `bottom` (la plus basse), sur une échelle log. */
export function oddsY(value: number, lo: number, hi: number, top: number, bottom: number): number {
  const l = Math.log(lo);
  const span = Math.log(hi) - l || 1;
  return bottom - ((Math.log(value) - l) / span) * (bottom - top);
}

/** Graduations lisibles comprises entre les bornes (cotes rondes du PMU). */
export function oddsTicks(lo: number, hi: number): number[] {
  const candidates = [1.5, 2, 3, 5, 10, 20, 50, 100, 200];
  const inside = candidates.filter((v) => v >= lo && v <= hi);
  return inside.length >= 2 ? inside : [lo, hi];
}
