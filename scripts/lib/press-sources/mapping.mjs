/**
 * Rapprochement d'une course publiée par un site avec NOTRE course (table `races`).
 *
 * Deux clés possibles :
 * 1. numérotation PMU (réunion R + course C) — utilisée quand le site la publie ;
 *    elle est confirmée par l'heure de départ et/ou l'hippodrome quand le site les donne,
 *    car un site peut se tromper de numéro (Geny a publié deux « R8 » le 31/10/2026) ;
 * 2. à défaut ou en cas de désaccord : hippodrome + heure de départ (Paris), qui
 *    doivent désigner UNE seule de nos courses.
 * Fonctions pures, sans réseau.
 */

import { normalizeTime } from "./parse-utils.mjs";

const STOP_WORDS = new Set(["de", "du", "des", "la", "le", "les", "sur", "en", "et", "hippodrome", "prix"]);

/** Jetons significatifs d'un nom d'hippodrome : « Rouen-Mauquenchy » → [rouen, mauquenchy]. */
export function racecourseTokens(name) {
  return String(name ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\[[^\]]*\]|\([^)]*\)/g, " ")
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length >= 3 && !STOP_WORDS.has(token));
}

/**
 * Deux libellés désignent-ils le même hippodrome ? Vrai s'ils partagent un jeton
 * (« PONT DE VIVAUX » / « Marseille-Vivaux »), ou si l'un est inconnu (`null`).
 */
export function sameRacecourse(a, b) {
  const left = racecourseTokens(a);
  const right = racecourseTokens(b);
  if (left.length === 0 || right.length === 0) return null;
  const joinedLeft = left.join("");
  const joinedRight = right.join("");
  if (joinedLeft.includes(joinedRight) || joinedRight.includes(joinedLeft)) return true;
  return left.some((token) => right.includes(token));
}

function minutesOf(time) {
  const normalized = normalizeTime(time);
  if (!normalized) return null;
  const [hours, minutes] = normalized.split(":").map(Number);
  return hours * 60 + minutes;
}

/** Heures compatibles à `toleranceMinutes` près ; `null` si l'une est inconnue. */
export function sameStartTime(a, b, toleranceMinutes = 5) {
  const left = minutesOf(a);
  const right = minutesOf(b);
  if (left === null || right === null) return null;
  return Math.abs(left - right) <= toleranceMinutes;
}

/**
 * @typedef {{ id: string, reunion: number|null, course: number|null, racecourse?: string|null, startTime?: string|null }} OurRace
 * @typedef {{ reunion?: number|null, course?: number|null, racecourse?: string|null, startTime?: string|null }} SiteRace
 */

/**
 * Trouve NOTRE course correspondant à une course du site, ou `null`.
 * @param {OurRace[]} races
 * @param {SiteRace} site
 * @returns {OurRace|null}
 */
export function matchRace(races, site) {
  const reunion = Number(site.reunion);
  const course = Number(site.course);

  if (Number.isInteger(reunion) && Number.isInteger(course)) {
    const byNumber = races.find((race) => Number(race.reunion) === reunion && Number(race.course) === course);
    if (byNumber) {
      const timeOk = sameStartTime(byNumber.startTime, site.startTime);
      const placeOk = sameRacecourse(byNumber.racecourse, site.racecourse);
      // Rejet seulement sur un désaccord AVÉRÉ (une info manquante ne disqualifie pas).
      if (timeOk !== false && placeOk !== false) return byNumber;
    }
  }

  // Repli : hippodrome + heure, qui doivent désigner une seule course.
  if (!site.startTime || !site.racecourse) return null;
  const candidates = races.filter(
    (race) => sameStartTime(race.startTime, site.startTime, 2) === true && sameRacecourse(race.racecourse, site.racecourse) === true,
  );
  return candidates.length === 1 ? candidates[0] : null;
}
