import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { stagesFor } from "../src/lib/live/freeze";
import { planScratches } from "../src/lib/live/refresh-race";

describe("planScratches", () => {
  it("retire les numéros absents des partants PMU", () => {
    assert.deepEqual(planScratches([1, 2, 3, 4, 5, 6, 7, 8], [1, 2, 4, 5, 6, 7, 8]), [3]);
  });

  it("ne retire rien sur une réponse tronquée (moins de 70 % des partants)", () => {
    assert.deepEqual(planScratches([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], [1, 2, 3, 4, 5, 6]), []);
  });

  it("petit peloton : les non-partants déclarés ne passent plus pour une réponse tronquée", () => {
    // 6 chevaux, 2 non-partants : 4 partants < 70 % de 6, mais la liste PMU est complète.
    assert.deepEqual(planScratches([1, 2, 3, 4, 5, 6], [1, 2, 4, 6], [1, 2, 3, 4, 5, 6]), [3, 5]);
  });

  it("réponse tronquée : seuls les non-partants déclarés sont retirés", () => {
    assert.deepEqual(planScratches([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], [1, 2, 3], [1, 2, 3, 4]), [4]);
  });

  it("ne retire rien quand tout le monde court", () => {
    assert.deepEqual(planScratches([1, 2, 3], [3, 2, 1]), []);
  });
});

describe("non-partant tardif et gel H-2", () => {
  it("réécrit H-2 à chaque passage du dernier quart d'heure, donc avec le peloton réduit", () => {
    for (let minutes = 0.5; minutes <= 15; minutes += 0.5) assert.ok(stagesFor(minutes).includes("H-2"), `${minutes} min`);
  });
});
