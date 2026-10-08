import { MARKET_GAMMA, MODEL_VERSION, PLACE_LAMBDAS } from "@/lib/probability";
import type { BetSimulation, HorsePrediction, ModelCard, RaceAnalysis } from "@/lib/types";
import { VALUE_EDGE_THRESHOLD, canLabelValue, expectedFinalOdds } from "@/lib/value-signal";

// ─────────────────────────────────────────────────────────────
// PRÉLÈVEMENTS PMU PAR TYPE DE PARI — ORDRES DE GRANDEUR
//
// Taux publics approximatifs (communication PMU et presse hippique), qui
// varient selon les années et les paris à bonus ; ils ne sont PAS tirés d'un
// règlement en vigueur vérifié. Seul le simple est recoupé par la mesure :
// marge médiane des cotes gagnant 1,184 sur 1 564 courses (24/08 → 07/10/2026),
// soit ≈ 15,5 % (voir WIN_TAKEOUT, src/lib/value-signal.ts).
//
// Usage unique : estimer le rapport d'un ticket combiné, ≈ (1 − prélèvement)
// / P_public (src/lib/bet-recommendations.ts, `expectedTicketReturn`). Les
// cotes et rapports PMU affichés sont déjà NETS de prélèvement : ne jamais
// appliquer (1 − prélèvement) à une cote affichée.
// ─────────────────────────────────────────────────────────────

export const PMU_TAKEOUT: Record<string, number> = {
  SIMPLE_GAGNANT: 0.155,
  SIMPLE_PLACE: 0.155,
  COUPLE_GAGNANT: 0.215,
  COUPLE_PLACE: 0.215,
  COUPLE_ORDRE: 0.215,
  DEUX_SUR_QUATRE: 0.215,
  TRIO: 0.245,
  TRIO_ORDRE: 0.245,
  TIERCE: 0.245,
  MULTI: 0.270,
  MINI_MULTI: 0.270,
  SUPER_QUATRE: 0.270,
  QUARTE_PLUS: 0.260,
  QUINTE_PLUS: 0.260,
  PICK5: 0.260,
  TIC_TROIS: 0.245,
};

/**
 * Closing Line Value — primary edge measurement for pari-mutuel.
 * CLV > 0 means you took price before the market sharpened against you.
 * Formula: (oddsTaken / oddsClosing − 1) × 100 in percent.
 */
export function closingLineValue(oddsTaken: number, oddsClosing: number): number {
  if (oddsClosing <= 0 || oddsTaken <= 0) return 0;
  return round((oddsTaken / oddsClosing - 1) * 100, 1);
}

export function probabilityToFairOdds(winProbability: number) {
  const probability = winProbability / 100;
  return probability > 0 ? round(1 / probability, 2) : 0;
}

export function marketEdgePercent(winProbability: number, decimalOdds: number) {
  // Sans cote publiée (NaN ou ≤ 1), il n'y a pas d'edge à mesurer.
  if (!Number.isFinite(decimalOdds) || decimalOdds <= 1) return 0;
  const probability = winProbability / 100;
  return round((decimalOdds * probability - 1) * 100, 1);
}

/**
 * Lecture d'une espérance (%) à la cote finale attendue. « Value bet » exige
 * le seuil unique du site (VALUE_EDGE_THRESHOLD) ET le droit d'employer le
 * mot (cote publiée, 30 minutes du départ ou moins) ; sinon la lecture
 * plafonne à « Observer ».
 */
export function classifyValueSignal(edgePercent: number, valueAllowed = true): BetSimulation["recommendation"] {
  if (edgePercent > VALUE_EDGE_THRESHOLD) return valueAllowed ? "Value bet" : "Observer";
  if (edgePercent > 0) return valueAllowed ? "Miser prudemment" : "Observer";
  if (edgePercent > -5) return "Observer";
  return "Éviter";
}

export function getDrawdownMultiplier(drawdown: number) {
  if (drawdown < 10) return 1;
  if (drawdown < 15) return 0.75;
  if (drawdown < 25) return 0.5;
  if (drawdown < 35) return 0.25;
  return 0.1;
}

export function fractionalKellyStake({
  bankroll,
  decimalOdds,
  drawdown = 0,
  kellyFraction = 0.25,
  maxStakeFraction = 0.05,
  winProbability,
}: {
  bankroll: number;
  decimalOdds: number;
  drawdown?: number;
  kellyFraction?: number;
  maxStakeFraction?: number;
  winProbability: number;
}) {
  const probability = winProbability / 100;
  const netOdds = decimalOdds - 1;
  const edge = netOdds * probability - (1 - probability);

  if (!(edge > 0) || !(netOdds > 0)) {
    return {
      baseStake: 0,
      adjustedStake: 0,
      fraction: 0,
      drawdownMultiplier: getDrawdownMultiplier(drawdown),
    };
  }

  const fullKelly = edge / netOdds;
  const fraction = Math.min(fullKelly * kellyFraction, maxStakeFraction);
  const baseStake = bankroll * fraction;
  const drawdownMultiplier = getDrawdownMultiplier(drawdown);

  return {
    baseStake: round(baseStake, 2),
    adjustedStake: round(baseStake * drawdownMultiplier, 2),
    fraction: round(fraction, 4),
    drawdownMultiplier,
  };
}

/**
 * Simulation THÉORIQUE d'un simple gagnant.
 *
 * L'espérance, l'edge et la mise de Kelly sont calculés à la cote FINALE
 * attendue (`expectedFinalOdds`), pas à la cote affichée : loin du départ,
 * l'écart apparent est supposé rattrapé par le marché. `minutesToStart` = 0
 * signifie « la cote fournie est celle qui sera payée » (usage de l'API) ;
 * `null` = délai inconnu, hypothèse la plus prudente.
 */
export function simulateBet(
  stake: number,
  odds: number,
  winProbability: number,
  bankroll = 500,
  drawdown = 0,
  minutesToStart: number | null = 0,
): BetSimulation {
  const probability = winProbability / 100;
  const finalOdds = expectedFinalOdds(odds, minutesToStart, winProbability);
  const priceOdds = Number.isFinite(finalOdds) ? finalOdds : odds;
  const potentialReturn = stake * odds;
  const expectedValue = stake * (priceOdds * probability - 1);
  const marketEdge = marketEdgePercent(winProbability, priceOdds);
  const kelly = fractionalKellyStake({
    bankroll,
    decimalOdds: priceOdds,
    drawdown,
    winProbability,
  });
  const valueAllowed = minutesToStart === 0 || canLabelValue(odds, minutesToStart);

  return {
    stake,
    odds,
    winProbability,
    expectedValue: round(expectedValue, 2),
    potentialReturn: round(potentialReturn, 2),
    kellyStake: kelly.baseStake,
    drawdownAdjustedStake: kelly.adjustedStake,
    fairOdds: probabilityToFairOdds(winProbability),
    marketEdge,
    recommendation: classifyValueSignal(marketEdge, valueAllowed),
  };
}

export function enrichHorsePrediction<T extends Omit<HorsePrediction, "fairOdds" | "marketEdge" | "valueIndex">>(
  horse: T,
): T & Pick<HorsePrediction, "fairOdds" | "marketEdge" | "valueIndex"> {
  const marketEdge = marketEdgePercent(horse.winProbability, horse.odds);

  return {
    ...horse,
    fairOdds: probabilityToFairOdds(horse.winProbability),
    marketEdge,
    valueIndex: marketEdge,
  };
}

export function classifyRaceTier(score: number): RaceAnalysis["bettingTier"] {
  if (score >= 70) return "Focus";
  if (score >= 50) return "Value";
  return "Avoid";
}

const fr = (v: number, d = 3) => v.toLocaleString("fr-FR", { maximumFractionDigits: d });

/** Fiche du modèle publiée par /api/model-card : décrit la chaîne réellement servie. */
export const modelCard: ModelCard = {
  version: MODEL_VERSION,
  purpose:
    "Aide à la lecture d'une course : probabilités de victoire et de place cohérentes entre elles, avis d'un modèle fondamental indépendant des cotes, et estimation honnête de ce que rapporte un ticket. Aucun gain n'est promis.",
  modelStack: [
    `Marché : cotes PMU, marge retirée par un exposant calibré (p ∝ (1/cote)^γ, γ = ${fr(MARKET_GAMMA)})`,
    "Mélange de Benter p ∝ exp(α·log p_marché + β·log p_IA), α et β par discipline — β = 0 aujourd'hui (aucun gain hors échantillon)",
    `Ordre d'arrivée : Plackett-Luce corrigé de Henery (forces p^λ, λ2 = ${fr(PLACE_LAMBDAS[0])}, λ3 = ${fr(PLACE_LAMBDAS[1])}) → Top 3, Top 5, tickets`,
    "Modèle fondamental (src/lib/fundamental) : musique, entourage, historique — sans aucune cote, affiché comme « avis IA »",
    "Retour estimé des tickets combinés : P_modèle × (1 − prélèvement) / P_public",
  ],
  featureFamilies: [
    "Marché : cote PMU gagnant (dernier relevé)",
    "Forme : musique (cinq dernières courses)",
    "Entourage : réussite du jockey/driver et de l'entraîneur, rétrécie vers la moyenne",
    "Historique du cheval",
  ],
  calibration: {
    method:
      "Maximum de vraisemblance sur arrivées réelles (scripts/fit-market.ts) : exposant γ du marché, mélange α/β par discipline (logit conditionnel), exposants de Henery λ2/λ3 sur les 2e et 3e. Ajustement avant le 16/09/2026, validation après (795 courses).",
    rationale:
      "Contre la cote finale, le modèle fondamental n'améliore pas le log loss (β non significatif) : la probabilité servie est le marché recalibré. La correction de Henery ramène le réel / attendu des places dans les 3 premiers de 0,87-1,65 (Harville) à 0,86-1,04 selon la tranche de cote.",
  },
  leakageControls: [
    "Séparation temporelle : ajustement sur les courses antérieures, validation sur les suivantes, jamais de tirage aléatoire.",
    "Variables d'entourage calculées avec les seules courses antérieures.",
    "Les cotes utilisées pour ajuster le mélange sont les dernières connues (≈ finales) : elles décrivent le marché au départ, pas celui disponible plus tôt.",
  ],
  bankrollPolicy: {
    kellyFraction: 0.25,
    maxStakeFraction: 0.05,
    drawdownRules: [
      { from: 0, to: 10, multiplier: 1 },
      { from: 10, to: 15, multiplier: 0.75 },
      { from: 15, to: 25, multiplier: 0.5 },
      { from: 25, to: 35, multiplier: 0.25 },
      { from: 35, to: null, multiplier: 0.1 },
    ],
  },
  limitations: [
    "Aucune rentabilité n'est établie : l'espérance d'un simple gagnant vaut environ −15 %, le prélèvement du PMU.",
    "La mise de Kelly n'est proposée que si l'espérance à la cote finale attendue est positive, à titre théorique.",
    "Le rattrapage des cotes avant le départ est une hypothèse prudente, pas encore ajustée sur des relevés horodatés.",
    "Le retour estimé des tickets combinés suppose que le public joue les combinaisons comme le simple gagnant ; il n'est pas vérifié sur les rapports réels.",
  ],
};

function round(value: number, decimals: number) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}
