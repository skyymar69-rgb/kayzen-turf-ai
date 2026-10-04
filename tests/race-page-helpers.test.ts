import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { groupPayouts, pickResult } from "../src/lib/arrival-recap";
import { beginnerSummary, chancesPhrase } from "../src/lib/beginner-summary";
import { COMPARE_MAX, musicRuns, pruneCompare, toggleCompare } from "../src/lib/horse-compare";
import { GLOSSARY, lexiqueDefinition } from "../src/lib/lexique";
import { buildOddsChart, oddsTicks, oddsY } from "../src/lib/odds-chart";

describe("comparateur", () => {
  it("ajoute, retire, et refuse un quatrième cheval sans en retirer un autre", () => {
    assert.deepEqual(toggleCompare([], 4), [4]);
    assert.deepEqual(toggleCompare([4, 8], 4), [8]);
    assert.equal(COMPARE_MAX, 3);
    assert.deepEqual(toggleCompare([1, 2, 3], 9), [1, 2, 3]);
  });

  it("oublie les numéros qui ne sont plus au départ", () => {
    assert.deepEqual(pruneCompare([1, 5, 9], new Set([1, 9])), [1, 9]);
  });
});

describe("dernières courses lues dans la musique", () => {
  it("la plus récente en premier, incidents nommés, changement d'année ignoré", () => {
    const runs = musicRuns("1a 0a (25) Da 3a");
    assert.deepEqual(runs.map((r) => r.label), ["1re place", "Au-delà de la 9e place", "Disqualifié", "3e place"]);
    assert.deepEqual(runs.map((r) => r.position), [1, 10, null, 3]);
  });

  it("rien sans musique", () => {
    assert.deepEqual(musicRuns(null), []);
  });
});

describe("résumé pour débutant", () => {
  const top = [
    { number: 4, name: "Alpha", win: 36 },
    { number: 8, name: "Bravo", win: 20 },
    { number: 2, name: "Charlie", win: 12 },
  ];

  it("traduit une probabilité en chances « sur N »", () => {
    assert.equal(chancesPhrase(36), "environ 1 chance sur 3");
    assert.equal(chancesPhrase(55), "plus d'une chance sur deux");
    assert.equal(chancesPhrase(15), "environ 1 chance sur 7");
  });

  it("une phrase par lecture, sans promesse", () => {
    assert.match(beginnerSummary({ reading: "lisible", top, oddsAvailable: true, finished: false })!, /^Le n° 4 Alpha ressort nettement.*loin d'une certitude\.$/);
    assert.match(beginnerSummary({ reading: "ouverte", top, oddsAvailable: true, finished: false })!, /^Course ouverte.*n° 4, 8, 2/);
    assert.match(beginnerSummary({ reading: "piege", top, oddsAvailable: false, finished: true })!, /^Avant le départ, course difficile à lire \(avis de l'IA seule/);
    assert.equal(beginnerSummary({ reading: "lisible", top: [], oddsAvailable: true, finished: false }), null);
  });
});

describe("rapports et premier choix", () => {
  it("groupe les rapports du simple au trio, sans ligne invalide", () => {
    const groups = groupPayouts([
      { betType: "TRIO", combination: "4-8-2", dividend: 42.5 },
      { betType: "SIMPLE_PLACE", combination: "4", dividend: 1.4 },
      { betType: "SIMPLE_GAGNANT", combination: "4", dividend: 3.2 },
      { betType: "SIMPLE_PLACE", combination: "8", dividend: 0 },
    ]);
    assert.deepEqual(groups.map((g) => g.label), ["Simple gagnant", "Simple placé", "Trio"]);
    assert.equal(groups[1].items.length, 1);
  });

  it("dit la place de notre premier choix, ou son absence", () => {
    assert.equal(pickResult([4, 8, 2], 4).sentence, "Notre premier choix, le n° 4, gagne.");
    assert.equal(pickResult([4, 8, 2], 2).position, 3);
    assert.match(pickResult([4, 8, 2], 9).sentence, /ne figure pas dans l'arrivée publiée \(3 places\)/);
  });
});

describe("graphique des cotes", () => {
  it("ne garde que les séries d'au moins deux relevés valides", () => {
    const data = buildOddsChart(
      {
        1: [{ t: "2026-10-04T10:00:00Z", odds: 4 }, { t: "2026-10-04T11:00:00Z", odds: 3 }],
        2: [{ t: "2026-10-04T10:00:00Z", odds: 9 }],
        3: [{ t: "2026-10-04T10:00:00Z", odds: 0 }, { t: "2026-10-04T11:30:00Z", odds: 15 }],
      },
      [1, 2, 3],
    );
    assert.deepEqual(data?.series.map((s) => s.number), [1]);
    assert.equal(data?.lo, 3);
    assert.equal(data?.hi, 4);
    assert.equal(buildOddsChart({}, [1]), null);
  });

  it("échelle logarithmique : 2→4 occupe autant que 10→20", () => {
    const y = (v: number) => oddsY(v, 2, 20, 0, 100);
    assert.ok(Math.abs(y(2) - y(4) - (y(10) - y(20))) < 1e-9);
    assert.equal(y(2), 100);
    assert.equal(y(20), 0);
    assert.deepEqual(oddsTicks(2.4, 18), [3, 5, 10]);
  });
});

describe("lexique partagé", () => {
  it("chaque terme est unique et défini", () => {
    const terms = GLOSSARY.map((g) => g.term);
    assert.equal(new Set(terms).size, terms.length);
    assert.ok(lexiqueDefinition("MVT")?.includes("cote"));
    assert.equal(lexiqueDefinition("inconnu"), null);
  });
});
