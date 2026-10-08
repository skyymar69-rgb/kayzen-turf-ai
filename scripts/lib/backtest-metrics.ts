/**
 * Indicateurs du backtest, purs et testés (tests/backtest-metrics.test.ts) :
 * découpage ajustement / hors échantillon, correction des tests multiples,
 * calibration par tranches logarithmiques, A/E par tranche de cote, log loss
 * mois par mois et ventilation par discipline.
 */

import { summarize, type Bet } from "./signal-stats";

// ── Périodes ───────────────────────────────────────────────────────

/**
 * Sépare les paris d'un signal en « période d'ajustement » (courses
 * antérieures au gel de ses règles : elles ont servi à les choisir) et
 * « hors échantillon » (à partir du gel). Un pari sans jour est écarté des deux.
 */
export function splitAtFreeze(bets: Bet[], frozenAt: string) {
  return {
    inSample: bets.filter((b) => b.day !== undefined && b.day < frozenAt),
    outOfSample: bets.filter((b) => b.day !== undefined && b.day >= frozenAt),
  };
}

/** Résumé d'une période ; null si elle ne compte aucun pari (rien à publier). */
export function periodSummary(bets: Bet[], raceCount: number) {
  return bets.length === 0 ? null : summarize(bets, raceCount);
}

// ── Tests multiples ────────────────────────────────────────────────

/**
 * P-valeurs ajustées de Holm (contrôle du risque de conclure à tort sur AU
 * MOINS un signal, quel que soit le nombre testé). Les NaN restent NaN et ne
 * comptent pas dans le nombre de tests. Même ordre que l'entrée.
 */
export function holmAdjust(pValues: number[]): number[] {
  const tested = pValues.map((p, i) => [p, i] as const).filter(([p]) => Number.isFinite(p)).sort((a, b) => a[0] - b[0]);
  const m = tested.length;
  const adjusted = new Array<number>(pValues.length).fill(NaN);
  tested.reduce((running, [p, i], rank) => {
    const value = Math.min(1, Math.max(running, (m - rank) * p));
    adjusted[i] = value;
    return value;
  }, 0);
  return adjusted;
}

/**
 * P-valeurs ajustées de Benjamini-Hochberg (contrôle de la proportion de
 * fausses découvertes), publiées à titre indicatif à côté de Holm.
 */
export function benjaminiHochbergAdjust(pValues: number[]): number[] {
  const tested = pValues.map((p, i) => [p, i] as const).filter(([p]) => Number.isFinite(p)).sort((a, b) => b[0] - a[0]);
  const m = tested.length;
  const adjusted = new Array<number>(pValues.length).fill(NaN);
  tested.reduce((running, [p, i], k) => {
    const rank = m - k;
    const value = Math.min(1, running, (m / rank) * p);
    adjusted[i] = value;
    return value;
  }, 1);
  return adjusted;
}

export type TestedSignal = { key: string; pValue: number };

/**
 * Bilan des tests multiples d'une famille de signaux. Le signal principal,
 * déclaré dans le code AVANT de regarder les résultats, est jugé seul au
 * seuil `alpha` ; tous les signaux le sont aussi après correction de Holm.
 */
export function multipleTesting(signals: TestedSignal[], primaryKey: string, alpha = 0.05) {
  const tested = signals.filter((s) => Number.isFinite(s.pValue));
  const holm = holmAdjust(tested.map((s) => s.pValue));
  const bh = benjaminiHochbergAdjust(tested.map((s) => s.pValue));
  const rows = tested.map((s, i) => ({ key: s.key, pValue: s.pValue, holm: holm[i], bh: bh[i], significant: holm[i] <= alpha }));
  const primary = rows.find((r) => r.key === primaryKey);
  return {
    method: "Holm (unilatéral, ROI > 0)",
    alpha,
    tested: rows.length,
    survivors: rows.filter((r) => r.significant).map((r) => r.key),
    primary: { key: primaryKey, pValue: primary?.pValue ?? NaN, significant: primary !== undefined && primary.pValue <= alpha },
    rows,
  };
}

// ── Calibration en tranches logarithmiques ────────────────────────

/**
 * Bornes des tranches : sous 1 %, puis doublement (1-2, 2-4, 4-8, 8-16,
 * 16-32 %) et 32 % et plus. Les déciles linéaires mettaient presque tous les
 * chevaux dans la première tranche (0-10 %), là où se jouent les grosses cotes.
 */
export const LOG_BIN_EDGES = [0.01, 0.02, 0.04, 0.08, 0.16, 0.32] as const;

const pctLabel = (v: number) => `${Math.round(v * 100)} %`;

export function logBinLabel(index: number): string {
  if (index === 0) return `< ${pctLabel(LOG_BIN_EDGES[0])}`;
  if (index >= LOG_BIN_EDGES.length) return `${pctLabel(LOG_BIN_EDGES[LOG_BIN_EDGES.length - 1])} et plus`;
  return `${pctLabel(LOG_BIN_EDGES[index - 1])} à ${pctLabel(LOG_BIN_EDGES[index])}`;
}

export function logBinIndex(p: number): number {
  const i = LOG_BIN_EDGES.findIndex((edge) => p < edge);
  return i === -1 ? LOG_BIN_EDGES.length : i;
}

export type CalibrationObservation = { p: number; won: boolean };

/**
 * Probabilité annoncée moyenne et fréquence observée par tranche
 * logarithmique. Même forme que l'ancienne calibration (`bucket`, `announced`,
 * `observed`, `n`), plus le libellé et l'A/E (victoires ÷ victoires annoncées).
 */
export function logCalibration(observations: CalibrationObservation[], minN = 30) {
  const bins = Array.from({ length: LOG_BIN_EDGES.length + 1 }, () => ({ announced: 0, wins: 0, n: 0 }));
  const filled = observations
    .filter((o) => Number.isFinite(o.p) && o.p >= 0)
    .reduce((acc, o) => {
      const i = logBinIndex(o.p);
      return acc.map((b, k) => (k === i ? { announced: b.announced + o.p, wins: b.wins + (o.won ? 1 : 0), n: b.n + 1 } : b));
    }, bins);
  return filled
    .map((b, i) => ({
      bucket: i,
      label: logBinLabel(i),
      announced: b.n ? b.announced / b.n : NaN,
      observed: b.n ? b.wins / b.n : NaN,
      ae: b.announced > 0 ? b.wins / b.announced : NaN,
      n: b.n,
    }))
    .filter((b) => b.n >= minN);
}

// ── A/E par tranche de cote ───────────────────────────────────────

/** Tranches de cote, dans la convention du site (cote PMU lue « x/1 », comme les seuils des profils). */
export const ODDS_BANDS: ReadonlyArray<{ label: string; lo: number; hi: number }> = [
  { label: "Moins de 3/1", lo: 1, hi: 3 },
  { label: "3/1 à 6/1", lo: 3, hi: 6 },
  { label: "6/1 à 10/1", lo: 6, hi: 10 },
  { label: "10/1 à 20/1", lo: 10, hi: 20 },
  { label: "20/1 à 50/1", lo: 20, hi: 50 },
  { label: "50/1 et plus", lo: 50, hi: Infinity },
];

export type RunnerObservation = {
  /** Cote de décision (rapport pour 1 €, mise comprise). */
  odds: number;
  /** Probabilité du marché (marge retirée) et du modèle affiché, en fraction. */
  market: number;
  model: number;
  won: boolean;
  /** Rapport officiel simple gagnant pour 1 €, 0 si perdu ; null sans rapports. */
  sg: number | null;
};

/**
 * Par tranche de cote de décision : victoires observées ÷ victoires annoncées
 * (A/E) selon le marché et selon notre modèle, et ROI d'un euro gagnant sur
 * chaque partant. A/E < 1 : la tranche gagne moins souvent qu'annoncé.
 */
export function oddsBandAE(runners: RunnerObservation[]) {
  return ODDS_BANDS.map((band) => {
    const g = runners.filter((r) => r.odds >= band.lo && r.odds < band.hi);
    const wins = g.filter((r) => r.won).length;
    const expectedMarket = g.reduce((s, r) => s + r.market, 0);
    const expectedModel = g.reduce((s, r) => s + r.model, 0);
    const paid = g.filter((r) => r.sg !== null);
    return {
      label: band.label,
      n: g.length,
      wins,
      aeMarket: expectedMarket > 0 ? wins / expectedMarket : NaN,
      aeModel: expectedModel > 0 ? wins / expectedModel : NaN,
      roiSG: paid.length ? (paid.reduce((s, r) => s + (r.sg ?? 0), 0) - paid.length) / paid.length : NaN,
    };
  }).filter((b) => b.n > 0);
}

// ── Log loss mois par mois ─────────────────────────────────────────

export type RaceLogLoss = { day: string; model: number; market: number; blend: number };

/**
 * Log loss moyen du gagnant par mois, pour le modèle fondamental, le marché et
 * le mélange affiché. Le modèle est figé avant la période : chaque mois est une
 * nouvelle mesure hors échantillon, lue dans l'ordre (vue « walk-forward »).
 */
export function monthlyLogLoss(races: RaceLogLoss[]) {
  const byMonth = races.reduce((acc, r) => {
    const month = r.day.slice(0, 7);
    const m = acc.get(month) ?? { races: 0, model: 0, market: 0, blend: 0 };
    return new Map(acc).set(month, { races: m.races + 1, model: m.model + r.model, market: m.market + r.market, blend: m.blend + r.blend });
  }, new Map<string, { races: number; model: number; market: number; blend: number }>());
  return [...byMonth.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, m]) => ({
      month,
      races: m.races,
      model: m.model / m.races,
      market: m.market / m.races,
      blend: m.blend / m.races,
    }));
}

/** −log de la probabilité donnée au gagnant, bornée pour un gagnant jugé impossible. */
export function winnerLogLoss(p: number[], winner: number): number {
  return -Math.log(Math.max(p[winner] ?? 0, 1e-12));
}

// ── Ventilation ────────────────────────────────────────────────────

/** ROI d'un signal ventilé par discipline ou spécialité ; groupes sans pari omis. */
export function breakdown(bets: Bet[], by: "discipline" | "specialty") {
  const groups = [...new Set(bets.map((b) => b[by]).filter((g): g is string => typeof g === "string" && g !== ""))].sort();
  return groups.map((group) => {
    const g = bets.filter((b) => b[by] === group);
    const s = summarize(g, 0);
    return { group, bets: s.bets, hitRate: s.hitRate, roi: s.roi, roiLow: s.roiLow, roiHigh: s.roiHigh };
  });
}
