/**
 * Geny (geny.com) — pronostic de la rédaction Geny.
 *
 * URL utilisées :
 * - programme du jour : https://www.geny.com/programme/{AAAA-MM-JJ}
 * - page course : https://www.geny.com/course/{idGeny}-{slug}/partants-pronostics
 *
 * Les pages sont rendues par Next.js : les données arrivent dans le flux RSC
 * (`self.__next_f.push([1,"…"])`). On ne lit QUE le bloc `geny` (le pronostic
 * de la rédaction Geny) : la page reprend aussi les pronostics d'autres
 * journaux (`presse`), qui ne sont pas couverts par l'accord et sont ignorés.
 * La sélection ordonnée = `metaData.listeBase` puis `metaData.listeBelleChance`
 * (les outsiders ne font pas partie de la sélection). Aucun texte n'est conservé.
 *
 * Rapprochement : Geny donne le numéro PMU de la réunion (`numeroPmu`), le numéro
 * de course et l'heure (Paris). R/C confirmés par l'heure ; en cas de désaccord
 * (Geny a déjà publié deux réunions « R8 » le même jour), repli sur hippodrome + heure.
 */

import { collected, responseProblem } from "./http.mjs";
import { matchRace } from "./mapping.mjs";
import { cleanRanks, looksLikeBotChallenge, normalizeTime, readBalancedJson } from "./parse-utils.mjs";

export const SOURCE = { key: "geny", label: "Geny", homepage: "https://www.geny.com" };

const BASE = "https://www.geny.com";

/** Concatène les morceaux du flux RSC Next.js présents dans la page. */
export function decodeNextFlight(html) {
  let payload = "";
  for (const match of String(html ?? "").matchAll(/self\.__next_f\.push\(\[1,("(?:[^"\\]|\\.)*")\]\)/g)) {
    try {
      payload += JSON.parse(match[1]);
    } catch {
      // morceau illisible : ignoré
    }
  }
  return payload;
}

/**
 * Programme Geny d'une journée → courses avec numérotation PMU.
 * @param {string} html
 * @returns {Array<{ genyId: number, slug: string, reunion: number|null, course: number|null, startTime: string|null, racecourse: string|null, url: string }>}
 */
export function parseGenyProgramme(html) {
  const payload = decodeNextFlight(html);
  const races = [];
  const seen = new Set();
  let index = payload.indexOf('{"reunion":{');
  while (index !== -1) {
    const block = readBalancedJson(payload, index);
    if (block?.reunion && Array.isArray(block.courseInfos)) {
      for (const info of block.courseInfos) {
        if (!info?.id || !info.slug || seen.has(info.id)) continue;
        seen.add(info.id);
        races.push({
          genyId: Number(info.id),
          slug: String(info.slug),
          reunion: Number.isInteger(block.reunion.numeroPmu) ? block.reunion.numeroPmu : null,
          course: Number.isInteger(info.numeroCourse) ? info.numeroCourse : null,
          startTime: normalizeTime(info.heureCourse),
          racecourse: block.reunion.hippodrome?.nom ?? block.reunion.nomReunion ?? null,
          url: `${BASE}/course/${info.id}-${info.slug}/partants-pronostics`,
        });
      }
    }
    index = payload.indexOf('{"reunion":{', index + 12);
  }
  return races;
}

/**
 * Page course Geny → sélection ordonnée de la rédaction Geny, ou `null`
 * (pas encore publiée, ou course sans pronostic Geny).
 * @param {string} html
 * @returns {number[]|null}
 */
export function parseGenyRacePage(html) {
  const payload = decodeNextFlight(html);
  const start = payload.indexOf('{"geny":');
  if (start === -1) return null;
  const data = readBalancedJson(payload, start);
  const meta = data?.geny?.metaData;
  if (!meta) return null;
  const numbers = [...(meta.listeBase ?? []), ...(meta.listeBelleChance ?? [])].map((horse) => horse?.numero);
  return cleanRanks(numbers);
}

/**
 * @param {{ date: string, races: Array<{ id: string, reunion: number|null, course: number|null, racecourse?: string|null, startTime?: string|null }>, http: { get: (url: string) => Promise<any> } }} args
 */
export async function collect({ date, races, http }) {
  const programmeUrl = `${BASE}/programme/${date}`;
  const programme = await http.get(programmeUrl);
  const problem = responseProblem(programme, looksLikeBotChallenge);
  if (problem) return { ...problem, selections: [] };

  const siteRaces = parseGenyProgramme(programme.text);
  if (siteRaces.length === 0) return { status: "error", selections: [], detail: "programme Geny illisible (format changé ?)" };

  const pairs = [];
  for (const siteRace of siteRaces) {
    const race = matchRace(races, siteRace);
    if (race) pairs.push({ race, siteRace });
  }

  const selections = [];
  let blocked = null;
  for (const { race, siteRace } of pairs) {
    const page = await http.get(siteRace.url);
    const pageProblem = responseProblem(page, looksLikeBotChallenge);
    if (pageProblem?.status === "blocked") {
      blocked = pageProblem;
      break;
    }
    if (pageProblem) continue;
    const ranks = parseGenyRacePage(page.text);
    if (ranks) selections.push({ raceId: race.id, ranks, url: siteRace.url });
  }

  if (blocked && selections.length === 0) return { ...blocked, selections };
  return collected(selections, `${siteRaces.length} courses au programme Geny, ${pairs.length} rapprochées, ${selections.length} pronostics Geny publiés`);
}
