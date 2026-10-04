import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  DEFAULT_FILTERS,
  DEFAULT_PREFS,
  activeFilterCount,
  adjacentAnchor,
  applyFilters,
  baseOutcome,
  countWith,
  groupByReunion,
  matchesQuery,
  nextUpcoming,
  normalizeText,
  parseDayParam,
  pickFavoriIa,
  sanitizePrefs,
  sortRaces,
  splitPast,
  type PronosticRace,
} from "../src/lib/pronostics-filters";

// 15:30 à Paris le 4 octobre 2026 (heure d'été) = 13:30 UTC.
const NOW = new Date("2026-10-04T13:30:00Z");

function race(extra: Partial<PronosticRace> & Pick<PronosticRace, "reunionNumber" | "courseNumber" | "startTime">): PronosticRace {
  const anchor = `R${extra.reunionNumber}C${extra.courseNumber}`;
  return {
    id: anchor,
    anchor,
    name: "Prix Test",
    raceDate: "2026-10-04",
    racecourse: "Vincennes",
    discipline: "Trot",
    details: "",
    bets: [],
    reading: "ouverte",
    arrival: [1, 2, 3],
    base: { number: 1, name: "Alpha" },
    valueBet: null,
    top3: [{ number: 1, name: "Alpha", winProbability: 20 }],
    favoriIa: null,
    tickets: [],
    moreTickets: 0,
    horses: [
      { number: 1, horse: "Alpha", jockey: "J. Dupont", trainer: "M. Martin", finishPosition: null },
      { number: 2, horse: "Éclair d'Été", jockey: "É. Raffin", trainer: "S. Guarato", finishPosition: null },
    ],
    ...extra,
  };
}

const r1c1 = race({ reunionNumber: 1, courseNumber: 1, startTime: "13:50", horses: [
  { number: 1, horse: "Alpha", jockey: "A", trainer: "B", finishPosition: 3 },
  { number: 2, horse: "Beta", jockey: "A", trainer: "B", finishPosition: 1 },
] });
const r1c4 = race({ reunionNumber: 1, courseNumber: 4, startTime: "15:40", discipline: "Plat", racecourse: "ParisLongchamp", reading: "lisible", top3: [{ number: 1, name: "Alpha", winProbability: 35 }] });
const r2c2 = race({ reunionNumber: 2, courseNumber: 2, startTime: "15:10", bets: ["QUINTE_PLUS"], valueBet: { number: 5, name: "Gamma", valueIndex: 18 } });
const r2c3 = race({ reunionNumber: 2, courseNumber: 3, startTime: "16:20", valueBet: { number: 7, name: "Delta", valueIndex: 25 }, reading: "lisible", top3: [{ number: 7, name: "Delta", winProbability: 22 }] });
const ALL = [r2c3, r1c1, r2c2, r1c4];

describe("parseDayParam", () => {
  it("lit hier, aujourd'hui et demain", () => {
    assert.deepEqual(parseDayParam("hier"), { param: "hier", day: "yesterday" });
    assert.deepEqual(parseDayParam("demain"), { param: "demain", day: "tomorrow" });
    assert.deepEqual(parseDayParam("aujourdhui"), { param: "aujourdhui", day: "today" });
  });
  it("retombe sur aujourd'hui pour toute autre valeur", () => {
    assert.equal(parseDayParam("lundi").day, "today");
    assert.equal(parseDayParam(undefined).day, "today");
    assert.equal(parseDayParam(["hier", "demain"]).day, "today");
  });
});

describe("recherche", () => {
  it("ignore accents et casse", () => {
    assert.equal(normalizeText("  Éclair   d'ÉTÉ "), "eclair d'ete");
    assert.ok(matchesQuery(r1c4, "eclair"));
    assert.ok(matchesQuery(r1c4, "raffin"));
    assert.ok(matchesQuery(r1c4, "GUARATO"));
    assert.ok(matchesQuery(r1c4, "longchamp"));
  });
  it("exige tous les mots", () => {
    assert.ok(matchesQuery(r1c4, "alpha dupont"));
    assert.ok(!matchesQuery(r1c4, "alpha inconnu"));
  });
  it("une recherche vide ne filtre rien", () => {
    assert.ok(matchesQuery(r1c4, "   "));
  });
});

describe("filtres", () => {
  it("discipline, Quinté+, value, lisible", () => {
    assert.deepEqual(applyFilters(ALL, { ...DEFAULT_FILTERS, disciplines: ["Plat"] }, NOW).map((r) => r.anchor), ["R1C4"]);
    assert.deepEqual(applyFilters(ALL, { ...DEFAULT_FILTERS, quinte: true }, NOW).map((r) => r.anchor), ["R2C2"]);
    assert.deepEqual(applyFilters(ALL, { ...DEFAULT_FILTERS, value: true }, NOW).map((r) => r.anchor), ["R2C3", "R2C2"]);
    assert.deepEqual(applyFilters(ALL, { ...DEFAULT_FILTERS, lisible: true }, NOW).map((r) => r.anchor), ["R2C3", "R1C4"]);
  });
  it("à venir exclut les courses parties ou arrivées", () => {
    assert.deepEqual(applyFilters(ALL, { ...DEFAULT_FILTERS, upcoming: true }, NOW).map((r) => r.anchor).sort(), ["R1C4", "R2C3"]);
  });
  it("compte ce que donnerait un filtre de plus", () => {
    assert.equal(countWith(ALL, { ...DEFAULT_FILTERS, value: true }, { lisible: true }, NOW), 1);
    assert.equal(activeFilterCount({ ...DEFAULT_FILTERS, disciplines: ["Plat", "Trot"], quinte: true, query: "x" }), 4);
  });
});

describe("tris", () => {
  it("heure, réunion, value, lisibilité", () => {
    assert.deepEqual(sortRaces(ALL, "heure").map((r) => r.anchor), ["R1C1", "R2C2", "R1C4", "R2C3"]);
    assert.deepEqual(sortRaces(ALL, "reunion").map((r) => r.anchor), ["R1C1", "R1C4", "R2C2", "R2C3"]);
    assert.deepEqual(sortRaces(ALL, "value").map((r) => r.anchor), ["R2C3", "R2C2", "R1C1", "R1C4"]);
    assert.deepEqual(sortRaces(ALL, "lisibilite").map((r) => r.anchor), ["R1C4", "R2C3", "R1C1", "R2C2"]);
  });
  it("ne modifie pas le tableau reçu", () => {
    const copy = [...ALL];
    sortRaces(ALL, "heure");
    assert.deepEqual(ALL, copy);
  });
});

describe("regroupements", () => {
  it("groupe par réunion, courses dans l'ordre", () => {
    const groups = groupByReunion(ALL);
    assert.deepEqual(groups.map((g) => [g.key, g.racecourse, g.races.map((r) => r.courseNumber)]), [
      ["R1", "Vincennes", [1, 4]],
      ["R2", "Vincennes", [2, 3]],
    ]);
  });
  it("sépare les courses passées et trouve la suivante", () => {
    const { active, past } = splitPast(ALL, NOW);
    assert.deepEqual(past.map((r) => r.anchor), ["R1C1", "R2C2"]);
    assert.deepEqual(active.map((r) => r.anchor).sort(), ["R1C4", "R2C3"]);
    assert.equal(nextUpcoming(ALL, NOW)?.anchor, "R1C4");
    assert.equal(nextUpcoming(ALL, new Date("2026-10-04T20:00:00Z")), null);
  });
  it("navigue d'une ancre à l'autre sans sortir de la liste", () => {
    const anchors = ["R1C1", "R1C4", "R2C2"];
    assert.equal(adjacentAnchor(anchors, "R1C4", 1), "R2C2");
    assert.equal(adjacentAnchor(anchors, "R2C2", 1), "R2C2");
    assert.equal(adjacentAnchor(anchors, "R1C1", -1), "R1C1");
    assert.equal(adjacentAnchor(anchors, null, 1), "R1C1");
    assert.equal(adjacentAnchor(anchors, null, -1), "R2C2");
    assert.equal(adjacentAnchor([], null, 1), null);
  });
});

describe("baseOutcome", () => {
  const withPositions = (positions: Array<number | null>, base = 1) =>
    race({ reunionNumber: 1, courseNumber: 1, startTime: "12:00", base: { number: base, name: "x" }, horses: positions.map((p, i) => ({ number: i + 1, horse: "", jockey: "", trainer: "", finishPosition: p })) });
  it("gagnante, placée, non placée selon la place officielle", () => {
    assert.equal(baseOutcome(withPositions([1, 2, 3])), "gagnante");
    assert.equal(baseOutcome(withPositions([3, 1, 2])), "placee");
    assert.equal(baseOutcome(withPositions([5, 1, 2])), "perdue");
  });
  it("n'invente rien sans arrivée ou sans place", () => {
    assert.equal(baseOutcome(withPositions([null, null])), "en-attente");
    assert.equal(baseOutcome(withPositions([null, 1, 2])), "hors-arrivee");
    assert.equal(baseOutcome({ ...withPositions([1, 2]), base: null }), "sans-base");
  });
});

describe("pickFavoriIa", () => {
  it("retient le plus grand écart IA − marché parmi les favoris IA", () => {
    const favori = pickFavoriIa([
      { number: 1, horse: "Accord", odds: 4, fundamentalProbability: 22, marketProbability: 21 },
      { number: 2, horse: "Petit écart", odds: 9, fundamentalProbability: 16, marketProbability: 10 },
      { number: 3, horse: "Grand écart", odds: 12, fundamentalProbability: 20, marketProbability: 8 },
      { number: 4, horse: "Marché", odds: 2, fundamentalProbability: 15, marketProbability: 35 },
    ]);
    assert.deepEqual(favori, { number: 3, name: "Grand écart", ai: 20, market: 8 });
  });
  it("aucun favori sans cote publiée", () => {
    assert.equal(pickFavoriIa([{ number: 1, horse: "x", odds: NaN, fundamentalProbability: 30, marketProbability: 5 }]), null);
  });
});

describe("sanitizePrefs", () => {
  it("retombe sur les valeurs par défaut", () => {
    assert.deepEqual(sanitizePrefs(null), DEFAULT_PREFS);
    assert.deepEqual(sanitizePrefs("x"), DEFAULT_PREFS);
  });
  it("garde les champs valides, écarte les autres", () => {
    const prefs = sanitizePrefs({ sort: "value", view: "compacte", filters: { disciplines: ["Trot", "Galop"], quinte: true, value: "oui", query: 42 } });
    assert.equal(prefs.sort, "value");
    assert.equal(prefs.view, "compacte");
    assert.deepEqual(prefs.filters, { ...DEFAULT_FILTERS, disciplines: ["Trot"], quinte: true });
    assert.equal(sanitizePrefs({ sort: "hasard" }).sort, "heure");
  });
});
