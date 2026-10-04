/**
 * « CE QUI A CHANGÉ DEPUIS VOTRE DERNIÈRE VISITE »
 *
 * À chaque visite, la page course garde dans le navigateur (localStorage) une
 * photographie compacte de la course : cote de chaque numéro, non-partants,
 * phrase du verdict, ordre du Top 3. À la visite suivante, la comparaison dit
 * ce qui a bougé entre-temps. Rien ne quitte le navigateur.
 *
 * Un cheval présent la dernière fois et absent aujourd'hui est compté comme
 * non-partant : l'import PMU n'écrit que les partants, son retrait est donc la
 * trace la plus fiable d'un forfait.
 */

export const VISIT_SNAPSHOT_VERSION = 1;
export const VISIT_STORAGE_PREFIX = "kz-visite:";

/** En deçà, une variation de cote n'est pas signalée : arrondis et bruit. */
const ODDS_EPSILON = 0.05;
/** Au-delà, la visite précédente est trop ancienne pour être comparée utilement. */
export const VISIT_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

export type VisitSnapshot = {
  v: typeof VISIT_SNAPSHOT_VERSION;
  /** Instant de la visite (ms). */
  at: number;
  /** Cote par numéro, `null` si non publiée. */
  odds: Record<string, number | null>;
  /** Numéros déclarés non-partants. */
  np: number[];
  /** Phrase du verdict. */
  s: string;
  top3: number[];
};

export type VisitInput = {
  horses: Array<{ number: number; odds: number | null; nonRunner: boolean }>;
  sentence: string;
  top3: number[];
};

export type OddsChange = { number: number; before: number | null; after: number | null };

export type VisitDiff = {
  since: number;
  oddsChanges: OddsChange[];
  newNonRunners: number[];
  verdictBefore: string | null;
  verdictAfter: string | null;
  top3Before: number[] | null;
  top3After: number[] | null;
};

export function visitStorageKey(raceId: string): string {
  return `${VISIT_STORAGE_PREFIX}${raceId}`;
}

export function buildVisitSnapshot(input: VisitInput, at: number): VisitSnapshot {
  const odds: Record<string, number | null> = {};
  for (const h of input.horses) odds[String(h.number)] = h.odds !== null && Number.isFinite(h.odds) && h.odds > 1 ? h.odds : null;
  return {
    v: VISIT_SNAPSHOT_VERSION,
    at,
    odds,
    np: input.horses.filter((h) => h.nonRunner).map((h) => h.number),
    s: input.sentence,
    top3: [...input.top3],
  };
}

const isNumberArray = (value: unknown): value is number[] => Array.isArray(value) && value.every((n) => Number.isInteger(n));

/** Lecture défensive : le stockage peut contenir n'importe quoi, d'une autre version ou d'une autre main. */
export function parseVisitSnapshot(raw: string | null): VisitSnapshot | null {
  if (!raw || raw.length > 20_000) return null;
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!value || typeof value !== "object") return null;
  const v = value as Record<string, unknown>;
  if (v.v !== VISIT_SNAPSHOT_VERSION || typeof v.at !== "number" || !Number.isFinite(v.at)) return null;
  if (typeof v.s !== "string" || !isNumberArray(v.np) || !isNumberArray(v.top3)) return null;
  if (!v.odds || typeof v.odds !== "object" || Array.isArray(v.odds)) return null;
  const odds: Record<string, number | null> = {};
  for (const [key, o] of Object.entries(v.odds as Record<string, unknown>)) {
    if (!/^\d{1,2}$/.test(key)) return null;
    if (o !== null && (typeof o !== "number" || !Number.isFinite(o))) return null;
    odds[key] = o as number | null;
  }
  return { v: VISIT_SNAPSHOT_VERSION, at: v.at, odds, np: v.np, s: v.s, top3: v.top3 };
}

function oddsMoved(a: number | null, b: number | null): boolean {
  if (a === null || b === null) return a !== b;
  return Math.abs(a - b) >= ODDS_EPSILON;
}

export function diffVisit(before: VisitSnapshot, after: VisitSnapshot): VisitDiff {
  const oddsChanges: OddsChange[] = [];
  for (const [key, now] of Object.entries(after.odds)) {
    if (!(key in before.odds)) continue;
    const then = before.odds[key];
    if (oddsMoved(then, now)) oddsChanges.push({ number: Number(key), before: then, after: now });
  }
  const knownNp = new Set(before.np);
  const declared = after.np.filter((n) => !knownNp.has(n));
  const withdrawn = Object.keys(before.odds)
    .filter((key) => !(key in after.odds))
    .map(Number)
    .filter((n) => !knownNp.has(n));
  const verdictChanged = before.s !== after.s;
  const top3Changed = before.top3.join("-") !== after.top3.join("-");
  return {
    since: before.at,
    oddsChanges: oddsChanges.sort((a, b) => a.number - b.number),
    newNonRunners: [...new Set([...declared, ...withdrawn])].sort((a, b) => a - b),
    verdictBefore: verdictChanged ? before.s : null,
    verdictAfter: verdictChanged ? after.s : null,
    top3Before: top3Changed ? before.top3 : null,
    top3After: top3Changed ? after.top3 : null,
  };
}

export function visitHasChanges(diff: VisitDiff): boolean {
  return diff.oddsChanges.length > 0 || diff.newNonRunners.length > 0 || diff.verdictAfter !== null || diff.top3After !== null;
}
