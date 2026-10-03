import type { CourseViewModel } from "@/lib/course-view-model";
import type { Profile, RaceReading } from "@/lib/profiles";

/**
 * ANALYSE DE DERNIÈRE MINUTE — ce qui a changé entre deux lectures.
 *
 * Avant une relance, la page photographie son analyse (classement, cotes,
 * probabilités, profils, verdict). Une fois les données relues et la page
 * recalculée, la comparaison dit au visiteur ce qui a bougé, au lieu de lui
 * laisser retrouver les différences dans le tableau.
 */

export type HorseSnapshot = {
  number: number;
  name: string;
  rank: number;
  odds: number | null;
  win: number;
  profile: Profile;
};

export type AnalysisSnapshot = {
  at: number;
  top3: number[];
  reading: RaceReading;
  sentence: string;
  horses: HorseSnapshot[];
};

export type HorseChange = {
  number: number;
  name: string;
  rankBefore: number;
  rankAfter: number;
  oddsBefore: number | null;
  oddsAfter: number | null;
  winBefore: number;
  winAfter: number;
  profileBefore: Profile;
  profileAfter: Profile;
};

export type AnalysisDiff = {
  before: AnalysisSnapshot;
  after: AnalysisSnapshot;
  top3Changed: boolean;
  verdictChanged: boolean;
  changes: HorseChange[];
  scratched: Array<{ number: number; name: string }>;
};

/** En deçà, une variation n'est pas signalée : arrondis et bruit. */
const ODDS_EPSILON = 0.05;
const WIN_EPSILON_PTS = 0.5;

export function snapshotAnalysis(vm: CourseViewModel, at = Date.now()): AnalysisSnapshot {
  return {
    at,
    top3: vm.rows.slice(0, 3).map((r) => r.horse.number),
    reading: vm.verdict.reading,
    sentence: vm.verdict.sentence,
    horses: vm.rows.map((r) => ({
      number: r.horse.number,
      name: r.horse.horse,
      rank: r.rank,
      odds: Number.isFinite(r.horse.odds) && r.horse.odds > 1 ? r.horse.odds : null,
      win: r.horse.winProbability,
      profile: r.profile,
    })),
  };
}

function oddsMoved(a: number | null, b: number | null) {
  if (a === null || b === null) return a !== b;
  return Math.abs(a - b) >= ODDS_EPSILON;
}

export function diffAnalysis(before: AnalysisSnapshot, after: AnalysisSnapshot): AnalysisDiff {
  const previous = new Map(before.horses.map((h) => [h.number, h]));
  const current = new Set(after.horses.map((h) => h.number));

  const changes: HorseChange[] = [];
  for (const h of after.horses) {
    const p = previous.get(h.number);
    if (!p) continue;
    if (p.rank === h.rank && !oddsMoved(p.odds, h.odds) && Math.abs(p.win - h.win) < WIN_EPSILON_PTS && p.profile === h.profile) continue;
    changes.push({
      number: h.number,
      name: h.name,
      rankBefore: p.rank,
      rankAfter: h.rank,
      oddsBefore: p.odds,
      oddsAfter: h.odds,
      winBefore: p.win,
      winAfter: h.win,
      profileBefore: p.profile,
      profileAfter: h.profile,
    });
  }

  return {
    before,
    after,
    top3Changed: before.top3.join("-") !== after.top3.join("-"),
    verdictChanged: before.sentence !== after.sentence || before.reading !== after.reading,
    changes: changes.sort((a, b) => a.rankAfter - b.rankAfter),
    scratched: before.horses.filter((h) => !current.has(h.number)).map((h) => ({ number: h.number, name: h.name })),
  };
}

export function hasChanges(diff: AnalysisDiff): boolean {
  return diff.top3Changed || diff.verdictChanged || diff.changes.length > 0 || diff.scratched.length > 0;
}
