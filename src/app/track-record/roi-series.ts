/**
 * Courbe de ROI cumulé par signal — calculs purs, testés (tests/roi-series.test.ts).
 *
 * Le rapport du backtest porte, pour chaque signal, une série `daily` de tuples
 * [jour, paris, mises cumulées, gains cumulés] (scripts/lib/signal-stats.ts).
 * Les anciens rapports n'en ont pas : la courbe est alors masquée.
 */

export type DailyPoint = [day: string, bets: number, staked: number, returned: number];

export type SeriesSignal = {
  key: string;
  label: string;
  betType: string;
  bets: number;
  roi: number;
  roiLow: number;
  roiHigh: number;
  daily?: DailyPoint[];
};

export type RoiPoint = { day: string; t: number; staked: number; roi: number };

/** Sélection par défaut : la confrontation IA × marché et les deux références. */
export const DEFAULT_SERIES = ["conf-accord-sg", "conf-ia-sg", "conf-marche-sg", "tous-sg", "favori-marche-sg"];

/** Signaux de référence, tracés en pointillés. */
export const REFERENCE_SERIES = new Set(["tous-sg", "favori-marche-sg"]);

const DAY = /^\d{4}-\d{2}-\d{2}$/;

/** Points valides seulement : un rapport malformé ne doit pas casser la page. */
export function roiPoints(daily: unknown): RoiPoint[] {
  if (!Array.isArray(daily)) return [];
  return daily.flatMap((p): RoiPoint[] => {
    if (!Array.isArray(p) || p.length < 4) return [];
    const [day, , staked, returned] = p as unknown[];
    if (typeof day !== "string" || !DAY.test(day)) return [];
    const s = Number(staked);
    const r = Number(returned);
    if (!(s > 0) || !Number.isFinite(r)) return [];
    return [{ day, t: Date.parse(`${day}T12:00:00Z`), staked: s, roi: (r - s) / s }];
  });
}

/** Vrai si au moins un signal porte une série exploitable (deux points ou plus). */
export function hasRoiSeries(signals: SeriesSignal[]): boolean {
  return signals.some((s) => roiPoints(s.daily).length >= 2);
}

export type ChartBox = { width: number; height: number; left: number; right: number; top: number; bottom: number };

export type ChartScale = {
  t0: number;
  t1: number;
  lo: number;
  hi: number;
  x: (t: number) => number;
  y: (roi: number) => number;
  /** Graduations du ROI, zéro compris. */
  ticks: number[];
};

/** Échelle commune aux séries tracées ; le zéro est toujours visible. */
export function chartScale(series: RoiPoint[][], box: ChartBox): ChartScale | null {
  const points = series.flat();
  if (points.length === 0) return null;
  const ts = points.map((p) => p.t);
  const rois = points.map((p) => p.roi);
  const t0 = Math.min(...ts);
  const t1 = Math.max(...ts);
  const step = niceStep(Math.max(...rois, 0) - Math.min(...rois, 0));
  const lo = Math.floor(Math.min(...rois, 0) / step) * step;
  const hi = Math.ceil(Math.max(...rois, 0) / step) * step;
  const span = hi - lo || 1;
  const innerW = box.width - box.left - box.right;
  const innerH = box.height - box.top - box.bottom;
  const ticks: number[] = [];
  for (let v = lo; v <= hi + step / 2; v += step) ticks.push(Math.round(v * 1000) / 1000);
  return {
    t0,
    t1,
    lo,
    hi,
    x: (t) => box.left + (t1 === t0 ? innerW / 2 : ((t - t0) / (t1 - t0)) * innerW),
    y: (roi) => box.top + (1 - (roi - lo) / span) * innerH,
    ticks,
  };
}

/** Pas de graduation « rond » (5 %, 10 %, 20 %, 25 %, 50 %…) pour 3 à 6 graduations. */
export function niceStep(range: number): number {
  if (!(range > 0)) return 0.1;
  const raw = range / 4;
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const nice = [1, 2, 2.5, 5, 10].find((m) => m * magnitude >= raw) ?? 10;
  return nice * magnitude;
}

export function linePath(points: RoiPoint[], scale: Pick<ChartScale, "x" | "y">): string {
  return points.map((p, i) => `${i === 0 ? "M" : "L"}${scale.x(p.t).toFixed(1)},${scale.y(p.roi).toFixed(1)}`).join(" ");
}

/**
 * Table de repli : une ligne par jour présent dans au moins une série, une
 * colonne par signal ; `null` quand le signal n'a pas de point ce jour-là.
 */
export function seriesTable(series: Array<{ key: string; points: RoiPoint[] }>): Array<{ day: string; values: Array<RoiPoint | null> }> {
  const days = [...new Set(series.flatMap((s) => s.points.map((p) => p.day)))].sort();
  const lookup = series.map((s) => new Map(s.points.map((p) => [p.day, p])));
  return days.map((day) => ({ day, values: lookup.map((m) => m.get(day) ?? null) }));
}
