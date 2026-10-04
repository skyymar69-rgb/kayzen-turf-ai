import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildVisitSnapshot, diffVisit, parseVisitSnapshot, visitHasChanges, visitStorageKey } from "../src/lib/visit-snapshot";

const horses = (odds: Array<[number, number | null]>, np: number[] = []) =>
  odds.map(([number, o]) => ({ number, odds: o, nonRunner: np.includes(number) }));

describe("photographie de visite", () => {
  it("garde les cotes valides, écarte les cotes absentes ou fausses", () => {
    const snap = buildVisitSnapshot({ horses: horses([[1, 3.2], [2, NaN], [3, null]]), sentence: "S", top3: [1, 3, 2] }, 1000);
    assert.deepEqual(snap.odds, { "1": 3.2, "2": null, "3": null });
    assert.equal(snap.at, 1000);
  });

  it("relit ce qu'elle a écrit et refuse le reste", () => {
    const snap = buildVisitSnapshot({ horses: horses([[4, 5]], [4]), sentence: "Phrase", top3: [4] }, 42);
    assert.deepEqual(parseVisitSnapshot(JSON.stringify(snap)), snap);
    assert.equal(parseVisitSnapshot(null), null);
    assert.equal(parseVisitSnapshot("pas du json"), null);
    assert.equal(parseVisitSnapshot(JSON.stringify({ ...snap, v: 2 })), null);
    assert.equal(parseVisitSnapshot(JSON.stringify({ ...snap, odds: { "<script>": 2 } })), null);
    assert.equal(parseVisitSnapshot(JSON.stringify({ ...snap, top3: ["1"] })), null);
  });

  it("une clé de stockage par course", () => {
    assert.equal(visitStorageKey("R1C3-2026-10-04"), "kz-visite:R1C3-2026-10-04");
  });
});

describe("comparaison de deux visites", () => {
  const before = buildVisitSnapshot({ horses: horses([[1, 3], [2, 8], [3, 12], [4, 20]]), sentence: "Avant", top3: [1, 2, 3] }, 1);

  it("rien à signaler quand rien n'a bougé", () => {
    const same = buildVisitSnapshot({ horses: horses([[1, 3.02], [2, 8], [3, 12], [4, 20]]), sentence: "Avant", top3: [1, 2, 3] }, 2);
    assert.equal(visitHasChanges(diffVisit(before, same)), false);
  });

  it("cotes, verdict, Top 3 et non-partants déclarés ou retirés", () => {
    const after = buildVisitSnapshot({ horses: horses([[1, 2.5], [2, 8], [3, 12]], [3]), sentence: "Après", top3: [1, 3, 2] }, 2);
    const diff = diffVisit(before, after);
    assert.deepEqual(diff.oddsChanges, [{ number: 1, before: 3, after: 2.5 }]);
    // Le n° 3 est déclaré non-partant, le n° 4 a disparu du programme.
    assert.deepEqual(diff.newNonRunners, [3, 4]);
    assert.equal(diff.verdictBefore, "Avant");
    assert.equal(diff.verdictAfter, "Après");
    assert.deepEqual(diff.top3After, [1, 3, 2]);
    assert.equal(visitHasChanges(diff), true);
  });
});
