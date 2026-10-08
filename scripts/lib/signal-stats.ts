/**
 * Statistiques des signaux, partagées par le backtest (scripts/backtest.ts) et
 * le balayage des seuils de la confrontation (scripts/evaluate-confrontation.ts).
 *
 * Mise fixe de 1 € par pari, sauf pour les tickets à plusieurs combinaisons
 * (`stake` : 1 € par combinaison).
 */

import { closingLineValue } from "@/lib/betting-engine";

export type Bet = {
  /** Index de la course : le rééchantillonnage tire des courses, pas des paris. */
  race: number;
  hit: boolean;
  /**
   * Somme rendue par le pari, 0 si perdu. Pour une mise de 1 €, c'est le
   * rapport officiel pour 1 € ; pour un ticket à X, la somme des rapports des
   * combinaisons gagnantes.
   */
  dividend: number;
  /** Cote de décision (NaN pour un ticket combiné). */
  odds: number;
  /** Jour de la course (AAAA-MM-JJ), pour la courbe de ROI cumulé et le découpage des périodes. */
  day?: string;
  /** Mise engagée en € ; 1 par défaut. */
  stake?: number;
  /** Cote finale : dernier relevé avant le départ, postérieur à la décision. Sert à la CLV. */
  closingOdds?: number;
  /** Discipline et spécialité de la course, pour la ventilation. */
  discipline?: string;
  specialty?: string;
};

export const BOOTSTRAP_DRAWS = 1000;

const stakeOf = (b: Bet) => (b.stake !== undefined && Number.isFinite(b.stake) && b.stake > 0 ? b.stake : 1);
const returnOf = (b: Bet) => (b.hit ? b.dividend : 0);

export function quantile(sorted: number[], q: number) {
  if (sorted.length === 0) return NaN;
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

/**
 * ROI rééchantillonné par course (graine fixe), trié : la distribution qui
 * donne l'intervalle à 90 % et la p-valeur unilatérale.
 */
function bootstrapRois(bets: Bet[], draws = BOOTSTRAP_DRAWS): number[] {
  const byRace = new Map<number, { staked: number; returned: number }>();
  for (const b of bets) {
    const g = byRace.get(b.race) ?? { staked: 0, returned: 0 };
    byRace.set(b.race, { staked: g.staked + stakeOf(b), returned: g.returned + returnOf(b) });
  }
  const groups = [...byRace.values()];
  const rois: number[] = [];
  let seed = 12345;
  const rand = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
  for (let k = 0; k < draws && groups.length > 0; k++) {
    let staked = 0;
    let ret = 0;
    for (let i = 0; i < groups.length; i++) {
      const g = groups[Math.floor(rand() * groups.length)];
      staked += g.staked;
      ret += g.returned;
    }
    rois.push((ret - staked) / staked);
  }
  return rois.sort((a, b) => a - b);
}

/**
 * P-valeur unilatérale de « ROI > 0 », lue sur la distribution bootstrap :
 * part des tirages dont le ROI est nul ou négatif, avec la correction +1 qui
 * interdit une p-valeur nulle (au mieux 1/1001). NaN sans pari.
 */
export function bootstrapPValue(sortedRois: number[]): number {
  if (sortedRois.length === 0) return NaN;
  const atOrBelowZero = sortedRois.filter((r) => r <= 0).length;
  return (atOrBelowZero + 1) / (sortedRois.length + 1);
}

/**
 * Risque d'une série de paris prise dans l'ordre chronologique : la plus forte
 * baisse du gain cumulé depuis son dernier sommet (en €, soit en mises de 1 €)
 * et la plus longue suite de paris perdants.
 */
export function riskProfile(bets: Bet[]) {
  const final = bets.reduce(
    (acc, b) => {
      const cumulative = acc.cumulative + returnOf(b) - stakeOf(b);
      const peak = Math.max(acc.peak, cumulative);
      const streak = b.hit ? 0 : acc.streak + 1;
      return {
        cumulative,
        peak,
        maxDrawdown: Math.max(acc.maxDrawdown, peak - cumulative),
        streak,
        longestLosingStreak: Math.max(acc.longestLosingStreak, streak),
      };
    },
    { cumulative: 0, peak: 0, maxDrawdown: 0, streak: 0, longestLosingStreak: 0 },
  );
  return { maxDrawdown: Math.round(final.maxDrawdown * 100) / 100, longestLosingStreak: final.longestLosingStreak };
}

/**
 * Closing Line Value : cote prise ÷ cote finale − 1 (`closingLineValue`, ici
 * en fraction). Positive : nous avons pris un meilleur prix que la clôture —
 * le marché est ensuite venu vers notre choix. Calculée seulement pour les
 * paris dont une cote finale distincte est connue ; null s'il n'y en a aucun.
 */
export function clvSummary(bets: Bet[]) {
  const values = bets
    .flatMap((b) => (Number.isFinite(b.odds) && b.odds > 1 && b.closingOdds !== undefined && b.closingOdds > 1 ? [closingLineValue(b.odds, b.closingOdds) / 100] : []))
    .sort((a, b) => a - b);
  if (values.length === 0) return null;
  return {
    n: values.length,
    mean: values.reduce((s, v) => s + v, 0) / values.length,
    median: quantile(values, 0.5),
    positiveShare: values.filter((v) => v > 0).length / values.length,
  };
}

/** ROI, intervalle à 90 % par rééchantillonnage des courses (1 000 tirages, graine fixe), p-valeur et risque. */
export function summarize(bets: Bet[], raceCount: number) {
  const n = bets.length;
  const staked = bets.reduce((s, b) => s + stakeOf(b), 0);
  const returned = bets.reduce((s, b) => s + returnOf(b), 0);
  const races = new Set(bets.map((b) => b.race)).size;
  const rois = bootstrapRois(bets);
  const hits = bets.filter((b) => b.hit).length;
  const priced = bets.filter((b) => Number.isFinite(b.odds));
  return {
    bets: n,
    races,
    raceCoverage: raceCount ? races / raceCount : 0,
    hits,
    hitRate: n ? hits / n : NaN,
    staked: Math.round(staked * 100) / 100,
    returned: Math.round(returned * 100) / 100,
    roi: staked > 0 ? (returned - staked) / staked : NaN,
    roiLow: quantile(rois, 0.05),
    roiHigh: quantile(rois, 0.95),
    /** P-valeur unilatérale (ROI > 0), AVANT correction des tests multiples. */
    pValue: bootstrapPValue(rois),
    averageOdds: priced.length ? priced.reduce((s, b) => s + b.odds, 0) / priced.length : NaN,
    clv: clvSummary(bets),
    ...riskProfile(bets),
  };
}

export type SignalSummary = ReturnType<typeof summarize>;

/**
 * Point de la courbe de ROI cumulé : [jour, paris du jour (ou de la période
 * regroupée), mises cumulées en €, gains cumulés en €]. Un tuple plutôt qu'un
 * objet : le rapport porte une série par signal, il doit rester léger.
 */
export type DailyPoint = [day: string, bets: number, staked: number, returned: number];

/** Au-delà, les jours consécutifs sont regroupés : le JSON reste borné. */
export const MAX_DAILY_POINTS = 90;

/**
 * Série quotidienne cumulée d'un signal. Les paris sans jour sont ignorés.
 * Si la période compte plus de `maxPoints` jours, les jours consécutifs sont
 * regroupés par paquets égaux : chaque point garde le dernier jour du paquet,
 * la somme des paris du paquet et les cumuls à la fin du paquet — les cumuls
 * restent donc exacts aux points conservés.
 */
export function dailySeries(bets: Bet[], maxPoints = MAX_DAILY_POINTS): DailyPoint[] {
  const perDay = new Map<string, { bets: number; staked: number; returned: number }>();
  for (const b of bets) {
    if (!b.day) continue;
    const d = perDay.get(b.day) ?? { bets: 0, staked: 0, returned: 0 };
    perDay.set(b.day, { bets: d.bets + 1, staked: d.staked + stakeOf(b), returned: d.returned + returnOf(b) });
  }
  const days = [...perDay.keys()].sort();
  const cumulative = days.reduce<DailyPoint[]>((acc, day) => {
    const prev = acc.at(-1);
    const d = perDay.get(day)!;
    return [...acc, [day, d.bets, (prev?.[2] ?? 0) + d.staked, (prev?.[3] ?? 0) + d.returned]];
  }, []);

  const size = Math.max(1, Math.ceil(cumulative.length / Math.max(1, maxPoints)));
  const grouped: DailyPoint[] = [];
  for (let start = 0; start < cumulative.length; start += size) {
    const chunk = cumulative.slice(start, start + size);
    const last = chunk.at(-1)!;
    grouped.push([last[0], chunk.reduce((s, p) => s + p[1], 0), Math.round(last[2] * 100) / 100, Math.round(last[3] * 100) / 100]);
  }
  return grouped;
}
