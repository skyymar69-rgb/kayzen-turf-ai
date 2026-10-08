import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  benjaminiHochbergAdjust,
  breakdown,
  holmAdjust,
  logBinIndex,
  logBinLabel,
  logCalibration,
  monthlyLogLoss,
  multipleTesting,
  oddsBandAE,
  periodSummary,
  splitAtFreeze,
  winnerLogLoss,
} from "../scripts/lib/backtest-metrics";
import { bootstrapPValue, clvSummary, riskProfile, summarize, type Bet } from "../scripts/lib/signal-stats";

const close = (a: number, b: number, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} ≠ ${b}`);
const bet = (over: Partial<Bet>): Bet => ({ race: 0, hit: false, dividend: 0, odds: 5, ...over });

describe("splitAtFreeze", () => {
  it("sépare la période d'ajustement du hors échantillon, jour du gel compris dans le second", () => {
    const bets = [bet({ day: "2026-10-01" }), bet({ day: "2026-10-02" }), bet({ day: "2026-10-05" }), bet({})];
    const { inSample, outOfSample } = splitAtFreeze(bets, "2026-10-02");
    assert.equal(inSample.length, 1);
    assert.equal(outOfSample.length, 2);
  });
  it("ne publie rien pour une période vide", () => {
    assert.equal(periodSummary([], 10), null);
    assert.equal(periodSummary([bet({ day: "2026-10-03" })], 1)?.bets, 1);
  });
});

describe("correction des tests multiples", () => {
  it("Holm : multiplie la plus petite p par m, reste monotone et borné à 1", () => {
    const adjusted = holmAdjust([0.01, 0.04, 0.03, NaN, 0.5]);
    close(adjusted[0], 0.04);
    close(adjusted[2], 0.09);
    close(adjusted[1], 0.09);
    close(adjusted[4], 0.5);
    assert.ok(Number.isNaN(adjusted[3]));
  });
  it("Benjamini-Hochberg est moins sévère que Holm", () => {
    const p = [0.01, 0.02, 0.03, 0.04];
    const bh = benjaminiHochbergAdjust(p);
    const holm = holmAdjust(p);
    bh.forEach((v, i) => assert.ok(v <= holm[i] + 1e-12));
    close(bh[3], 0.04);
  });
  it("juge le signal principal seul et les autres après correction", () => {
    const mt = multipleTesting(
      [
        { key: "rank1-sp", pValue: 0.03 },
        { key: "a", pValue: 0.001 },
        { key: "b", pValue: 0.2 },
        { key: "c", pValue: NaN },
      ],
      "rank1-sp",
    );
    assert.equal(mt.tested, 3);
    assert.deepEqual(mt.survivors, ["a"]);
    assert.equal(mt.primary.significant, true);
  });
});

describe("p-valeur bootstrap et summarize", () => {
  it("ne descend jamais à zéro et vaut 1 quand tout est négatif", () => {
    close(bootstrapPValue([0.1, 0.2, 0.3]), 1 / 4);
    close(bootstrapPValue([-0.3, -0.2]), 1);
    assert.ok(Number.isNaN(bootstrapPValue([])));
  });
  it("un signal nettement gagnant a une p-valeur faible", () => {
    const bets = Array.from({ length: 200 }, (_, i) => bet({ race: i, hit: i % 2 === 0, dividend: 3 }));
    const s = summarize(bets, 200);
    assert.ok(s.roi > 0.4);
    assert.ok(s.pValue < 0.01);
  });
  it("tient compte de la mise des tickets à plusieurs combinaisons", () => {
    const s = summarize([bet({ race: 0, stake: 12, hit: true, dividend: 41 }), bet({ race: 1, stake: 12 })], 2);
    assert.equal(s.staked, 24);
    close(s.roi, (41 - 24) / 24);
  });
});

describe("riskProfile", () => {
  it("mesure la plus forte baisse depuis un sommet et la plus longue série perdante", () => {
    const seq = [true, false, false, false, true, false].map((hit) => bet({ hit, dividend: hit ? 3 : 0 }));
    // Cumul : +2, +1, 0, −1, +1, 0 → sommet 2, creux −1 : baisse de 3.
    assert.deepEqual(riskProfile(seq), { maxDrawdown: 3, longestLosingStreak: 3 });
  });
});

describe("clvSummary", () => {
  it("compare la cote prise à la cote finale et ignore les paris sans cote finale", () => {
    const clv = clvSummary([bet({ odds: 6, closingOdds: 5 }), bet({ odds: 4, closingOdds: 5 }), bet({ odds: 5 })])!;
    assert.equal(clv.n, 2);
    close(clv.positiveShare, 0.5);
    close(clv.mean, (0.2 - 0.2) / 2);
    assert.equal(clvSummary([bet({})]), null);
  });
});

describe("calibration logarithmique", () => {
  it("range les probabilités dans des tranches doublées", () => {
    assert.equal(logBinIndex(0.005), 0);
    assert.equal(logBinIndex(0.015), 1);
    assert.equal(logBinIndex(0.08), 4);
    assert.equal(logBinIndex(0.5), 6);
    assert.equal(logBinLabel(0), "< 1 %");
    assert.equal(logBinLabel(3), "4 % à 8 %");
    assert.equal(logBinLabel(6), "32 % et plus");
  });
  it("calcule annoncé, observé et A/E par tranche suffisante", () => {
    const obs = Array.from({ length: 40 }, (_, i) => ({ p: 0.05, won: i < 4 }));
    const [bin] = logCalibration(obs);
    assert.equal(bin.label, "4 % à 8 %");
    close(bin.announced, 0.05);
    close(bin.observed, 0.1);
    close(bin.ae, 2);
    assert.deepEqual(logCalibration(obs.slice(0, 10)), []);
  });
});

describe("oddsBandAE", () => {
  it("compare victoires observées et annoncées par tranche de cote", () => {
    const runners = [
      { odds: 2, market: 0.4, model: 0.45, won: true, sg: 2 },
      { odds: 2.5, market: 0.35, model: 0.3, won: false, sg: 0 },
      { odds: 25, market: 0.04, model: 0.05, won: false, sg: 0 },
    ];
    const [fav, , ] = oddsBandAE(runners);
    assert.equal(fav.label, "Moins de 3/1");
    assert.equal(fav.n, 2);
    close(fav.aeMarket, 1 / 0.75);
    close(fav.roiSG, (2 - 2) / 2);
    assert.equal(oddsBandAE(runners).length, 2);
  });
});

describe("monthlyLogLoss", () => {
  it("moyenne le log loss du gagnant par mois, dans l'ordre", () => {
    const rows = monthlyLogLoss([
      { day: "2026-07-03", model: 2, market: 1.8, blend: 1.9 },
      { day: "2026-06-10", model: 2.2, market: 2, blend: 2.1 },
      { day: "2026-07-20", model: 1, market: 1, blend: 1 },
    ]);
    assert.deepEqual(rows.map((r) => r.month), ["2026-06", "2026-07"]);
    close(rows[1].model, 1.5);
    assert.equal(rows[1].races, 2);
  });
  it("borne un gagnant jugé impossible", () => {
    close(winnerLogLoss([0.5, 0.5], 0), Math.log(2));
    assert.ok(Number.isFinite(winnerLogLoss([1, 0], 1)));
  });
});

describe("breakdown", () => {
  it("ventile le ROI par discipline", () => {
    const rows = breakdown(
      [bet({ discipline: "Trot", hit: true, dividend: 4 }), bet({ discipline: "Trot", race: 1 }), bet({ discipline: "Plat", race: 2 }), bet({ race: 3 })],
      "discipline",
    );
    assert.deepEqual(rows.map((r) => [r.group, r.bets]), [["Plat", 1], ["Trot", 2]]);
    close(rows[1].roi, 1);
  });
});
