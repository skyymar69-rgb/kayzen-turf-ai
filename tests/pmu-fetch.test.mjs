// Tests des fonctions pures de scripts/lib/pmu-fetch.mjs.
// Lancer : npm test  (node --test, sans framework)

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { formatParisPmuDateOffset, getOdds, isoDateFromPmu } from "../scripts/lib/pmu-fetch.mjs";

describe("isoDateFromPmu", () => {
  it("convertit JJMMAAAA en AAAA-MM-JJ", () => {
    assert.equal(isoDateFromPmu("03052026"), "2026-05-03");
    assert.equal(isoDateFromPmu("31122013"), "2013-12-31");
    assert.equal(isoDateFromPmu("01012024"), "2024-01-01");
  });
});

describe("formatParisPmuDateOffset", () => {
  const today = formatParisPmuDateOffset(0);

  it("produit huit chiffres JJMMAAAA", () => {
    assert.match(today, /^\d{8}$/);
    const day = Number(today.slice(0, 2));
    const month = Number(today.slice(2, 4));
    const year = Number(today.slice(4, 8));
    assert.ok(day >= 1 && day <= 31, `jour ${day}`);
    assert.ok(month >= 1 && month <= 12, `mois ${month}`);
    assert.ok(year >= 2024 && year <= 2100, `année ${year}`);
  });

  it("correspond à la date du jour à Paris", () => {
    const paris = new Intl.DateTimeFormat("fr-CA", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      timeZone: "Europe/Paris",
    }).format(new Date());
    const [year, month, day] = paris.split("-");
    assert.equal(today, `${day}${month}${year}`);
  });

  it("décale d'exactement un jour, dans les deux sens (via isoDateFromPmu)", () => {
    const toUtcMs = (pmu) => Date.parse(`${isoDateFromPmu(pmu)}T00:00:00Z`);
    const day = 86_400_000;
    assert.equal(toUtcMs(formatParisPmuDateOffset(1)) - toUtcMs(today), day);
    assert.equal(toUtcMs(today) - toUtcMs(formatParisPmuDateOffset(-1)), day);
    assert.equal(toUtcMs(formatParisPmuDateOffset(30)) - toUtcMs(today), 30 * day);
  });

  it("aller-retour avec isoDateFromPmu", () => {
    const iso = isoDateFromPmu(today);
    assert.match(iso, /^\d{4}-\d{2}-\d{2}$/);
    const [year, month, day] = iso.split("-");
    assert.equal(`${day}${month}${year}`, today);
  });
});

describe("getOdds", () => {
  it("préfère la cote directe, puis la référence, puis la probable", () => {
    assert.equal(getOdds({ dernierRapportDirect: { rapport: 4.5 }, dernierRapportReference: { rapport: 6 }, rapportProbable: 8 }), 4.5);
    assert.equal(getOdds({ dernierRapportReference: { rapport: 6 }, rapportProbable: 8 }), 6);
    assert.equal(getOdds({ rapportProbable: 8 }), 8);
  });

  it("renvoie 0 sans aucune cote, y compris pour un partant absent", () => {
    assert.equal(getOdds({}), 0);
    assert.equal(getOdds(undefined), 0);
    assert.equal(getOdds({ dernierRapportDirect: {} }), 0);
  });

  it("convertit une cote reçue en chaîne", () => {
    assert.equal(getOdds({ dernierRapportDirect: { rapport: "12.3" } }), 12.3);
  });
});
