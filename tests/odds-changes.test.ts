import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { announceOdds, diffOdds, swipeDirection } from "../src/lib/odds-changes";

describe("diffOdds", () => {
  const before = new Map([[4, 4.8], [8, 7.2], [2, 5.6]]);

  it("ne retient que les vrais mouvements", () => {
    const changes = diffOdds(before, [{ number: 4, odds: 4.2 }, { number: 8, odds: 7.25 }, { number: 2, odds: NaN }, { number: 11, odds: 14 }]);
    assert.deepEqual(changes, [{ number: 4, from: 4.8, to: 4.2 }]);
  });
});

describe("announceOdds", () => {
  it("cite les plus gros écarts relatifs, au plus trois", () => {
    const text = announceOdds([
      { number: 1, from: 2, to: 2.1 },
      { number: 2, from: 10, to: 20 },
      { number: 3, from: 5, to: 4 },
      { number: 4, from: 8, to: 6 },
    ]);
    assert.equal(text, "Cotes mises à jour : n° 2 de 10,0 à 20,0 ; n° 4 de 8,0 à 6,0 ; n° 3 de 5,0 à 4,0 ; et 1 autre.");
  });

  it("se tait sans changement", () => {
    assert.equal(announceOdds([]), "");
  });
});

describe("swipeDirection", () => {
  it("reconnaît un glissement franc", () => {
    assert.equal(swipeDirection(-120, 10), "next");
    assert.equal(swipeDirection(120, -20), "previous");
  });

  it("ignore un défilement vertical ou un geste trop court", () => {
    assert.equal(swipeDirection(-60, 0), null);
    assert.equal(swipeDirection(-120, 90), null);
  });
});
