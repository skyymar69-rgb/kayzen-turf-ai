/**
 * Paris-Turf (paris-turf.com).
 *
 * État au 31/10/2026 : robots.txt et sitemap.xml sont publics, mais toutes les
 * pages de contenu (accueil, programme, pages course) répondent 403 avec un défi
 * Cloudflare à notre robot. Aucun contournement n'est tenté (pas d'usurpation de
 * navigateur, pas de résolution de défi) : la collecte rend « blocked » et le
 * propriétaire demande à Paris-Turf d'autoriser notre User-Agent
 * (voir docs/partenariats-sources.md).
 *
 * URL sondée : https://www.paris-turf.com/programme-courses
 *
 * Aucun parseur n'est livré : aucune page publique contenant les sélections n'a
 * pu être lue, et un parseur écrit à l'aveugle serait trompeur. Si la page
 * devient accessible, la collecte rend « error » avec un message explicite
 * jusqu'à l'écriture du parseur sur une page réelle.
 */

import { responseProblem } from "./http.mjs";
import { looksLikeBotChallenge } from "./parse-utils.mjs";

export const SOURCE = { key: "paris-turf", label: "Paris-Turf", homepage: "https://www.paris-turf.com" };

export const PARIS_TURF_PROBE_URL = "https://www.paris-turf.com/programme-courses";

/**
 * Lecture d'une réponse sonde : « blocked » si refus, sinon « error » (parseur à écrire).
 * Fonction pure, testable sur fixture.
 * @param {{ status: number, text: string, robotsDenied?: boolean, error?: string }} response
 */
export function interpretParisTurfProbe(response) {
  const problem = responseProblem(response, looksLikeBotChallenge);
  if (problem) return { ...problem, selections: [] };
  return {
    status: "error",
    selections: [],
    detail: "page accessible : parseur à écrire à partir d'une page réelle (accès rétabli ?)",
  };
}

/** @param {{ date: string, races: unknown[], http: { get: (url: string) => Promise<any> } }} args */
export async function collect({ http }) {
  const response = await http.get(PARIS_TURF_PROBE_URL);
  return interpretParisTurfProbe(response);
}
