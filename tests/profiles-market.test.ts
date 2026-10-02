import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { moneyFlow, oddsMovement } from "../src/lib/market";
import { classifyField, raceVerdict, type ProfileInput } from "../src/lib/profiles";
import { instantDepart } from "../src/lib/paris-time";

function horse(number: number, odds: number, win: number, top3: number, market: number, ai: number): ProfileInput {
  return { number, odds, winProbability: win, top3Probability: top3, marketProbability: market, fundamentalProbability: ai };
}

describe("classifyField", () => {
  const field = [
    horse(1, 2.2, 38, 72, 38, 40), // base (rang 1, Top 3 ≥ 45 %, IA ≥ marché)
    horse(2, 4.5, 18, 50, 18, 15), // favori (rang 2, mais l'IA moins confiante que le marché)
    horse(3, 14, 6, 22, 6, 17), // caché (14/1, 2e de l'IA, IA ≈ 2,8 × marché)
    horse(4, 7, 11, 35, 11, 16.5), // value (< 10/1, IA = 1,5 × marché)
    horse(5, 12, 7, 25, 7, 7.5), // outsider (8-25/1, IA ≥ marché)
    horse(6, 40, 2, 8, 2, 2.5), // tocard
    horse(7, 30, 2.5, 9, 2.5, 1), // à éviter (IA < 3 % et < 0,7 × marché)
    horse(8, 7.5, 9, 30, 9, 8), // second plan
  ];
  const profiled = classifyField(field);
  const of = (n: number) => profiled.find((p) => p.number === n)!.profile;

  it("attribue un profil unique selon l'ordre publié", () => {
    assert.equal(of(1), "base");
    assert.equal(of(2), "favori");
    assert.equal(of(3), "cache");
    assert.equal(of(4), "value");
    assert.equal(of(5), "outsider");
    assert.equal(of(6), "tocard");
    assert.equal(of(7), "eviter");
    assert.equal(of(8), "second");
  });

  it("classe dans l'ordre des probabilités affichées", () => {
    assert.deepEqual(profiled.map((p) => p.number).slice(0, 3), [1, 2, 4]);
    assert.deepEqual(profiled.map((p) => p.rank), [1, 2, 3, 4, 5, 6, 7, 8]);
  });

  it("le verdict ne cite que des chevaux de la classification", () => {
    const verdict = raceVerdict(field, profiled);
    assert.equal(verdict.reading, "lisible");
    assert.deepEqual(verdict.bases, [1]);
    assert.deepEqual(verdict.hidden, [3]);
    assert.match(verdict.sentence, /base : n° 1/);
    assert.match(verdict.sentence, /caché à 14\/1 \(n° 3\)/);
  });

  it("ne déclare pas caché une grosse cote que l'IA ne place pas dans ses 3 premiers", () => {
    const longshot = [...field, horse(9, 80, 1, 4, 1, 2.5)];
    assert.notEqual(classifyField(longshot).find((p) => p.number === 9)!.profile, "cache");
  });

  it("lit la course selon la concentration des probabilités", () => {
    const flat = field.map((h) => ({ ...h, winProbability: 12 }));
    assert.equal(raceVerdict(flat).reading, "piege");
  });

  it("sans cote, aucun cheval n'est déclaré caché ni à éviter", () => {
    const blind = field.map((h) => ({ ...h, odds: NaN, marketProbability: null }));
    const profiles = classifyField(blind).map((p) => p.profile);
    assert.ok(!profiles.includes("cache"));
    assert.ok(!profiles.includes("eviter"));
  });
});

describe("oddsMovement", () => {
  const points = [
    { t: "2026-10-01T18:00:00.000Z", odds: 9 }, // veille
    { t: "2026-10-02T07:00:00.000Z", odds: 8 }, // matin du jour
    { t: "2026-10-02T11:00:00.000Z", odds: 6 },
  ];

  it("prend le premier relevé du jour de la course comme référence", () => {
    const m = oddsMovement(points, 6, "2026-10-02");
    assert.equal(m.reference, 8);
    assert.equal(Math.round(m.changePct!), -25);
    assert.equal(m.direction, "joue");
  });

  it("tient une variation sous 10 % pour du bruit", () => {
    assert.equal(oddsMovement(points, 8.5, "2026-10-02").direction, "stable");
  });

  it("dit « inconnu » sans relevé", () => {
    assert.equal(oddsMovement([], 5, "2026-10-02").direction, "inconnu");
  });
});

describe("moneyFlow", () => {
  const pools = [
    { t: "2026-10-02T12:00:00.000Z", numbers: [1, 2], win: [20, 10] },
    { t: "2026-10-02T12:10:00.000Z", numbers: [1, 2], win: [21, 11] },
    { t: "2026-10-02T12:16:00.000Z", numbers: [1, 2], win: [24, 9] },
  ];

  it("mesure la variation de part sur 15 et 5 minutes", () => {
    const f = moneyFlow(pools, 1);
    assert.equal(f.share, 24);
    assert.equal(f.delta15, 4);
    assert.equal(f.delta5, 3);
    assert.equal(f.strong, true);
  });

  it("ne déclare pas d'argent fort sur une part en baisse", () => {
    assert.equal(moneyFlow(pools, 2).strong, false);
  });
});

describe("instantDepart", () => {
  it("convertit une heure de Paris en instant UTC, été comme hiver", () => {
    assert.equal(instantDepart("2026-07-14", "15:30")?.toISOString(), "2026-07-14T13:30:00.000Z");
    assert.equal(instantDepart("2026-12-14", "15:30")?.toISOString(), "2026-12-14T14:30:00.000Z");
  });
});
