import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { predictionIndicative } from "../src/lib/odds-freshness";
import { goingFromCourse, participantOdds, participantOddsWithSource } from "../src/lib/pmu/client";
import { connectionStatsAt, raceHasStarted, type ConnectionStatsRow } from "../src/lib/point-in-time";
import { probableArrivalScore } from "../src/lib/prediction-math";
import type { HorsePrediction } from "../src/lib/types";

const row: ConnectionStatsRow = {
  jockey_runs: 500,
  jockey_wins: 90,
  trainer_runs: 200,
  trainer_wins: 30,
  jockey_runs_pre: null,
  jockey_wins_pre: null,
  trainer_runs_pre: null,
  trainer_wins_pre: null,
};

describe("connectionStatsAt — statistiques à l'instant de la course", () => {
  it("course à venir sans valeur figée : totaux courants", () => {
    assert.deepEqual(connectionStatsAt(row, false), { jockeyRuns: 500, jockeyWins: 90, trainerRuns: 200, trainerWins: 30 });
  });

  it("course passée sans valeur figée : rien (pas de fuite de l'avenir)", () => {
    assert.deepEqual(connectionStatsAt(row, true), { jockeyRuns: null, jockeyWins: null, trainerRuns: null, trainerWins: null });
  });

  it("valeur figée : elle fait foi, course passée ou non", () => {
    const frozen = { ...row, jockey_runs_pre: 480, jockey_wins_pre: 85, trainer_runs_pre: 190, trainer_wins_pre: 29 };
    for (const started of [false, true]) {
      assert.deepEqual(connectionStatsAt(frozen, started), { jockeyRuns: 480, jockeyWins: 85, trainerRuns: 190, trainerWins: 29 });
    }
  });

  it("jockey figé, entraîneur non : chacun sa règle", () => {
    const partial = { ...row, jockey_runs_pre: 10, jockey_wins_pre: 1 };
    assert.deepEqual(connectionStatsAt(partial, true), { jockeyRuns: 10, jockeyWins: 1, trainerRuns: null, trainerWins: null });
  });
});

describe("raceHasStarted", () => {
  const now = new Date("2026-10-06T12:00:00Z"); // 14:00 à Paris

  it("arrivée publiée : partie", () => {
    assert.equal(raceHasStarted({ raceDate: "2026-10-07", startTime: "15:00" }, true, now), true);
  });

  it("selon l'heure de Paris", () => {
    assert.equal(raceHasStarted({ raceDate: "2026-10-06", startTime: "13:59" }, false, now), true);
    assert.equal(raceHasStarted({ raceDate: "2026-10-06", startTime: "14:30" }, false, now), false);
  });

  it("heure illisible : selon la date", () => {
    assert.equal(raceHasStarted({ raceDate: "2026-10-05", startTime: "??" }, false, now), true);
    assert.equal(raceHasStarted({ raceDate: "2026-10-06", startTime: "??" }, false, now), false);
  });
});

describe("predictionIndicative", () => {
  it("cotes directes fraîches : pronostic normal", () => {
    assert.equal(predictionIndicative({ minutesToStart: 45, oddsAgeMinutes: 5, sources: ["direct", "direct", "direct"] }), null);
  });

  it("majorité de cotes probables : indicatif", () => {
    assert.equal(predictionIndicative({ minutesToStart: 600, oddsAgeMinutes: 5, sources: ["probable", "probable", "direct"] }), "cotes-probables");
  });

  it("majorité de cotes de référence : indicatif", () => {
    assert.equal(predictionIndicative({ minutesToStart: 600, oddsAgeMinutes: 5, sources: ["reference", "reference", "direct"] }), "cotes-reference");
  });

  it("cote de plus de 30 min à moins de 2 h du départ : indicatif", () => {
    assert.equal(predictionIndicative({ minutesToStart: 90, oddsAgeMinutes: 31, sources: ["direct"] }), "cotes-anciennes");
    assert.equal(predictionIndicative({ minutesToStart: 90, oddsAgeMinutes: null, sources: [] }), "cotes-anciennes");
  });

  it("cote ancienne mais départ lointain : pas d'alerte d'âge", () => {
    assert.equal(predictionIndicative({ minutesToStart: 300, oddsAgeMinutes: 240, sources: ["direct"] }), null);
  });

  it("origines inconnues (historique) : ignorées", () => {
    assert.equal(predictionIndicative({ minutesToStart: 300, oddsAgeMinutes: 5, sources: [null, undefined, null] }), null);
  });

  it("course partie : jamais indicatif", () => {
    assert.equal(predictionIndicative({ minutesToStart: -1, oddsAgeMinutes: 90, sources: ["probable"] }), null);
    assert.equal(predictionIndicative({ minutesToStart: null, oddsAgeMinutes: 90, sources: ["probable"] }), null);
  });
});

describe("participantOddsWithSource", () => {
  it("même cote que participantOdds, avec son origine", () => {
    const direct = { numPmu: 1, dernierRapportDirect: { rapport: 4.5 }, rapportProbable: 8 };
    assert.deepEqual(participantOddsWithSource(direct), { odds: participantOdds(direct), source: "direct" });
    assert.deepEqual(participantOddsWithSource({ numPmu: 2, dernierRapportReference: { rapport: 6 } }), { odds: 6, source: "reference" });
    assert.deepEqual(participantOddsWithSource({ numPmu: 3, rapportProbable: 9 }), { odds: 9, source: "probable" });
    assert.deepEqual(participantOddsWithSource({ numPmu: 4 }), { odds: 0, source: null });
  });
});

describe("réduction kilométrique — plus de repli sur le chrono de la course", () => {
  const horse = (number: number, extra: Partial<HorsePrediction> = {}): HorsePrediction => ({
    id: `h${number}`,
    number,
    horse: `Cheval ${number}`,
    jockey: "J",
    trainer: "T",
    odds: 5 + number,
    fairOdds: 6,
    marketEdge: 0,
    winProbability: 15,
    top3Probability: 40,
    top5Probability: 60,
    kzScore: 50,
    valueIndex: 0,
    confidence: "Moyenne",
    factors: [],
    music: "1a2a3a",
    ...extra,
  });
  const context = { discipline: "Trot" as const, distance: "2700" };

  it("`reduction_km` (chrono réalisé après l'arrivée) n'influence plus le score", () => {
    const without = [horse(1), horse(2)];
    const withRaceTime = [horse(1, { reductionKm: "70000" }), horse(2, { reductionKm: "79000" })];
    assert.equal(probableArrivalScore(withRaceTime[0], withRaceTime, context), probableArrivalScore(without[0], without, context));
  });

  it("`speed_figure` (relevée avant le départ) reste lue", () => {
    const fast = [horse(1, { speedFigure: 70000 }), horse(2)];
    const plain = [horse(1), horse(2)];
    assert.notEqual(probableArrivalScore(fast[0], fast, context), probableArrivalScore(plain[0], plain, context));
  });
});

describe("goingFromCourse", () => {
  it("lit le pénétromètre de la course", () => {
    assert.equal(goingFromCourse({ penetrometre: { intitule: "Très souple" } }), "Très souple");
    assert.equal(goingFromCourse({ penetrometre: { intitule: " " } }), null);
    assert.equal(goingFromCourse({}), null);
    assert.equal(goingFromCourse(null), null);
  });
});
