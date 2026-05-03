export type Confidence = "Faible" | "Moyenne" | "Forte";

export type HorsePrediction = {
  id: string;
  number: number;
  horse: string;
  jockey: string;
  trainer: string;
  odds: number;
  winProbability: number;
  top3Probability: number;
  top5Probability: number;
  kzScore: number;
  valueIndex: number;
  confidence: Confidence;
  factors: string[];
};

export type RaceAnalysis = {
  id: string;
  name: string;
  racecourse: string;
  startTime: string;
  discipline: "Plat" | "Trot" | "Obstacle";
  distance: string;
  going: string;
  weather: string;
  marketVolatility: number;
  modelConsensus: number;
  riskLevel: "Prudent" | "Equilibre" | "Speculatif";
  horses: HorsePrediction[];
};

export type BetSimulation = {
  stake: number;
  odds: number;
  winProbability: number;
  expectedValue: number;
  potentialReturn: number;
  kellyStake: number;
  recommendation: "Eviter" | "Observer" | "Miser prudemment" | "Value bet";
};
