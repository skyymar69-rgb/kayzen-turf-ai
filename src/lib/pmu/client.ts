/**
 * Accès à l'API PMU depuis le code TypeScript (site et boucle de
 * rafraîchissement). Même comportement que `scripts/lib/pmu-fetch.mjs`, utilisé
 * par l'import : reprises sur coupure réseau, délai maximal par requête.
 */

export const PMU_BASE = "https://offline.turfinfo.api.pmu.fr/rest/client/7/programme";
const USER_AGENT = "KayzenTurf/1.0 contact:github.com/skyymar69-rgb/kayzen-turf-ai";

const FETCH_ATTEMPTS = 3;
const RETRYABLE_STATUS = new Set([408, 425, 429, 500, 502, 503, 504]);

export function delay(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

export async function fetchPmuJson<T = unknown>(url: string, timeoutMs = 10_000): Promise<T> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= FETCH_ATTEMPTS; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: { Accept: "application/json", "User-Agent": USER_AGENT },
        signal: AbortSignal.timeout(timeoutMs),
        cache: "no-store",
      });
      if (response.ok) return (await response.json()) as T;

      const error = new Error(`PMU ${response.status} sur ${url}`);
      if (!RETRYABLE_STATUS.has(response.status)) throw Object.assign(error, { permanent: true });
      lastError = error;
    } catch (error) {
      if ((error as { permanent?: boolean })?.permanent) throw error;
      lastError = error;
    }
    if (attempt < FETCH_ATTEMPTS) await delay(attempt * 1500);
  }

  throw lastError;
}

export type PmuParticipant = {
  numPmu: number | string;
  statut?: string;
  reductionKilometrique?: number | string | null;
  dernierRapportDirect?: { rapport?: number } | null;
  dernierRapportReference?: { rapport?: number } | null;
  rapportProbable?: number | null;
};

/** Cote retenue pour un partant, dans l'ordre de fiabilité décroissante. */
export function participantOdds(participant: PmuParticipant): number {
  return Number(
    participant?.dernierRapportDirect?.rapport ??
      participant?.dernierRapportReference?.rapport ??
      participant?.rapportProbable ??
      0,
  );
}

export type PmuOddsSource = "direct" | "reference" | "probable";

/**
 * Cote retenue ET son origine — même ordre que `participantOdds`, même règle
 * que `getOddsWithSource` (scripts/lib/pmu-fetch.mjs). Une cote probable ou de
 * référence n'est pas un prix de marché vivant : l'origine est stockée dans
 * `entries.odds_source` pour que la page le dise (src/lib/odds-freshness.ts).
 */
export function participantOddsWithSource(participant: PmuParticipant): { odds: number; source: PmuOddsSource | null } {
  const candidates: Array<[PmuOddsSource, unknown]> = [
    ["direct", participant?.dernierRapportDirect?.rapport],
    ["reference", participant?.dernierRapportReference?.rapport],
    ["probable", participant?.rapportProbable],
  ];
  for (const [source, value] of candidates) {
    if (value == null) continue;
    const odds = Number(value);
    return odds > 1 ? { odds, source } : { odds: 0, source: null };
  }
  return { odds: 0, source: null };
}

/**
 * Terrain publié par l'organisateur (pénétromètre), `null` s'il n'est pas
 * renseigné. Le champ vit sur la COURSE (`/R1/C4`), pas sur la réunion, et
 * n'existe en pratique qu'en plat et obstacle : au trot, rien n'est écrit.
 */
export function goingFromCourse(course: { penetrometre?: { intitule?: string | null } | null } | null | undefined): string | null {
  const value = course?.penetrometre?.intitule;
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

/** « 2026-10-02-R1-C4 » → éléments d'URL PMU. */
export function pmuPathFromRaceId(raceId: string) {
  const match = raceId.match(/^(\d{4})-(\d{2})-(\d{2})-R(\d+)-C(\d+)$/);
  if (!match) return null;
  const [, year, month, day, reunion, course] = match;
  return { pmuDate: `${day}${month}${year}`, reunion: Number(reunion), course: Number(course) };
}

export function pmuRaceUrl(raceId: string, suffix = "") {
  const path = pmuPathFromRaceId(raceId);
  if (!path) return null;
  return `${PMU_BASE}/${path.pmuDate}/R${path.reunion}/C${path.course}${suffix}`;
}
