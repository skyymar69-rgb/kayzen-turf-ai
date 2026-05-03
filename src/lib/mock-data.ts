import type { BetSimulation, HorsePrediction, RaceAnalysis } from "@/lib/types";

export const raceAnalysis: RaceAnalysis = {
  id: "R1C3-2026-05-03",
  name: "Prix Kayzen Data",
  racecourse: "ParisLongchamp",
  startTime: "15:15",
  discipline: "Plat",
  distance: "2 100 m",
  going: "Bon souple",
  weather: "Nuageux, vent faible",
  marketVolatility: 18,
  modelConsensus: 76,
  raceQualityScore: 82,
  bettingTier: "Focus",
  riskLevel: "Equilibre",
  horses: [
    {
      id: "h-1",
      number: 4,
      horse: "Helios Prime",
      jockey: "M. Barzalona",
      trainer: "A. Fabre",
      odds: 4.8,
      fairOdds: 4.17,
      marketEdge: 15.2,
      winProbability: 24,
      top3Probability: 56,
      top5Probability: 72,
      kzScore: 91,
      valueIndex: 15.2,
      confidence: "Forte",
      factors: ["Regularite recente", "Jockey en forme", "Profil piste favorable"],
    },
    {
      id: "h-2",
      number: 8,
      horse: "Nuit de Seine",
      jockey: "C. Soumillon",
      trainer: "J. Reynier",
      odds: 7.2,
      fairOdds: 5.56,
      marketEdge: 29.6,
      winProbability: 18,
      top3Probability: 44,
      top5Probability: 63,
      kzScore: 84,
      valueIndex: 29.6,
      confidence: "Forte",
      factors: ["Cote superieure au juste prix", "Bonne tenue", "Derniers 600 m solides"],
    },
    {
      id: "h-3",
      number: 2,
      horse: "Atlas Green",
      jockey: "T. Piccone",
      trainer: "F. Chappet",
      odds: 5.6,
      fairOdds: 5.88,
      marketEdge: -4.8,
      winProbability: 17,
      top3Probability: 39,
      top5Probability: 58,
      kzScore: 78,
      valueIndex: -4.8,
      confidence: "Moyenne",
      factors: ["Classe stable", "Terrain correct", "Marche deja ajuste"],
    },
    {
      id: "h-4",
      number: 11,
      horse: "Orage Secret",
      jockey: "A. Lemaitre",
      trainer: "M. Delzangles",
      odds: 14.5,
      fairOdds: 10,
      marketEdge: 45,
      winProbability: 10,
      top3Probability: 31,
      top5Probability: 49,
      kzScore: 73,
      valueIndex: 45,
      confidence: "Moyenne",
      factors: ["Outsider sous-estime", "Distance ideale", "Rythme probable avantageux"],
    },
    {
      id: "h-5",
      number: 6,
      horse: "Silver Method",
      jockey: "S. Pasquier",
      trainer: "P. Bary",
      odds: 3.9,
      fairOdds: 4.76,
      marketEdge: -18.1,
      winProbability: 21,
      top3Probability: 48,
      top5Probability: 69,
      kzScore: 71,
      valueIndex: -18.1,
      confidence: "Moyenne",
      factors: ["Favori logique", "Cote courte", "Peu de marge value"],
    },
  ],
};

export const predictions = raceAnalysis.horses
  .slice()
  .sort((a, b) => b.kzScore - a.kzScore);

export const valueBets = raceAnalysis.horses
  .filter((horse) => horse.valueIndex > 10)
  .sort((a, b) => b.valueIndex - a.valueIndex);

export function simulateBet(
  stake: number,
  odds: number,
  winProbability: number,
  bankroll = 500,
  drawdown = 0,
): BetSimulation {
  const probability = winProbability / 100;
  const fairOdds = probability > 0 ? 1 / probability : 0;
  const potentialReturn = stake * odds;
  const expectedValue = potentialReturn * probability - stake;
  const marketEdge = odds * probability - 1;
  const fullKelly = Math.max(0, marketEdge / Math.max(odds - 1, 1));
  const kellyFraction = Math.min(fullKelly * 0.25, 0.05);
  const kellyStake = bankroll * kellyFraction;
  const drawdownMultiplier = getDrawdownMultiplier(drawdown);
  const drawdownAdjustedStake = kellyStake * drawdownMultiplier;

  let recommendation: BetSimulation["recommendation"] = "Eviter";
  if (marketEdge > 0.22) recommendation = "Value bet";
  else if (marketEdge > 0.08) recommendation = "Miser prudemment";
  else if (marketEdge > -0.05) recommendation = "Observer";

  return {
    stake,
    odds,
    winProbability,
    expectedValue: Number(expectedValue.toFixed(2)),
    potentialReturn: Number(potentialReturn.toFixed(2)),
    kellyStake: Number(kellyStake.toFixed(2)),
    drawdownAdjustedStake: Number(drawdownAdjustedStake.toFixed(2)),
    fairOdds: Number(fairOdds.toFixed(2)),
    marketEdge: Number((marketEdge * 100).toFixed(1)),
    recommendation,
  };
}

export function getTopPick(): HorsePrediction {
  return predictions[0];
}

function getDrawdownMultiplier(drawdown: number) {
  if (drawdown < 10) return 1;
  if (drawdown < 15) return 0.75;
  if (drawdown < 25) return 0.5;
  if (drawdown < 35) return 0.25;
  return 0.1;
}
