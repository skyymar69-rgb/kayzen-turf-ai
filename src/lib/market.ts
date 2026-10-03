/**
 * LECTURE DU MARCHÉ — mouvement des cotes (MVT) et parts des enjeux (Money Flow).
 *
 * Définitions, publiées telles quelles sur la page /methode :
 *
 *   MVT        variation relative de la cote depuis la cote de référence — le
 *              premier relevé du jour de la course (« cote du matin »), à
 *              défaut le premier relevé connu. Sous ±10 %, le mouvement est
 *              tenu pour du bruit.
 *
 *   Money Flow variation, en points, de la part du cheval dans le pool simple
 *              gagnant du PMU sur les 15 dernières minutes, et sur les 5
 *              dernières pour l'accélération. Le PMU ne publie pas les mises
 *              individuelles : c'est la part des mises, jamais « l'argent des
 *              initiés ».
 */

export type OddsPoint = { t: string; odds: number };
export type PoolSnapshot = { t: string; numbers: number[]; win: number[] };

export type MarketHistory = {
  /** Relevés de cote par numéro, du plus ancien au plus récent. */
  odds: Record<number, OddsPoint[]>;
  pools: PoolSnapshot[];
};

export const MVT_NOISE_PCT = 10;
export const FLOW_WINDOW_MIN = 15;
export const FLOW_ACCEL_WINDOW_MIN = 5;
/** Seuil de la tuile « Argent fort » : +2 points de part du pool en 15 minutes. */
export const STRONG_MONEY_PTS = 2;
/** Sous ±0,5 point en 15 min, la part des mises est tenue pour stable. */
export const FLOW_TREND_PTS = 0.5;
/** Accélération : +1 point ou plus sur les 5 dernières minutes. */
export const FLOW_ACCEL_PTS = 1;

export type Movement = {
  reference: number | null;
  current: number | null;
  changePct: number | null;
  /** « joue » : la cote baisse, le cheval est joué. « delaisse » : elle monte. */
  direction: "joue" | "delaisse" | "stable" | "inconnu";
  referenceAt: string | null;
};

function parisDay(iso: string) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris" }).format(new Date(iso));
}

export function oddsMovement(points: OddsPoint[] | undefined, currentOdds: number, raceDate: string): Movement {
  const current = Number.isFinite(currentOdds) && currentOdds > 1 ? currentOdds : (points?.at(-1)?.odds ?? null);
  if (!points || points.length === 0 || current === null) {
    return { reference: null, current, changePct: null, direction: "inconnu", referenceAt: null };
  }
  const sameDay = points.find((p) => parisDay(p.t) === raceDate);
  const ref = sameDay ?? points[0];
  const changePct = ((current - ref.odds) / ref.odds) * 100;
  const direction = Math.abs(changePct) < MVT_NOISE_PCT ? "stable" : changePct < 0 ? "joue" : "delaisse";
  return { reference: ref.odds, current, changePct, direction, referenceAt: ref.t };
}

export type Flow = {
  share: number | null;
  delta15: number | null;
  delta5: number | null;
  strong: boolean;
};

function shareAt(snapshot: PoolSnapshot | undefined, number: number): number | null {
  if (!snapshot) return null;
  const i = snapshot.numbers.indexOf(number);
  return i === -1 ? null : snapshot.win[i];
}

/** Relevé le plus récent observé au plus tard `minutes` avant le dernier. */
function snapshotBefore(pools: PoolSnapshot[], minutes: number): PoolSnapshot | undefined {
  const last = pools.at(-1);
  if (!last) return undefined;
  const limit = new Date(last.t).getTime() - minutes * 60_000;
  let found: PoolSnapshot | undefined;
  for (const p of pools) if (new Date(p.t).getTime() <= limit) found = p;
  return found;
}

export function moneyFlow(pools: PoolSnapshot[], number: number): Flow {
  const latest = pools.at(-1);
  const share = shareAt(latest, number);
  if (share === null) return { share: null, delta15: null, delta5: null, strong: false };
  const before15 = shareAt(snapshotBefore(pools, FLOW_WINDOW_MIN), number);
  const before5 = shareAt(snapshotBefore(pools, FLOW_ACCEL_WINDOW_MIN), number);
  const delta15 = before15 === null ? null : share - before15;
  const delta5 = before5 === null ? null : share - before5;
  return { share, delta15, delta5, strong: delta15 !== null && delta15 >= STRONG_MONEY_PTS };
}

/**
 * Ordre du marché, du plus soutenu au plus délaissé : la baisse de cote depuis
 * le matin d'abord, puis la hausse de la part des mises sur 15 min pour
 * départager. Les chevaux sans historique ferment la marche.
 */
export function compareMarketSupport(
  a: { movement: Movement; flow: Flow },
  b: { movement: Movement; flow: Flow },
): number {
  const ca = a.movement.changePct;
  const cb = b.movement.changePct;
  if (ca !== null && cb !== null && ca !== cb) return ca - cb;
  if (ca === null && cb !== null) return 1;
  if (cb === null && ca !== null) return -1;
  return (b.flow.delta15 ?? -Infinity) - (a.flow.delta15 ?? -Infinity);
}
