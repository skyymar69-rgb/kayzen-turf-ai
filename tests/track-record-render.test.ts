import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { Report, ReportSignal } from "../src/app/track-record/report-types";
import { TrackRecordBody } from "../src/components/track/track-record-body";

const base = { bets: 420, hitRate: 0.31, roi: -0.08, roiLow: -0.15, roiHigh: -0.01 };
const signal = (key: string, extra: Partial<ReportSignal> = {}): ReportSignal => ({
  key,
  label: key === "tous-sg" ? "Tous les partants" : "N° 1 de la sélection",
  betType: key.endsWith("sp") ? "SP" : "SG",
  description: key === "tous-sg" ? "Référence : 1 € gagnant sur chaque partant" : "Simple placé sur le premier",
  daily: [
    ["2026-09-01", 10, 10, 9],
    ["2026-09-02", 10, 20, 17],
  ],
  ...base,
  ...extra,
});

/** Rapport tel qu'enregistré avant le découpage hors échantillon. */
const oldReport: Report = {
  generatedAt: "2026-10-07T23:30:00Z",
  modelVersion: "m",
  fundamentalVersion: "f",
  profilesVersion: "profils-v2",
  period: { from: "2026-06-01", to: "2026-10-06" },
  rules: { decisionOddsLeadMinutes: 15, payouts: "rapports", stake: "1 €", outOfSample: "modèle" },
  racesConsidered: 100,
  racesEvaluated: 90,
  racesWithPayouts: 80,
  oddsAgeMinutes: { median: 40, p25: 20, p75: 90, within30: 0.4 },
  accuracy: { winnerFoundShown: 30, top3HitsPerRace: 1.3, byModel: [] },
  calibration: [{ bucket: 0, announced: 0.05, observed: 0.04, n: 900 }],
  signals: [signal("rank1-sp"), signal("tous-sg")],
  live: { since: "2026-09-20T10:00:00Z", races: 40, signals: [signal("rank1-sp")] },
};

const mt = {
  method: "Holm",
  alpha: 0.05,
  tested: 21,
  survivors: [],
  primary: { key: "rank1-sp", pValue: 0.6, significant: false },
  rows: [{ key: "rank1-sp", pValue: 0.6, holm: 1, bh: 1, significant: false }],
};

const newReport: Report = {
  ...oldReport,
  rules: { ...oldReport.rules, closingOdds: "dernier relevé avant le départ", multipleTesting: "Holm" },
  profilesFrozenAt: "2026-10-02",
  primarySignal: "rank1-sp",
  calibration: [{ bucket: 3, label: "4 % à 8 %", announced: 0.05, observed: 0.045, ae: 0.9, n: 900 }],
  calibrationScheme: "log2",
  oddsBands: [{ label: "Moins de 3/1", n: 300, wins: 110, aeMarket: 1.01, aeModel: 0.98, roiSG: -0.12 }],
  monthlyLogLoss: [{ month: "2026-09", races: 500, model: 2.2, market: 2.05, blend: 2.04 }],
  signals: [
    signal("rank1-sp", {
      frozenAt: "2026-10-02",
      inSample: { ...base, roi: 0.02 },
      outOfSample: { ...base, bets: 25, clv: { n: 20, mean: 0.03, median: 0.01, positiveShare: 0.6 }, maxDrawdown: 6, longestLosingStreak: 4 },
      byDiscipline: [{ group: "Trot", bets: 200, hitRate: 0.3, roi: -0.05, roiLow: -0.1, roiHigh: 0 }],
    }),
    signal("tous-sg", { frozenAt: "2026-10-02", reference: true, inSample: base, outOfSample: null }),
  ],
  multipleTesting: { outOfSample: mt, inSample: mt },
  tickets: {
    races: 80,
    frozenAt: "2026-10-02",
    rows: [{ key: "propose-TRIO", label: "Ticket proposé · Trio", source: "propose", betType: "TRIO", ...base, staked: 420, outOfSample: null }],
    unpriceable: [{ label: "Quinté+", reason: "rapports non conservés" }],
  },
  live: { ...oldReport.live!, multipleTesting: mt },
};

describe("page /track-record", () => {
  it("affiche un ancien rapport en signalant les indicateurs à venir", () => {
    const html = renderToStaticMarkup(createElement(TrackRecordBody, { report: oldReport }));
    assert.match(html, /disponible au prochain calcul/);
    assert.match(html, /période complète, dont la période d&#x27;ajustement/);
    assert.match(html, /déciles linéaires/);
  });

  it("met le hors échantillon en tête et publie les nouveaux indicateurs", () => {
    const html = renderToStaticMarkup(createElement(TrackRecordBody, { report: newReport }));
    assert.ok(html.indexOf("Hors échantillon — depuis le gel des règles") < html.indexOf("Période d&#x27;ajustement — dans l&#x27;échantillon"));
    assert.match(html, /21 signaux testés/);
    assert.match(html, /Aucun signal ne reste significatif après correction/);
    assert.match(html, /Trop peu de paris/);
    assert.match(html, /Ticket proposé · Trio/);
    assert.match(html, /4 % à 8 %/);
    assert.match(html, /60 % positives/);
    assert.doesNotMatch(html, /disponible au prochain calcul/);
  });
});
