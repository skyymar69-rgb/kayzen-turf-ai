import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { normalizeRacecourse, racecourseHue } from "../src/lib/racecourse-color";

describe("racecourseHue", () => {
  it("normalise accents, casse et préfixe", () => {
    assert.equal(normalizeRacecourse("Hippodrome de Vincennes"), "vincennes");
    assert.equal(normalizeRacecourse("PARISLONGCHAMP"), "parislongchamp");
    assert.equal(normalizeRacecourse("Saint-Cloud"), "saint cloud");
  });

  it("donne la même teinte au même hippodrome, quelle que soit l'écriture", () => {
    assert.equal(racecourseHue("Vincennes"), racecourseHue("HIPPODROME DE VINCENNES"));
    assert.equal(racecourseHue("Chantilly"), racecourseHue("chantilly"));
  });

  it("reste dans [0, 360)", () => {
    for (const name of ["Vincennes", "Chantilly", "Deauville", "Auteuil", "Enghien", ""]) {
      const hue = racecourseHue(name);
      assert.ok(hue >= 0 && hue < 360);
    }
  });
});
