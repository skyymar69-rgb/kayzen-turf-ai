/**
 * CARRÉ MAGIQUE 16 PARTANTS — la méthode turf du carré de 16, adossée à nos
 * probabilités.
 *
 * Le carré magique d'ordre 4 range les nombres 1 à 16 dans une grille 4 × 4 de
 * sorte que chaque ligne, chaque colonne et chaque diagonale totalise 34. La
 * méthode turf y place les partants, puis lit chaque alignement comme une
 * combinaison de quatre chevaux à jouer.
 *
 * Ici, le nombre d'une case n'est pas le numéro de dossard mais le RANG du
 * cheval dans notre classement (1 = plus forte probabilité). Le carré retenu
 * est construit à partir de deux carrés latins diagonaux orthogonaux
 * (case = 4·A + B + 1), ce qui lui donne une propriété turf précise : chacun
 * de ses 16 alignements contient exactement un cheval de chaque quart du
 * classement — un des rangs 1-4, un des 5-8, un des 9-12, un des 13-16. Toutes
 * les combinaisons sont donc équilibrées de la même façon, et la somme des
 * rangs vaut toujours 34.
 *
 * Ce n'est pas un modèle : l'équilibre est une contrainte, pas une prédiction.
 * Pour que chaque lecture reste honnête, chaque alignement porte ses chances
 * calculées sur nos probabilités : qu'il contienne le gagnant, qu'au moins
 * deux de ses chevaux finissent dans les quatre premiers (le 2 sur 4, pari
 * naturel d'un groupe de quatre), et que les quatre y soient (Quarté+
 * désordre). Comme chaque alignement compte un cheval classé 13-16, ce
 * dernier se joue presque toujours sous 0,1 % — c'est le 2 sur 4 qui
 * départage les alignements.
 */

export const MAGIC_SIZE = 4;
export const MAGIC_SUM = 34;

/** Rangs 1 à 16 ; ligne, colonne, diagonale, quart, centre et coins font 34. */
export const MAGIC_GRID: readonly (readonly number[])[] = [
  [1, 6, 11, 16],
  [12, 15, 2, 5],
  [14, 9, 8, 3],
  [7, 4, 13, 10],
];

type Cell = readonly [row: number, col: number];

export type MagicLineKind = "ligne" | "colonne" | "diagonale" | "carre";

export const MAGIC_LINES: ReadonlyArray<{ id: string; label: string; kind: MagicLineKind; cells: readonly Cell[] }> = [
  ...[0, 1, 2, 3].map((r) => ({ id: `L${r + 1}`, label: `Ligne ${r + 1}`, kind: "ligne" as const, cells: [0, 1, 2, 3].map((c) => [r, c] as const) })),
  ...[0, 1, 2, 3].map((c) => ({ id: `C${c + 1}`, label: `Colonne ${c + 1}`, kind: "colonne" as const, cells: [0, 1, 2, 3].map((r) => [r, c] as const) })),
  { id: "D1", label: "Diagonale ↘", kind: "diagonale", cells: [[0, 0], [1, 1], [2, 2], [3, 3]] },
  { id: "D2", label: "Diagonale ↙", kind: "diagonale", cells: [[0, 3], [1, 2], [2, 1], [3, 0]] },
  { id: "Q1", label: "Carré haut gauche", kind: "carre", cells: [[0, 0], [0, 1], [1, 0], [1, 1]] },
  { id: "Q2", label: "Carré haut droit", kind: "carre", cells: [[0, 2], [0, 3], [1, 2], [1, 3]] },
  { id: "Q3", label: "Carré bas gauche", kind: "carre", cells: [[2, 0], [2, 1], [3, 0], [3, 1]] },
  { id: "Q4", label: "Carré bas droit", kind: "carre", cells: [[2, 2], [2, 3], [3, 2], [3, 3]] },
  { id: "CE", label: "Carré central", kind: "carre", cells: [[1, 1], [1, 2], [2, 1], [2, 2]] },
  { id: "CO", label: "Quatre coins", kind: "carre", cells: [[0, 0], [0, 3], [3, 0], [3, 3]] },
];

export type MagicRunner = { number: number; name: string; winProbability: number };

export type MagicCell = {
  row: number;
  col: number;
  /** Rang dans notre classement, 1 à 16. */
  rank: number;
  /** Quart du classement : 1 (rangs 1-4) à 4 (rangs 13-16). */
  quarter: 1 | 2 | 3 | 4;
  /** Null si la course compte moins de partants que ce rang. */
  runner: MagicRunner | null;
};

export type MagicLine = {
  id: string;
  label: string;
  kind: MagicLineKind;
  cells: MagicCell[];
  /** Numéros de dossard présents, dans l'ordre du classement. */
  numbers: number[];
  complete: boolean;
  /** Chance (%) que le gagnant soit dans l'alignement — somme exacte. */
  winChance: number;
  /** Chance (%) qu'au moins deux d'entre eux finissent dans les 4 premiers. Null sous deux chevaux. */
  twoInFourChance: number | null;
  /** Chance (%) que les quatre fassent les 4 premières places, ordre libre. Null si incomplet. */
  quarteChance: number | null;
};

export type MagicSquare = {
  grid: MagicCell[][];
  lines: MagicLine[];
  /** Alignement le plus probable au 2 sur 4. */
  best: MagicLine | null;
  /** Partants au-delà du 16e rang, hors carré. */
  outside: MagicRunner[];
  runners: number;
};

/**
 * Pour chaque groupe de chevaux (indices dans `pWin`), distribution exacte du
 * nombre d'entre eux classés dans les `depth` premiers : out[g][k] = P(k).
 *
 * Énumère tous les ordres d'arrivée des `depth` premières places sous le
 * modèle de Plackett-Luce qu'utilise simulateTopOrders — 43 680 ordres pour 16
 * partants. Calcul exact plutôt que simulé : un Quarté désordre se joue
 * autour de 0,01 %, là où une simulation ne compterait qu'une poignée de
 * tirages.
 */
export function topOverlapDistribution(pWin: number[], groups: number[][], depth = 4): number[][] {
  const out = groups.map((g) => new Array<number>(g.length + 1).fill(0));
  const total = pWin.reduce((a, b) => a + b, 0);
  const d = Math.min(depth, pWin.length);
  if (total <= 0 || d === 0) return out;
  const p = pWin.map((x) => x / total);

  // member[i] = groupes qui contiennent le cheval i.
  const member = p.map(() => [] as number[]);
  groups.forEach((g, gi) => g.forEach((i) => member[i].push(gi)));
  const counts = new Array<number>(groups.length).fill(0);
  const used = new Array<boolean>(p.length).fill(false);

  const walk = (pos: number, prob: number, remaining: number) => {
    if (pos === d) {
      groups.forEach((_, gi) => (out[gi][counts[gi]] += prob));
      return;
    }
    for (let i = 0; i < p.length; i++) {
      if (used[i] || p[i] <= 0 || remaining <= 0) continue;
      used[i] = true;
      for (const gi of member[i]) counts[gi]++;
      walk(pos + 1, (prob * p[i]) / remaining, remaining - p[i]);
      for (const gi of member[i]) counts[gi]--;
      used[i] = false;
    }
  };
  walk(0, 1, 1);
  return out;
}

/**
 * @param ranked partants au départ, déjà triés du plus probable au moins
 *               probable (l'ordre de la sélection — jamais reclassé ici).
 */
export function buildMagicSquare(ranked: MagicRunner[]): MagicSquare {
  const grid: MagicCell[][] = MAGIC_GRID.map((row, r) =>
    row.map((rank, c) => ({
      row: r,
      col: c,
      rank,
      quarter: (Math.floor((rank - 1) / 4) + 1) as MagicCell["quarter"],
      runner: ranked[rank - 1] ?? null,
    })),
  );

  const index = new Map(ranked.map((h, i) => [h.number, i]));
  const pWin = ranked.map((h) => Math.max(0, h.winProbability));
  const shaped = MAGIC_LINES.map((line) => {
    const cells = line.cells.map(([r, c]) => grid[r][c]);
    const present = cells.filter((cell) => cell.runner).sort((a, b) => a.rank - b.rank);
    return { line, cells, numbers: present.map((cell) => cell.runner!.number) };
  });
  const overlap = ranked.length >= 4 ? topOverlapDistribution(pWin, shaped.map((s) => s.numbers.map((n) => index.get(n)!))) : null;

  const lines: MagicLine[] = shaped.map(({ line, cells, numbers }, li) => {
    const complete = numbers.length === MAGIC_SIZE;
    const dist = overlap?.[li];
    const winChance = cells.reduce((sum, cell) => sum + (cell.runner?.winProbability ?? 0), 0);
    const twoInFourChance = dist && numbers.length >= 2 ? dist.slice(2).reduce((a, b) => a + b, 0) * 100 : null;
    const quarteChance = dist && complete ? dist[4] * 100 : null;
    return { id: line.id, label: line.label, kind: line.kind, cells, numbers, complete, winChance, twoInFourChance, quarteChance };
  });

  const best = lines
    .filter((l) => l.twoInFourChance !== null)
    .reduce<MagicLine | null>((top, l) => {
      if (!top) return l;
      if (l.twoInFourChance! !== top.twoInFourChance!) return l.twoInFourChance! > top.twoInFourChance! ? l : top;
      return l.winChance > top.winChance ? l : top;
    }, null);

  return { grid, lines, best, outside: ranked.slice(16), runners: ranked.length };
}
