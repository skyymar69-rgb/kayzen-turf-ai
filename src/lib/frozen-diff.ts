import type { FrozenPayload } from "@/lib/live/freeze";
import { MVT_NOISE_PCT } from "@/lib/market";
import type { Profile } from "@/lib/profiles";

/**
 * CE QUE L'IA A CHANGÉ ENTRE DEUX PRONOSTICS GELÉS (H-60, H-15, H-2).
 *
 * Fonctions pures : elles comparent deux instantanés publiés tels quels avant
 * le départ, sans rien recalculer. Un écart de cote sous ±MVT_NOISE_PCT % est
 * tenu pour du bruit, comme sur la page course. Les gels anciens peuvent ne
 * pas porter toutes les colonnes : une colonne absente donne `null`.
 */

export type FrozenStageName = "H-60" | "H-15" | "H-2";

export const FROZEN_STAGE_ORDER: FrozenStageName[] = ["H-60", "H-15", "H-2"];

export type FrozenStage = {
  stage: FrozenStageName;
  /** Horodatage ISO 8601 du gel. */
  capturedAt: string;
  minutesToStart: number;
  modelVersion: string;
  payload: FrozenPayload;
};

export type HorseChange = {
  number: number;
  /** « retire » : présent au premier gel, absent du second (non-partant). */
  status: "present" | "retire" | "ajoute";
  rankBefore: number | null;
  rankAfter: number | null;
  /** Places gagnées (positif) ou perdues (négatif) dans le classement publié. */
  rankDelta: number | null;
  profileBefore: Profile | null;
  profileAfter: Profile | null;
  profileChanged: boolean;
  oddsBefore: number | null;
  oddsAfter: number | null;
  /** Variation relative de la cote, en %. */
  oddsChangePct: number | null;
  winBefore: number | null;
  winAfter: number | null;
  /** Variation de la probabilité de victoire affichée, en points. */
  winDeltaPts: number | null;
};

export type FrozenDiff = {
  from: Pick<FrozenStage, "stage" | "capturedAt" | "minutesToStart" | "modelVersion">;
  to: Pick<FrozenStage, "stage" | "capturedAt" | "minutesToStart" | "modelVersion">;
  topPickBefore: number | null;
  topPickAfter: number | null;
  topPickChanged: boolean;
  /** Tous les chevaux : d'abord dans l'ordre du second gel, puis les retirés. */
  horses: HorseChange[];
  rankChanges: HorseChange[];
  profileChanges: HorseChange[];
  /** Cotes ayant bougé d'au moins MVT_NOISE_PCT %, de la plus forte baisse à la plus forte hausse. */
  oddsMoves: HorseChange[];
  scratched: number[];
};

/**
 * Les deux gels à comparer : le plus ancien disponible (H-60, à défaut H-15)
 * et le plus récent (H-2, à défaut H-15). `null` s'il n'y en a pas deux.
 */
export function pickComparedStages(stages: FrozenStage[]): { from: FrozenStage; to: FrozenStage } | null {
  const sorted = [...stages]
    .filter((s) => FROZEN_STAGE_ORDER.includes(s.stage))
    .sort((a, b) => FROZEN_STAGE_ORDER.indexOf(a.stage) - FROZEN_STAGE_ORDER.indexOf(b.stage));
  if (sorted.length < 2) return null;
  return { from: sorted[0], to: sorted.at(-1)! };
}

const validOdds = (v: number | null | undefined) => (v != null && Number.isFinite(v) && v > 1 ? v : null);
const round1 = (v: number) => Math.round(v * 10) / 10;

function indexByNumber(payload: FrozenPayload) {
  return new Map(payload.numbers.map((n, i) => [n, i]));
}

function horseChange(number: number, before: FrozenPayload, after: FrozenPayload, ib: Map<number, number>, ia: Map<number, number>): HorseChange {
  const i = ib.get(number);
  const j = ia.get(number);
  const status = i === undefined ? "ajoute" : j === undefined ? "retire" : "present";
  const oddsBefore = i === undefined ? null : validOdds((before.odds ?? [])[i]);
  const oddsAfter = j === undefined ? null : validOdds((after.odds ?? [])[j]);
  const winBefore = i === undefined ? null : ((before.win ?? [])[i] ?? null);
  const winAfter = j === undefined ? null : ((after.win ?? [])[j] ?? null);
  const profileBefore = i === undefined ? null : ((before.profile ?? [])[i] ?? null);
  const profileAfter = j === undefined ? null : ((after.profile ?? [])[j] ?? null);
  return {
    number,
    status,
    rankBefore: i === undefined ? null : i + 1,
    rankAfter: j === undefined ? null : j + 1,
    rankDelta: i === undefined || j === undefined ? null : i - j,
    profileBefore,
    profileAfter,
    profileChanged: status === "present" && profileBefore !== null && profileAfter !== null && profileBefore !== profileAfter,
    oddsBefore,
    oddsAfter,
    oddsChangePct: oddsBefore && oddsAfter ? round1(((oddsAfter - oddsBefore) / oddsBefore) * 100) : null,
    winBefore,
    winAfter,
    winDeltaPts: winBefore !== null && winAfter !== null ? round1(winAfter - winBefore) : null,
  };
}

export function diffFrozen(from: FrozenStage, to: FrozenStage): FrozenDiff {
  const before = from.payload;
  const after = to.payload;
  const ib = indexByNumber(before);
  const ia = indexByNumber(after);
  const order = [...after.numbers, ...before.numbers.filter((n) => !ia.has(n))];
  const horses = order.map((n) => horseChange(n, before, after, ib, ia));
  const meta = (s: FrozenStage) => ({ stage: s.stage, capturedAt: s.capturedAt, minutesToStart: s.minutesToStart, modelVersion: s.modelVersion });
  const topPickBefore = before.numbers[0] ?? null;
  const topPickAfter = after.numbers[0] ?? null;
  return {
    from: meta(from),
    to: meta(to),
    topPickBefore,
    topPickAfter,
    topPickChanged: topPickBefore !== topPickAfter,
    horses,
    rankChanges: horses.filter((h) => h.rankDelta !== null && h.rankDelta !== 0),
    profileChanges: horses.filter((h) => h.profileChanged),
    oddsMoves: horses
      .filter((h) => h.oddsChangePct !== null && Math.abs(h.oddsChangePct) >= MVT_NOISE_PCT)
      .sort((a, b) => a.oddsChangePct! - b.oddsChangePct!),
    scratched: horses.filter((h) => h.status === "retire").map((h) => h.number),
  };
}
