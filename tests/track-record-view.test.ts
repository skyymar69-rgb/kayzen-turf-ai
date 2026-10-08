import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { calibrationPoints } from "../src/app/track-record/calibration";
import type { ReportSignal } from "../src/app/track-record/report-types";
import { earliestFreeze, fullRows, holmByKey, periodRows, readingOf, ticketGroups } from "../src/app/track-record/report-view";

const stats = (over: Partial<ReportSignal> = {}) => ({ bets: 400, hitRate: 0.3, roi: -0.1, roiLow: -0.2, roiHigh: 0, ...over });
const oldSignal: ReportSignal = { key: "rank1-sp", label: "N° 1", betType: "SP", description: "Simple placé", ...stats() };
const newSignal: ReportSignal = {
  ...oldSignal,
  frozenAt: "2026-10-02",
  inSample: stats({ roi: 0.05 }),
  outOfSample: stats({ bets: 30 }),
};

describe("lecture d'un rapport ancien ou récent", () => {
  it("n'invente pas de découpage pour un ancien rapport", () => {
    assert.equal(periodRows([oldSignal], "outOfSample"), null);
    assert.equal(fullRows([oldSignal])[0].stats?.bets, 400);
    assert.equal(holmByKey(undefined).size, 0);
    assert.equal(earliestFreeze({ signals: [oldSignal] }), null);
    assert.deepEqual(ticketGroups(undefined), []);
  });

  it("lit les périodes et la p-valeur corrigée d'un rapport récent", () => {
    const mt = { method: "Holm", alpha: 0.05, tested: 1, survivors: [], primary: { key: "rank1-sp", pValue: 0.4, significant: false }, rows: [{ key: "rank1-sp", pValue: 0.4, holm: 0.4, bh: 0.4, significant: false }] };
    const [row] = periodRows([newSignal], "outOfSample", mt)!;
    assert.equal(row.stats?.bets, 30);
    assert.equal(row.holm, 0.4);
    assert.equal(earliestFreeze({ profilesFrozenAt: "2026-10-02", signals: [{ ...newSignal, frozenAt: "2026-10-05" }] }), "2026-10-02");
  });

  it("repère les références même dans un ancien rapport", () => {
    const [row] = fullRows([{ ...oldSignal, key: "tous-sg", description: "Référence : 1 € sur chaque partant" }]);
    assert.equal(row.reference, true);
  });
});

describe("readingOf", () => {
  it("ne conclut jamais sur un petit échantillon ni sans correction", () => {
    assert.equal(readingOf(stats({ bets: 30, roiLow: 0.1, roiHigh: 0.5, roi: 0.3 })).label, "Trop peu de paris");
    assert.equal(readingOf(stats({ roiLow: 0.01, roiHigh: 0.2, roi: 0.1 }), 0.2).label, "Positif, non confirmé après correction");
    assert.equal(readingOf(stats({ roiLow: 0.01, roiHigh: 0.2, roi: 0.1 }), 0.01).tone, "good");
    assert.equal(readingOf(stats({ roiLow: 0.01, roiHigh: 0.2, roi: 0.1 })).label, "Positif, sans correction des tests multiples");
    assert.equal(readingOf(stats({ roiHigh: -0.01 })).label, "Perdant");
    assert.equal(readingOf(null).label, "Aucun pari");
  });
});

describe("calibration logarithmique à l'affichage", () => {
  it("garde le libellé et l'A/E des tranches récentes, tolère les anciennes", () => {
    const [p] = calibrationPoints([{ bucket: 3, label: "4 % à 8 %", announced: 0.05, observed: 0.06, ae: 1.2, n: 500 }]);
    assert.equal(p.label, "4 % à 8 %");
    assert.equal(p.ae, 1.2);
    const [old] = calibrationPoints([{ bucket: 0, announced: 0.05, observed: 0.06, n: 500 }]);
    assert.equal(old.label, undefined);
  });
});

describe("un seul banc de mesure", () => {
  it("les scripts d'évaluation utilisent le retrait de marge de production", () => {
    const scripts = readdirSync("scripts").filter((f) => f.startsWith("evaluate-"));
    for (const file of scripts) {
      const source = readFileSync(`scripts/${file}`, "utf8");
      assert.ok(!/function devig\s*\(/.test(source), `${file} redéfinit devig`);
      if (/\bdevig\(/.test(source)) assert.match(source, /import \{[^}]*\bdevig\b[^}]*\} from "(\.\.\/src\/lib\/probability\.ts|@\/lib\/probability)"/, file);
    }
  });
});
