/**
 * PRONOSTIQUEURS × MARCHÉ — ce que disent les sites de pronostics, comparé à
 * ce que joue le public.
 *
 * Sources : sélections publiques de Geny, Paris-Turf, ZEturf, Canalturf,
 * Turfomania (avec leur accord, voir docs/partenariats-sources.md) et le
 * pronostic presse publié par le PMU. Seul l'ordre des numéros est conservé,
 * relevé avant le départ (scripts/import-press.mjs).
 *
 * Pour chaque cheval :
 *   Sites      nombre de sources qui le citent, et son rang chez chacune ;
 *              soutien des sites = moyenne, sur les sources disponibles, de
 *              (k + 1 − rang) ÷ k, k = longueur de la sélection (0 si absent).
 *   Consensus  part des sources qui le citent (2 sur 5 = 40 %).
 *   Marché     rang du cheval par la cote (1 = favori) et probabilité du
 *              marché, marge retirée.
 *
 * Catégories, publiées sur /methode :
 *   Consensus sites + marché    cité par au moins 60 % des sources ET dans
 *                               les 3 premiers du marché ;
 *   Sites sans le marché        cité par au moins 60 % des sources ET au-delà
 *                               du 5e rang du marché — alerte ;
 *   Marché sans les sites       dans les 3 premiers du marché ET cité par au
 *                               plus 20 % des sources — alerte.
 * Avec une seule source, « 60 % » veut dire « dans ses 3 premiers » : la page
 * le signale (« une seule source »).
 *
 * Ce comparateur décrit des divergences ; leur valeur réelle (gagnants et
 * placés) est mesurée par le backtest (signaux `presse-*`).
 */

export const PRESS_SOURCE_LABELS: Record<string, string> = {
  geny: "Geny",
  "paris-turf": "Paris-Turf",
  zeturf: "ZEturf",
  canalturf: "Canalturf",
  turfomania: "Turfomania",
  "pmu-presse": "Presse PMU",
};

/** Ordre d'affichage des sources. */
export const PRESS_SOURCE_ORDER = ["geny", "paris-turf", "zeturf", "canalturf", "turfomania", "pmu-presse"];

export const PRESS_THRESHOLDS = {
  /** Part des sources qui citent le cheval pour parler de soutien des sites. */
  sitesStrongShare: 0.6,
  /** Au plus cette part : cheval négligé par les sites. */
  sitesWeakShare: 0.2,
  /** Rang du marché (par la cote) pour un fort soutien du marché. */
  marketStrongRank: 3,
  /** Au-delà de ce rang, le marché délaisse le cheval. */
  marketWeakRank: 5,
  /** Avec une seule source : rang maximal chez elle pour compter comme soutien. */
  singleSourceTopRank: 3,
} as const;

export type PressSelection = { source: string; ranks: number[]; url?: string | null; fetchedAt?: string | null };

export type PressCategory = "consensus" | "sites-sans-marche" | "marche-sans-sites";

export const PRESS_CATEGORY_LABELS: Record<PressCategory, string> = {
  consensus: "Consensus sites + marché",
  "sites-sans-marche": "Recommandé par les sites, délaissé par le marché",
  "marche-sans-sites": "Soutenu par le marché, négligé par les sites",
};

export const PRESS_CATEGORY_HINTS: Record<PressCategory, string> = {
  consensus: "Les sites et les parieurs vont dans le même sens.",
  "sites-sans-marche": "Les pronostiqueurs y croient, les parieurs beaucoup moins.",
  "marche-sans-sites": "Les parieurs le soutiennent sans que les pronostiqueurs le retiennent.",
};

export type PressHorse = {
  number: number;
  /** Rang chez chaque source qui le cite. */
  citations: Array<{ source: string; rank: number }>;
  /** Sources disponibles pour la course. */
  sources: number;
  /** Part des sources qui le citent (0 à 1). */
  share: number;
  /** Soutien des sites, 0 à 1. */
  sitesScore: number;
  /** Rang moyen chez les sources qui le citent, `null` si aucune. */
  meanRank: number | null;
  /** Rang du marché par la cote (1 = favori), `null` sans cote. */
  marketRank: number | null;
  /** Probabilité du marché, marge retirée (%). */
  market: number | null;
  category: PressCategory | null;
};

export type PressInput = { number: number; market: number | null; nonRunner?: boolean };

/** Rang de chaque cheval par la probabilité du marché (1 = favori). */
export function marketRanks(field: PressInput[]): Map<number, number> {
  const ranked = field
    .filter((h) => h.market !== null && Number.isFinite(h.market) && h.market > 0 && !h.nonRunner)
    .sort((a, b) => (b.market as number) - (a.market as number) || a.number - b.number);
  return new Map(ranked.map((h, i) => [h.number, i + 1]));
}

function categoryOf(share: number, sources: number, bestRank: number | null, marketRank: number | null): PressCategory | null {
  const t = PRESS_THRESHOLDS;
  if (sources === 0 || marketRank === null) return null;
  const sitesStrong = sources === 1 ? bestRank !== null && bestRank <= t.singleSourceTopRank : share >= t.sitesStrongShare;
  const sitesWeak = sources === 1 ? bestRank === null : share <= t.sitesWeakShare;
  if (sitesStrong && marketRank <= t.marketStrongRank) return "consensus";
  if (sitesStrong && marketRank > t.marketWeakRank) return "sites-sans-marche";
  if (sitesWeak && marketRank <= t.marketStrongRank) return "marche-sans-sites";
  return null;
}

/** Comparaison de tout le peloton. Les sélections vides sont ignorées. */
export function pressConsensus(selections: PressSelection[], field: PressInput[]): Map<number, PressHorse> {
  const usable = selections.filter((s) => s.ranks.length > 0);
  const sources = usable.length;
  const ranks = marketRanks(field);
  return new Map(
    field.map((h) => {
      const citations = usable
        .map((s) => ({ source: s.source, rank: s.ranks.indexOf(h.number) + 1, k: s.ranks.length }))
        .filter((c) => c.rank > 0);
      const sitesScore = sources === 0 ? 0 : citations.reduce((sum, c) => sum + (c.k + 1 - c.rank) / c.k, 0) / sources;
      const share = sources === 0 ? 0 : citations.length / sources;
      const meanRank = citations.length ? citations.reduce((s, c) => s + c.rank, 0) / citations.length : null;
      const bestRank = citations.length ? Math.min(...citations.map((c) => c.rank)) : null;
      const marketRank = h.nonRunner ? null : (ranks.get(h.number) ?? null);
      return [
        h.number,
        {
          number: h.number,
          citations: citations.map(({ source, rank }) => ({ source, rank })),
          sources,
          share,
          sitesScore,
          meanRank,
          marketRank,
          market: h.market,
          category: h.nonRunner ? null : categoryOf(share, sources, bestRank, marketRank),
        },
      ];
    }),
  );
}

/**
 * Degré d'accord des sources entre elles pour la course, 0 à 1 : part moyenne
 * des chevaux communs entre deux sélections (sur leurs 5 premiers). `null`
 * avec moins de deux sources.
 */
export function raceAgreement(selections: PressSelection[]): number | null {
  const tops = selections.filter((s) => s.ranks.length > 0).map((s) => new Set(s.ranks.slice(0, 5)));
  if (tops.length < 2) return null;
  let total = 0;
  let pairs = 0;
  for (let i = 0; i < tops.length; i++) {
    for (let j = i + 1; j < tops.length; j++) {
      const common = [...tops[i]].filter((n) => tops[j].has(n)).length;
      total += common / Math.min(tops[i].size, tops[j].size);
      pairs++;
    }
  }
  return total / pairs;
}

/** Libellé court du degré d'accord. */
export function agreementLabel(value: number | null): string {
  if (value === null) return "une seule source";
  if (value >= 0.7) return "fort";
  if (value >= 0.45) return "moyen";
  return "faible";
}

export function sourceLabel(key: string): string {
  return PRESS_SOURCE_LABELS[key] ?? key;
}
