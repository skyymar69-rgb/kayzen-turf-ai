import assert from "node:assert/strict";
import { describe, it } from "node:test";
import calibration from "../src/lib/market-calibration.json";
import { buildBetRecommendations, expectedTicketReturn } from "../src/lib/bet-recommendations";
import { simulateBet } from "../src/lib/betting-engine";
import { exactTop3, powerDevig, proportionalDevig, shinDevig } from "../src/lib/market-model";
import {
  BLEND_COEFFICIENTS,
  MARKET_GAMMA,
  PLACE_LAMBDAS,
  blendProbabilities,
  calibrateField,
  devig,
  monteCarloTopK,
  publicProbabilities,
  simulateTopOrders,
} from "../src/lib/probability";
import type { BetOffer, HorsePrediction } from "../src/lib/types";
import {
  WIN_TAKEOUT,
  canLabelValue,
  catchUpShare,
  expectedFinalOdds,
  expectedValueAtStart,
  valueEdge,
} from "../src/lib/value-signal";

const ODDS = [2.1, 3.5, 6, 9, 14, 22, 35, 60];
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
const close = (a: number, b: number, tol: number, label = "") => assert.ok(Math.abs(a - b) <= tol, `${label} ${a} vs ${b}`);

function field(odds: number[], extra: Partial<HorsePrediction> = {}): HorsePrediction[] {
  return odds.map((o, i) => ({ id: `h${i}`, number: i + 1, horse: `C${i}`, odds: o, kzScore: 50, ...extra }) as HorsePrediction);
}

describe("retrait de la marge", () => {
  it("toutes les méthodes somment à 1", () => {
    const q = ODDS.map((o) => 1 / o);
    for (const p of [proportionalDevig(q), powerDevig(q), shinDevig(q), devig(ODDS)]) close(sum(p), 1, 1e-9);
  });

  it("l'exposant calibré (γ > 1) prend la marge surtout sur les tocards", () => {
    assert.ok(MARKET_GAMMA > 1);
    const prop = proportionalDevig(ODDS.map((o) => 1 / o));
    const served = devig(ODDS);
    assert.ok(served[0] > prop[0], "le favori gagne en probabilité");
    assert.ok(served.at(-1)! < prop.at(-1)!, "le tocard en perd");
  });

  it("cote manquante : plus petite probabilité connue, pas la moyenne", () => {
    const p = devig([2, 4, NaN]);
    assert.ok(p[2] <= Math.min(p[0], p[1]) + 1e-12);
  });

  it("probabilités du public = retrait proportionnel", () => {
    publicProbabilities(ODDS).forEach((p, i) => close(p, proportionalDevig(ODDS.map((o) => 1 / o))[i], 1e-12));
  });
});

describe("mélange de Benter", () => {
  it("β = 0 partout : la validation n'a montré aucun gain hors échantillon", () => {
    for (const d of ["Plat", "Trot", "Obstacle"] as const) {
      assert.equal(BLEND_COEFFICIENTS[d].beta, 0);
      assert.equal(calibration.blend[d].kept, false);
    }
  });

  it("ancienne API à poids numérique : mélange géométrique inchangé", () => {
    const market = [0.5, 0.3, 0.2];
    const model = [0.2, 0.3, 0.5];
    const raw = market.map((m, i) => m ** 0.9 * model[i] ** 0.1);
    blendProbabilities(market, model, 0.1).forEach((p, i) => close(p, raw[i] / sum(raw), 1e-9));
    assert.deepEqual(blendProbabilities(market, model, 0), market);
  });

  it("probabilité servie = marché recalibré, l'avis IA n'y entre pas", () => {
    const horses = field(ODDS).map((h, i) => ({ ...h, fundamentalProbability: i === 7 ? 40 : 60 / 7 }));
    const out = calibrateField(horses, { discipline: "Trot" });
    const alpha = BLEND_COEFFICIENTS.Trot.alpha;
    const market = devig(ODDS).map((p) => p ** alpha);
    out.forEach((h, i) => close(h.winProbability, (market[i] / sum(market)) * 100, 0.06, `n° ${i + 1}`));
  });
});

describe("ordre d'arrivée de Henery", () => {
  it("λ ajustés < 1, décroissants", () => {
    assert.ok(PLACE_LAMBDAS[0] < 1 && PLACE_LAMBDAS[1] < PLACE_LAMBDAS[0]);
  });

  it("le favori perd du Top 3 face à Harville, Σ Top 3 = 300 %", () => {
    const p = devig(ODDS);
    const henery = monteCarloTopK(p, [3], 20000).get(3)!;
    const harville = monteCarloTopK(p, [3], 20000, { lambdas: [1, 1] }).get(3)!;
    close(sum(henery), 300, 1e-6);
    assert.ok(henery[0] < harville[0] - 3, `${henery[0]} vs ${harville[0]}`);
    assert.ok(henery[7] > harville[7]);
  });

  it("la simulation suit le calcul exact", () => {
    const p = devig(ODDS);
    const exact = exactTop3(p, PLACE_LAMBDAS);
    const simulated = monteCarloTopK(p, [3], 40000).get(3)!;
    exact.forEach((e, i) => close(simulated[i], e * 100, 0.8, `n° ${i + 1}`));
  });
});

describe("cote finale attendue et value", () => {
  it("rattrapage : rien au départ, tout si le délai est inconnu", () => {
    assert.equal(catchUpShare(0), 0);
    assert.equal(catchUpShare(null), 1);
    assert.ok(catchUpShare(10) < catchUpShare(30) && catchUpShare(30) < catchUpShare(120));
    assert.equal(expectedFinalOdds(8, 0, 20), 8);
    close(expectedValueAtStart(8, null, 20)!, -WIN_TAKEOUT * 100, 0.1);
    assert.ok(Number.isNaN(expectedFinalOdds(NaN, 10, 20)));
  });

  it("l'espérance apparente fond à mesure que le départ s'éloigne", () => {
    const near = expectedValueAtStart(8, 5, 20)!;
    const far = expectedValueAtStart(8, 120, 20)!;
    assert.ok(near > far, `${near} vs ${far}`);
  });

  it("« Value » : cote publiée et 30 minutes au plus", () => {
    assert.equal(canLabelValue(8, 20), true);
    assert.equal(canLabelValue(8, 45), false);
    assert.equal(canLabelValue(NaN, 10), false);
    assert.equal(canLabelValue(8, null), false);
    assert.equal(valueEdge({ odds: 8, winProbability: 20 }, 60), null);
    assert.ok((valueEdge({ odds: 8, winProbability: 20 }, 2) ?? 0) > 10);
  });

  it("simulation : pas de Kelly sans espérance positive, pas de « Value bet » loin du départ", () => {
    const fair = simulateBet(10, 4, 20, 500, 0, 0);
    assert.equal(fair.kellyStake, 0);
    const early = simulateBet(10, 8, 20, 500, 0, 90);
    assert.notEqual(early.recommendation, "Value bet");
    const late = simulateBet(10, 8, 20, 500, 0, 3);
    assert.equal(late.recommendation, "Value bet");
    assert.ok(late.kellyStake > 0);
  });
});

describe("retour estimé des tickets combinés", () => {
  it("modèle = public : retour = 1 − prélèvement", () => {
    const p = publicProbabilities(ODDS);
    const orders = simulateTopOrders(p, 5, 4000, { seed: 7 });
    const ret = expectedTicketReturn("COUPLE_GAGNANT", { orders, publicOrders: orders }, [0, 1], 2, false);
    assert.equal(ret, 0.79);
  });

  it("sans cote : pas d'estimation ; ticket trop rare : pas d'estimation", () => {
    const orders = simulateTopOrders(publicProbabilities(ODDS), 5, 4000, { seed: 7 });
    assert.equal(expectedTicketReturn("TRIO", { orders, publicOrders: [] }, [0, 1, 2], 3, false), null);
    assert.equal(expectedTicketReturn("QUINTE_PLUS", { orders, publicOrders: orders }, [7, 6, 5, 4, 3], 5, true), null);
  });

  it("chaque ticket porte un retour estimé, sous la mise", () => {
    const horses = field(ODDS, { winProbability: 10, top3Probability: 30, top5Probability: 50, valueIndex: 0, marketEdge: 0, fairOdds: 10 });
    const offers = [
      { type: "SIMPLE_GAGNANT", label: "Simple gagnant", requiredHorses: 1, baseStake: 1, ordered: false },
      { type: "COUPLE_GAGNANT", label: "Couplé gagnant", requiredHorses: 2, baseStake: 1, ordered: false },
    ] as BetOffer[];
    const recos = buildBetRecommendations(horses, offers, { discipline: "Plat" });
    assert.equal(recos.length, 2);
    for (const r of recos) {
      assert.ok(r.expectedReturn != null && r.expectedReturn > 0.6 && r.expectedReturn < 1, `${r.type} ${r.expectedReturn}`);
    }
  });
});
