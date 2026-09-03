/**
 * Accès à l'API PMU.
 *
 * `import-pmu-day.mjs` embarque encore ses propres copies de ces fonctions : il
 * tourne trois fois par jour en production et n'avait aucune raison d'être
 * touché pour introduire le rafraîchissement des cotes. Le jour où il évoluera,
 * c'est ici qu'il faudra le brancher — les deux implémentations sont
 * identiques et doivent le rester.
 */

import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

export const PMU_BASE = "https://offline.turfinfo.api.pmu.fr/rest/client/7/programme";
export const USER_AGENT = "KayzenTurfAI/0.1 contact:github.com/skyymar69-rgb/kayzen-turf-ai";

// L'API PMU coupe régulièrement la connexion (ECONNRESET) : sans reprise, un seul
// incident réseau tuait l'import complet de la journée.
const FETCH_ATTEMPTS = 4;
const RETRYABLE_STATUS = new Set([408, 425, 429, 500, 502, 503, 504]);

export function delay(ms) {
  return new Promise((resolveDelay) => setTimeout(resolveDelay, ms));
}

export async function fetchJson(url) {
  let lastError;

  for (let attempt = 1; attempt <= FETCH_ATTEMPTS; attempt += 1) {
    try {
      // Sans délai maximal, une connexion que l'API PMU laisse pendre bloquait
      // le job jusqu'à sa limite. Le TimeoutError n'est pas marqué `permanent` :
      // il repasse par les tentatives ci-dessous comme une coupure réseau.
      const response = await fetch(url, {
        headers: {
          Accept: "application/json",
          "User-Agent": USER_AGENT,
        },
        signal: AbortSignal.timeout(20_000),
      });

      if (response.ok) return await response.json();

      const httpError = new Error(`PMU request failed ${response.status} for ${url}`);
      if (!RETRYABLE_STATUS.has(response.status)) {
        httpError.permanent = true;
        throw httpError;
      }
      lastError = httpError;
    } catch (error) {
      if (error?.permanent) throw error;
      lastError = error;
    }

    if (attempt < FETCH_ATTEMPTS) {
      console.warn(`[pmu] tentative ${attempt}/${FETCH_ATTEMPTS} échouée sur ${url} — nouvel essai`);
      await delay(attempt * 2000);
    }
  }

  throw lastError;
}

/** Cote retenue pour un partant, dans l'ordre de fiabilité décroissante. */
export function getOdds(participant) {
  return Number(
    participant?.dernierRapportDirect?.rapport ??
      participant?.dernierRapportReference?.rapport ??
      participant?.rapportProbable ??
      0,
  );
}

/** Date PMU (JJMMAAAA) décalée de `offset` jours par rapport à aujourd'hui à Paris. */
export function formatParisPmuDateOffset(offset) {
  const parisDate = new Intl.DateTimeFormat("fr-CA", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "Europe/Paris",
    year: "numeric",
  }).format(new Date());
  const [year, month, day] = parisDate.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + offset, 12));

  return `${String(date.getUTCDate()).padStart(2, "0")}${String(date.getUTCMonth() + 1).padStart(2, "0")}${date.getUTCFullYear()}`;
}

export function isoDateFromPmu(pmuDate) {
  return `${pmuDate.slice(4, 8)}-${pmuDate.slice(2, 4)}-${pmuDate.slice(0, 2)}`;
}

export async function loadLocalEnv() {
  try {
    const content = await readFile(resolve(process.cwd(), ".env.local"), "utf8");
    for (const line of content.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const separator = trimmed.indexOf("=");
      if (separator === -1) continue;
      const key = trimmed.slice(0, separator);
      const value = trimmed.slice(separator + 1).replace(/^"|"$/g, "");
      process.env[key] ||= value;
    }
  } catch {
    // Vercel/CI fournissent DATABASE_URL directement.
  }
}
