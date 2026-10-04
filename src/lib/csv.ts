import type { MarketHistory } from "@/lib/market";

/**
 * EXPORT CSV — format RFC 4180 : virgule séparatrice, fin de ligne CRLF,
 * guillemets doublés. Les nombres sont écrits avec un point décimal (lisible
 * par tout tableur réglé en anglais, par Python ou R) ; les dates en ISO 8601 UTC.
 */

export type CsvCell = string | number | null | undefined;

/**
 * Une cellule de texte commençant par =, +, -, @ (ou une tabulation, un retour
 * chariot) serait interprétée comme une formule par un tableur : on la préfixe
 * d'une apostrophe. Les nombres ne sont jamais concernés.
 */
const FORMULA_START = /^[=+\-@\t\r]/;

export function csvCell(value: CsvCell): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "";
  const text = FORMULA_START.test(value) ? `'${value}` : value;
  return /[",\r\n]/.test(text) || text !== text.trim() ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toCsv(header: string[], rows: CsvCell[][]): string {
  return [header, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n") + "\r\n";
}

export const MARKET_HISTORY_HEADER = ["horodatage_utc", "serie", "numero", "valeur"];

/**
 * Historique de marché d'une course, au format long : une ligne par relevé et
 * par cheval, triée par horodatage puis par numéro.
 *   serie = « cote_simple_gagnant »          cote PMU relevée
 *   serie = « part_mises_simple_gagnant »    part du cheval dans le pool simple gagnant, telle que publiée par le PMU
 */
export function marketHistoryRows(history: MarketHistory): CsvCell[][] {
  const odds = Object.entries(history.odds).flatMap(([number, points]) =>
    points.map((p) => ({ t: p.t, serie: "cote_simple_gagnant", number: Number(number), value: p.odds })),
  );
  const pools = history.pools.flatMap((snapshot) =>
    snapshot.numbers.map((number, i) => ({ t: snapshot.t, serie: "part_mises_simple_gagnant", number, value: snapshot.win[i] })),
  );
  return [...odds, ...pools]
    .filter((r) => Number.isFinite(r.value))
    .sort((a, b) => a.t.localeCompare(b.t) || a.serie.localeCompare(b.serie) || a.number - b.number)
    .map((r) => [r.t, r.serie, r.number, r.value]);
}

export function marketHistoryCsv(history: MarketHistory): string {
  return toCsv(MARKET_HISTORY_HEADER, marketHistoryRows(history));
}
