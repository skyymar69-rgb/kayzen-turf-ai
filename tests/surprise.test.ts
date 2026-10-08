import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  SURPRISE_MAX_PER_RACE,
  aiRanks,
  formReading,
  scoreField,
  shrunkRate,
  surpriseKind,
  surpriseLevel,
  surpriseScore,
  topSurprises,
  type SurpriseInput,
} from "../src/lib/surprise";

const base: SurpriseInput = { number: 1, odds: 12, ai: 12, market: 6, music: "1a2a3a4a5a", jockeyWins: 20, jockeyRuns: 100, trainerWins: 20, trainerRuns: 100 };

describe("formReading", () => {
  it("compte victoires, podiums et incidents sur cinq courses", () => {
    const f = formReading("1a2aDa5a0a7a1a");
    assert.equal(f.known, 5);
    assert.equal(f.wins, 1);
    assert.equal(f.places, 2);
    assert.equal(f.incidents, 1);
    // 4 + 3 − 2 + 1 + 0
    assert.equal(f.points, 6);
  });

  it("ignore le marqueur d'année et plafonne à 15 points", () => {
    assert.equal(formReading("1a(25)1a1a1a1a").points, 15);
  });

  it("donne une note neutre sans musique", () => {
    assert.equal(formReading(null).points, 5);
    assert.equal(formReading("").known, 0);
  });
});

describe("shrunkRate", () => {
  it("ramène un petit échantillon vers la moyenne", () => {
    assert.ok(shrunkRate(3, 5) < 0.2);
    assert.ok(Math.abs(shrunkRate(0, 0) - 0.09) < 1e-9);
  });
});

describe("surpriseScore", () => {
  it("reste entre 0 et 100 et additionne ses briques", () => {
    const s = surpriseScore({ ...base, movement: { direction: "joue", changePct: -60 }, signals: ["argent", "acceleration", "smart"] }, 1);
    assert.ok(s.score >= 0 && s.score <= 100);
    const sum = Object.values(s.parts).reduce((a, b) => a + b, 0);
    assert.ok(Math.abs(sum - s.score) <= 0.5);
  });

  it("donne plus de points d'écart à 3 fois 12 % qu'à 3 fois 1 %", () => {
    const strong = surpriseScore({ ...base, ai: 12, market: 4 }, 3);
    const weak = surpriseScore({ ...base, ai: 1, market: 1 / 3 }, 3);
    assert.ok(strong.parts.value > weak.parts.value);
  });

  it("ne signale pas un cheval que l'IA ne voit pas au-dessus du marché", () => {
    const s = surpriseScore({ ...base, ai: 6, market: 6 }, 1);
    assert.equal(s.alert, null);
  });

  it("ne signale pas le favori du marché", () => {
    const s = surpriseScore({ ...base, odds: 2.5, ai: 60, market: 35 }, 1);
    assert.equal(s.alert, null);
  });

  it("ne signale jamais un non-partant", () => {
    const s = surpriseScore({ ...base, nonRunner: true }, 1);
    assert.equal(s.score, 0);
    assert.equal(s.alert, null);
  });

  it("type l'alerte selon la cote", () => {
    assert.equal(surpriseKind(6), "value");
    assert.equal(surpriseKind(15), "surprise");
    assert.equal(surpriseKind(45), "tocard");
  });

  it("ne signale un tocard qu'au niveau fort", () => {
    // Note « possible » : le tocard descend à « à surveiller ».
    const s = surpriseScore({ ...base, odds: 40, ai: 4, market: 2.4, music: "3a4a5a6a7a" }, 4);
    if (s.alert) assert.notEqual(s.alert.level, "possible");
  });

  it("classe les niveaux par seuils", () => {
    assert.equal(surpriseLevel(90), "forte");
    assert.equal(surpriseLevel(60), "possible");
    assert.equal(surpriseLevel(47), "surveiller");
    assert.equal(surpriseLevel(10), null);
  });

  it("explique d'abord l'écart avec le marché", () => {
    const s = surpriseScore(base, 2);
    assert.match(s.reasons[0], /Sous-estimé par le marché/);
    assert.ok(s.conclusion === null || typeof s.conclusion === "string");
  });

  it("dit quand le cheval est délaissé, sans l'exclure", () => {
    const s = surpriseScore({ ...base, movement: { direction: "delaisse", changePct: 56 } }, 2);
    assert.ok(s.reasons.some((r) => r.startsWith("Délaissé")));
    assert.ok(s.parts.marche > 0);
  });
});

describe("scoreField", () => {
  it("lit le rang de l'IA à l'échelle de la course", () => {
    const ranks = aiRanks([
      { number: 1, ai: 10 },
      { number: 2, ai: 30 },
      { number: 3, ai: null },
      { number: 4, ai: 20, nonRunner: true },
    ]);
    assert.equal(ranks.get(2), 1);
    assert.equal(ranks.get(1), 2);
    assert.equal(ranks.has(3), false);
    assert.equal(ranks.has(4), false);
  });

  it(`garde au plus ${SURPRISE_MAX_PER_RACE} alertes fortes ou possibles par course`, () => {
    const field: SurpriseInput[] = Array.from({ length: 8 }, (_, i) => ({ ...base, number: i + 1, odds: 6 + i, ai: 14, market: 5, movement: { direction: "joue", changePct: -50 }, signals: ["smart", "argent"] }));
    const scored = [...scoreField(field).values()];
    const strong = scored.filter((s) => s.alert && s.alert.level !== "surveiller");
    assert.ok(strong.length <= SURPRISE_MAX_PER_RACE);
  });
});

describe("topSurprises", () => {
  it("écarte les simples « à surveiller » et trie par niveau puis note", () => {
    const mk = (n: number, score: number, level: "forte" | "possible" | "surveiller" | null) => ({
      n,
      surprise: { score, parts: { value: 0, ia: 0, forme: 0, entourage: 0, marche: 0 }, ratio: 2, aiRank: 1, alert: level ? { kind: "value" as const, level } : null, reasons: [], conclusion: null },
    });
    const top = topSurprises([mk(1, 60, "possible"), mk(2, 50, "surveiller"), mk(3, 80, "forte"), mk(4, 70, null)], 3);
    assert.deepEqual(top.map((x) => x.n), [3, 1]);
  });
});

describe("daySurprises", () => {
  it("garde une surprise par course au plus, courses à venir d'abord", async () => {
    const { daySurprises } = await import("../src/lib/home/surprises");
    const { getRaces } = await import("../src/lib/race-repository");
    const races = await getRaces({});
    const picks = daySurprises(races, 3);
    assert.ok(picks.length <= 3);
    assert.equal(new Set(picks.map((p) => p.race.id)).size, picks.length);
    for (const p of picks) assert.ok(p.row.surprise.alert && p.row.surprise.alert.level !== "surveiller");
    const firstFinished = picks.findIndex((p) => p.finished);
    if (firstFinished !== -1) assert.ok(picks.slice(firstFinished).every((p) => p.finished));
  });
});

describe("surpriseNumbers (backtest)", () => {
  it("signale les mêmes chevaux que la page, sans « à surveiller »", async () => {
    const { surpriseNumbers } = await import("../scripts/lib/backtest-signals");
    const runner = (number: number, odds: number, ai: number, market: number) => ({
      number, odds, ai, market, morning: odds * 1.5, pools: [], music: "1a1a2a3a1a", jockeyWins: 30, jockeyRuns: 100, trainerWins: 30, trainerRuns: 100,
    });
    const numbers = surpriseNumbers([runner(1, 2, 30, 45), runner(2, 8, 25, 10), runner(3, 60, 1, 1.5)]);
    assert.deepEqual(numbers, [2]);
  });
});
