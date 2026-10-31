/**
 * Client HTTP « poli » partagé par les collecteurs de sélections presse.
 *
 * Règles (voir docs/partenariats-sources.md) :
 * - identité de robot honnête, jamais d'usurpation d'un navigateur ;
 * - au moins 1,5 s entre deux requêtes vers un même hôte ;
 * - respect des règles `Disallow` de robots.txt pour `User-agent: *`
 *   (et pour notre propre robot s'il est nommé), lu une fois par hôte et par exécution ;
 * - délai maximal de 20 s par requête ;
 * - plafond de requêtes par hôte et par exécution ;
 * - aucune reprise automatique sur 401/403/429 : un refus reste un refus.
 */

export const BOT_USER_AGENT = "KayzenTurfBot/1.0 (+https://kayzen-turf-ai.vercel.app/methode)";
export const BOT_TOKEN = "kayzenturfbot";
export const MIN_DELAY_MS = 1500;
export const TIMEOUT_MS = 20_000;
export const DEFAULT_MAX_REQUESTS_PER_HOST = 120;

/** Statuts HTTP qui signifient « le site ne veut pas de nous » : jamais contournés. */
export const BLOCKED_STATUSES = new Set([401, 403, 429, 451]);

/**
 * Analyse un robots.txt et renvoie les règles applicables à notre robot :
 * le groupe qui nous nomme s'il existe, sinon le groupe `*`.
 * Fonction pure : testable sans réseau.
 * @param {string} text
 * @returns {{ allow: string[], disallow: string[] }}
 */
export function parseRobots(text) {
  const groups = [];
  let current = null;
  let lastWasAgent = false;

  for (const rawLine of String(text ?? "").split(/\r?\n/)) {
    const line = rawLine.replace(/#.*$/, "").trim();
    if (!line) continue;
    const separator = line.indexOf(":");
    if (separator === -1) continue;
    const field = line.slice(0, separator).trim().toLowerCase();
    const value = line.slice(separator + 1).trim();

    if (field === "user-agent") {
      if (!current || !lastWasAgent) {
        current = { agents: [], allow: [], disallow: [] };
        groups.push(current);
      }
      current.agents.push(value.toLowerCase());
      lastWasAgent = true;
      continue;
    }
    lastWasAgent = false;
    if (!current) continue;
    if (field === "disallow" && value) current.disallow.push(value);
    if (field === "allow" && value) current.allow.push(value);
  }

  const own = groups.filter((group) => group.agents.some((agent) => agent !== "*" && BOT_TOKEN.includes(agent)));
  const chosen = own.length > 0 ? own : groups.filter((group) => group.agents.includes("*"));
  return {
    allow: chosen.flatMap((group) => group.allow),
    disallow: chosen.flatMap((group) => group.disallow),
  };
}

function ruleToRegExp(rule) {
  const anchored = rule.endsWith("$");
  const body = (anchored ? rule.slice(0, -1) : rule)
    .split("*")
    .map((part) => part.replace(/[.+?^${}()|[\]\\]/g, "\\$&"))
    .join(".*");
  return new RegExp(`^${body}${anchored ? "$" : ""}`);
}

/**
 * Le chemin (avec sa query) est-il autorisé ? Règle la plus longue gagnante,
 * `Allow` l'emporte à longueur égale (comportement Google / RFC 9309).
 * @param {{ allow: string[], disallow: string[] }} rules
 * @param {string} pathWithQuery
 */
export function isPathAllowed(rules, pathWithQuery) {
  let best = { length: -1, allowed: true };
  for (const [list, allowed] of [
    [rules.disallow, false],
    [rules.allow, true],
  ]) {
    for (const rule of list) {
      if (!ruleToRegExp(rule).test(pathWithQuery)) continue;
      const length = rule.length;
      if (length > best.length || (length === best.length && allowed)) best = { length, allowed };
    }
  }
  return best.allowed;
}

const sleep = (ms) => new Promise((resolveSleep) => setTimeout(resolveSleep, ms));

/**
 * Crée un client poli. Une instance = une exécution (cache robots, compteurs).
 * `hostLimits` relève le plafond pour un hôte donné (ex. l'API PMU, une requête par course).
 * @param {{ fetchImpl?: typeof fetch, minDelayMs?: number, maxRequestsPerHost?: number, hostLimits?: Record<string, number>, log?: (message: string) => void }} [options]
 */
export function createPoliteHttp(options = {}) {
  const fetchImpl = options.fetchImpl ?? fetch;
  const minDelayMs = options.minDelayMs ?? MIN_DELAY_MS;
  const maxRequestsPerHost = options.maxRequestsPerHost ?? DEFAULT_MAX_REQUESTS_PER_HOST;
  const hostLimits = options.hostLimits ?? {};
  const log = options.log ?? (() => {});
  const lastRequestAt = new Map();
  const requestCount = new Map();
  const robotsCache = new Map();

  async function throttledFetch(url, accept) {
    const host = url.host;
    const count = requestCount.get(host) ?? 0;
    const limit = hostLimits[host] ?? maxRequestsPerHost;
    if (count >= limit) {
      return { status: 0, text: "", error: `plafond de ${limit} requêtes atteint pour ${host}` };
    }
    requestCount.set(host, count + 1);

    const wait = (lastRequestAt.get(host) ?? 0) + minDelayMs - Date.now();
    if (wait > 0) await sleep(wait);
    lastRequestAt.set(host, Date.now());

    try {
      const response = await fetchImpl(url.href, {
        headers: { "User-Agent": BOT_USER_AGENT, Accept: accept },
        redirect: "follow",
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      const text = await response.text();
      return { status: response.status, text, finalUrl: response.url || url.href };
    } catch (error) {
      return { status: 0, text: "", error: error instanceof Error ? error.message : String(error) };
    } finally {
      lastRequestAt.set(host, Date.now());
    }
  }

  async function robotsFor(url) {
    const origin = url.origin;
    if (!robotsCache.has(origin)) {
      const result = await throttledFetch(new URL("/robots.txt", origin), "text/plain");
      let rules;
      if (result.status >= 200 && result.status < 300) rules = parseRobots(result.text);
      else if (BLOCKED_STATUSES.has(result.status)) rules = { allow: [], disallow: ["/"], blocked: true };
      // 404 ou erreur : pas de robots.txt publié, tout est permis (usage établi).
      else rules = { allow: [], disallow: [] };
      robotsCache.set(origin, rules);
    }
    return robotsCache.get(origin);
  }

  /**
   * GET poli. Ne lève jamais : renvoie toujours `{ status, text, ... }`.
   * `status` vaut 0 en cas d'erreur réseau, de refus robots.txt ou de plafond.
   * `robotsDenied: true` quand robots.txt interdit le chemin.
   * @param {string} href
   * @param {{ accept?: string }} [init]
   */
  async function get(href, init = {}) {
    const url = new URL(href);
    const rules = await robotsFor(url);
    if (rules.blocked) {
      return { status: 403, text: "", robotsDenied: false, error: "robots.txt lui-même refusé (403)" };
    }
    if (!isPathAllowed(rules, `${url.pathname}${url.search}`)) {
      log(`[http] robots.txt interdit ${url.pathname} sur ${url.host} : requête non envoyée`);
      return { status: 0, text: "", robotsDenied: true, error: "interdit par robots.txt" };
    }
    const result = await throttledFetch(url, init.accept ?? "text/html,application/json;q=0.9,*/*;q=0.5");
    log(`[http] ${result.status} ${url.href}`);
    return result;
  }

  return { get, stats: () => Object.fromEntries(requestCount) };
}

/**
 * Traduit une réponse du client poli en statut de collecte, ou `null` si la page est exploitable.
 * Un refus (401/403/429/451, défi anti-robot, robots.txt) donne « blocked » : on s'arrête là,
 * sans aucune tentative de contournement.
 * @param {{ status: number, text: string, robotsDenied?: boolean, error?: string }} result
 * @param {(html: string) => boolean} [isChallenge]
 * @returns {{ status: "blocked"|"error", detail: string } | null}
 */
export function responseProblem(result, isChallenge) {
  if (result.robotsDenied) return { status: "blocked", detail: "chemin interdit par robots.txt" };
  if (BLOCKED_STATUSES.has(result.status)) return { status: "blocked", detail: `HTTP ${result.status} (accès refusé à notre robot)` };
  if (result.status === 0) return { status: "error", detail: result.error ?? "erreur réseau" };
  if (result.status < 200 || result.status >= 300) return { status: "error", detail: `HTTP ${result.status}` };
  if (isChallenge?.(result.text)) return { status: "blocked", detail: "page de défi anti-robot servie" };
  return null;
}

/** Résultat de collecte normalisé : « ok » s'il y a au moins une sélection, sinon « empty ». */
export function collected(selections, detail) {
  return { status: selections.length > 0 ? "ok" : "empty", selections, detail };
}
