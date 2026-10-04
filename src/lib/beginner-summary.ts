import type { RaceReading } from "@/lib/profiles";

/**
 * RÉSUMÉ POUR DÉBUTANT — une phrase, sans jargon.
 *
 * Elle reformule ce que la page affiche déjà (lecture de la course, cheval le
 * mieux classé, sa probabilité retenue) en chances « sur N ». Elle n'ajoute
 * aucune information et ne recommande aucun pari : une probabilité de 35 %
 * veut aussi dire que le cheval perd presque deux fois sur trois.
 */

export type SummaryHorse = { number: number; name: string; win: number };

export type SummaryInput = {
  reading: RaceReading;
  /** Chevaux dans l'ordre du classement (les trois premiers suffisent). */
  top: SummaryHorse[];
  oddsAvailable: boolean;
  finished: boolean;
};

/** « environ 1 chance sur 3 », « plus d'une chance sur deux ». */
export function chancesPhrase(pct: number): string {
  if (!Number.isFinite(pct) || pct <= 0) return "des chances non estimées";
  if (pct >= 50) return "plus d'une chance sur deux";
  return `environ 1 chance sur ${Math.max(2, Math.round(100 / pct))}`;
}

export function beginnerSummary(input: SummaryInput): string | null {
  const [first] = input.top;
  if (!first) return null;
  const lead = input.finished ? "Avant le départ, " : "";
  const who = `le n° ${first.number} ${first.name}`;
  const chances = chancesPhrase(first.win);
  const noOdds = input.oddsAvailable ? "" : " (avis de l'IA seule, les cotes n'étant pas encore publiées)";

  if (input.reading === "lisible") {
    return `${lead}${capitalize(who, !lead)} ressort nettement${noOdds} : nos calculs lui donnent ${chances} de gagner, ce qui reste loin d'une certitude.`;
  }
  if (input.reading === "ouverte") {
    const numbers = input.top.slice(0, 3).map((h) => h.number).join(", ");
    return `${lead}${capitalize("course ouverte", !lead)}${noOdds} : aucun cheval ne se détache, les n° ${numbers} sont les plus probables, le premier avec ${chances} de gagner.`;
  }
  return `${lead}${capitalize("course difficile à lire", !lead)}${noOdds} : même le mieux classé, ${who}, n'a selon nos calculs que ${chances} de gagner.`;
}

function capitalize(text: string, yes: boolean): string {
  return yes ? text.charAt(0).toUpperCase() + text.slice(1) : text;
}
