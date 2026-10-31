// Tests des collecteurs de sélections presse (scripts/lib/press-sources/*).
// Fixtures réduites capturées le 31/10/2026 avec le client poli (tests/fixtures/press/).
// Lancer : npm test

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { parseCanalturfList, parseCanalturfRacePage, canalturfListUrl } from "../scripts/lib/press-sources/canalturf.mjs";
import { parseGenyProgramme, parseGenyRacePage } from "../scripts/lib/press-sources/geny.mjs";
import { BOT_USER_AGENT, createPoliteHttp, isPathAllowed, parseRobots, responseProblem } from "../scripts/lib/press-sources/http.mjs";
import { PRESS_SOURCES } from "../scripts/lib/press-sources/index.mjs";
import { matchRace, sameRacecourse } from "../scripts/lib/press-sources/mapping.mjs";
import { interpretParisTurfProbe } from "../scripts/lib/press-sources/paris-turf.mjs";
import { cleanRanks, looksLikeBotChallenge } from "../scripts/lib/press-sources/parse-utils.mjs";
import { parsePmuPronostics, pmuPronosticUrl } from "../scripts/lib/press-sources/pmu-presse.mjs";
import { isUpcoming, parisStartEpoch, racesFromPmuProgramme } from "../scripts/lib/press-sources/races.mjs";
import { interpretTurfomaniaProbe } from "../scripts/lib/press-sources/turfomania.mjs";
import { parseZeturfProgramme, parseZeturfRacePage } from "../scripts/lib/press-sources/zeturf.mjs";

const fixture = (name) => readFileSync(new URL(`./fixtures/press/${name}`, import.meta.url), "utf8");
const DATE = "2026-10-31";
const ourRaces = racesFromPmuProgramme(JSON.parse(fixture("pmu-programme-31102026.json")), DATE);

describe("registre des sources", () => {
  it("expose les six clés attendues par src/lib/press-consensus.ts", () => {
    assert.deepEqual(PRESS_SOURCES.map((collector) => collector.SOURCE.key).sort(), ["canalturf", "geny", "paris-turf", "pmu-presse", "turfomania", "zeturf"]);
    for (const collector of PRESS_SOURCES) assert.equal(typeof collector.collect, "function");
  });
});

describe("client poli", () => {
  it("lit robots.txt pour * et applique la règle la plus longue", () => {
    const rules = parseRobots("User-agent: GPTBot\nDisallow: /\n\nUser-agent: *\nDisallow: /api/\nDisallow: /*/compte\nAllow: /api/public\n");
    assert.equal(isPathAllowed(rules, "/fr/pronostics"), true);
    assert.equal(isPathAllowed(rules, "/api/x"), false);
    assert.equal(isPathAllowed(rules, "/api/public/y"), true);
    assert.equal(isPathAllowed(rules, "/fr/compte"), false);
  });

  it("robots.txt sans groupe * : tout est permis", () => {
    assert.equal(isPathAllowed(parseRobots("User-agent: GPTBot\nDisallow: /\n"), "/pronostics/"), true);
  });

  it("envoie notre User-Agent, respecte robots.txt et espace les requêtes d'un même hôte", async () => {
    const calls = [];
    const fetchImpl = async (url, init) => {
      calls.push({ url, at: Date.now(), ua: init.headers["User-Agent"] });
      const body = url.endsWith("/robots.txt") ? "User-agent: *\nDisallow: /prive\n" : "ok";
      return { status: 200, url, text: async () => body };
    };
    const http = createPoliteHttp({ fetchImpl, minDelayMs: 60 });
    const first = await http.get("https://exemple.test/a");
    const denied = await http.get("https://exemple.test/prive/b");
    await http.get("https://exemple.test/c");
    assert.equal(first.text, "ok");
    assert.equal(denied.robotsDenied, true);
    assert.deepEqual(calls.map((call) => new URL(call.url).pathname), ["/robots.txt", "/a", "/c"]);
    assert.ok(calls.every((call) => call.ua === BOT_USER_AGENT));
    for (let index = 1; index < calls.length; index += 1) assert.ok(calls[index].at - calls[index - 1].at >= 55);
  });

  it("plafonne le nombre de requêtes par hôte", async () => {
    const fetchImpl = async (url) => ({ status: 404, url, text: async () => "" });
    const http = createPoliteHttp({ fetchImpl, minDelayMs: 0, maxRequestsPerHost: 2 });
    await http.get("https://exemple.test/a");
    const capped = await http.get("https://exemple.test/b");
    assert.equal(capped.status, 0);
    assert.match(capped.error, /plafond/);
  });

  it("classe un refus en « blocked », sans contournement", () => {
    assert.equal(responseProblem({ status: 403, text: "" }).status, "blocked");
    assert.equal(responseProblem({ status: 0, text: "", robotsDenied: true }).status, "blocked");
    assert.equal(responseProblem({ status: 500, text: "" }).status, "error");
    assert.equal(responseProblem({ status: 200, text: "<html>" }), null);
  });
});

describe("outils", () => {
  it("cleanRanks garde l'ordre, retire doublons et valeurs invalides", () => {
    assert.deepEqual(cleanRanks([6, "9", 6, 0, 31, "x", 1]), [6, 9, 1]);
    assert.equal(cleanRanks([1, 2]), null);
  });

  it("rapproche par R/C confirmé, sinon par hippodrome + heure", () => {
    assert.equal(sameRacecourse("PONT DE VIVAUX", "Marseille-Vivaux"), true);
    assert.equal(sameRacecourse("REIMS", "Châteaubriant"), false);
    // Geny a publié Reims en « R8 » (c'est R9) : l'heure contredit, repli hippodrome + heure.
    assert.equal(matchRace(ourRaces, { reunion: 8, course: 1, startTime: "13:40", racecourse: "Reims" })?.id, "2026-10-31-R9-C1");
    assert.equal(matchRace(ourRaces, { reunion: 1, course: 3, startTime: "15:15", racecourse: "Deauville" })?.id, "2026-10-31-R1-C3");
    assert.equal(matchRace(ourRaces, { reunion: 1, course: 3, racecourse: "chateaubriant prix casdar" }), null);
  });

  it("heure de Paris → instant, changement d'heure compris", () => {
    assert.equal(new Date(parisStartEpoch("2026-10-31", "15:15")).toISOString(), "2026-10-31T14:15:00.000Z");
    assert.equal(new Date(parisStartEpoch("2026-07-14", "15:15")).toISOString(), "2026-07-14T13:15:00.000Z");
    const race = { date: "2026-10-31", startTime: "15:15" };
    assert.equal(isUpcoming(race, Date.parse("2026-10-31T14:14:00Z")), true);
    assert.equal(isUpcoming(race, Date.parse("2026-10-31T14:15:00Z")), false);
    assert.equal(isUpcoming({ date: "2026-10-31", startTime: "??" }, 0), false);
  });

  it("le programme PMU donne nos identifiants de course", () => {
    const quinte = ourRaces.find((race) => race.id === "2026-10-31-R1-C3");
    assert.deepEqual({ reunion: quinte.reunion, course: quinte.course, racecourse: quinte.racecourse, startTime: quinte.startTime }, {
      reunion: 1,
      course: 3,
      racecourse: "DEAUVILLE",
      startTime: "15:15",
    });
  });
});

describe("Geny", () => {
  it("lit le programme avec la numérotation PMU", () => {
    const races = parseGenyProgramme(fixture("geny-programme-2026-10-31.html"));
    assert.equal(races.length, 84);
    const quinte = races.find((race) => race.genyId === 1695243);
    assert.equal(quinte.reunion, 1);
    assert.equal(quinte.course, 3);
    assert.equal(quinte.startTime, "15:15");
    assert.equal(quinte.url, "https://www.geny.com/course/1695243-2026-10-31-deauville-prix-du-pays-de-bray/partants-pronostics");
    const matched = races.filter((race) => matchRace(ourRaces, race));
    assert.equal(matched.length, 84);
  });

  it("lit la sélection de la rédaction Geny (base puis belles chances), pas la presse", () => {
    assert.deepEqual(parseGenyRacePage(fixture("geny-course-quinte-2026-10-31.html")), [1, 11, 9, 6, 7, 5, 16, 4]);
    assert.deepEqual(parseGenyRacePage(fixture("geny-course-vincennes-2026-10-30.html")), [9, 18, 13, 11, 5, 4, 17]);
  });

  it("rend null quand Geny n'a pas (encore) publié", () => {
    assert.equal(parseGenyRacePage(fixture("geny-course-sans-prono-2026-10-31.html")), null);
    assert.equal(parseGenyRacePage("<html></html>"), null);
  });
});

describe("ZEturf", () => {
  it("lit les liens R/C du programme pour la date demandée", () => {
    const races = parseZeturfProgramme(fixture("zeturf-programme-2026-10-31.html"), DATE);
    assert.ok(races.length >= 80);
    assert.deepEqual(races.find((race) => race.reunion === 1 && race.course === 3), {
      reunion: 1,
      course: 3,
      slug: "deauville-prix-du-pays-de-bray",
      url: "https://www.zeturf.fr/fr/course-du-jour/2026-10-31/R1C3-deauville-prix-du-pays-de-bray",
    });
    assert.equal(parseZeturfProgramme(fixture("zeturf-programme-2026-10-31.html"), "2026-11-01").length, 0);
  });

  it("lit « Notre choix »", () => {
    assert.deepEqual(parseZeturfRacePage(fixture("zeturf-course-R1C3-2026-10-31.html")), [6, 9, 1, 11, 7, 16, 4, 15]);
    assert.deepEqual(parseZeturfRacePage(fixture("zeturf-course-R2C1-2026-10-31.html")), [3, 2, 1, 6, 9, 5]);
  });

  it("se replie sur les cartes de pronostic", () => {
    const html = '<div class="prono-cards"><span class="numero-cheval-card">4</span><span class="numero-cheval-card">2</span><span class="numero-cheval-card">7</span></div>';
    assert.deepEqual(parseZeturfRacePage(html), [4, 2, 7]);
  });
});

describe("Canalturf", () => {
  it("choisit la liste du jour ou du lendemain", () => {
    assert.match(canalturfListUrl("2026-10-31", "2026-10-31", "2026-11-01"), /courses_liste_pronostics\.php$/);
    assert.match(canalturfListUrl("2026-11-01", "2026-10-31", "2026-11-01"), /_demain\.php$/);
    assert.equal(canalturfListUrl("2026-10-20", "2026-10-31", "2026-11-01"), null);
  });

  it("lit la liste : réunion, course, heure, hippodrome", () => {
    const races = parseCanalturfList(fixture("canalturf-liste-2026-10-31.html"), DATE);
    assert.ok(races.length >= 80);
    const quinte = races.find((race) => race.reunion === 1 && race.course === 3);
    assert.equal(quinte.startTime, "15:15");
    assert.equal(quinte.racecourse, "DEAUVILLE");
    assert.equal(matchRace(ourRaces, quinte)?.id, "2026-10-31-R1-C3");
  });

  it("lit « La sélection de … » dans l'ordre affiché", () => {
    assert.deepEqual(parseCanalturfRacePage(fixture("canalturf-course-R1C3-2026-10-31.html")), {
      reunion: 1,
      course: 3,
      startTime: "15:15",
      ranks: [6, 9, 11, 1, 3, 7, 4, 16],
    });
    assert.deepEqual(parseCanalturfRacePage(fixture("canalturf-course-R2C1-2026-10-31.html")).ranks, [6, 1, 5, 10, 2, 3]);
  });
});

describe("PMU presse", () => {
  it("construit l'URL de l'API", () => {
    assert.equal(pmuPronosticUrl(DATE, 1, 3), "https://online.turfinfo.api.pmu.fr/rest/client/61/programme/31102026/R1/C3/pronostics");
  });

  it("trie par rang et garde les 8 premiers", () => {
    assert.deepEqual(parsePmuPronostics(fixture("pmu-pronostics-R1C3-31102026.json")), [11, 6, 7, 9, 1, 3, 5, 4]);
    assert.deepEqual(parsePmuPronostics({ selection: [{ num_partant: 2, rang: 2 }, { num_partant: 5, rang: 1 }, { num_partant: 8, rang: 3 }] }), [5, 2, 8]);
    assert.equal(parsePmuPronostics("pas du json"), null);
  });
});

describe("sites qui refusent notre robot", () => {
  it("reconnaît les pages de défi Cloudflare", () => {
    assert.equal(looksLikeBotChallenge(fixture("turfomania-403.html")), true);
    assert.equal(looksLikeBotChallenge(fixture("paris-turf-403.html")), true);
    assert.equal(looksLikeBotChallenge("<html><title>Programme</title></html>"), false);
  });

  it("Paris-Turf et Turfomania : 403 → blocked, défi servi en 200 → blocked", () => {
    assert.equal(interpretParisTurfProbe({ status: 403, text: fixture("paris-turf-403.html") }).status, "blocked");
    assert.equal(interpretTurfomaniaProbe({ status: 403, text: fixture("turfomania-403.html") }).status, "blocked");
    assert.equal(interpretParisTurfProbe({ status: 200, text: fixture("paris-turf-403.html") }).status, "blocked");
    assert.equal(interpretTurfomaniaProbe({ status: 200, text: "<html><title>Pronostics</title></html>" }).status, "error");
  });
});
