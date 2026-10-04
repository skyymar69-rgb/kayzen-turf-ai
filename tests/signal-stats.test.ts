import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { confrontationKeys } from "../scripts/lib/backtest-signals";
import { PRODUCTION_THRESHOLDS, betsForThresholds, classifyStanceWith, thresholdGrid, type ScanRunner } from "../scripts/lib/confrontation-scan";
import { dailySeries, summarize, type Bet } from "../scripts/lib/signal-stats";
import { classifyStance } from "../src/lib/confrontation";

const bet = (day: string, hit: boolean, dividend = 0, race = 0): Bet => ({ race, day, hit, dividend: hit ? dividend : 0, odds: 5 });

describe("dailySeries", () => {
  it("cumule mises et gains par jour, dans l'ordre chronologique", () => {
    const series = dailySeries([bet("2026-09-02", true, 4), bet("2026-09-01", false), bet("2026-09-01", true, 2.5), bet("2026-09-02", false)]);
    assert.deepEqual(series, [
      ["2026-09-01", 2, 2, 2.5],
      ["2026-09-02", 2, 4, 6.5],
    ]);
  });

  it("ignore les paris sans jour", () => {
    assert.deepEqual(dailySeries([{ race: 0, hit: true, dividend: 3, odds: 3 }]), []);
  });

  it("regroupe les jours au-delà du plafond sans fausser les cumuls", () => {
    const bets = Array.from({ length: 10 }, (_, i) => bet(`2026-09-${String(i + 1).padStart(2, "0")}`, i % 2 === 0, 2));
    const series = dailySeries(bets, 4);
    assert.ok(series.length <= 4);
    const last = series.at(-1)!;
    assert.equal(last[0], "2026-09-10");
    assert.equal(last[2], 10);
    assert.equal(last[3], 10);
    assert.equal(series.reduce((s, p) => s + p[1], 0), 10);
  });
});

describe("summarize", () => {
  it("calcule le ROI net et un intervalle qui l'encadre", () => {
    const bets = Array.from({ length: 40 }, (_, i) => bet("2026-09-01", i % 4 === 0, 3.2, i));
    const s = summarize(bets, 40);
    assert.equal(s.bets, 40);
    assert.ok(Math.abs(s.roi - (10 * 3.2 - 40) / 40) < 1e-9);
    assert.ok(s.roiLow <= s.roi && s.roi <= s.roiHigh);
  });
});

describe("confrontationKeys", () => {
  const base = { number: 3, odds: 5, morning: undefined, pools: [] };
  it("ajoute la version placé pour l'accord et le favori IA", () => {
    assert.deepEqual(confrontationKeys({ ...base, market: 16, ai: 15 }), ["conf-accord-sg", "conf-accord-sp"]);
    assert.deepEqual(confrontationKeys({ ...base, market: 10, ai: 18 }), ["conf-ia-sg", "conf-ia-sp"]);
  });
  it("garde le favori marché en simple gagnant seulement", () => {
    assert.deepEqual(confrontationKeys({ ...base, market: 18, ai: 11 }), ["conf-marche-sg"]);
  });
  it("ne classe rien sans cote", () => {
    assert.deepEqual(confrontationKeys({ ...base, odds: null, market: 16, ai: 15 }), []);
  });
});

describe("balayage des seuils de la confrontation", () => {
  it("coïncide avec classifyStance au réglage de production", () => {
    for (let ai = 0; ai <= 40; ai += 0.5) {
      for (let market = 0; market <= 40; market += 0.5) {
        assert.equal(classifyStanceWith(ai, market, PRODUCTION_THRESHOLDS), classifyStance(ai, market), `${ai} / ${market}`);
      }
    }
  });

  it("inclut toujours le réglage de production dans la grille", () => {
    const grid = thresholdGrid({ minPct: [5], maxGapPts: [2], ratioBounds: [[0.9, 1.1]] });
    assert.equal(grid.length, 2);
    assert.deepEqual(grid[0], PRODUCTION_THRESHOLDS);
  });

  it("répartit les paris par famille et n'engage pas de placé sans rapports placés", () => {
    const runners: ScanRunner[] = [
      { race: 0, day: "2026-09-01", odds: 5, ai: 15, market: 16, sg: 5.1, sp: 1.8, hasSp: true },
      { race: 0, day: "2026-09-01", odds: 9, ai: 18, market: 10, sg: 0, sp: 0, hasSp: true },
      { race: 1, day: "2026-09-02", odds: 4, ai: 15, market: 16, sg: 0, sp: 0, hasSp: false },
    ];
    const bets = betsForThresholds(runners, PRODUCTION_THRESHOLDS);
    assert.equal(bets["accord-sg"].length, 2);
    assert.equal(bets["accord-sp"].length, 1);
    assert.equal(bets["accord-sp"][0].dividend, 1.8);
    assert.equal(bets["ia-sg"].length, 1);
    assert.equal(bets["ia-sg"][0].hit, false);
  });
});
