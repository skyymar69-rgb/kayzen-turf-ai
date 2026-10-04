import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { DIRECT_AHEAD_MINUTES, inDirectWindow } from "../src/lib/direct";

const race = (id: string, startTime: string) => ({ id, raceDate: "2026-10-04", startTime });
// 15:00 à Paris le 4 octobre 2026 = 13:00 UTC.
const now = new Date("2026-10-04T13:00:00Z");

describe("inDirectWindow", () => {
  it("garde les courses des 30 prochaines minutes et des 10 dernières", () => {
    const races = [race("loin", "16:00"), race("bientot", "15:20"), race("juste-partie", "14:55"), race("finie", "14:40"), race("imminente", "15:05")];
    assert.deepEqual(inDirectWindow(races, now).map((r) => r.id), ["juste-partie", "imminente", "bientot"]);
  });

  it("inclut la borne de 30 minutes", () => {
    assert.equal(DIRECT_AHEAD_MINUTES, 30);
    assert.deepEqual(inDirectWindow([race("borne", "15:30")], now).map((r) => r.id), ["borne"]);
  });

  it("ignore une heure illisible", () => {
    assert.deepEqual(inDirectWindow([race("x", "bientôt")], now), []);
  });
});

describe("nextDirectRace / directStatus", async () => {
  const { directStatus, nextDirectRace } = await import("../src/lib/direct");
  const r = (id: string, startTime: string, arrival: number[] = []) => ({ id, raceDate: "2026-10-04", startTime, arrival });

  it("trouve la prochaine course non partie, même hors fenêtre", () => {
    assert.equal(nextDirectRace([r("a", "14:00"), r("b", "17:00"), r("c", "16:00")], now)?.id, "c");
  });

  it("l'arrivée publiée prime sur l'horloge", () => {
    assert.equal(directStatus(r("a", "15:20", [3, 1]), now), "arrivee");
    assert.equal(directStatus(r("a", "15:10"), now), "imminente");
  });
});
