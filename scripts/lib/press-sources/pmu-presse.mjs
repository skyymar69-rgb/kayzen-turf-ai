/**
 * PMU — pronostic presse (source DATAHIPPIQUE) publié par l'API PMU.
 *
 * URL : https://online.turfinfo.api.pmu.fr/rest/client/61/programme/{JJMMAAAA}/R{r}/C{c}/pronostics
 * Réponse : `{ selection: [{ num_partant, rang, … }], source: "DATAHIPPIQUE" }`.
 * Seuls `num_partant` triés par `rang` sont gardés ; les commentaires sont ignorés.
 *
 * Rapprochement : direct, l'API est interrogée avec NOS numéros de réunion et de
 * course (numérotation PMU). Une course sans pronostic répond 204/404 : ignorée.
 */

import { collected, responseProblem } from "./http.mjs";
import { cleanRanks } from "./parse-utils.mjs";

export const SOURCE = { key: "pmu-presse", label: "PMU — pronostic presse", homepage: "https://www.pmu.fr" };

export const PMU_PRESSE_HOST = "online.turfinfo.api.pmu.fr";

/** Longueur gardée du classement PMU : 8, comme les sélections des sites. */
export const PMU_SELECTION_SIZE = 8;

/** AAAA-MM-JJ → JJMMAAAA */
export function pmuDate(date) {
  const [year, month, day] = date.split("-");
  return `${day}${month}${year}`;
}

export function pmuPronosticUrl(date, reunion, course) {
  return `https://${PMU_PRESSE_HOST}/rest/client/61/programme/${pmuDate(date)}/R${reunion}/C${course}/pronostics`;
}

/**
 * Réponse JSON de l'API → sélection ordonnée par rang, ou `null`.
 * @param {string|object} json
 */
export function parsePmuPronostics(json) {
  let data = json;
  if (typeof json === "string") {
    try {
      data = JSON.parse(json);
    } catch {
      return null;
    }
  }
  const selection = Array.isArray(data?.selection) ? data.selection : [];
  const ordered = selection
    .filter((item) => Number.isInteger(Number(item?.rang)) && Number.isInteger(Number(item?.num_partant)))
    .sort((left, right) => Number(left.rang) - Number(right.rang))
    .map((item) => Number(item.num_partant));
  // L'API classe souvent TOUT le champ (16 partants au Quinté du 31/10/2026) :
  // seule la tête du classement est une « sélection » comparable à celle des
  // sites. Sans cette coupe, chaque partant serait « cité » par le PMU et le
  // consensus (part des sources qui citent un cheval) serait faussé.
  return cleanRanks(ordered.slice(0, PMU_SELECTION_SIZE));
}

/**
 * @param {{ date: string, races: Array<{ id: string, reunion: number|null, course: number|null }>, http: { get: (url: string, init?: { accept?: string }) => Promise<any> } }} args
 */
export async function collect({ date, races, http }) {
  const selections = [];
  let failures = 0;
  for (const race of races) {
    if (!Number.isInteger(race.reunion) || !Number.isInteger(race.course)) continue;
    const url = pmuPronosticUrl(date, race.reunion, race.course);
    const response = await http.get(url, { accept: "application/json" });
    const problem = responseProblem(response);
    if (problem?.status === "blocked") return { ...problem, selections };
    if (problem) {
      // 404 / 204 = pas de pronostic presse pour cette course (normal à l'étranger).
      if (response.status !== 404) failures += 1;
      continue;
    }
    const ranks = parsePmuPronostics(response.text);
    if (ranks) selections.push({ raceId: race.id, ranks, url });
  }
  if (selections.length === 0 && failures > 0) return { status: "error", selections, detail: `${failures} erreurs, aucune sélection` };
  return collected(selections, `${races.length} courses interrogées, ${selections.length} sélections, ${failures} erreurs`);
}
