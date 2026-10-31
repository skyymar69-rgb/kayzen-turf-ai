/**
 * Outils de parsing partagés par les collecteurs presse. Fonctions pures, sans réseau.
 */

/** Décode les entités HTML courantes (suffisant pour des numéros et des libellés courts). */
export function decodeEntities(text) {
  return String(text ?? "")
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(parseInt(code, 16)))
    .replace(/&nbsp;/g, " ")
    .replace(/&eacute;/g, "é")
    .replace(/&egrave;/g, "è")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

/**
 * Liste ordonnée de numéros de selle valides : entiers 1..30, sans doublon.
 * Renvoie `null` si la liste est trop courte pour être une sélection (moins de 3).
 * @param {Array<number|string>} values
 */
export function cleanRanks(values) {
  const seen = new Set();
  const ranks = [];
  for (const value of values) {
    const number = Number(String(value).trim());
    if (!Number.isInteger(number) || number < 1 || number > 30 || seen.has(number)) continue;
    seen.add(number);
    ranks.push(number);
  }
  return ranks.length >= 3 ? ranks : null;
}

/**
 * Lit un objet/tableau JSON équilibré à partir de `start` (qui doit pointer sur `{` ou `[`).
 * Tient compte des chaînes et de leurs échappements. Renvoie `null` si invalide.
 * @param {string} text
 * @param {number} start
 */
export function readBalancedJson(text, start) {
  const open = text[start];
  if (open !== "{" && open !== "[") return null;
  let depth = 0;
  let inString = false;
  for (let index = start; index < text.length; index += 1) {
    const char = text[index];
    if (inString) {
      if (char === "\\") index += 1;
      else if (char === '"') inString = false;
      continue;
    }
    if (char === '"') inString = true;
    else if (char === "{" || char === "[") depth += 1;
    else if (char === "}" || char === "]") {
      depth -= 1;
      if (depth === 0) {
        try {
          return JSON.parse(text.slice(start, index + 1));
        } catch {
          return null;
        }
      }
    }
  }
  return null;
}

/** "HH:MM" à partir de "15:15", "15h15", "15:15:00"… ou `null`. */
export function normalizeTime(value) {
  const match = /(\d{1,2})\s*[:hH]\s*(\d{2})/.exec(String(value ?? ""));
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return `${String(hours).padStart(2, "0")}:${match[2]}`;
}

/** Page de défi anti-robot (Cloudflare & co.) servie avec un 200 : traitée comme un refus. */
export function looksLikeBotChallenge(html) {
  const head = String(html ?? "").slice(0, 4000);
  return /<title>\s*(Just a moment|Attention Required|Access denied)/i.test(head) || /challenges\.cloudflare\.com|cf-chl-|cf_chl_/i.test(head);
}
