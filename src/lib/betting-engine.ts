import type { BetSimulation, HorsePrediction, ModelCard, RaceAnalysis } from "@/lib/types";

// ─────────────────────────────────────────────────────────────
// PMU PARI-MUTUEL TAKEOUT RATES (approximate)
// Source: PMU règlement — 16.5% simple, 21.5% couple, 24-27% bonus pools
// ─────────────────────────────────────────────────────────────

export const PMU_TAKEOUT: Record<string, number> = {
  SIMPLE_GAGNANT: 0.165,
  SIMPLE_PLACE: 0.165,
  COUPLE_GAGNANT: 0.215,
  COUPLE_PLACE: 0.215,
  COUPLE_ORDRE: 0.215,
  DEUX_SUR_QUATRE: 0.215,
  TRIO: 0.245,
  TRIO_ORDRE: 0.245,
  TIERCE: 0.245,
  MULTI: 0.270,
  SUPER_QUATRE: 0.270,
  QUARTE_PLUS: 0.260,
  QUINTE_PLUS: 0.260,
  PICK5: 0.260,
  TIC_TROIS: 0.245,
};

/**
 * Expected value with PMU pari-mutuel takeout correction.
 * PMU pays dividends on the pool net of takeout, so the stated cote
 * is an estimate of gross payout. EV = p × odds × (1 − takeout) − 1.
 */
export function expectedValuePMU(
  winProbability: number,
  decimalOdds: number,
  betType: string = "SIMPLE_GAGNANT",
): number {
  const p = winProbability / 100;
  const takeout = PMU_TAKEOUT[betType] ?? 0.22;
  return round((p * decimalOdds * (1 - takeout) - 1) * 100, 1);
}

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
  const probability = winProbability / 100;
  return round((decimalOdds * probability - 1) * 100, 1);
}

export function classifyValueSignal(edgePercent: number): BetSimulation["recommendation"] {
  if (edgePercent > 22) return "Value bet";
  if (edgePercent > 8) return "Miser prudemment";
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

  if (edge <= 0 || netOdds <= 0) {
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

export function simulateBet(
  stake: number,
  odds: number,
  winProbability: number,
  bankroll = 500,
  drawdown = 0,
): BetSimulation {
  const probability = winProbability / 100;
  const potentialReturn = stake * odds;
  const expectedValue = potentialReturn * probability - stake;
  const marketEdge = marketEdgePercent(winProbability, odds);
  const kelly = fractionalKellyStake({
    bankroll,
    decimalOdds: odds,
    drawdown,
    winProbability,
  });

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
    recommendation: classifyValueSignal(marketEdge),
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

export const modelCard: ModelCard = {
  version: "0.3.0-arrival-correlation",
  purpose: "Aide à la décision pour analyser une course, estimér les probabilités et controler le risque de mise.",
  modelStack: ["Race pre-filtering", "Horse win probability", "Top 3 upset detection", "Favorite failure risk", "Value bet scoring", "Fractional Kelly bankroll policy"],
  featureFamilies: [
    "Forme recente cheval/jockey/entraîneur",
    "Contexte course: distance, piste, terrain, taille du peloton",
    "Historique course et categorie",
    "Signal marché: cote, cote juste, edge",
    "Correlation prediction/resultat: ecart gagnant-place, rang KZ, rang cote, stabilite des rangs",
    "Tocard surveille: cote outsider, edge positif, reservoir Top 5 et probabilite Top 3",
    "Favori fragile: cote courte, Top 3 insuffisant, edge negatif et volatilite course",
    "Garde-fous bankroll: drawdown et plafond de mise",
  ],
  calibration: {
    method: "Shrinkage vers le prior de peloton, detection des favoris fragiles, remontee des outsiders surveilles puis calibration temporelle en backtest",
    rationale: "Les modèles de classement hippique deviennent vite trop confiants. La calibration doit ramener les favoris vers des probabilités realistes et mesurer quand un tocard peut entrer dans les trois premiers.",
  },
  leakageControls: [
    "Split temporel obligatoire pour validation, jamais de split aleatoire comme preuve principale.",
    "Features historiques calculees avec decalage temporel: shift(1), expanding window ou date filtering.",
    "Aucune statistique globale cheval, jockey, entraîneur ou pedigree ne doit utiliser des courses futures.",
    "Les cotes de marché ne doivent être jointes qu'au timestamp disponible pour l'utilisateur.",
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
    "Aucune prediction ne garantit un gain.",
    "Les performances doivent être jugees sur un grand volume de paris et en conditions live.",
    "Une value bet peut perdre meme si la decision était mathematiquement correcte.",
    "Les données hippiques et les cotes peuvent changer rapidement avant le départ.",
  ],
};

function round(value: number, decimals: number) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}
