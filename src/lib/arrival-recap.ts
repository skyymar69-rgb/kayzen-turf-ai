/**
 * RÉCAPITULATIF D'ARRIVÉE — rapports officiels et résultat de notre premier choix.
 *
 * Les rapports sont ceux que le PMU a réellement payés pour 1 € (table
 * `race_payouts`). Le résultat du « premier choix » se lit sur l'arrivée
 * officielle, sans arrondi flatteur : un cheval hors de l'arrivée publiée est
 * dit tel quel.
 */

export type Payout = { betType: string; combination: string; dividend: number };

export const PAYOUT_ORDER = ["SIMPLE_GAGNANT", "SIMPLE_PLACE", "COUPLE_GAGNANT", "COUPLE_PLACE", "TRIO"] as const;

export const PAYOUT_LABELS: Record<string, string> = {
  SIMPLE_GAGNANT: "Simple gagnant",
  SIMPLE_PLACE: "Simple placé",
  COUPLE_GAGNANT: "Couplé gagnant",
  COUPLE_PLACE: "Couplé placé",
  TRIO: "Trio",
};

export type PayoutGroup = { betType: string; label: string; items: Array<{ combination: string; dividend: number }> };

/** Rapports groupés par pari, dans l'ordre du simple au trio ; les paris inconnus ferment la marche. */
export function groupPayouts(payouts: Payout[]): PayoutGroup[] {
  const valid = payouts.filter((p) => Number.isFinite(p.dividend) && p.dividend > 0 && p.combination.trim() !== "");
  const types = [...new Set(valid.map((p) => p.betType))];
  const rank = (t: string) => {
    const i = (PAYOUT_ORDER as readonly string[]).indexOf(t);
    return i === -1 ? PAYOUT_ORDER.length : i;
  };
  return types
    .sort((a, b) => rank(a) - rank(b) || a.localeCompare(b))
    .map((betType) => ({
      betType,
      label: PAYOUT_LABELS[betType] ?? betType,
      items: valid.filter((p) => p.betType === betType).map(({ combination, dividend }) => ({ combination, dividend })),
    }));
}

/** Place de notre premier choix dans l'arrivée officielle, et une phrase qui la dit. */
export function pickResult(arrival: number[], pick: number | null): { position: number | null; sentence: string } {
  if (pick === null) return { position: null, sentence: "Aucun premier choix n'était établi pour cette course." };
  const index = arrival.indexOf(pick);
  if (index === -1) {
    return { position: null, sentence: `Notre premier choix, le n° ${pick}, ne figure pas dans l'arrivée publiée (${arrival.length} place${arrival.length > 1 ? "s" : ""}).` };
  }
  const position = index + 1;
  const place = position === 1 ? "gagne" : `termine ${position}e`;
  return { position, sentence: `Notre premier choix, le n° ${pick}, ${place}.` };
}
