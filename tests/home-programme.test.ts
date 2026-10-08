import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { adjacentDay, dateForDay, formatRelativeDay, formatShortDate, racesOfDay } from "../src/lib/home/days";
import {
  buildDayInsights,
  featuredRace,
  groupRacesByMeeting,
  meetingDifficulty,
  meetingScore,
  meetingStrategy,
  racePriorityScore,
  gapRaceCount,
} from "../src/lib/home/meetings";
import { raceOpportunity, raceStatusAt, selectTimelineRace, sortByStart, startMinutes, statusLabel } from "../src/lib/home/race-signals";
import type { BetOffer } from "../src/lib/types";
import { clearField, horse, openField, race } from "./home-fixtures";

const offer = (type: string, audience: string | null = null) => ({ type, audience }) as BetOffer;

describe("jours du programme", () => {
  it("libellés et date courte", () => {
    assert.equal(formatRelativeDay("yesterday"), "Hier");
    assert.equal(formatRelativeDay("today"), "Aujourd'hui");
    assert.equal(formatShortDate("2026-10-04"), "04/10");
  });

  it("date d'un jour : celle des courses, sinon calculée à Paris", () => {
    const races = [race("a", { relativeDay: "tomorrow", raceDate: "2026-10-05" })];
    assert.equal(dateForDay(races, "tomorrow"), "2026-10-05");
    // 23 h 30 UTC le 4 = 1 h 30 le 5 à Paris : « hier » est donc le 4.
    assert.equal(dateForDay([], "yesterday", new Date("2026-10-04T23:30:00Z")), "2026-10-04");
  });

  it("courses d'un jour par réunion puis course, sans réordonner l'entrée", () => {
    const input = [race("b", { reunionNumber: 2, courseNumber: 1 }), race("a", { reunionNumber: 1, courseNumber: 2 }), race("x", { relativeDay: "tomorrow" })];
    assert.deepEqual(racesOfDay(input, "today").map((r) => r.id), ["a", "b"]);
    assert.equal(input[0].id, "b");
  });

  it("jour voisin pour les flèches", () => {
    assert.equal(adjacentDay("today", 1), "tomorrow");
    assert.equal(adjacentDay("yesterday", -1), null);
  });
});

describe("réunions", () => {
  const races = [
    race("r2c1", { reunionNumber: 2, courseNumber: 1 }),
    race("r1c2", { reunionNumber: 1, courseNumber: 2, betTypes: [offer("QUINTE_PLUS")] }),
    race("r1c1", { reunionNumber: 1, courseNumber: 1, betTypes: [offer("QUARTE_PLUS", "REGIONAL"), offer("QUINTE_PLUS")] }),
  ];

  it("regroupe par réunion, trie réunions et courses", () => {
    const meetings = groupRacesByMeeting(races);
    assert.deepEqual(meetings.map((m) => m.reunionNumber), [1, 2]);
    assert.deepEqual(meetings[0].races.map((r) => r.id), ["r1c1", "r1c2"]);
    assert.deepEqual(meetings[0].highlights, ["QUINTE_PLUS", "QUARTE_PLUS"]);
    assert.deepEqual(meetings[0].specialties, ["Attelé"]);
  });

  it("score, difficulté et stratégie", () => {
    const easy = [race("a", { modelConsensus: 70, raceQualityScore: 70, marketVolatility: 10 })];
    assert.equal(racePriorityScore(easy[0]), 130);
    assert.equal(meetingScore(easy), 100);
    assert.equal(meetingDifficulty(100, easy), "Facile");
    assert.equal(meetingStrategy(100, easy), "Bases simples et couples");
    const spec = [race("b", { riskLevel: "Speculatif" })];
    assert.equal(meetingDifficulty(60, spec), "Complexe");
    assert.equal(meetingScore([]), 0);
  });

  // Les courses se comptent à l'écart IA / marché (≥ 4 points), plus à
  // l'indice value, calculé contre une cote finale où il est négatif partout.
  it("compte les courses à écart IA / marché d'une réunion", () => {
    const withGap = race("v", { horses: [horse(1, { fundamentalProbability: 15, marketProbability: 9 }), horse(2)] });
    const valueOnly = race("w", { horses: [horse(1, { valueIndex: 15 }), horse(2)] });
    assert.equal(gapRaceCount({ races: [withGap, valueOnly, race("n")] }), 1);
  });
});

describe("indicateurs du jour", () => {
  it("lit les courses à partir des profils et retient la course phare", () => {
    const strong = race("fort", { raceQualityScore: 90, horses: [...clearField().slice(0, 7), horse(8, { fundamentalProbability: 16, marketProbability: 6 })] });
    const trap = race("piege", { horses: openField() });
    const insights = buildDayInsights([trap, strong]);
    assert.equal(insights.readable, 1);
    assert.equal(insights.traps, 1);
    assert.equal(insights.gapRaces, 1);
    assert.equal(insights.nextPriority?.id, "fort");
    assert.equal(insights.bestAlert, "Écart IA / marché fort");
    assert.equal(featuredRace([trap, strong])?.id, "fort");
    assert.equal(buildDayInsights([]).bestAlert, "En attente");
  });
});

describe("signaux et ligne du temps", () => {
  it("heure illisible repoussée en fin de journée", () => {
    assert.equal(startMinutes("15h30"), 930);
    assert.equal(startMinutes("??"), 1440);
  });

  it("trie par heure sans modifier l'entrée", () => {
    const input = [race("b", { startTime: "16:00" }), race("a", { startTime: "13:00" })];
    assert.deepEqual(sortByStart(input).map((r) => r.id), ["a", "b"]);
    assert.equal(input[0].id, "b");
  });

  it("course active : la prochaine, sinon la première", () => {
    const input = [race("a", { startTime: "13:00" }), race("b", { startTime: "16:00" }), race("c", { startTime: "14:30" })];
    assert.equal(selectTimelineRace(input, 14 * 60)?.id, "c");
    assert.equal(selectTimelineRace(input, 23 * 60)?.id, "a");
    assert.equal(selectTimelineRace(input, -1)?.id, "a");
  });

  it("état sans horloge : seule l'arrivée publiée fait foi", () => {
    assert.equal(raceStatusAt(race("a"), null), "a-venir");
    const arrived = race("b", { horses: clearField().map((h) => ({ ...h, finishPosition: h.number })) });
    assert.equal(raceStatusAt(arrived, null), "arrivee");
    assert.equal(raceStatusAt(race("c", { startTime: "15:00" }), new Date("2026-10-04T12:50:00Z")), "imminente");
  });

  it("libellé d'état", () => {
    assert.equal(statusLabel("imminente", "15:00"), "Départ imminent 15:00");
    assert.equal(statusLabel("arrivee", "15:00"), "Arrivée disponible");
    assert.equal(statusLabel("partie", "15:00"), "Départ à 15:00");
  });

  it("signal IA : cotes à venir, favori fragile, base à surveiller", () => {
    assert.equal(raceOpportunity(race("a", { oddsAvailable: false })), "Cotes à venir — base #1");
    const fragile = race("f", { horses: clearField().map((h) => (h.number === 1 ? { ...h, top3Probability: 30 } : h)) });
    assert.equal(raceOpportunity(fragile), "Favori fragile #1");
    assert.equal(raceOpportunity(race("s")), "À surveiller #1");
    const gap = race("g", { horses: [...clearField().slice(0, 4), horse(5, { odds: 9, top3Probability: 30, fundamentalProbability: 14, marketProbability: 8 }), ...clearField().slice(5)] });
    // Le marché est recalculé depuis la cote (9/1) par la calibration : seuls le numéro et le signe sont fixés.
    assert.match(raceOpportunity(gap), /^Écart IA \/ marché #5 \(\+[\d,]+ pts\)$/);
    assert.equal(raceOpportunity(race("vide", { horses: [] })), "Signal indisponible");
  });
});
