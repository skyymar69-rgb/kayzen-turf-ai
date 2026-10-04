import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { bubbleRadius, calibrationAxisMax, calibrationPoints, wilsonInterval } from "../src/app/track-record/calibration";
import { chartScale, hasRoiSeries, linePath, niceStep, roiPoints, seriesTable } from "../src/app/track-record/roi-series";

const box = { width: 600, height: 200, left: 40, right: 10, top: 10, bottom: 20 };

describe("roiPoints", () => {
  it("convertit les cumuls en ROI net", () => {
    const points = roiPoints([
      ["2026-09-01", 10, 10, 8],
      ["2026-09-02", 10, 20, 23],
    ]);
    assert.deepEqual(
      points.map((p) => [p.day, p.staked, Math.round(p.roi * 1000) / 1000]),
      [
        ["2026-09-01", 10, -0.2],
        ["2026-09-02", 20, 0.15],
      ],
    );
  });

  it("ignore un rapport ancien ou malformé", () => {
    assert.deepEqual(roiPoints(undefined), []);
    assert.deepEqual(roiPoints([["pas une date", 1, 1, 1], ["2026-09-01", 1, 0, 0], { day: "2026-09-01" }]), []);
  });
});

describe("hasRoiSeries", () => {
  const signal = { key: "tous-sg", label: "Tous", betType: "SG", bets: 2, roi: 0, roiLow: 0, roiHigh: 0 };
  it("masque la courbe pour les rapports sans série", () => {
    assert.equal(hasRoiSeries([signal]), false);
    assert.equal(hasRoiSeries([{ ...signal, daily: [["2026-09-01", 1, 1, 0]] }]), false);
    assert.equal(hasRoiSeries([{ ...signal, daily: [["2026-09-01", 1, 1, 0], ["2026-09-02", 1, 2, 3]] }]), true);
  });
});

describe("chartScale", () => {
  it("garde toujours le zéro dans l'échelle", () => {
    const points = roiPoints([
      ["2026-09-01", 5, 5, 4],
      ["2026-09-03", 5, 10, 7],
    ]);
    const scale = chartScale([points], box)!;
    assert.ok(scale.lo < 0 && scale.hi >= 0);
    assert.ok(scale.ticks.includes(0));
    assert.equal(scale.x(points[0].t), box.left);
    assert.equal(scale.x(points[1].t), box.width - box.right);
    assert.ok(linePath(points, scale).startsWith("M40.0,"));
  });

  it("renvoie null sans point", () => {
    assert.equal(chartScale([], box), null);
  });

  it("choisit des pas ronds", () => {
    assert.equal(niceStep(0.4), 0.1);
    assert.ok(Math.abs(niceStep(0.08) - 0.02) < 1e-12);
    assert.equal(niceStep(0), 0.1);
  });
});

describe("seriesTable", () => {
  it("aligne les séries par jour", () => {
    const a = roiPoints([["2026-09-01", 1, 1, 0], ["2026-09-02", 1, 2, 0]]);
    const b = roiPoints([["2026-09-02", 1, 1, 2]]);
    const table = seriesTable([{ key: "a", points: a }, { key: "b", points: b }]);
    assert.deepEqual(table.map((r) => [r.day, r.values.map((v) => (v ? v.staked : null))]), [
      ["2026-09-01", [1, null]],
      ["2026-09-02", [2, 1]],
    ]);
  });
});

describe("calibration", () => {
  it("encadre la fréquence observée par l'intervalle de Wilson", () => {
    const [low, high] = wilsonInterval(0.2, 100);
    assert.ok(low < 0.2 && 0.2 < high);
    assert.ok(low > 0.13 && high < 0.28);
    assert.deepEqual(wilsonInterval(0.2, 0).map(Number.isNaN), [true, true]);
  });

  it("trie les tranches et écarte les valeurs invalides", () => {
    const points = calibrationPoints([
      { bucket: 2, announced: 0.25, observed: 0.22, n: 400 },
      { bucket: 0, announced: 0.04, observed: 0.05, n: 9000 },
      { bucket: 9, announced: 1.4, observed: 0.5, n: 40 },
      null,
    ]);
    assert.deepEqual(points.map((p) => p.bucket), [0, 2]);
    assert.equal(calibrationAxisMax(points), 0.3);
  });

  it("donne une surface proportionnelle à l'effectif", () => {
    assert.equal(bubbleRadius(100, 100), 10);
    assert.ok(bubbleRadius(25, 100) < bubbleRadius(50, 100));
    assert.equal(bubbleRadius(0, 100), 3);
  });
});
