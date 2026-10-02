/**
 * Rapports officiels PMU (`rapports-definitifs`), stockés dans `race_payouts`.
 *
 * Le suivi de performance calcule le ROI sur ce que le PMU a réellement payé :
 * une cote relevée avant le départ n'est pas un rapport (le pari mutuel fixe
 * le rapport après la clôture des enjeux).
 *
 * Seuls les paris dont le suivi a besoin sont gardés — simple gagnant, simple
 * placé, couplés, trio — soit quatre à huit lignes par course.
 */

const KEPT_TYPES = new Set(["SIMPLE_GAGNANT", "SIMPLE_PLACE", "COUPLE_GAGNANT", "COUPLE_PLACE", "TRIO"]);

/** Lignes à écrire à partir de la réponse de l'API. Fonction pure, testée. */
export function payoutRows(raceId, rapports) {
  const rows = [];
  for (const bloc of Array.isArray(rapports) ? rapports : []) {
    if (!KEPT_TYPES.has(bloc?.typePari) || bloc?.rembourse) continue;
    // Les paris nationaux et internationaux coexistent parfois : on garde le national.
    if (bloc.audience && bloc.audience !== "NATIONAL") continue;
    for (const rapport of bloc.rapports ?? []) {
      const centimes = Number(rapport?.dividendePourUnEuro);
      const combination = String(rapport?.combinaison ?? "").trim();
      // « 3-NP » : combinaison de remboursement liée à un non-partant, inutile au suivi.
      if (!combination || combination.includes("NP") || !Number.isFinite(centimes) || centimes <= 0) continue;
      rows.push({ raceId, betType: bloc.typePari, combination, dividend: centimes / 100 });
    }
  }
  return rows;
}

export async function storePayouts(sql, raceId, rapports) {
  const rows = payoutRows(raceId, rapports);
  if (rows.length === 0) return 0;
  await sql.query(
    `insert into race_payouts (race_id, bet_type, combination, dividend)
     select $1, t, c, d from unnest($2::text[], $3::text[], $4::numeric[]) as v(t, c, d)
     on conflict (race_id, bet_type, combination) do update set dividend = excluded.dividend`,
    [raceId, rows.map((r) => r.betType), rows.map((r) => r.combination), rows.map((r) => r.dividend)],
  );
  return rows.length;
}
