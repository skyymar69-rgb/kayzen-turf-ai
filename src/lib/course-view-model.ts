import { compareMarketSupport, moneyFlow, oddsMovement, type Flow, type MarketHistory, type Movement } from "@/lib/market";
import type { CalibratedHorse } from "@/lib/probability";
import type { Profile, RaceVerdict } from "@/lib/profiles";
import { buildSelection } from "@/lib/selection";
import type { RaceAnalysis } from "@/lib/types";

/**
 * Tout ce que la page course affiche pour un partant, calculé une fois.
 * Les composants ne recalculent rien : ils lisent cette ligne.
 */
export type HorseRow = {
  horse: CalibratedHorse;
  rank: number;
  profile: Profile;
  /** Probabilité de l'IA, sans cote (%). */
  ai: number | null;
  /** Probabilité du marché, marge retirée (%). */
  market: number | null;
  /** IA − marché, en points. */
  gap: number | null;
  /** IA ÷ marché. */
  ratio: number | null;
  /** Espérance d'un pari gagnant de 1 € à la cote affichée, selon la probabilité retenue (%). */
  expectedValue: number | null;
  movement: Movement;
  flow: Flow;
};

export type CourseViewModel = {
  rows: HorseRow[];
  /** Les mêmes lignes, du plus joué au plus délaissé (onglet MVT). */
  marketRows: HorseRow[];
  verdict: RaceVerdict;
  byProfile: Record<Profile, HorseRow[]>;
  strongMoney: HorseRow[];
  /** Dernier relevé de cote connu (ISO). */
  lastObservation: string | null;
};

export function buildCourseViewModel(race: RaceAnalysis, history: MarketHistory): CourseViewModel {
  const selection = buildSelection(race.horses);
  const hasOdds = (o: number) => Number.isFinite(o) && o > 1;

  const rows: HorseRow[] = selection.field.map(({ horse, rank, profile, ratio }) => {
    const ai = Number.isFinite(Number(horse.fundamentalProbability)) ? Number(horse.fundamentalProbability) : null;
    const market = hasOdds(horse.odds) ? horse.marketProbability : null;
    return {
      horse,
      rank,
      profile,
      ai,
      market,
      gap: ai !== null && market !== null ? ai - market : null,
      ratio,
      expectedValue: hasOdds(horse.odds) ? (horse.odds * horse.winProbability) / 100 * 100 - 100 : null,
      movement: oddsMovement(history.odds[horse.number], horse.odds, race.raceDate),
      flow: moneyFlow(history.pools, horse.number),
    };
  });

  const byProfile = Object.fromEntries(
    (["base", "cache", "value", "favori", "outsider", "tocard", "eviter", "second"] as Profile[]).map((p) => [p, rows.filter((r) => r.profile === p)]),
  ) as Record<Profile, HorseRow[]>;

  const times = [
    ...Object.values(history.odds).flatMap((points) => points.map((p) => p.t)),
    ...history.pools.map((p) => p.t),
  ].sort((a, b) => Date.parse(a) - Date.parse(b));

  return {
    rows,
    marketRows: [...rows].sort(compareMarketSupport),
    verdict: selection.verdict,
    byProfile,
    strongMoney: rows.filter((r) => r.flow.strong).sort((a, b) => (b.flow.delta15 ?? 0) - (a.flow.delta15 ?? 0)),
    lastObservation: latest([race.oddsRefreshedAt ?? null, times.at(-1) ?? null]),
  };
}

/** Le plus récent de plusieurs instants ISO, comparés en temps et non en texte. */
function latest(values: Array<string | null>): string | null {
  const valid = values.filter((v): v is string => v !== null && Number.isFinite(Date.parse(v)));
  return valid.length ? valid.reduce((a, b) => (Date.parse(b) > Date.parse(a) ? b : a)) : null;
}
