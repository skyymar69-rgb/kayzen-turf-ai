import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { arrivalBody, evaluateMarketAlert, oddsDirection } from "../src/lib/push/market-alerts";

const pools = (shares: Array<[string, number]>) => shares.map(([t, win]) => ({ t, numbers: [5], win: [win] }));
const rising = pools([["2026-10-04T13:00:00Z", 10], ["2026-10-04T13:10:00Z", 11], ["2026-10-04T13:16:00Z", 13]]);
const falling = pools([["2026-10-04T13:00:00Z", 12], ["2026-10-04T13:16:00Z", 10]]);
const base = { number: 5, minutesToStart: 8, morningOdds: 8, currentOdds: 6, pools: rising, ai: 18, market: 12 };

describe("oddsDirection", () => {
  it("tient ±10 % pour du bruit", () => {
    assert.equal(oddsDirection(8, 7.5), "stable");
    assert.equal(oddsDirection(8, 6), "joue");
    assert.equal(oddsDirection(8, 10), "delaisse");
    assert.equal(oddsDirection(null, 6), "inconnu");
  });
});

describe("evaluateMarketAlert", () => {
  it("smart money : argent qui entre, cote en baisse, IA favorable", () => {
    assert.equal(evaluateMarketAlert(base), "smart-money");
  });

  it("pas de smart money quand l'IA juge le cheval surcoté", () => {
    assert.equal(evaluateMarketAlert({ ...base, ai: 6, market: 14 }), null);
  });

  it("délaissé : cote en hausse sans argent qui entre, à moins de 10 min", () => {
    assert.equal(evaluateMarketAlert({ ...base, currentOdds: 11, pools: falling }), "delaisse");
    assert.equal(evaluateMarketAlert({ ...base, currentOdds: 11, pools: falling, minutesToStart: 20 }), null);
  });

  it("rien une fois le départ passé", () => {
    assert.equal(evaluateMarketAlert({ ...base, minutesToStart: -1 }), null);
  });
});

describe("arrivalBody", () => {
  it("donne l'arrivée, la place du cheval suivi et le sort de la base IA", () => {
    const body = arrivalBody(4, { arrival: [8, 4, 2, 11, 6], position: 2, aiBase: 8 });
    assert.match(body, /Arrivée : 8 – 4 – 2 – 11 – 6/);
    assert.match(body, /Votre n° 4 : 2e/);
    assert.match(body, /Base IA n° 8 : gagnante/);
  });

  it("dit honnêtement un cheval non classé et une base hors du podium", () => {
    const body = arrivalBody(9, { arrival: [1, 2, 3], position: null, aiBase: 7 });
    assert.match(body, /non classé/);
    assert.match(body, /hors du podium/);
  });
});
