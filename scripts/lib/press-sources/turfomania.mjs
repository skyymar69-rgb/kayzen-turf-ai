/**
 * Turfomania (turfomania.fr).
 *
 * État au 31/10/2026 : robots.txt est public (il ne vise que quelques robots
 * nommés, pas `*`), mais l'accueil, /pronostics/ et sitemap.xml répondent 403
 * avec la page « Attention Required! | Cloudflare » à notre robot. Aucun
 * contournement n'est tenté : la collecte rend « blocked » et le propriétaire
 * demande à Turfomania d'autoriser notre User-Agent (voir docs/partenariats-sources.md).
 *
 * URL sondée : https://www.turfomania.fr/pronostics/
 *
 * Aucun parseur n'est livré (aucune page de sélection lisible) ; si la page
 * devient accessible, la collecte rend « error » jusqu'à l'écriture du parseur.
 */

import { responseProblem } from "./http.mjs";
import { looksLikeBotChallenge } from "./parse-utils.mjs";

export const SOURCE = { key: "turfomania", label: "Turfomania", homepage: "https://www.turfomania.fr" };

export const TURFOMANIA_PROBE_URL = "https://www.turfomania.fr/pronostics/";

/** @param {{ status: number, text: string, robotsDenied?: boolean, error?: string }} response */
export function interpretTurfomaniaProbe(response) {
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
  const response = await http.get(TURFOMANIA_PROBE_URL);
  return interpretTurfomaniaProbe(response);
}
