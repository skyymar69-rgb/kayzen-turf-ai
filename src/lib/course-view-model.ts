import { STANCE_ORDER, classifyStance, marketSignals, type MarketSignal, type Stance } from "@/lib/confrontation";
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
  /** Famille de la confrontation IA × marché, `null` hors du jeu. */
  stance: Stance | null;
  /** Argent entrant ou sortant, accélération, smart money. */
  signals: MarketSignal[];
  /** Déclaré non-partant (voir `NonRunnerFields`). */
  nonRunner: boolean;
  /** Heure de la déclaration de non-partant (ISO), quand la source la donne. */
  nonRunnerAt: string | null;
};

/**
 * Non-partants : le modèle de données n'a pas encore de champ pour eux —
 * l'import PMU écarte tout participant dont le statut n'est pas « PARTANT ».
 * La page lit donc ces deux champs optionnels, que l'import pourra renseigner
 * (statut et heure de l'information) sans autre changement d'interface. En
 * attendant, un retrait se voit d'une visite à l'autre (lib/visit-snapshot).
 */
type NonRunnerFields = { nonRunner?: boolean | null; nonRunnerAt?: string | null };

export type CourseViewModel = {
  rows: HorseRow[];
  /** Les mêmes lignes, du plus joué au plus délaissé (onglet MVT). */
  marketRows: HorseRow[];
  /** Chevaux classés IA × marché, par famille puis par avis le plus fort (onglet IA × Marché). */
  confrontRows: HorseRow[];
  verdict: RaceVerdict;
  byProfile: Record<Profile, HorseRow[]>;
  strongMoney: HorseRow[];
  /** Partants déclarés non-partants, dans l'ordre des numéros. */
  nonRunners: HorseRow[];
  /** Dernier relevé de cote connu (ISO). */
  lastObservation: string | null;
};

export function buildCourseViewModel(race: RaceAnalysis, history: MarketHistory): CourseViewModel {
  const selection = buildSelection(race.horses);
  const hasOdds = (o: number) => Number.isFinite(o) && o > 1;

  const rows: HorseRow[] = selection.field.map(({ horse, rank, profile, ratio }) => {
    const ai = Number.isFinite(Number(horse.fundamentalProbability)) ? Number(horse.fundamentalProbability) : null;
    const market = hasOdds(horse.odds) ? horse.marketProbability : null;
    const movement = oddsMovement(history.odds[horse.number], horse.odds, race.raceDate);
    const flow = moneyFlow(history.pools, horse.number);
    const extra = horse as typeof horse & NonRunnerFields;
    const nonRunner = extra.nonRunner === true;
    // Un non-partant ne se confronte pas au marché : sa cote n'a plus de sens.
    const stance = nonRunner ? null : classifyStance(ai, market);
    return {
      horse,
      rank,
      profile,
      ai,
      market,
      gap: ai !== null && market !== null ? ai - market : null,
      ratio,
      expectedValue: hasOdds(horse.odds) ? (horse.odds * horse.winProbability) / 100 * 100 - 100 : null,
      movement,
      flow,
      stance,
      signals: nonRunner ? [] : marketSignals({ direction: movement.direction, flow, stance }),
      nonRunner,
      nonRunnerAt: nonRunner && typeof extra.nonRunnerAt === "string" ? extra.nonRunnerAt : null,
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
    confrontRows: rows
      .filter((r) => r.stance !== null)
      .sort((a, b) => STANCE_ORDER.indexOf(a.stance!) - STANCE_ORDER.indexOf(b.stance!) || strength(b) - strength(a)),
    verdict: selection.verdict,
    byProfile,
    strongMoney: rows.filter((r) => r.flow.strong && !r.nonRunner).sort((a, b) => (b.flow.delta15 ?? 0) - (a.flow.delta15 ?? 0)),
    nonRunners: rows.filter((r) => r.nonRunner).sort((a, b) => a.horse.number - b.horse.number),
    lastObservation: latest([race.oddsRefreshedAt ?? null, times.at(-1) ?? null]),
  };
}

/** Avis le plus fort des deux, pour ordonner une famille. */
function strength(row: HorseRow): number {
  return Math.max(row.ai ?? 0, row.market ?? 0);
}

/** Le plus récent de plusieurs instants ISO, comparés en temps et non en texte. */
function latest(values: Array<string | null>): string | null {
  const valid = values.filter((v): v is string => v !== null && Number.isFinite(Date.parse(v)));
  return valid.length ? valid.reduce((a, b) => (Date.parse(b) > Date.parse(a) ? b : a)) : null;
}
