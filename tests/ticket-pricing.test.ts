import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { raceTickets, type TicketRunner } from "../scripts/lib/backtest-tickets";
import { combinationKey, parseCombination, payoutBooks, priceTicket } from "../scripts/lib/ticket-pricing";

const rows = [
  { race_id: "R", bet_type: "SIMPLE_GAGNANT", combination: "7", dividend: 4.2 },
  { race_id: "R", bet_type: "SIMPLE_PLACE", combination: "7", dividend: 1.6 },
  { race_id: "R", bet_type: "SIMPLE_PLACE", combination: "3", dividend: 2.1 },
  { race_id: "R", bet_type: "SIMPLE_PLACE", combination: "12", dividend: 3.4 },
  { race_id: "R", bet_type: "COUPLE_GAGNANT", combination: "7-3", dividend: 9.5 },
  { race_id: "R", bet_type: "COUPLE_PLACE", combination: "7-3", dividend: 3.1 },
  { race_id: "R", bet_type: "COUPLE_PLACE", combination: "7-12", dividend: 6.0 },
  { race_id: "R", bet_type: "COUPLE_PLACE", combination: "3-12", dividend: 8.2 },
  { race_id: "R", bet_type: "TRIO", combination: "12-7-3", dividend: 41.0 },
  { race_id: "R", bet_type: "QUINTE_PLUS", combination: "7-3-12-1-2", dividend: 999 },
  { race_id: "R", bet_type: "TRIO", combination: "3-NP", dividend: 5 },
];

describe("payoutBooks", () => {
  it("indexe les combinaisons en désordre et ignore les paris non chiffrables", () => {
    const book = payoutBooks(rows).get("R")!;
    assert.equal(book.get("COUPLE_GAGNANT")!.get("3-7"), 9.5);
    assert.equal(book.get("TRIO")!.get("3-7-12"), 41);
    assert.equal(book.get("TRIO")!.size, 1);
    assert.ok(!book.has("QUINTE_PLUS"));
  });
  it("lit les combinaisons publiées", () => {
    assert.deepEqual(parseCombination("5 - 1 - 9"), [5, 1, 9]);
    assert.equal(parseCombination("3-NP"), null);
    assert.equal(combinationKey([12, 3, 7]), "3-7-12");
  });
});

describe("priceTicket", () => {
  const book = payoutBooks(rows).get("R");
  it("paie une combinaison simple, en désordre", () => {
    assert.deepEqual(priceTicket(book, "COUPLE_GAGNANT", [3, 7], 0, 14), { stake: 1, returned: 9.5, hit: true });
    assert.deepEqual(priceTicket(book, "COUPLE_PLACE", [12, 7], 0, 14), { stake: 1, returned: 6, hit: true });
    assert.deepEqual(priceTicket(book, "SIMPLE_GAGNANT", [3], 0, 14), { stake: 1, returned: 0, hit: false });
  });
  it("chiffre un ticket à X : une mise par combinaison", () => {
    // 2 bases + 1 X sur 14 partants : 12 combinaisons, une seule gagnante.
    assert.deepEqual(priceTicket(book, "TRIO", [7, 3], 1, 14), { stake: 12, returned: 41, hit: true });
    // 1 base + 2 X : C(13, 2) = 78 combinaisons.
    assert.equal(priceTicket(book, "TRIO", [5], 2, 14)!.stake, 78);
    assert.equal(priceTicket(book, "TRIO", [5], 2, 14)!.hit, false);
  });
  it("refuse ce qui n'est pas chiffrable", () => {
    assert.equal(priceTicket(book, "QUINTE_PLUS", [1, 2, 3, 4, 5], 0, 14), null);
    assert.equal(priceTicket(undefined, "TRIO", [1, 2, 3], 0, 14), null);
    assert.equal(priceTicket(book, "TRIO", [1, 2], 0, 14), null);
  });
});

describe("raceTickets", () => {
  const runners: TicketRunner[] = [3, 7, 12, 1, 5, 9, 2, 8].map((number, i) => ({
    number,
    horseId: `h${number}`,
    odds: [2.5, 4, 6, 9, 12, 18, 25, 40][i],
    fundamental: [0.3, 0.2, 0.15, 0.1, 0.09, 0.07, 0.05, 0.04][i],
    music: "1p2p3p",
  }));
  const book = payoutBooks(rows).get("R");

  it("reconstitue et chiffre les tickets du site avec le code de production", () => {
    const tickets = raceTickets(runners, book, { discipline: "Plat" });
    const keys = new Set(tickets.map((t) => t.key));
    for (const key of ["propose-SIMPLE_GAGNANT", "propose-SIMPLE_PLACE", "propose-COUPLE_GAGNANT", "propose-COUPLE_PLACE", "propose-TRIO", "strategie-securise-SIMPLE_PLACE", "strategie-equilibre-COUPLE_PLACE"]) {
      assert.ok(keys.has(key), key);
    }
    assert.ok(tickets.some((t) => t.source === "x" && t.betType === "TRIO"));
    // Le favori du modèle (n° 3) est le simple gagnant proposé : perdu, le 7 a gagné.
    const sg = tickets.find((t) => t.key === "propose-SIMPLE_GAGNANT")!;
    assert.equal(sg.hit, false);
    assert.ok(tickets.every((t) => t.stake >= 1 && t.returned >= 0));
  });

  it("ne propose rien sans rapports", () => {
    assert.deepEqual(raceTickets(runners, undefined, {}), []);
  });
});

describe("2 sur 4 et multi", () => {
  const book = payoutBooks([
    { race_id: "R", bet_type: "DEUX_SUR_QUATRE", combination: "2-11", dividend: 9.8 },
    { race_id: "R", bet_type: "DEUX_SUR_QUATRE", combination: "2-16", dividend: 9.8 },
    { race_id: "R", bet_type: "MULTI_EN_5", combination: "2-11-16-4", dividend: 289.8 },
  ]).get("R");

  it("paie le 2 sur 4 sur la paire publiée", () => {
    assert.deepEqual(priceTicket(book, "DEUX_SUR_QUATRE", [2, 11], 0, 16), { stake: 1, returned: 9.8, hit: true });
  });

  it("paie le multi en 5 quand les quatre premiers sont dans la sélection", () => {
    assert.deepEqual(priceTicket(book, "MULTI", [2, 11, 16, 4, 9], 0, 16), { stake: 1, returned: 289.8, hit: true });
    assert.deepEqual(priceTicket(book, "MULTI", [2, 11, 16, 3, 9], 0, 16), { stake: 1, returned: 0, hit: false });
    assert.equal(priceTicket(book, "MULTI", [2, 11, 16, 4], 0, 16), null);
  });
});
