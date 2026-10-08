import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { payoutRows } from "../scripts/lib/payouts.mjs";

describe("payoutRows", () => {
  const api = [
    { typePari: "SIMPLE_GAGNANT", audience: "NATIONAL", rembourse: false, rapports: [{ combinaison: "15", dividendePourUnEuro: 1000 }] },
    { typePari: "SIMPLE_PLACE", audience: "NATIONAL", rapports: [{ combinaison: "15", dividendePourUnEuro: 380 }, { combinaison: "3", dividendePourUnEuro: 200 }] },
    { typePari: "TRIO", audience: "NATIONAL", rapports: [{ combinaison: "3-5-NP", dividendePourUnEuro: 1240 }, { combinaison: "3-5-1", dividendePourUnEuro: 3580 }] },
    { typePari: "QUINTE_PLUS", audience: "NATIONAL", rapports: [{ combinaison: "1-2-3-4-5", dividendePourUnEuro: 99999 }] },
    { typePari: "SIMPLE_GAGNANT", audience: "INTERNATIONAL", rapports: [{ combinaison: "15", dividendePourUnEuro: 1100 }] },
  ];

  it("convertit les centimes pour 1 € en euros", () => {
    const rows = payoutRows("R", api);
    assert.deepEqual(rows.find((r) => r.betType === "SIMPLE_GAGNANT"), { raceId: "R", betType: "SIMPLE_GAGNANT", combination: "15", dividend: 10 });
  });

  it("ne garde que les paris suivis, en audience nationale, sans combinaisons de non-partant", () => {
    const rows = payoutRows("R", api);
    assert.equal(rows.length, 4);
    assert.ok(!rows.some((r) => r.betType === "QUINTE_PLUS"));
    assert.ok(!rows.some((r) => r.combination.includes("NP")));
  });

  it("garde le rapport régional quand aucun rapport national n'est publié", () => {
    const rows = payoutRows("R", [{ typePari: "SIMPLE_GAGNANT", audience: "LOCAL", rapports: [{ combinaison: "2", dividendePourUnEuro: 1490 }] }]);
    assert.deepEqual(rows, [{ raceId: "R", betType: "SIMPLE_GAGNANT", combination: "2", dividend: 14.9 }]);
  });

  it("ignore une réponse vide ou malformée", () => {
    assert.deepEqual(payoutRows("R", null), []);
    assert.deepEqual(payoutRows("R", [{ typePari: "SIMPLE_GAGNANT", rapports: [{ combinaison: "", dividendePourUnEuro: 100 }] }]), []);
  });
});

describe("payoutRows — 2 sur 4 et multi", () => {
  it("garde le 2 sur 4 et porte la formule du multi dans le type", () => {
    const rows = payoutRows("R", [
      { typePari: "DEUX_SUR_QUATRE", audience: "NATIONAL", rapports: [{ libelle: "2sur4", combinaison: "2-11", dividendePourUnEuro: 980 }] },
      {
        typePari: "MULTI",
        audience: "NATIONAL",
        rapports: [
          { libelle: "Multi en 4", combinaison: "2-11-16-4", dividendePourUnEuro: 144900 },
          { libelle: "Multi en 5", combinaison: "2-11-16-4", dividendePourUnEuro: 28980 },
        ],
      },
    ]);
    assert.deepEqual(rows.map((r) => r.betType).sort(), ["DEUX_SUR_QUATRE", "MULTI_EN_4", "MULTI_EN_5"]);
  });
});
