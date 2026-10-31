/**
 * Canalturf (canalturf.com) — « La sélection de … » de la rédaction Canalturf.
 *
 * URL utilisées :
 * - liste du jour : https://www.canalturf.com/courses_liste_pronostics.php
 * - liste du lendemain : https://www.canalturf.com/courses_liste_pronostics_demain.php
 * - page course : https://www.canalturf.com/pronostics-PMU/{AAAA-MM-JJ}/{hippodrome}/{id}_{slug}.html
 *
 * Sélection : tableaux BASE / CHANCES REGULIERES / OUTSIDERS qui suivent le titre
 * « La sélection de … », lus dans l'ordre d'affichage. Les commentaires ne sont
 * jamais lus ni conservés (ni le pronostic ZEturf repris sur la même page).
 *
 * Rapprochement : la liste donne « Réunion N - HIPPODROME », le numéro de course et
 * l'heure (Paris), en numérotation PMU. R/C confirmés par l'heure et l'hippodrome ;
 * l'en-tête de la page course (« 15:15 - Réunion 1 Course 3 - DEAUVILLE ») est
 * revérifié avant d'enregistrer.
 */

import { collected, responseProblem } from "./http.mjs";
import { matchRace } from "./mapping.mjs";
import { cleanRanks, decodeEntities, looksLikeBotChallenge, normalizeTime } from "./parse-utils.mjs";

export const SOURCE = { key: "canalturf", label: "Canalturf", homepage: "https://www.canalturf.com" };

const BASE = "https://www.canalturf.com";

/**
 * URL de la liste à lire pour `date`, ou `null` si Canalturf ne la publie pas
 * sous une adresse stable (seuls le jour même et le lendemain le sont).
 * @param {string} date AAAA-MM-JJ
 * @param {string} today AAAA-MM-JJ (Paris)
 * @param {string} tomorrow AAAA-MM-JJ (Paris)
 */
export function canalturfListUrl(date, today, tomorrow) {
  if (date === today) return `${BASE}/courses_liste_pronostics.php`;
  if (date === tomorrow) return `${BASE}/courses_liste_pronostics_demain.php`;
  return null;
}

/**
 * Liste Canalturf → courses du jour `date`.
 * @param {string} html
 * @param {string} date
 * @returns {Array<{ reunion: number, course: number, racecourse: string, startTime: string|null, url: string }>}
 */
export function parseCanalturfList(html, date) {
  const text = String(html ?? "");
  const races = [];
  const seen = new Set();
  const sections = text.split(/<div id="h\d+" class="panel/).slice(1);
  for (const section of sections) {
    const heading = /Réunion\s+(\d+)\s*-\s*([^<]+)<\/h2>/.exec(section);
    if (!heading) continue;
    const reunion = Number(heading[1]);
    const racecourse = decodeEntities(heading[2]).trim();
    const linkPattern = new RegExp(
      `href="(https://www\\.canalturf\\.com/pronostics-PMU/${date}/[^"]+\\.html)"><div class="row"><div class="col-xs-2"><span class="badge[^"]*">(\\d+)</span>[\\s\\S]*?<div class="col-xs-2">(\\d{1,2}:\\d{2})`,
      "g",
    );
    for (const match of section.matchAll(linkPattern)) {
      if (seen.has(match[1])) continue;
      seen.add(match[1]);
      races.push({ reunion, course: Number(match[2]), racecourse, startTime: normalizeTime(match[3]), url: match[1] });
    }
  }
  return races;
}

/**
 * Page course Canalturf → `{ reunion, course, startTime, ranks }` ; `ranks` vaut `null`
 * si la sélection n'est pas (encore) publiée.
 * @param {string} html
 */
export function parseCanalturfRacePage(html) {
  const text = String(html ?? "");
  const header = /(\d{1,2}:\d{2})\s*-\s*Réunion\s+(\d+)\s+Course\s+(\d+)/.exec(text);
  const start = text.search(/<h3>La s(?:&eacute;|é)lection de/);
  let ranks = null;
  if (start !== -1) {
    const rest = text.slice(start + 4);
    const end = rest.search(/<h3|<hr/);
    const block = end === -1 ? rest.slice(0, 10_000) : rest.slice(0, end);
    ranks = cleanRanks([...block.matchAll(/<td width="30">\s*(\d+)\s*<\/td>/g)].map((match) => match[1]));
  }
  return {
    reunion: header ? Number(header[2]) : null,
    course: header ? Number(header[3]) : null,
    startTime: header ? normalizeTime(header[1]) : null,
    ranks,
  };
}

function parisDayOffset(offset) {
  const today = new Intl.DateTimeFormat("fr-CA", { timeZone: "Europe/Paris" }).format(new Date());
  const [year, month, day] = today.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + offset, 12)).toISOString().slice(0, 10);
}

/**
 * @param {{ date: string, races: Array<{ id: string, reunion: number|null, course: number|null, racecourse?: string|null, startTime?: string|null }>, http: { get: (url: string) => Promise<any> } }} args
 */
export async function collect({ date, races, http }) {
  const listUrl = canalturfListUrl(date, parisDayOffset(0), parisDayOffset(1));
  if (!listUrl) return { status: "empty", selections: [], detail: `Canalturf ne publie une liste stable que pour aujourd'hui et demain (${date})` };

  const list = await http.get(listUrl);
  const problem = responseProblem(list, looksLikeBotChallenge);
  if (problem) return { ...problem, selections: [] };

  const siteRaces = parseCanalturfList(list.text, date);
  if (siteRaces.length === 0) return { status: "empty", selections: [], detail: "aucune course dans la liste Canalturf" };

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
    const parsed = parseCanalturfRacePage(page.text);
    // Revérification : l'en-tête de la page doit désigner la même course que la liste.
    if (parsed.reunion !== siteRace.reunion || parsed.course !== siteRace.course) continue;
    if (parsed.ranks) selections.push({ raceId: race.id, ranks: parsed.ranks, url: siteRace.url });
  }

  if (blocked && selections.length === 0) return { ...blocked, selections };
  return collected(selections, `${siteRaces.length} courses listées par Canalturf, ${pairs.length} rapprochées, ${selections.length} sélections`);
}
