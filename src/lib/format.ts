/**
 * Formateurs d'affichage partagés entre les pages et les composants.
 *
 * `formatMeters` existait en copie locale dans la page course et la distance
 * était affichée brute (« 2100 », « 2 100 m », « 2100m » selon la source PMU)
 * sur l'accueil et dans les métadonnées : trois rendus pour une même donnée.
 */

/** Distance en mètres, telle qu'on l'écrit : « 2100 m ». Chaîne vide si absente. */
export function formatMeters(distance: string | number | null | undefined): string {
  if (distance === null || distance === undefined) return "";
  const chiffres = String(distance).replace(/\D/g, "");
  if (!chiffres) return typeof distance === "string" ? distance.trim() : "";
  return `${Number(chiffres)} m`;
}

/**
 * Une cote n'est exploitable que finie et supérieure à 1 : le PMU stocke
 * 0/NULL tant que le marché n'est pas ouvert, et l'import livre alors `NaN`
 * plutôt que la cote juste du modèle — l'afficher ferait passer une
 * estimation pour un prix de marché.
 */
export function hasOdds(odds: number | null | undefined): boolean {
  return typeof odds === "number" && Number.isFinite(odds) && odds > 1;
}

/**
 * Cote affichable à la française, une décimale comme le PMU : « 8,8 », ou
 * « — » tant que le marché n'a rien publié. Le site affichait « 3.8 » dans le
 * tableau et « 8.82 » dans la sélection pour la même cote.
 */
export function formatOdds(odds: number | null | undefined, digits = 1): string {
  return hasOdds(odds) ? (odds as number).toFixed(digits).replace(".", ",") : "—";
}

/** Montant en euros à la française : « −2,17 € », « 0,50 € ». */
export function formatEuros(value: number | null | undefined, digits = 2): string {
  if (value == null || !Number.isFinite(value)) return "—";
  const rounded = Number(value.toFixed(digits));
  const abs = new Intl.NumberFormat("fr-FR", { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(Math.abs(rounded));
  return `${rounded < 0 ? "−" : ""}${abs} €`;
}

/** Pourcentage à la française : « 12,3 % ». */
export function formatPct(value: number | null | undefined, digits = 1, signed = false): string {
  if (value == null || !Number.isFinite(value)) return "—";
  const rounded = Number(value.toFixed(digits));
  const sign = signed && rounded > 0 ? "+" : rounded < 0 ? "−" : "";
  return `${sign}${Math.abs(rounded).toFixed(digits).replace(".", ",")} %`;
}

/** Clé de tri croissant : une cote absente part en fin de liste. */
export function oddsSortValue(odds: number | null | undefined): number {
  return hasOdds(odds) ? (odds as number) : Infinity;
}

/** Graphies officielles que la règle générale ne peut pas deviner. */
const PROPER_NAMES: Record<string, string> = {
  parislongchamp: "ParisLongchamp",
  "paris-longchamp": "ParisLongchamp",
  "saint-cloud": "Saint-Cloud",
  "cagnes-sur-mer": "Cagnes-sur-Mer",
  "pmu": "PMU",
  "qatar": "Qatar",
};

const LOWER_WORDS = new Set(["de", "du", "des", "la", "le", "les", "et", "à", "au", "aux", "sur", "en", "d", "l"]);

/**
 * Nom propre à partir d'un libellé PMU en capitales : « PRIX DE L'ARC DE
 * TRIOMPHE » → « Prix de l'Arc de Triomphe ». Les mots-outils restent en
 * minuscules sauf en tête. Les accents absents de la source ne peuvent pas
 * être restitués.
 */
export function properName(value: string | null | undefined): string {
  if (!value) return "";
  const known = PROPER_NAMES[value.trim().toLowerCase()];
  if (known) return known;
  let first = true;
  return value
    .toLowerCase()
    .split(/(\s+|-|'|’|\/)/)
    .map((part) => {
      if (!part || /^(\s+|-|'|’|\/)$/.test(part)) return part;
      const word = PROPER_NAMES[part] ?? (!first && LOWER_WORDS.has(part) ? part : part.charAt(0).toUpperCase() + part.slice(1));
      first = false;
      return word;
    })
    .join("");
}
