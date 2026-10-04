import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { classifyStance, marketSignals, STANCE_ORDER } from "../src/lib/confrontation";

describe("classifyStance", () => {
  it("reprend les trois exemples du retour client", () => {
    assert.equal(classifyStance(18, 10), "ia");
    assert.equal(classifyStance(11, 18), "marche");
    assert.equal(classifyStance(16, 15), "accord");
  });

  it("tient pour un accord un écart relatif faible sur un gros favori", () => {
    // 5 points d'écart, mais un rapport de 1,2 : les deux avis convergent.
    assert.equal(classifyStance(30, 25), "accord");
  });

  it("ne classe pas les chevaux dont personne ne veut", () => {
    assert.equal(classifyStance(3, 2), null);
    assert.equal(classifyStance(6, 7.9), null);
  });

  it("classe dès que l'un des deux avis dépasse le seuil", () => {
    assert.equal(classifyStance(9, 3), "ia");
    assert.equal(classifyStance(2, 12), "marche");
  });

  it("ne classe pas sans l'un des deux avis", () => {
    assert.equal(classifyStance(null, 20), null);
    assert.equal(classifyStance(20, null), null);
    assert.equal(classifyStance(NaN, 20), null);
  });

  it("ordonne les familles : accord, IA, marché", () => {
    assert.deepEqual(STANCE_ORDER, ["accord", "ia", "marche"]);
  });
});

describe("marketSignals", () => {
  const flow = (delta15: number | null, delta5: number | null) => ({ delta15, delta5 });

  it("argent entrant à +2 points en 15 minutes", () => {
    assert.deepEqual(marketSignals({ direction: "stable", flow: flow(2.4, 0.3), stance: null }), ["argent"]);
    assert.deepEqual(marketSignals({ direction: "stable", flow: flow(1.9, 0.3), stance: null }), []);
  });

  it("accélération : +1 point en 5 minutes, plus vite que les 10 minutes précédentes", () => {
    // 1,5 pt en 5 min contre 0,5 pt sur les 10 minutes d'avant.
    assert.deepEqual(marketSignals({ direction: "stable", flow: flow(2, 1.5), stance: null }), ["argent", "acceleration"]);
    // 1 pt en 5 min, mais 3 pts sur les 10 minutes d'avant : le rythme ralentit.
    assert.deepEqual(marketSignals({ direction: "stable", flow: flow(4, 1), stance: null }), ["argent"]);
    // Sans recul sur 15 min, le seuil de 5 min suffit.
    assert.deepEqual(marketSignals({ direction: "stable", flow: flow(null, 1.2), stance: null }), ["acceleration"]);
  });

  it("smart money : l'argent entre, la cote baisse et l'IA ne le contredit pas", () => {
    assert.deepEqual(marketSignals({ direction: "joue", flow: flow(2.5, 0.2), stance: "ia" }), ["argent", "smart"]);
    assert.deepEqual(marketSignals({ direction: "joue", flow: flow(0.8, 1.1), stance: "accord" }), ["acceleration", "smart"]);
  });

  it("pas de smart money quand l'IA le juge surcoté ou quand la cote ne baisse pas", () => {
    assert.deepEqual(marketSignals({ direction: "joue", flow: flow(2.5, 0.2), stance: "marche" }), ["argent"]);
    assert.deepEqual(marketSignals({ direction: "stable", flow: flow(2.5, 0.2), stance: "ia" }), ["argent"]);
    assert.deepEqual(marketSignals({ direction: "joue", flow: flow(2.5, 0.2), stance: null }), ["argent"]);
  });

  it("rien sans données de mises", () => {
    assert.deepEqual(marketSignals({ direction: "joue", flow: flow(null, null), stance: "ia" }), []);
  });
});
