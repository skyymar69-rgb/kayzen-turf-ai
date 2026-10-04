import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { betHighlights, minutesToStart, nextRace, officialArrival, raceAnchor, raceStatus } from "../src/lib/race-status";
import type { BetOffer, RaceAnalysis } from "../src/lib/types";

// 15:30 à Paris le 4 octobre 2026 (heure d'été) = 13:30 UTC.
const race = (startTime: string, positions: Array<number | null> = [null, null], extra: Partial<RaceAnalysis> = {}) =>
  ({ raceDate: "2026-10-04", startTime, reunionNumber: 1, courseNumber: 3, horses: positions.map((p, i) => ({ number: i + 1, finishPosition: p })), ...extra }) as unknown as RaceAnalysis;
const at = (iso: string) => new Date(iso);

describe("raceStatus", () => {
  it("à venir, imminente, partie selon l'heure de Paris", () => {
    assert.equal(raceStatus(race("15:30"), at("2026-10-04T13:00:00Z")), "a-venir");
    assert.equal(raceStatus(race("15:30"), at("2026-10-04T13:20:00Z")), "imminente");
    assert.equal(raceStatus(race("15:30"), at("2026-10-04T13:31:00Z")), "partie");
  });

  it("arrivée dès qu'une place est publiée", () => {
    assert.equal(raceStatus(race("15:30", [2, 1]), at("2026-10-04T12:00:00Z")), "arrivee");
  });

  it("lit l'heure au format PMU « 15h30 »", () => {
    assert.equal(Math.round(minutesToStart(race("15h30"), at("2026-10-04T13:00:00Z"))!), 30);
  });
});

describe("officialArrival / raceAnchor / nextRace", () => {
  it("ordonne l'arrivée par place", () => {
    assert.deepEqual(officialArrival(race("15:30", [3, 1, null, 2].slice(0, 4))), [2, 4, 1]);
  });

  it("forme l'ancre R1C3", () => {
    assert.equal(raceAnchor(race("15:30")), "R1C3");
  });

  it("trouve la prochaine course non partie", () => {
    const a = race("14:00", [null], { id: "a" });
    const b = race("16:00", [null], { id: "b" });
    const c = race("15:00", [null], { id: "c" });
    assert.equal(nextRace([b, a, c], at("2026-10-04T12:30:00Z"))?.id, "c");
    assert.equal(nextRace([a], at("2026-10-04T20:00:00Z")), null);
  });
});

describe("betHighlights", () => {
  const offer = (type: string, audience: string | null = null) => ({ type, audience }) as BetOffer;
  it("ne retient le Quarté+ que dans son offre régionale", () => {
    assert.deepEqual(betHighlights([offer("QUINTE_PLUS"), offer("QUARTE_PLUS", "NATIONAL"), offer("PICK5")]), ["QUINTE_PLUS", "PICK5"]);
    assert.deepEqual(betHighlights([offer("QUARTE_PLUS", "REGIONAL")]), ["QUARTE_PLUS"]);
  });
});
