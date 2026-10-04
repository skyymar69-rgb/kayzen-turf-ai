/**
 * Statistiques des signaux, partagées par le backtest (scripts/backtest.ts) et
 * le balayage des seuils de la confrontation (scripts/evaluate-confrontation.ts).
 *
 * Mise fixe de 1 € par pari : la somme engagée vaut le nombre de paris.
 */

export type Bet = {
  /** Index de la course : le rééchantillonnage tire des courses, pas des paris. */
  race: number;
  hit: boolean;
  /** Rapport officiel pour 1 €, 0 si perdu. */
  dividend: number;
  odds: number;
  /** Jour de la course (AAAA-MM-JJ), pour la courbe de ROI cumulé. */
  day?: string;
};

export function quantile(sorted: number[], q: number) {
  if (sorted.length === 0) return NaN;
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

/** ROI et intervalle à 90 % par rééchantillonnage des courses (1 000 tirages, graine fixe). */
export function summarize(bets: Bet[], raceCount: number) {
  const n = bets.length;
  const returned = bets.reduce((s, b) => s + (b.hit ? b.dividend : 0), 0);
  const roi = n ? (returned - n) / n : NaN;

  const byRace = new Map<number, Bet[]>();
  for (const b of bets) byRace.set(b.race, [...(byRace.get(b.race) ?? []), b]);
  const groups = [...byRace.values()];
  const rois: number[] = [];
  let seed = 12345;
  const rand = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
  for (let k = 0; k < 1000 && groups.length > 0; k++) {
    let staked = 0;
    let ret = 0;
    for (let i = 0; i < groups.length; i++) {
      const g = groups[Math.floor(rand() * groups.length)];
      staked += g.length;
      ret += g.reduce((s, b) => s + (b.hit ? b.dividend : 0), 0);
    }
    rois.push((ret - staked) / staked);
  }
  rois.sort((a, b) => a - b);
  return {
    bets: n,
    races: byRace.size,
    raceCoverage: raceCount ? byRace.size / raceCount : 0,
    hits: bets.filter((b) => b.hit).length,
    hitRate: n ? bets.filter((b) => b.hit).length / n : NaN,
    staked: n,
    returned: Math.round(returned * 100) / 100,
    roi,
    roiLow: quantile(rois, 0.05),
    roiHigh: quantile(rois, 0.95),
    averageOdds: n ? bets.reduce((s, b) => s + b.odds, 0) / n : NaN,
  };
}

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
  const perDay = new Map<string, { bets: number; returned: number }>();
  for (const b of bets) {
    if (!b.day) continue;
    const d = perDay.get(b.day) ?? { bets: 0, returned: 0 };
    perDay.set(b.day, { bets: d.bets + 1, returned: d.returned + (b.hit ? b.dividend : 0) });
  }
  const days = [...perDay.keys()].sort();
  const cumulative = days.reduce<DailyPoint[]>((acc, day) => {
    const prev = acc.at(-1);
    const d = perDay.get(day)!;
    return [...acc, [day, d.bets, (prev?.[2] ?? 0) + d.bets, (prev?.[3] ?? 0) + d.returned]];
  }, []);

  const size = Math.max(1, Math.ceil(cumulative.length / Math.max(1, maxPoints)));
  const grouped: DailyPoint[] = [];
  for (let start = 0; start < cumulative.length; start += size) {
    const chunk = cumulative.slice(start, start + size);
    const last = chunk.at(-1)!;
    grouped.push([last[0], chunk.reduce((s, p) => s + p[1], 0), last[2], Math.round(last[3] * 100) / 100]);
  }
  return grouped;
}
