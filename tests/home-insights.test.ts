import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { HOME_BLOCKS, parseHiddenBlocks, serializeHiddenBlocks, toggleHiddenBlock } from "../src/lib/home/blocks";
import { buildDaySummary } from "../src/lib/home/day-summary";
import { followedRunners } from "../src/lib/home/followed";
import { racePeek } from "../src/lib/home/race-peek";
import { buildTimeline, formatMinute } from "../src/lib/home/timeline";
import { buildYesterdayReport, outcomeOf } from "../src/lib/home/yesterday";
import { clearField, horse, openField, race } from "./home-fixtures";

describe("résumé du jour", () => {
  it("vide sans course", () => {
    assert.deepEqual(buildDaySummary([]).sentences, []);
  });

  it("courses lisibles, course piège la plus fournie, meilleure value", () => {
    const lisible = race("l", { programCode: "R1C1", horses: [...clearField().slice(0, 7), horse(8, { valueIndex: 22, horse: "BELLE VALUE" })] });
    const petitPiege = race("p1", { programCode: "R1C2", name: "PRIX COURT", horses: openField(10) });
    const grandPiege = race("p2", { programCode: "R2C4", name: "PRIX LONG", horses: openField(14) });
    const [first, second, third] = buildDaySummary([lisible, petitPiege, grandPiege]).sentences;
    assert.equal(first, "1 course sur 3 se lit avec une base nette.");
    assert.match(second, /^Course piège à surveiller : R2C4 Prix Long, 14 partants, aucun à 20 % de chances \(et 1 autre piège\)\.$/);
    assert.match(third, /n° 8 Belle Value en R1C1, espérance \+22 %/);
  });

  it("ne cite pas de value sans cote publiée, ni de piège inexistant", () => {
    const sansCote = race("s", { oddsAvailable: false, horses: clearField().map((h) => ({ ...h, valueIndex: 30 })) });
    const sentences = buildDaySummary([sansCote]).sentences;
    assert.equal(sentences.length, 2);
    assert.equal(sentences[0], "La seule course du programme se lit avec une base nette.");
    assert.equal(sentences[1], "Aucune course n'est classée piège.");
  });
});

describe("bilan d'hier", () => {
  it("place de la base IA : gagnée, placée, perdue", () => {
    assert.equal(outcomeOf(1), "gagnee");
    assert.equal(outcomeOf(3), "placee");
    assert.equal(outcomeOf(4), "perdue");
    assert.equal(outcomeOf(null), "perdue");
  });

  it("ne compte que les courses d'hier arrivées", () => {
    const withPositions = (positions: Record<number, number>) => clearField().map((h) => ({ ...h, finishPosition: positions[h.number] ?? null }));
    const report = buildYesterdayReport([
      race("gagne", { relativeDay: "yesterday", startTime: "14:00", horses: withPositions({ 1: 1, 2: 2, 3: 3 }) }),
      race("place", { relativeDay: "yesterday", startTime: "13:00", horses: withPositions({ 2: 1, 1: 2, 3: 3 }) }),
      race("perdu", { relativeDay: "yesterday", startTime: "15:00", horses: withPositions({ 2: 1, 3: 2, 4: 3 }) }),
      race("sans-arrivee", { relativeDay: "yesterday" }),
      race("aujourdhui", { horses: withPositions({ 1: 1 }) }),
    ]);
    assert.deepEqual(report.rows.map((r) => [r.race.id, r.baseNumber, r.outcome]), [
      ["place", 1, "placee"],
      ["gagne", 1, "gagnee"],
      ["perdu", 1, "perdue"],
    ]);
    assert.deepEqual([report.won, report.placed, report.lost], [1, 1, 1]);
    assert.equal(buildYesterdayReport([race("x", { relativeDay: "yesterday" })]).rows.length, 0);
  });
});

describe("chevaux suivis du jour", () => {
  it("rapproche par identifiant, dans l'ordre des départs", () => {
    const races = [race("tard", { startTime: "17:00" }), race("tot", { startTime: "13:00" })];
    const runners = followedRunners(races, new Map([["cheval-2", "CHEVAL 2"]]));
    assert.deepEqual(runners.map((r) => [r.race.id, r.number]), [["tot", 2], ["tard", 2]]);
    assert.deepEqual(followedRunners(races, new Set()), []);
    assert.deepEqual(followedRunners(races, new Set(["inconnu"])), []);
  });
});

describe("ligne du temps", () => {
  const day = [race("a", { startTime: "13:00" }), race("c", { startTime: "17:00" }), race("b", { startTime: "15:00" })];

  it("place le curseur avant la première course non partie (heure de Paris)", () => {
    // 12:50 UTC = 14:50 à Paris (heure d'été) : 13:00 partie, 15:00 imminente.
    const t = buildTimeline(day, new Date("2026-10-04T12:50:00Z"));
    assert.deepEqual(t.items.map((i) => [i.race.id, i.state]), [["a", "passee"], ["b", "imminente"], ["c", "a-venir"]]);
    assert.equal(t.cursorIndex, 1);
    assert.equal(t.nowMinute, 890);
    assert.equal(t.progress, (890 - 780) / 240);
    assert.equal(t.first, "13:00");
    assert.equal(t.last, "17:00");
  });

  it("curseur en fin de liste quand tout est parti, absent hors du jour", () => {
    assert.equal(buildTimeline(day, new Date("2026-10-04T18:00:00Z")).cursorIndex, 3);
    const tomorrow = buildTimeline(day, new Date("2026-10-03T10:00:00Z"));
    assert.equal(tomorrow.cursorIndex, null);
    assert.equal(tomorrow.progress, null);
    assert.equal(buildTimeline(day, null).items.every((i) => i.state === "a-venir"), true);
  });

  it("formate une minute", () => {
    assert.equal(formatMinute(905), "15:05");
  });
});

describe("aperçu d'une course", () => {
  it("Top 3 de l'IA et value bet", () => {
    const peek = racePeek(race("a", { horses: [...clearField().slice(0, 7), horse(8, { valueIndex: 14 })] }));
    assert.equal(peek.top3.length, 3);
    assert.equal(peek.top3[0].number, 1);
    assert.equal(peek.valueBet?.number, 8);
    assert.equal(racePeek(race("b", { oddsAvailable: false, horses: [horse(1, { valueIndex: 30 })] })).valueBet, null);
  });
});

describe("blocs personnalisables", () => {
  it("lit, bascule et écrit sans modifier l'ensemble reçu", () => {
    const hidden = parseHiddenBlocks('["timeline","inconnu",3]');
    assert.deepEqual([...hidden], ["timeline"]);
    const next = toggleHiddenBlock(hidden, "summary");
    assert.deepEqual([...hidden], ["timeline"]);
    assert.equal(serializeHiddenBlocks(next), '["summary","timeline"]');
    assert.equal(toggleHiddenBlock(next, "timeline").has("timeline"), false);
  });

  it("valeur illisible : rien de masqué", () => {
    assert.equal(parseHiddenBlocks("{pas du json").size, 0);
    assert.equal(parseHiddenBlocks(null).size, 0);
    assert.equal(parseHiddenBlocks('{"a":1}').size, 0);
    assert.equal(HOME_BLOCKS.length, 8);
  });
});
