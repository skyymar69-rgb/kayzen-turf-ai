import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildMagicSquare, MAGIC_GRID, MAGIC_LINES, MAGIC_SUM, topOverlapDistribution } from "../src/lib/magic-square";
import { simulateTopOrders, ticketProbability } from "../src/lib/probability";

function field(n: number) {
  // Probabilités décroissantes, normalisées à 100.
  const raw = Array.from({ length: n }, (_, i) => 1 / (i + 1));
  const total = raw.reduce((a, b) => a + b, 0);
  return raw.map((p, i) => ({ number: 100 + i, name: `Cheval ${i + 1}`, winProbability: (p / total) * 100 }));
}

describe("carré magique 16 partants", () => {
  it("contient les rangs 1 à 16 une seule fois", () => {
    assert.deepEqual(MAGIC_GRID.flat().slice().sort((a, b) => a - b), Array.from({ length: 16 }, (_, i) => i + 1));
  });

  it("chaque alignement totalise 34 et prend un cheval dans chaque quart du classement", () => {
    assert.equal(MAGIC_LINES.length, 16);
    for (const line of MAGIC_LINES) {
      const ranks = line.cells.map(([r, c]) => MAGIC_GRID[r][c]);
      assert.equal(ranks.reduce((a, b) => a + b, 0), MAGIC_SUM, line.id);
      assert.deepEqual(ranks.map((k) => Math.floor((k - 1) / 4)).sort(), [0, 1, 2, 3], line.id);
    }
  });

  it("place les partants selon leur rang, sans reclasser", () => {
    const sq = buildMagicSquare(field(16));
    assert.equal(sq.grid[0][0].runner?.number, 100);
    assert.equal(sq.grid[1][2].runner?.number, 101);
    assert.equal(sq.grid[0][3].runner?.number, 115);
    assert.ok(sq.lines.every((l) => l.complete && l.quarteChance !== null));
  });

  it("chance gagnant = somme exacte : les 4 lignes couvrent le peloton et totalisent 100 %", () => {
    const sq = buildMagicSquare(field(16));
    const rows = sq.lines.filter((l) => l.kind === "ligne");
    const total = rows.reduce((s, l) => s + l.winChance, 0);
    assert.ok(Math.abs(total - 100) < 1e-9);
  });

  it("désigne l'alignement le plus probable au 2 sur 4", () => {
    const sq = buildMagicSquare(field(16));
    const max = Math.max(...sq.lines.map((l) => l.twoInFourChance ?? 0));
    assert.equal(sq.best?.twoInFourChance, max);
    assert.ok(sq.lines.every((l) => l.quarteChance! <= l.twoInFourChance!));
  });

  it("peloton réduit : cases vides, alignements incomplets sans chance de Quarté", () => {
    const sq = buildMagicSquare(field(10));
    assert.equal(sq.grid[0][3].runner, null);
    const d2 = sq.lines.find((l) => l.id === "D2")!;
    assert.equal(d2.complete, false);
    assert.equal(d2.quarteChance, null);
    // Le 2 sur 4 se joue encore à trois chevaux.
    assert.equal(d2.numbers.length, 3);
    assert.ok(d2.twoInFourChance! > 0);
  });

  it("au-delà de 16 partants, les suivants restent hors carré", () => {
    const sq = buildMagicSquare(field(18));
    assert.deepEqual(sq.outside.map((h) => h.number), [116, 117]);
  });

  it("aucun partant : carré vide, pas de meilleure lecture", () => {
    const sq = buildMagicSquare([]);
    assert.equal(sq.best, null);
    assert.ok(sq.lines.every((l) => l.numbers.length === 0));
  });

  it("recoupement exact avec le top 4 : distribution complète, conforme à la simulation Plackett-Luce", () => {
    const p = field(8).map((h) => h.winProbability);
    const groups = [[0, 1, 2, 3], [4, 5, 6, 7], [0, 7]];
    const dist = topOverlapDistribution(p, groups)!;
    for (const d of dist) assert.ok(Math.abs(d.reduce((a, b) => a + b, 0) - 1) < 1e-9);
    // Les deux groupes complémentaires se partagent les 4 places : P(k) de l'un = P(4 − k) de l'autre.
    for (let k = 0; k <= 4; k++) assert.ok(Math.abs(dist[0][k] - dist[1][4 - k]) < 1e-9);
    const simulated = ticketProbability(simulateTopOrders(p, 4, 40000), groups[0], 4, false);
    assert.ok(Math.abs(dist[0][4] * 100 - simulated) < 0.6, `${dist[0][4] * 100} vs ${simulated}`);
    // Quatre partants : les quatre sont forcément dans le top 4.
    assert.ok(Math.abs(topOverlapDistribution([10, 20, 30, 40], [[0, 1, 2, 3]])![0][4] - 1) < 1e-9);
    // Moins de quatre chevaux à probabilité positive : aucune chance calculable.
    assert.equal(topOverlapDistribution([50, 50, 0, 0, 0], [[0, 1, 2, 3]]), null);
  });
});
