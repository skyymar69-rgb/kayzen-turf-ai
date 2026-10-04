import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { adjacentRaces, indexStatus, meetingRaces, sortRaceIndex, type RaceIndexItem } from "../src/lib/race-navigation";

const item = (id: string, startTime: string, reunionNumber: number, courseNumber: number, arrived = false): RaceIndexItem => ({
  id,
  raceDate: "2026-10-04",
  startTime,
  reunionNumber,
  courseNumber,
  programCode: `R${reunionNumber}C${courseNumber}`,
  racecourse: "Vincennes",
  name: `Prix ${id}`,
  discipline: "Trot",
  arrived,
});

const day = [item("c", "15:30", 1, 3), item("a", "13:50", 1, 1), item("x", "14:10", 2, 1), item("b", "14:40", 1, 2)];

describe("navigation entre courses", () => {
  it("trie le programme dans l'ordre chronologique", () => {
    assert.deepEqual(sortRaceIndex(day).map((r) => r.id), ["a", "x", "b", "c"]);
  });

  it("donne la course précédente et la suivante, toutes réunions confondues", () => {
    const { previous, next } = adjacentRaces(day, "x");
    assert.equal(previous?.id, "a");
    assert.equal(next?.id, "b");
  });

  it("n'invente rien aux extrémités ni pour une course absente de l'index", () => {
    assert.equal(adjacentRaces(day, "a").previous, null);
    assert.equal(adjacentRaces(day, "c").next, null);
    assert.deepEqual(adjacentRaces(day, "inconnue"), { previous: null, next: null });
  });

  it("isole la réunion, dans l'ordre des numéros de course", () => {
    assert.deepEqual(meetingRaces(day, { raceDate: "2026-10-04", reunionNumber: 1 }).map((r) => r.programCode), ["R1C1", "R1C2", "R1C3"]);
  });

  it("calcule l'état à l'heure de Paris, l'arrivée l'emportant", () => {
    // 13:00 UTC = 15:00 à Paris (heure d'été).
    const now = new Date("2026-10-04T13:00:00Z");
    assert.equal(indexStatus(item("a", "13:50", 1, 1), now), "partie");
    assert.equal(indexStatus(item("c", "15:10", 1, 3), now), "imminente");
    assert.equal(indexStatus(item("d", "17:00", 1, 4), now), "a-venir");
    assert.equal(indexStatus(item("e", "17:00", 1, 5, true), now), "arrivee");
  });
});
