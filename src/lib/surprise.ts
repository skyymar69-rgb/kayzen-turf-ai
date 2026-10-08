/**
 * SCORE DE SURPRISE — les chevaux que l'IA juge sous-estimés, expliqués.
 *
 * Une note de 0 à 100 par partant, somme de cinq briques lisibles, publiées
 * telles quelles sur la page /methode :
 *
 *   Écart IA / marché   40 pts  rapport IA ÷ marché (2,5 fois ou plus = plein),
 *                               pondéré par la probabilité de l'IA : 3 fois 1 %
 *                               ne vaut pas 3 fois 8 %.
 *   Rang de l'IA        15 pts  1er de l'IA 15, 2e 12, 3e 10, 4e 7, 5e 5, 6e-8e 2.
 *   Forme               15 pts  cinq dernières courses de la musique : victoire 4,
 *                               2e-3e 3, 4e-5e 1, incident −2.
 *   Entourage           10 pts  réussite du jockey/driver et de l'entraîneur,
 *                               rétrécie vers la moyenne (3 sur 5 ≠ 60 %).
 *   Marché du jour      20 pts  MVT et argent : joué, argent entrant, smart
 *                               money montent la note ; délaissé ne l'annule
 *                               pas — c'est souvent là que naît la surprise —,
 *                               l'argent sortant la baisse.
 *
 * Alertes : un cheval n'est signalé que si l'IA le voit au-dessus du marché
 * (rapport ≥ SURPRISE_MIN_RATIO). Le type dépend de la cote (Top value, Surprise
 * IA, Tocard malin), le niveau de la note (forte, possible, à surveiller).
 *
 * CE QUE LE SCORE N'EST PAS. Mesuré sur 1 571 courses (24/08 → 07/10/2026,
 * hors période d'entraînement du modèle), contre la cote FINALE : aucune brique
 * n'annonce plus de gagnants ni plus de placés que la cote elle-même — le
 * marché de clôture intègre déjà forme, entourage et avis de l'IA. Le score
 * est un outil de lecture : il dit où l'IA et le marché divergent, et pourquoi.
 * Sa rentabilité réelle (simple gagnant et placé, rapports officiels) est
 * mesurée par le backtest (signaux `surprise-*`) et affichée à côté de lui.
 */

import type { MarketSignal } from "@/lib/confrontation";
import type { Movement } from "@/lib/market";
import { tokenizeMusic } from "@/lib/prediction-math";

export const SURPRISE_VERSION = "surprise-v1";

export const SURPRISE_WEIGHTS = { value: 40, ia: 15, forme: 15, entourage: 10, marche: 20 } as const;
export type SurprisePart = keyof typeof SURPRISE_WEIGHTS;

export const SURPRISE_PART_LABELS: Record<SurprisePart, string> = {
  value: "Écart IA / marché",
  ia: "Rang de l'IA",
  forme: "Forme",
  entourage: "Entourage",
  marche: "Marché du jour",
};

/** Rapport IA ÷ marché qui donne la totalité des points d'écart. */
export const SURPRISE_FULL_RATIO = 2.5;
/** Sous cette probabilité IA (%), les points d'écart sont réduits d'autant. */
export const SURPRISE_FULL_AI_PCT = 6;
/** Un cheval n'est signalé que si l'IA lui donne au moins 1,25 fois la probabilité du marché. */
export const SURPRISE_MIN_RATIO = 1.25;
/** Le favori du marché n'est pas une surprise : sous 4/1, pas d'alerte. */
export const SURPRISE_MIN_ODDS = 4;
/** Bornes de cote des trois types d'alerte. */
export const SURPRISE_ODDS_BANDS = { value: 10, tocard: 30 } as const;
/** Notes minimales des trois niveaux. */
export const SURPRISE_LEVELS = { forte: 68, possible: 56, surveiller: 46 } as const;

export type SurpriseKind = "value" | "surprise" | "tocard";
export type SurpriseLevel = keyof typeof SURPRISE_LEVELS;

export const SURPRISE_KIND_LABELS: Record<SurpriseKind, string> = {
  value: "Top value",
  surprise: "Surprise IA",
  tocard: "Tocard malin",
};

export const SURPRISE_LEVEL_LABELS: Record<SurpriseLevel, string> = {
  forte: "Signal fort",
  possible: "Surprise possible",
  surveiller: "À surveiller",
};

export type SurpriseAlert = { kind: SurpriseKind; level: SurpriseLevel };

export type SurpriseInput = {
  number: number;
  /** Cote PMU actuelle, `null` sans cote. */
  odds: number | null;
  /** Probabilité de l'IA, sans cote (%). */
  ai: number | null;
  /** Probabilité du marché, marge retirée (%). */
  market: number | null;
  music?: string | null;
  jockeyWins?: number | null;
  jockeyRuns?: number | null;
  trainerWins?: number | null;
  trainerRuns?: number | null;
  movement?: Pick<Movement, "direction" | "changePct"> | null;
  signals?: readonly MarketSignal[];
  nonRunner?: boolean;
};

export type Surprise = {
  /** Note de 0 à 100. */
  score: number;
  parts: Record<SurprisePart, number>;
  /** IA ÷ marché, `null` sans l'un des deux avis. */
  ratio: number | null;
  /** Rang du cheval chez l'IA, `null` sans avis de l'IA. */
  aiRank: number | null;
  alert: SurpriseAlert | null;
  /** Raisons courtes, de la plus forte à la plus faible. */
  reasons: string[];
  /** Conclusion d'une ligne, `null` sans alerte. */
  conclusion: string | null;
};

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const round1 = (v: number) => Math.round(v * 10) / 10;
const fr = (v: number, digits = 0) => v.toFixed(digits).replace(".", ",");

/** Taux de réussite rétréci vers 9 % : même règle que le modèle fondamental. */
export function shrunkRate(wins?: number | null, runs?: number | null): number {
  const r = Math.max(0, Number(runs) || 0);
  const w = clamp(Number(wins) || 0, 0, r);
  return (w + 0.09 * 30) / (r + 30);
}

function valuePoints(ai: number | null, market: number | null): number {
  if (ai === null || market === null || !(market > 0) || !(ai > 0)) return 0;
  const strength = clamp(Math.log(ai / market) / Math.log(SURPRISE_FULL_RATIO), 0, 1);
  const weight = clamp(ai / SURPRISE_FULL_AI_PCT, 0.25, 1);
  return SURPRISE_WEIGHTS.value * strength * weight;
}

const IA_RANK_POINTS = [15, 12, 10, 7, 5, 2, 2, 2];

function iaPoints(aiRank: number | null): number {
  return aiRank === null ? 0 : (IA_RANK_POINTS[aiRank - 1] ?? 0);
}

type FormReading = { points: number; wins: number; places: number; incidents: number; known: number };

export function formReading(music?: string | null): FormReading {
  const last5 = tokenizeMusic(music, 5);
  if (last5.length === 0) return { points: 5, wins: 0, places: 0, incidents: 0, known: 0 };
  let points = 0;
  let wins = 0;
  let places = 0;
  let incidents = 0;
  for (const t of last5) {
    if (t.kind === "inc") {
      points -= 2;
      incidents++;
    } else if (t.value === 1) {
      points += 4;
      wins++;
      places++;
    } else if (t.value <= 3) {
      points += 3;
      places++;
    } else if (t.value <= 5) points += 1;
  }
  return { points: clamp(points, 0, SURPRISE_WEIGHTS.forme), wins, places, incidents, known: last5.length };
}

function entouragePoints(input: SurpriseInput): { points: number; jockey: number; trainer: number } {
  const jockey = shrunkRate(input.jockeyWins, input.jockeyRuns);
  const trainer = shrunkRate(input.trainerWins, input.trainerRuns);
  const half = SURPRISE_WEIGHTS.entourage / 2;
  const part = (rate: number) => clamp((rate - 0.07) / 0.1, 0, 1) * half;
  return { points: part(jockey) + part(trainer), jockey, trainer };
}

function marketPoints(input: SurpriseInput): number {
  const direction = input.movement?.direction ?? "inconnu";
  const change = input.movement?.changePct ?? null;
  let points =
    direction === "joue" ? 10 + clamp(-(change ?? 0) / 40, 0, 1) * 6 : direction === "stable" ? 8 : direction === "delaisse" ? 5 : 7;
  const signals = input.signals ?? [];
  if (signals.includes("argent")) points += 4;
  if (signals.includes("acceleration")) points += 2;
  if (signals.includes("smart")) points += 4;
  if (signals.includes("sortant")) points -= 5;
  return clamp(points, 0, SURPRISE_WEIGHTS.marche);
}

export function surpriseKind(odds: number): SurpriseKind {
  return odds < SURPRISE_ODDS_BANDS.value ? "value" : odds < SURPRISE_ODDS_BANDS.tocard ? "surprise" : "tocard";
}

export function surpriseLevel(score: number): SurpriseLevel | null {
  if (score >= SURPRISE_LEVELS.forte) return "forte";
  if (score >= SURPRISE_LEVELS.possible) return "possible";
  if (score >= SURPRISE_LEVELS.surveiller) return "surveiller";
  return null;
}

/** Note d'un partant. `aiRank` : rang du cheval chez l'IA dans sa course. */
export function surpriseScore(input: SurpriseInput, aiRank: number | null): Surprise {
  const ai = input.ai !== null && Number.isFinite(input.ai) ? input.ai : null;
  const market = input.market !== null && Number.isFinite(input.market) ? input.market : null;
  const ratio = ai !== null && market !== null && market > 0 ? ai / market : null;
  const form = formReading(input.music);
  const entourage = entouragePoints(input);

  const parts: Record<SurprisePart, number> = {
    value: round1(valuePoints(ai, market)),
    ia: iaPoints(aiRank),
    forme: form.points,
    entourage: round1(entourage.points),
    marche: round1(marketPoints(input)),
  };
  const score = input.nonRunner ? 0 : Math.round(Object.values(parts).reduce((a, b) => a + b, 0));

  const odds = input.odds !== null && Number.isFinite(input.odds) && input.odds > 1 ? input.odds : null;
  const level = surpriseLevel(score);
  const eligible = !input.nonRunner && odds !== null && odds >= SURPRISE_MIN_ODDS && ratio !== null && ratio >= SURPRISE_MIN_RATIO;
  const kind = odds !== null ? surpriseKind(odds) : null;
  // L'IA, moins tranchée que le marché, remonte presque toutes les grosses
  // cotes : un tocard n'est signalé qu'au niveau fort, sinon « à surveiller ».
  const alertLevel = kind === "tocard" && level === "possible" ? "surveiller" : level;
  const alert: SurpriseAlert | null = eligible && kind && alertLevel ? { kind, level: alertLevel } : null;

  return {
    score,
    parts,
    ratio,
    aiRank,
    alert,
    reasons: reasonsFor({ ai, market, ratio, aiRank, form, entourage, input }),
    conclusion: alert ? conclusionFor(alert, input.movement?.direction ?? "inconnu") : null,
  };
}

function reasonsFor(x: {
  ai: number | null;
  market: number | null;
  ratio: number | null;
  aiRank: number | null;
  form: FormReading;
  entourage: { jockey: number; trainer: number };
  input: SurpriseInput;
}): string[] {
  const reasons: Array<{ weight: number; text: string }> = [];
  if (x.ratio !== null && x.ai !== null && x.market !== null) {
    if (x.ratio >= SURPRISE_MIN_RATIO) {
      reasons.push({ weight: 10, text: `Sous-estimé par le marché : IA ${fr(x.ai, 1)} % contre ${fr(x.market, 1)} % (× ${fr(x.ratio, 1)})` });
    } else if (x.ratio < 0.8) {
      reasons.push({ weight: 3, text: `Le marché y croit plus que l'IA (${fr(x.market, 1)} % contre ${fr(x.ai, 1)} %)` });
    }
  }
  if (x.aiRank !== null && x.aiRank <= 3) reasons.push({ weight: 8 - x.aiRank, text: `${x.aiRank === 1 ? "1er" : `${x.aiRank}e`} de l'IA` });
  if (x.form.known > 0) {
    if (x.form.places >= 2) {
      const detail = x.form.wins > 0 ? `${x.form.wins} victoire${x.form.wins > 1 ? "s" : ""} et ${x.form.places} podiums` : `${x.form.places} podiums`;
      reasons.push({ weight: 6, text: `Bonne forme : ${detail} sur ses ${x.form.known} dernières courses` });
    } else if (x.form.incidents >= 2) {
      reasons.push({ weight: 4, text: `Forme irrégulière : ${x.form.incidents} incidents sur ses ${x.form.known} dernières courses` });
    }
  }
  if (x.entourage.jockey >= 0.14) reasons.push({ weight: 5, text: `Jockey/driver en réussite (${fr(x.entourage.jockey * 100)} %)` });
  if (x.entourage.trainer >= 0.14) reasons.push({ weight: 5, text: `Entraîneur en réussite (${fr(x.entourage.trainer * 100)} %)` });
  const direction = x.input.movement?.direction;
  const change = x.input.movement?.changePct;
  if (direction === "joue" && change != null) reasons.push({ weight: 7, text: `Joué depuis le matin (cote ${fr(change)} %)` });
  if (direction === "delaisse" && change != null) reasons.push({ weight: 4, text: `Délaissé depuis le matin (cote +${fr(change)} %)` });
  const signals = x.input.signals ?? [];
  if (signals.includes("smart")) reasons.push({ weight: 9, text: "Smart money : l'argent entre et l'IA confirme" });
  else if (signals.includes("argent")) reasons.push({ weight: 6, text: "Argent entrant sur 15 min" });
  if (signals.includes("sortant")) reasons.push({ weight: 5, text: "Argent sortant sur 15 min" });
  return reasons.sort((a, b) => b.weight - a.weight).map((r) => r.text);
}

function conclusionFor(alert: SurpriseAlert, direction: Movement["direction"]): string {
  if (alert.kind === "tocard") return direction === "delaisse" ? "Le marché le délaisse, l'IA y croit : surprise possible" : "Grosse cote que l'IA remonte : surprise possible";
  if (alert.kind === "surprise") return alert.level === "forte" ? "Sous-estimé par le marché : à surveiller de près" : "Sous-estimé par le marché : à surveiller";
  return alert.level === "forte" ? "Très bonne valeur à sa cote" : "Bonne valeur à sa cote";
}

/** Rang de chaque cheval chez l'IA (1 = plus haute probabilité), `null` sans avis. */
export function aiRanks(field: Array<{ number: number; ai: number | null; nonRunner?: boolean }>): Map<number, number> {
  const ranked = field
    .filter((h) => h.ai !== null && Number.isFinite(h.ai) && !h.nonRunner)
    .sort((a, b) => (b.ai as number) - (a.ai as number) || a.number - b.number);
  return new Map(ranked.map((h, i) => [h.number, i + 1]));
}

/**
 * Au plus trois alertes « forte » ou « possible » par course : au-delà, une
 * alerte ne désigne plus rien. Les suivantes descendent à « à surveiller ».
 */
export const SURPRISE_MAX_PER_RACE = 3;

/** Note tout le peloton d'un coup : le rang de l'IA se lit à l'échelle de la course. */
export function scoreField(field: SurpriseInput[]): Map<number, Surprise> {
  const ranks = aiRanks(field);
  const scored = field.map((h) => [h.number, surpriseScore(h, ranks.get(h.number) ?? null)] as const);
  const kept = new Set(
    scored
      .filter(([, s]) => s.alert && s.alert.level !== "surveiller")
      .sort(([, a], [, b]) => compareSurprise(a, b))
      .slice(0, SURPRISE_MAX_PER_RACE)
      .map(([n]) => n),
  );
  return new Map(
    scored.map(([n, s]) => {
      if (!s.alert || s.alert.level === "surveiller" || kept.has(n)) return [n, s];
      const alert: SurpriseAlert = { ...s.alert, level: "surveiller" };
      return [n, { ...s, alert, conclusion: conclusionFor(alert, field.find((h) => h.number === n)?.movement?.direction ?? "inconnu") }];
    }),
  );
}

/** Ordre d'affichage des alertes : niveau, puis note. */
const LEVEL_ORDER: SurpriseLevel[] = ["forte", "possible", "surveiller"];

export function compareSurprise(a: Surprise, b: Surprise): number {
  const la = a.alert ? LEVEL_ORDER.indexOf(a.alert.level) : LEVEL_ORDER.length;
  const lb = b.alert ? LEVEL_ORDER.indexOf(b.alert.level) : LEVEL_ORDER.length;
  return la - lb || b.score - a.score;
}

/** Les `n` meilleures surprises signalées (forte ou possible) d'une liste. */
export function topSurprises<T extends { surprise: Surprise }>(items: T[], n = 3): T[] {
  return items
    .filter((x) => x.surprise.alert && x.surprise.alert.level !== "surveiller")
    .sort((a, b) => compareSurprise(a.surprise, b.surprise))
    .slice(0, n);
}
