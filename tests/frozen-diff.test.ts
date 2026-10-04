import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { diffFrozen, pickComparedStages, type FrozenStage } from "../src/lib/frozen-diff";
import type { FrozenPayload } from "../src/lib/live/freeze";
import type { Profile } from "../src/lib/profiles";

function stage(name: FrozenStage["stage"], rows: Array<[number, number | null, number, Profile]>, minutes: number): FrozenStage {
  const payload: FrozenPayload = {
    numbers: rows.map((r) => r[0]),
    odds: rows.map((r) => r[1]),
    win: rows.map((r) => r[2]),
    top3: rows.map((r) => r[2] * 2),
    market: rows.map((r) => r[2]),
    ai: rows.map((r) => r[2]),
    profile: rows.map((r) => r[3]),
    profilesVersion: "test",
  };
  return { stage: name, capturedAt: "2026-10-04T12:00:00.000Z", minutesToStart: minutes, modelVersion: "m1", payload };
}

const h60 = stage("H-60", [[4, 3.5, 24, "base"], [7, 6, 14, "value"], [2, 9, 9, "outsider"], [5, 20, 4, "tocard"]], 58);
const h15 = stage("H-15", [[4, 3.4, 25, "base"], [7, 5, 15, "value"], [2, 9, 9, "outsider"], [5, 22, 4, "tocard"]], 14);
const h2 = stage("H-2", [[7, 4.2, 22, "base"], [4, 3.6, 21, "cache"], [2, 9.5, 9, "outsider"]], 2);

describe("pickComparedStages", () => {
  it("compare le plus ancien gel au plus récent, quel que soit l'ordre reçu", () => {
    const pair = pickComparedStages([h2, h15, h60]);
    assert.equal(pair?.from.stage, "H-60");
    assert.equal(pair?.to.stage, "H-2");
  });
  it("se replie sur H-15 et renvoie null avec un seul gel", () => {
    assert.equal(pickComparedStages([h15, h2])?.from.stage, "H-15");
    assert.equal(pickComparedStages([h2]), null);
    assert.equal(pickComparedStages([]), null);
  });
});

describe("diffFrozen", () => {
  const diff = diffFrozen(h60, h2);

  it("repère le changement de n° 1", () => {
    assert.equal(diff.topPickBefore, 4);
    assert.equal(diff.topPickAfter, 7);
    assert.equal(diff.topPickChanged, true);
  });

  it("mesure les changements de rang en places gagnées", () => {
    const seven = diff.horses.find((h) => h.number === 7)!;
    const four = diff.horses.find((h) => h.number === 4)!;
    assert.equal(seven.rankDelta, 1);
    assert.equal(four.rankDelta, -1);
    assert.deepEqual(diff.rankChanges.map((h) => h.number).sort(), [4, 7]);
  });

  it("liste les changements de profil", () => {
    assert.deepEqual(
      diff.profileChanges.map((h) => [h.number, h.profileBefore, h.profileAfter]),
      [
        [7, "value", "base"],
        [4, "base", "cache"],
      ],
    );
  });

  it("ne retient que les mouvements de cote d'au moins 10 %, plus forte baisse en tête", () => {
    assert.deepEqual(diff.oddsMoves.map((h) => [h.number, h.oddsChangePct]), [[7, -30]]);
  });

  it("signale les non-partants survenus entre les deux gels", () => {
    assert.deepEqual(diff.scratched, [5]);
    const five = diff.horses.at(-1)!;
    assert.equal(five.status, "retire");
    assert.equal(five.rankAfter, null);
    assert.equal(five.profileChanged, false);
  });

  it("donne l'écart de probabilité en points", () => {
    assert.equal(diff.horses.find((h) => h.number === 7)!.winDeltaPts, 8);
  });

  it("tolère un gel ancien sans profils ni cotes valides", () => {
    const old = { ...h60, payload: { ...h60.payload, profile: undefined as unknown as Profile[], odds: [null, null, null, null] } };
    const d = diffFrozen(old, h2);
    assert.equal(d.profileChanges.length, 0);
    assert.equal(d.oddsMoves.length, 0);
  });
});
