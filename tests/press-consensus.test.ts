import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { agreementLabel, marketRanks, pressConsensus, raceAgreement, type PressInput, type PressSelection } from "../src/lib/press-consensus";

// Peloton de 8 : le marché classe 1, 2, 3, … dans l'ordre des numéros.
const field: PressInput[] = Array.from({ length: 8 }, (_, i) => ({ number: i + 1, market: 30 - i * 3 }));

const sel = (source: string, ranks: number[]): PressSelection => ({ source, ranks });

describe("marketRanks", () => {
  it("classe par probabilité du marché, sans cote ni non-partant", () => {
    const r = marketRanks([{ number: 1, market: 10 }, { number: 2, market: 30 }, { number: 3, market: null }, { number: 4, market: 20, nonRunner: true }]);
    assert.equal(r.get(2), 1);
    assert.equal(r.get(1), 2);
    assert.equal(r.has(3), false);
    assert.equal(r.has(4), false);
  });
});

describe("pressConsensus", () => {
  const selections = [
    sel("geny", [1, 7, 2, 3, 4]),
    sel("zeturf", [7, 1, 3, 2, 5]),
    sel("canalturf", [1, 7, 4, 2, 6]),
    sel("turfomania", [7, 2, 1, 5, 4]),
    sel("pmu-presse", [1, 3, 7, 4, 2]),
  ];
  const result = pressConsensus(selections, field);

  it("compte les sources et les rangs", () => {
    const h1 = result.get(1)!;
    assert.equal(h1.sources, 5);
    assert.equal(h1.citations.length, 5);
    assert.equal(h1.share, 1);
    assert.ok(h1.sitesScore > 0.8);
  });

  it("classe en consensus un cheval cité partout et favori du marché", () => {
    assert.equal(result.get(1)!.category, "consensus");
  });

  it("signale un cheval des sites délaissé par le marché", () => {
    // Le 7 est cité par les 5 sources, mais 7e du marché.
    assert.equal(result.get(7)!.category, "sites-sans-marche");
  });

  it("signale un cheval du marché négligé par les sites", () => {
    const res = pressConsensus([sel("geny", [5, 6, 7, 8, 4]), sel("zeturf", [6, 5, 7, 8, 4]), sel("canalturf", [5, 7, 6, 8, 4])], field);
    assert.equal(res.get(1)!.category, "marche-sans-sites");
  });

  it("sans source, aucune catégorie", () => {
    const res = pressConsensus([], field);
    assert.equal(res.get(1)!.category, null);
    assert.equal(res.get(1)!.sitesScore, 0);
  });

  it("avec une seule source, le soutien veut dire « dans ses 3 premiers »", () => {
    const res = pressConsensus([sel("pmu-presse", [8, 1, 2, 3, 4])], field);
    assert.equal(res.get(8)!.category, "sites-sans-marche");
    assert.equal(res.get(1)!.category, "consensus");
    assert.equal(res.get(4)!.category, null);
  });

  it("n'attribue rien à un non-partant", () => {
    const res = pressConsensus(selections, [...field.slice(0, 6), { number: 7, market: 9, nonRunner: true }, field[7]]);
    assert.equal(res.get(7)!.category, null);
    assert.equal(res.get(7)!.marketRank, null);
  });
});

describe("raceAgreement", () => {
  it("vaut 1 quand les sélections sont identiques et null avec une source", () => {
    assert.equal(raceAgreement([sel("a", [1, 2, 3, 4, 5]), sel("b", [5, 4, 3, 2, 1])]), 1);
    assert.equal(raceAgreement([sel("a", [1, 2, 3])]), null);
    assert.equal(agreementLabel(null), "une seule source");
  });

  it("baisse quand les sélections divergent", () => {
    const value = raceAgreement([sel("a", [1, 2, 3, 4, 5]), sel("b", [6, 7, 8, 1, 2])])!;
    assert.ok(Math.abs(value - 0.4) < 1e-9);
    assert.equal(agreementLabel(value), "faible");
  });
});
