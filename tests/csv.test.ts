import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { MARKET_HISTORY_HEADER, csvCell, marketHistoryCsv, marketHistoryRows, toCsv } from "../src/lib/csv";

describe("csvCell", () => {
  it("laisse passer le texte simple et écrit les nombres avec un point décimal", () => {
    assert.equal(csvCell("cote_simple_gagnant"), "cote_simple_gagnant");
    assert.equal(csvCell(4.5), "4.5");
    assert.equal(csvCell(-2.25), "-2.25");
  });

  it("met entre guillemets et double les guillemets", () => {
    assert.equal(csvCell('Le "Prix" de Vincennes'), '"Le ""Prix"" de Vincennes"');
    assert.equal(csvCell("a,b"), '"a,b"');
    assert.equal(csvCell("ligne 1\nligne 2"), '"ligne 1\nligne 2"');
    assert.equal(csvCell(" espace"), '" espace"');
  });

  it("neutralise les formules de tableur dans le texte", () => {
    assert.equal(csvCell("=HYPERLINK(\"x\")"), "\"'=HYPERLINK(\"\"x\"\")\"");
    assert.equal(csvCell("+33"), "'+33");
    assert.equal(csvCell("@cmd"), "'@cmd");
  });

  it("écrit une cellule vide pour l'absence de valeur", () => {
    assert.equal(csvCell(null), "");
    assert.equal(csvCell(undefined), "");
    assert.equal(csvCell(NaN), "");
    assert.equal(csvCell(Infinity), "");
  });
});

describe("toCsv", () => {
  it("sépare par des virgules et termine chaque ligne par CRLF", () => {
    assert.equal(toCsv(["a", "b"], [[1, "x"], [2.5, null]]), "a,b\r\n1,x\r\n2.5,\r\n");
  });
});

describe("historique de marché", () => {
  const history = {
    odds: {
      3: [
        { t: "2026-10-04T12:00:00.000Z", odds: 6.5 },
        { t: "2026-10-04T12:30:00.000Z", odds: 5.2 },
      ],
      1: [{ t: "2026-10-04T12:00:00.000Z", odds: 2.1 }],
    },
    pools: [{ t: "2026-10-04T12:15:00.000Z", numbers: [1, 3], win: [31.4, 12.05] }],
  };

  it("produit une ligne par relevé, triée par horodatage puis numéro", () => {
    assert.deepEqual(marketHistoryRows(history), [
      ["2026-10-04T12:00:00.000Z", "cote_simple_gagnant", 1, 2.1],
      ["2026-10-04T12:00:00.000Z", "cote_simple_gagnant", 3, 6.5],
      ["2026-10-04T12:15:00.000Z", "part_mises_simple_gagnant", 1, 31.4],
      ["2026-10-04T12:15:00.000Z", "part_mises_simple_gagnant", 3, 12.05],
      ["2026-10-04T12:30:00.000Z", "cote_simple_gagnant", 3, 5.2],
    ]);
  });

  it("commence par l'en-tête en français", () => {
    const csv = marketHistoryCsv(history);
    assert.ok(csv.startsWith(`${MARKET_HISTORY_HEADER.join(",")}\r\n`));
    assert.equal(csv.trim().split("\r\n").length, 6);
  });

  it("écarte les valeurs non numériques", () => {
    assert.deepEqual(marketHistoryRows({ odds: {}, pools: [{ t: "2026-10-04T12:15:00.000Z", numbers: [2], win: [NaN] }] }), []);
  });
});
