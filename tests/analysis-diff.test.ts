import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { diffAnalysis, hasChanges, type AnalysisSnapshot, type HorseSnapshot } from "../src/lib/analysis-diff";

const horse = (number: number, rank: number, odds: number | null, win: number, profile: HorseSnapshot["profile"] = "second"): HorseSnapshot => ({
  number, name: `CHEVAL ${number}`, rank, odds, win, profile,
});

const snap = (horses: HorseSnapshot[], sentence = "Base : n° 1", reading: AnalysisSnapshot["reading"] = "lisible"): AnalysisSnapshot => ({
  at: 0,
  top3: [...horses].sort((a, b) => a.rank - b.rank).slice(0, 3).map((h) => h.number),
  reading,
  sentence,
  horses,
});

describe("diffAnalysis", () => {
  it("ne signale rien quand rien n'a bougé (bruit d'arrondi compris)", () => {
    const before = snap([horse(1, 1, 3.2, 30.0, "base"), horse(2, 2, 5.0, 18.0), horse(3, 3, 8.0, 11.0)]);
    const after = snap([horse(1, 1, 3.2, 30.3, "base"), horse(2, 2, 5.0, 18.0), horse(3, 3, 8.0, 11.0)]);
    const diff = diffAnalysis(before, after);
    assert.equal(hasChanges(diff), false);
    assert.equal(diff.changes.length, 0);
  });

  it("repère un changement de rang, de cote, de profil et de Top 3", () => {
    const before = snap([horse(1, 1, 3.2, 30, "base"), horse(2, 2, 5.0, 18), horse(3, 3, 8.0, 11), horse(4, 4, 12, 8, "cache")]);
    const after = snap([horse(1, 1, 3.4, 28, "base"), horse(4, 2, 7.5, 16, "value"), horse(2, 3, 5.2, 17), horse(3, 4, 8.0, 11)]);
    const diff = diffAnalysis(before, after);
    assert.equal(diff.top3Changed, true);
    const four = diff.changes.find((c) => c.number === 4)!;
    assert.deepEqual([four.rankBefore, four.rankAfter, four.oddsBefore, four.oddsAfter, four.profileBefore, four.profileAfter], [4, 2, 12, 7.5, "cache", "value"]);
    assert.deepEqual(diff.changes.map((c) => c.number), [1, 4, 2, 3], "triés par nouveau rang");
  });

  it("liste les non-partants et le changement de verdict", () => {
    const before = snap([horse(1, 1, 3.2, 30, "base"), horse(2, 2, 5.0, 18), horse(3, 3, 8.0, 11)]);
    const after = snap([horse(1, 1, 2.9, 34, "base"), horse(3, 2, 7.0, 14)], "Pas de base solide", "ouverte");
    const diff = diffAnalysis(before, after);
    assert.deepEqual(diff.scratched, [{ number: 2, name: "CHEVAL 2" }]);
    assert.equal(diff.verdictChanged, true);
  });
});
