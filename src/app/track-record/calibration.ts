/**
 * Graphique de calibration — calculs purs, testés (tests/calibration-chart.test.ts).
 *
 * Chaque tranche du rapport donne la probabilité annoncée en moyenne, la
 * fréquence de victoire observée et le nombre de chevaux. L'intervalle de
 * Wilson à 90 % montre la marge d'erreur liée à la taille de la tranche.
 */

export type CalibrationBucket = { bucket: number; announced: number; observed: number; n: number; label?: string; ae?: number };

export type CalibrationPoint = CalibrationBucket & { low: number; high: number };

/** z pour un intervalle bilatéral à 90 %. */
const Z90 = 1.6449;

export function wilsonInterval(p: number, n: number, z = Z90): [number, number] {
  if (!(n > 0) || !Number.isFinite(p)) return [NaN, NaN];
  const z2 = z * z;
  const center = (p + z2 / (2 * n)) / (1 + z2 / n);
  const half = (z / (1 + z2 / n)) * Math.sqrt((p * (1 - p)) / n + z2 / (4 * n * n));
  return [Math.max(0, center - half), Math.min(1, center + half)];
}

/** Tranches valides, triées, avec leur intervalle. Un rapport malformé ne casse pas la page. */
export function calibrationPoints(buckets: unknown): CalibrationPoint[] {
  if (!Array.isArray(buckets)) return [];
  const inUnit = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= 1;
  return buckets
    .filter((raw: unknown): raw is CalibrationBucket => {
      const b = (raw ?? {}) as Partial<Record<keyof CalibrationBucket, unknown>>;
      return inUnit(b.announced) && inUnit(b.observed) && Number(b.n) > 0;
    })
    .map((b) => {
      const [low, high] = wilsonInterval(b.observed, b.n);
      return {
        bucket: Number(b.bucket),
        announced: b.announced,
        observed: b.observed,
        n: Number(b.n),
        low,
        high,
        // Tranches logarithmiques (rapports récents) : libellé et A/E publiés.
        ...(typeof b.label === "string" ? { label: b.label } : {}),
        ...(typeof b.ae === "number" && Number.isFinite(b.ae) ? { ae: b.ae } : {}),
      };
    })
    .sort((a, b) => a.announced - b.announced);
}

/** Borne des deux axes : la plus grande valeur tracée, arrondie au 10 % supérieur. */
export function calibrationAxisMax(points: CalibrationPoint[]): number {
  const max = Math.max(0.1, ...points.flatMap((p) => [p.announced, p.high].filter(Number.isFinite)));
  return Math.min(1, Math.ceil(max * 10) / 10);
}

/** Rayon du point, proportionnel à la racine de l'effectif (surface ∝ n). */
export function bubbleRadius(n: number, maxN: number, minR = 3, maxR = 10): number {
  if (!(n > 0) || !(maxN > 0)) return minR;
  return minR + (maxR - minR) * Math.sqrt(Math.min(n, maxN) / maxN);
}
