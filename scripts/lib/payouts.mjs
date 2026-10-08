/**
 * Rapports officiels PMU (`rapports-definitifs`), stockés dans `race_payouts`.
 *
 * Le suivi de performance calcule le ROI sur ce que le PMU a réellement payé :
 * une cote relevée avant le départ n'est pas un rapport (le pari mutuel fixe
 * le rapport après la clôture des enjeux).
 *
 * Seuls les paris dont le suivi a besoin sont gardés — simple gagnant, simple
 * placé, couplés, trio, 2 sur 4 et multi — une dizaine de lignes par course.
 *
 * Le multi publie une ligne par formule (« Multi en 4 » à « Multi en 7 ») avec
 * la même combinaison (les quatre premiers) : la formule est donc portée par
 * le type, `MULTI_EN_4` … `MULTI_EN_7`, pour que chaque rapport ait sa ligne.
 */

const KEPT_TYPES = new Set(["SIMPLE_GAGNANT", "SIMPLE_PLACE", "COUPLE_GAGNANT", "COUPLE_PLACE", "TRIO", "DEUX_SUR_QUATRE", "MULTI"]);

/** Type stocké : la formule du multi (« Multi en 5 ») devient `MULTI_EN_5`. */
export function storedBetType(typePari, libelle) {
  if (typePari !== "MULTI") return typePari;
  const n = String(libelle ?? "").match(/en\s*(\d)/i)?.[1];
  return n ? `MULTI_EN_${n}` : null;
}

/** Lignes à écrire à partir de la réponse de l'API. Fonction pure, testée. */
export function payoutRows(raceId, rapports) {
  const blocs = (Array.isArray(rapports) ? rapports : []).filter((b) => KEPT_TYPES.has(b?.typePari) && !b?.rembourse);
  // Un même pari peut être publié pour plusieurs audiences : on garde le
  // national quand il existe. Les réunions régionales ne publient qu'en
  // « LOCAL » ou « REGIONAL » : c'est alors le seul rapport payé, on le garde.
  const chosen = new Map();
  for (const bloc of blocs) {
    const current = chosen.get(bloc.typePari);
    if (!current || (current.audience !== "NATIONAL" && bloc.audience === "NATIONAL")) chosen.set(bloc.typePari, bloc);
  }
  const rows = [];
  for (const bloc of chosen.values()) {
    for (const rapport of bloc.rapports ?? []) {
      const centimes = Number(rapport?.dividendePourUnEuro);
      const combination = String(rapport?.combinaison ?? "").trim();
      // « 3-NP » : combinaison de remboursement liée à un non-partant, inutile au suivi.
      if (!combination || combination.includes("NP") || !Number.isFinite(centimes) || centimes <= 0) continue;
      const betType = storedBetType(bloc.typePari, rapport?.libelle);
      if (!betType) continue;
      rows.push({ raceId, betType, combination, dividend: centimes / 100 });
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
