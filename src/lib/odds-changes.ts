/**
 * Cotes qui ont bougé entre deux rendus de la page course (rafraîchissement
 * automatique ou relance). Sert à l'éclair visuel sur la cellule et à
 * l'annonce, limitée, pour les lecteurs d'écran.
 */

export type OddsChange = { number: number; from: number; to: number };

/** Sous 0,1 point de cote, l'écart est un arrondi, pas un mouvement. */
export const MIN_ODDS_STEP = 0.1;
/** L'annonce vocale ne cite que les plus gros mouvements. */
export const MAX_ANNOUNCED = 3;

const valid = (o: number | null | undefined): o is number => typeof o === "number" && Number.isFinite(o) && o > 1;

export function diffOdds(previous: ReadonlyMap<number, number>, current: ReadonlyArray<{ number: number; odds: number }>): OddsChange[] {
  return current
    .filter((h) => valid(h.odds) && valid(previous.get(h.number)) && Math.abs(h.odds - previous.get(h.number)!) >= MIN_ODDS_STEP)
    .map((h) => ({ number: h.number, from: previous.get(h.number)!, to: h.odds }));
}

const fmt = (o: number) => o.toFixed(1).replace(".", ",");

/** « Cotes mises à jour : n° 4 de 4,8 à 4,2 ; n° 8 de 7,2 à 8,0. » — les plus gros écarts relatifs d'abord. */
export function announceOdds(changes: OddsChange[]): string {
  if (changes.length === 0) return "";
  const top = [...changes].sort((a, b) => Math.abs(b.to / b.from - 1) - Math.abs(a.to / a.from - 1)).slice(0, MAX_ANNOUNCED);
  const rest = changes.length - top.length;
  const parts = top.map((c) => `n° ${c.number} de ${fmt(c.from)} à ${fmt(c.to)}`);
  return `Cotes mises à jour : ${parts.join(" ; ")}${rest > 0 ? ` ; et ${rest} autre${rest > 1 ? "s" : ""}` : ""}.`;
}

/** Glissement horizontal franc : au moins 80 px, et nettement plus horizontal que vertical. */
export function swipeDirection(dx: number, dy: number): "previous" | "next" | null {
  if (Math.abs(dx) < 80 || Math.abs(dx) < Math.abs(dy) * 2) return null;
  return dx < 0 ? "next" : "previous";
}
