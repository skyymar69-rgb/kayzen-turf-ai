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

  it("ignore une réponse vide ou malformée", () => {
    assert.deepEqual(payoutRows("R", null), []);
    assert.deepEqual(payoutRows("R", [{ typePari: "SIMPLE_GAGNANT", rapports: [{ combinaison: "", dividendePourUnEuro: 100 }] }]), []);
  });
});
