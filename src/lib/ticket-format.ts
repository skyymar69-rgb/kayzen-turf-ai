/**
 * TICKET À COPIER OU À PARTAGER — format texte PMU et paramètres de l'image.
 *
 * Le texte copié suit l'écriture d'un ticket PMU : le pari, puis les numéros
 * séparés par des tirets (« Quinté+ 4-8-2-11-6 »). L'image de partage reçoit
 * ce même ticket en paramètre d'URL : tout ce qui y entre est validé
 * strictement (chiffres, X, « ordre », longueur bornée), pour qu'aucune URL
 * forgée ne fasse écrire un texte arbitraire sous la marque du site.
 */

export const TICKET_MAX_NUMBERS = 20;
export const TICKET_LABEL_MAX = 40;
export const TICKET_TEXT_MAX = 80;

/** Un numéro de 1 à 99 ou un X (champ libre de la notation en X). */
const SLOT = "(?:[1-9]\\d?|X)";
const TICKET_RE = new RegExp(`^${SLOT}(?:-${SLOT}){0,${TICKET_MAX_NUMBERS - 1}}(?: ordre)?$`);
/** Lettres (accents compris), chiffres, espace, plus, tiret, apostrophe, point. */
const LABEL_RE = /^[\p{L}\p{N} +'’.-]+$/u;

/**
 * Ramène un ticket à l'écriture canonique « 4-8-2 » : espaces et tirets
 * multiples fusionnés, X en majuscule. `null` s'il ne ressemble pas à un ticket.
 */
export function normalizeTicket(raw: string | null | undefined): string | null {
  if (typeof raw !== "string" || raw.length > TICKET_TEXT_MAX) return null;
  let text = raw.trim().replace(/\s+/g, " ");
  const ordered = / ordre$/i.test(text);
  if (ordered) text = text.replace(/ ordre$/i, "");
  const slots = text.split(/\s*-\s*|\s+/).map((s) => (s.toLowerCase() === "x" ? "X" : s));
  // Un tiret en tête, en fin ou doublé laisse une case vide : ce n'est pas un ticket.
  if (slots.some((s) => s === "")) return null;
  const canonical = `${slots.join("-")}${ordered ? " ordre" : ""}`;
  return TICKET_RE.test(canonical) ? canonical : null;
}

export function normalizeLabel(raw: string | null | undefined): string | null {
  if (typeof raw !== "string") return null;
  const label = raw.trim().replace(/\s+/g, " ");
  if (!label || label.length > TICKET_LABEL_MAX || !LABEL_RE.test(label)) return null;
  return label;
}

/** Texte au format PMU, prêt à coller : « Quinté+ 4-8-2-11-6 ». */
export function pmuTicketText(label: string, ticket: string | number[]): string {
  const numbers = Array.isArray(ticket) ? ticket.join("-") : (normalizeTicket(ticket) ?? ticket.trim());
  return `${label.trim()} ${numbers}`.trim();
}

/** Paramètres `?t=…&k=…` de l'image validés, ou `null` au moindre écart. */
export function parseTicketParams(t: string | null, k: string | null): { ticket: string; label: string } | null {
  const ticket = normalizeTicket(t);
  const label = normalizeLabel(k);
  return ticket && label ? { ticket, label } : null;
}

/** Chemin de l'image de partage d'un ticket. */
export function ticketImagePath(raceId: string, ticket: string, label: string): string {
  const params = new URLSearchParams({ t: ticket, k: label });
  return `/races/${encodeURIComponent(raceId)}/ticket?${params.toString()}`;
}
