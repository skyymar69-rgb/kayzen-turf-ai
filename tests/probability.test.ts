import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { calibrateField } from "../src/lib/probability";

describe("course sans cotes publiées", () => {
  it("les probabilités sont celles de l'IA, pas un quasi-uniforme", () => {
    const fundamental = [30, 26, 14, 10, 8, 5, 3, 2, 1, 1];
    const horses = fundamental.map((p, i) => ({ number: i + 1, odds: 0, kzScore: 50, fundamentalProbability: p }) as never);
    const out = calibrateField(horses);
    assert.ok(Math.abs(out[0].winProbability - 30) < 0.2, String(out[0].winProbability));
    assert.ok(Math.abs(out[9].winProbability - 1) < 0.2, String(out[9].winProbability));
  });
});
