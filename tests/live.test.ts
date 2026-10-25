import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { stagesFor } from "../src/lib/live/freeze";
import { refreshIntervalSeconds, snapshotGapMinutes } from "../src/lib/live/refresh-race";

describe("stagesFor", () => {
  it("n'écrit H-60 qu'entre H-60 et H-15", () => {
    assert.deepEqual(stagesFor(75), []);
    assert.deepEqual(stagesFor(45), ["H-60"]);
  });
  it("n'étiquette jamais un relevé tardif comme H-60", () => {
    assert.deepEqual(stagesFor(10), ["H-15", "H-2"]);
    assert.deepEqual(stagesFor(2), ["H-2"]);
  });
});

describe("cadence", () => {
  it("resserre l'historique à l'approche du départ", () => {
    assert.ok(snapshotGapMinutes(80) > snapshotGapMinutes(40));
    assert.ok(snapshotGapMinutes(40) > snapshotGapMinutes(5));
  });
  it("réduit les appels loin du départ tout en gardant un relevé toutes les deux minutes à l'approche", () => {
    assert.equal(refreshIntervalSeconds(90), 15 * 60);
    assert.equal(refreshIntervalSeconds(60), 10 * 60);
    assert.equal(refreshIntervalSeconds(15), 2 * 60);
  });
});
