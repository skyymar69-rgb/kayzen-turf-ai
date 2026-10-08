/**
 * PRONOSTIC « INDICATIF » — quand la cote affichée n'est pas un prix de marché
 * vivant.
 *
 * L'API PMU livre trois cotes, que l'import et la boucle live retenaient dans
 * cet ordre en les étiquetant toutes « PMU » :
 *   - `direct`    dernier rapport direct, le prix du pari mutuel en cours ;
 *   - `reference` cote de référence, figée (veille ou matin) ;
 *   - `probable`  rapport probable, publié avant tout enjeu.
 * Le pronostic dérive largement du marché (probabilité dévigée) : bâti sur une
 * cote probable ou sur une cote vieille d'une heure à l'approche du départ, il
 * ne vaut que comme indication. La page course le dit (voir live-status.tsx).
 */

export type OddsSource = "direct" | "reference" | "probable";

/** Au-delà, une cote relevée est jugée ancienne à l'approche du départ. */
export const STALE_ODDS_MINUTES = 30;
/** Fenêtre avant le départ où l'âge de la cote compte. */
export const INDICATIVE_WINDOW_MINUTES = 120;

export type IndicativeReason = "cotes-probables" | "cotes-reference" | "cotes-anciennes";

export const INDICATIVE_LABELS: Record<IndicativeReason, string> = {
  "cotes-probables": "les cotes sont encore des cotes probables (aucun enjeu engagé)",
  "cotes-reference": "les cotes sont des cotes de référence, pas les rapports directs",
  "cotes-anciennes": `les cotes datent de plus de ${STALE_ODDS_MINUTES} min alors que le départ approche`,
};

export function parseOddsSource(value: unknown): OddsSource | null {
  return value === "direct" || value === "reference" || value === "probable" ? value : null;
}

/**
 * Motif pour lequel le pronostic est indicatif, ou `null` s'il repose sur des
 * cotes directes fraîches. Ne s'applique qu'aux courses pas encore parties.
 *
 *   - origine : plus de la moitié des cotes CONNUES ne sont pas directes. Les
 *     partants sans origine (historique antérieur à la colonne) ne comptent pas ;
 *   - âge : départ dans moins de deux heures et dernière lecture de plus de
 *     30 minutes (ou inconnue).
 */
export function predictionIndicative({
  minutesToStart,
  oddsAgeMinutes,
  sources,
}: {
  minutesToStart: number | null;
  oddsAgeMinutes: number | null;
  sources: Array<OddsSource | null | undefined>;
}): IndicativeReason | null {
  if (minutesToStart === null || minutesToStart <= 0) return null;

  const known = sources.filter((s): s is OddsSource => s != null);
  const probable = known.filter((s) => s === "probable").length;
  const reference = known.filter((s) => s === "reference").length;
  if (known.length > 0 && probable + reference > known.length / 2) {
    return probable >= reference ? "cotes-probables" : "cotes-reference";
  }

  if (minutesToStart <= INDICATIVE_WINDOW_MINUTES && (oddsAgeMinutes === null || oddsAgeMinutes > STALE_ODDS_MINUTES)) {
    return "cotes-anciennes";
  }
  return null;
}
