/**
 * VALUE ET ÉCART IA / MARCHÉ — une seule définition pour tout le site.
 *
 * Deux notions distinctes, qui étaient confondues :
 *
 *   « Value »             espérance POSITIVE d'un simple gagnant, calculée sur
 *                         la cote FINALE attendue (pas sur la cote affichée),
 *                         au-delà de VALUE_EDGE_THRESHOLD. N'est affichée qu'à
 *                         30 minutes du départ ou moins, cote publiée.
 *   « Écart IA / marché » différence, en points, entre la probabilité du
 *                         modèle fondamental (qui ne voit pas la cote) et celle
 *                         du marché. Outil de lecture : il dit où l'IA et le
 *                         marché divergent, pas qu'un pari est rentable.
 *
 * Pourquoi la cote finale : une cote PMU bouge jusqu'au départ, et une large
 * part des enjeux arrive dans les dernières minutes. Une espérance calculée
 * sur la cote de 11 h « rattrapée » à 15 h n'existe plus quand on peut la
 * jouer. Sur 795 courses (16/09 → 07/10/2026, scripts/fit-market.ts), le
 * modèle fondamental n'apporte RIEN contre la cote finale (β = 0, voir
 * src/lib/probability.ts) : la probabilité servie est le marché recalibré, et
 * l'espérance d'un simple gagnant y vaut environ −15 %, le prélèvement.
 */

/**
 * Prélèvement approximatif du simple gagnant, recoupé par la mesure : la marge
 * médiane des cotes (Σ 1/cote) vaut 1,184 sur 1 564 courses (24/08 → 07/10/2026),
 * soit 1 − 1/1,184 ≈ 15,5 % rendus en moins aux parieurs.
 */
export const WIN_TAKEOUT = 0.155;

/** Espérance minimale (%, à la cote finale attendue) pour parler de « Value ». Seuil unique du site. */
export const VALUE_EDGE_THRESHOLD = 10;

/** Au-delà de ce délai avant le départ, aucune « Value » n'est affichée : la cote est encore trop mobile. */
export const VALUE_LABEL_MAX_MINUTES = 30;

/** Écart IA − marché (points de probabilité) à partir duquel un partant est signalé. Seuil d'affichage, pas de rentabilité. */
export const AI_MARKET_GAP_POINTS = 4;

/**
 * Constante de temps du rattrapage des cotes, en minutes.
 *
 * HYPOTHÈSE PRUDENTE, NON AJUSTÉE : les données disponibles localement ne
 * contiennent que la dernière cote (≈ finale), pas de relevé horodaté. On
 * suppose que la part de l'écart rattrapée d'ici le départ vaut
 * 1 − exp(−minutes / 30) : 28 % à 10 min, 63 % à 30 min, 86 % à 1 h, 98 % à
 * 2 h. Un modèle ajusté sur les relevés `odds_snapshots` de la base doit
 * remplacer `catchUpShare` — c'est son unique point d'entrée.
 */
export const ODDS_CATCH_UP_MINUTES = 30;

const hasOdds = (odds: number) => Number.isFinite(odds) && odds > 1;

/**
 * Part (0 à 1) de l'écart cote affichée / probabilité estimée que le marché
 * aura rattrapée au départ. Délai inconnu → 1 (hypothèse la plus prudente :
 * toute l'espérance apparente disparaît). Course partie → 0.
 */
export function catchUpShare(minutesToStart: number | null | undefined): number {
  if (minutesToStart == null || !Number.isFinite(minutesToStart)) return 1;
  if (minutesToStart <= 0) return 0;
  return 1 - Math.exp(-minutesToStart / ODDS_CATCH_UP_MINUTES);
}

/**
 * Cote finale attendue d'un cheval.
 *
 * Le marché final est supposé converger, d'une part `catchUpShare`, vers la
 * cote nette que paierait un marché d'accord avec notre probabilité :
 * (1 − prélèvement) / p. On interpole en probabilité implicite :
 *
 *     1/cote_finale = (1 − s)/cote_affichée + s · p / (1 − prélèvement)
 *
 * À s = 1, l'espérance vaut exactement −prélèvement : aucune value ne survit.
 * Renvoie NaN sans cote publiée.
 */
export function expectedFinalOdds(
  odds: number,
  minutesToStart: number | null | undefined,
  winProbabilityPct: number,
  takeout = WIN_TAKEOUT,
): number {
  if (!hasOdds(odds)) return Number.NaN;
  const p = winProbabilityPct / 100;
  if (!(p > 0)) return odds;
  const s = catchUpShare(minutesToStart);
  const implied = (1 - s) / odds + (s * p) / (1 - takeout);
  return implied > 0 ? 1 / implied : odds;
}

/** Espérance (%) d'un simple gagnant de 1 € à la cote finale attendue, `null` sans cote. */
export function expectedValueAtStart(
  odds: number,
  minutesToStart: number | null | undefined,
  winProbabilityPct: number,
): number | null {
  const final = expectedFinalOdds(odds, minutesToStart, winProbabilityPct);
  if (!Number.isFinite(final)) return null;
  return Math.round((final * (winProbabilityPct / 100) - 1) * 1000) / 10;
}

/** Le mot « Value » n'est permis qu'avec une cote publiée, à 30 minutes du départ ou moins. */
export function canLabelValue(odds: number, minutesToStart: number | null | undefined): boolean {
  return hasOdds(odds) && minutesToStart != null && Number.isFinite(minutesToStart) && minutesToStart > 0 && minutesToStart <= VALUE_LABEL_MAX_MINUTES;
}

/** Espérance (%) si le partant mérite le libellé « Value », sinon `null`. */
export function valueEdge(
  horse: { odds: number; winProbability: number },
  minutesToStart: number | null | undefined,
): number | null {
  if (!canLabelValue(horse.odds, minutesToStart)) return null;
  const ev = expectedValueAtStart(horse.odds, minutesToStart, horse.winProbability);
  return ev != null && ev > VALUE_EDGE_THRESHOLD ? ev : null;
}

type GapInput = { odds: number; fundamentalProbability?: number | null; marketProbability?: number };

/** Écart IA − marché en points de probabilité, `null` si l'un des deux manque. */
export function aiMarketGap(horse: GapInput): number | null {
  const ai = Number(horse.fundamentalProbability);
  const market = Number(horse.marketProbability);
  if (!hasOdds(horse.odds) || !Number.isFinite(ai) || !Number.isFinite(market)) return null;
  return Math.round((ai - market) * 10) / 10;
}

/** Partant au plus fort écart IA / marché au-delà du seuil d'affichage, `null` sinon. */
export function bestAiMarketGap<T extends GapInput>(horses: T[]): { horse: T; points: number } | null {
  let best: { horse: T; points: number } | null = null;
  for (const horse of horses) {
    const points = aiMarketGap(horse);
    if (points != null && points >= AI_MARKET_GAP_POINTS && (!best || points > best.points)) best = { horse, points };
  }
  return best;
}

/** « +5,2 pts » — écart IA / marché formaté. */
export function formatGap(points: number): string {
  const sign = points > 0 ? "+" : points < 0 ? "−" : "";
  return `${sign}${Math.abs(points).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} pts`;
}
