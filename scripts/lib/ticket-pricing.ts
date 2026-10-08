/**
 * Chiffrage des tickets proposés par le site sur les rapports officiels PMU
 * (`race_payouts`), purs et testés (tests/ticket-pricing.test.ts).
 *
 * `race_payouts` ne conserve que les paris dont le suivi a besoin
 * (scripts/lib/payouts.mjs) : simple gagnant, simple placé, couplé gagnant,
 * couplé placé, trio, 2 sur 4 (depuis octobre 2026) et multi, tous en
 * désordre. Un ticket d'un autre type (couplé ordre, tiercé, quarté+,
 * quinté+, pick 5…) n'est pas chiffrable : il est écarté, et le rapport le dit.
 * Les courses antérieures à l'ajout du 2 sur 4 et du multi n'en ont pas les
 * rapports : leurs tickets de ce type sont simplement non chiffrés.
 */

/** Paris chiffrables : ceux que `race_payouts` conserve. Tous se jouent en désordre. */
export const PRICEABLE_BET_TYPES = ["SIMPLE_GAGNANT", "SIMPLE_PLACE", "COUPLE_GAGNANT", "COUPLE_PLACE", "TRIO", "DEUX_SUR_QUATRE", "MULTI"] as const;
export type PriceableBetType = (typeof PRICEABLE_BET_TYPES)[number];

export const BET_TYPE_LABELS: Record<string, string> = {
  SIMPLE_GAGNANT: "Simple gagnant",
  SIMPLE_PLACE: "Simple placé",
  COUPLE_GAGNANT: "Couplé gagnant",
  COUPLE_PLACE: "Couplé placé",
  COUPLE_ORDRE: "Couplé ordre",
  DEUX_SUR_QUATRE: "2 sur 4",
  TRIO: "Trio",
  TRIO_ORDRE: "Trio ordre",
  TIERCE: "Tiercé",
  MULTI: "Multi",
  MINI_MULTI: "Mini-Multi",
  SUPER_QUATRE: "Super 4",
  QUARTE_PLUS: "Quarté+",
  QUINTE_PLUS: "Quinté+",
  PICK5: "Pick 5",
  TIC_TROIS: "Tic Trois",
};

/** Nombre de chevaux d'une combinaison, par type chiffrable. */
const COMBINATION_SIZE: Record<Exclude<PriceableBetType, "MULTI">, number> = {
  SIMPLE_GAGNANT: 1,
  SIMPLE_PLACE: 1,
  COUPLE_GAGNANT: 2,
  COUPLE_PLACE: 2,
  TRIO: 3,
  DEUX_SUR_QUATRE: 2,
};

/** Type stocké d'un rapport de multi (`MULTI_EN_4` … `MULTI_EN_7`), voir payouts.mjs. */
const MULTI_STORED = /^MULTI_EN_[4-7]$/;

export function isPriceable(betType: string): betType is PriceableBetType {
  return (PRICEABLE_BET_TYPES as readonly string[]).includes(betType);
}

/** Clé d'une combinaison en désordre : numéros triés, séparés par « - ». */
export function combinationKey(numbers: number[]): string {
  return [...numbers].sort((a, b) => a - b).join("-");
}

/** Numéros d'une combinaison publiée (« 3-12 », « 5 - 1 - 9 »), null si illisible. */
export function parseCombination(combination: string): number[] | null {
  const parts = combination.split("-").map((s) => Number(s.trim()));
  return parts.length > 0 && parts.every((n) => Number.isInteger(n) && n > 0) ? parts : null;
}

/** Rapports d'une course : type de pari → clé de combinaison → rapport pour 1 €. */
export type PayoutBook = Map<string, Map<string, number>>;

export type PayoutRow = { race_id: string; bet_type: string; combination: string; dividend: number };

/** Index des rapports par course. Les combinaisons illisibles sont ignorées. */
export function payoutBooks(rows: PayoutRow[]): Map<string, PayoutBook> {
  const books = new Map<string, PayoutBook>();
  for (const row of rows) {
    if (!isPriceable(row.bet_type) && !MULTI_STORED.test(row.bet_type)) continue;
    const numbers = parseCombination(row.combination);
    const dividend = Number(row.dividend);
    if (!numbers || !(dividend > 0)) continue;
    const book = books.get(row.race_id) ?? new Map<string, Map<string, number>>();
    const table = book.get(row.bet_type) ?? new Map<string, number>();
    table.set(combinationKey(numbers), dividend);
    book.set(row.bet_type, table);
    books.set(row.race_id, book);
  }
  return books;
}

function choose(n: number, k: number): number {
  if (k < 0 || k > n) return 0;
  return Array.from({ length: k }, (_, i) => i).reduce((acc, i) => (acc * (n - i)) / (i + 1), 1);
}

export type PricedTicket = { stake: number; returned: number; hit: boolean };

/**
 * Chiffre un ticket en désordre, 1 € par combinaison.
 *
 * Sans X (`xPositions` = 0), le ticket est une seule combinaison : les
 * `bases`. Avec X, les bases sont associées à toutes les combinaisons des
 * autres partants (« 3-7 X » au trio = 3, 7 et n'importe quel autre) : la mise
 * vaut le nombre de combinaisons, le gain la somme des rapports des
 * combinaisons publiées qui contiennent toutes les bases.
 *
 * Null quand le ticket n'est pas chiffrable : type non conservé, rapports
 * absents pour cette course, ou ticket mal formé.
 */
export function priceTicket(book: PayoutBook | undefined, betType: string, bases: number[], xPositions: number, runners: number): PricedTicket | null {
  if (!book || !isPriceable(betType)) return null;
  if (betType === "MULTI") return priceMulti(book, bases, xPositions);
  const table = book.get(betType);
  if (!table || table.size === 0) return null;
  const size = COMBINATION_SIZE[betType];
  if (new Set(bases).size !== bases.length || bases.length + xPositions !== size || bases.length === 0) return null;

  const stake = xPositions === 0 ? 1 : choose(runners - bases.length, xPositions);
  if (!(stake >= 1)) return null;
  const returned = [...table.entries()]
    .filter(([key]) => {
      const published = key.split("-").map(Number);
      return bases.every((n) => published.includes(n));
    })
    .reduce((sum, [, dividend]) => sum + dividend, 0);
  return { stake, returned: Math.round(returned * 100) / 100, hit: returned > 0 };
}

/**
 * Multi : une sélection de 4 à 7 chevaux gagne si les quatre premiers en font
 * tous partie, au rapport de sa formule (« Multi en 5 » pour 5 chevaux). Mise
 * comptée 1 € par ticket, comme le rapport publié pour 1 €.
 */
function priceMulti(book: PayoutBook, bases: number[], xPositions: number): PricedTicket | null {
  const n = bases.length;
  if (xPositions !== 0 || n < 4 || n > 7 || new Set(bases).size !== n) return null;
  const table = book.get(`MULTI_EN_${n}`);
  if (!table || table.size === 0) return null;
  const returned = [...table.entries()]
    .filter(([key]) => key.split("-").map(Number).every((h) => bases.includes(h)))
    .reduce((sum, [, dividend]) => sum + dividend, 0);
  return { stake: 1, returned: Math.round(returned * 100) / 100, hit: returned > 0 };
}
