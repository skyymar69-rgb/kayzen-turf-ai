/**
 * ZEturf (zeturf.fr) — « Notre choix » de la rédaction ZEturf.
 *
 * URL utilisées :
 * - programme du jour : https://www.zeturf.fr/fr/programmes-et-pronostics-du-jour
 *   (ZEturf ne publie cette liste que pour le jour courant : pour une autre date,
 *   aucune course n'est trouvée et la collecte rend « empty ») ;
 * - page course : https://www.zeturf.fr/fr/course-du-jour/{AAAA-MM-JJ}/R{r}C{c}-{slug}
 *
 * Sélection : bloc `<div id="notre-choix">` → `<div class="list">6 - 9 - 1 …</div>`,
 * à défaut les numéros de `<div class="prono-cards">` (même ordre). Le texte
 * d'analyse n'est jamais lu ni conservé.
 *
 * Rapprochement : ZEturf utilise la numérotation PMU (R/C dans l'URL). Le slug
 * (qui commence par l'hippodrome) sert de garde-fou contre une erreur de numéro.
 */

import { collected, responseProblem } from "./http.mjs";
import { matchRace } from "./mapping.mjs";
import { cleanRanks, decodeEntities, looksLikeBotChallenge } from "./parse-utils.mjs";

export const SOURCE = { key: "zeturf", label: "ZEturf", homepage: "https://www.zeturf.fr" };

const BASE = "https://www.zeturf.fr";
export const ZETURF_PROGRAMME_URL = `${BASE}/fr/programmes-et-pronostics-du-jour`;

/**
 * Liens course du programme ZEturf pour une date donnée.
 * @param {string} html
 * @param {string} date AAAA-MM-JJ
 * @returns {Array<{ reunion: number, course: number, slug: string, url: string }>}
 */
export function parseZeturfProgramme(html, date) {
  const races = new Map();
  const pattern = new RegExp(`href="(/fr/course-du-jour/${date}/R(\\d+)C(\\d+)-([a-z0-9-]+))"`, "g");
  for (const match of String(html ?? "").matchAll(pattern)) {
    const key = `R${match[2]}C${match[3]}`;
    if (races.has(key)) continue;
    races.set(key, { reunion: Number(match[2]), course: Number(match[3]), slug: match[4], url: `${BASE}${match[1]}` });
  }
  return [...races.values()];
}

/**
 * Page course ZEturf → sélection ordonnée « Notre choix », ou `null`.
 * @param {string} html
 * @returns {number[]|null}
 */
export function parseZeturfRacePage(html) {
  const text = String(html ?? "");
  const choice = text.indexOf('id="notre-choix"');
  if (choice !== -1) {
    const list = /<div class="list">([^<]*)<\/div>/.exec(text.slice(choice, choice + 20_000));
    if (list) {
      const ranks = cleanRanks(decodeEntities(list[1]).split(/[^0-9]+/).filter(Boolean));
      if (ranks) return ranks;
    }
  }
  const cards = /<div class="prono-cards">([\s\S]*?)<\/div>/.exec(text);
  if (cards) {
    const numbers = [...cards[1].matchAll(/<span class="numero-cheval-card">\s*(\d+)\s*<\/span>/g)].map((match) => match[1]);
    return cleanRanks(numbers);
  }
  return null;
}

/**
 * @param {{ date: string, races: Array<{ id: string, reunion: number|null, course: number|null, racecourse?: string|null, startTime?: string|null }>, http: { get: (url: string) => Promise<any> } }} args
 */
export async function collect({ date, races, http }) {
  const programme = await http.get(ZETURF_PROGRAMME_URL);
  const problem = responseProblem(programme, looksLikeBotChallenge);
  if (problem) return { ...problem, selections: [] };

  const siteRaces = parseZeturfProgramme(programme.text, date);
  if (siteRaces.length === 0) {
    return { status: "empty", selections: [], detail: `aucune course du ${date} au programme ZEturf (liste publiée pour le jour même seulement)` };
  }

  const pairs = [];
  for (const siteRace of siteRaces) {
    // Le slug commence par l'hippodrome (« marseille-vivaux-prix-… ») : il sert de
    // libellé d'hippodrome approximatif pour le garde-fou de matchRace.
    const race = matchRace(races, { reunion: siteRace.reunion, course: siteRace.course, racecourse: siteRace.slug.replace(/-/g, " ") });
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
    const ranks = parseZeturfRacePage(page.text);
    if (ranks) selections.push({ raceId: race.id, ranks, url: siteRace.url });
  }

  if (blocked && selections.length === 0) return { ...blocked, selections };
  return collected(selections, `${siteRaces.length} courses au programme ZEturf, ${pairs.length} rapprochées, ${selections.length} sélections`);
}
