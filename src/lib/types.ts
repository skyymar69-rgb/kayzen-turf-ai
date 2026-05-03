export type Confidence = "Faible" | "Moyenne" | "Forte";

export type HorsePrediction = {
  id: string;
  number: number;
  horse: string;
  jockey: string;
  trainer: string;
  odds: number;
  fairOdds: number;
  marketEdge: number;
  winProbability: number;
  top3Probability: number;
  top5Probability: number;
  kzScore: number;
  valueIndex: number;
  confidence: Confidence;
  factors: string[];
};

export type BetOffer = {
  type: string;
  label: string;
  audience: string | null;
  baseStake: number;
  ordered: boolean;
  combined: boolean;
  requiredHorses: number;
  flexi: number[];
  riskOptions: number[];
  online: boolean;
  spotAllowed: boolean;
};

export type BetRecommendation = {
  type: string;
  label: string;
  audience: string | null;
  baseStake: number;
  strategy: "Confiance" | "Value" | "Couverture" | "Speculatif";
  horses: Array<{
    number: number;
    name: string;
  }>;
  ticket: string;
  confidence: number;
  rationale: string;
};

export type RaceAnalysis = {
  id: string;
  name: string;
  raceDate: string;
  relativeDay: "yesterday" | "today" | "tomorrow";
  reunionNumber: number;
  courseNumber: number;
  programCode: string;
  sourceCountry: string;
  racecourse: string;
  startTime: string;
  discipline: "Plat" | "Trot" | "Obstacle";
  distance: string;
  going: string;
  weather: string;
  marketVolatility: number;
  modelConsensus: number;
  raceQualityScore: number;
  bettingTier: "Focus" | "Value" | "Avoid";
  riskLevel: "Prudent" | "Equilibre" | "Speculatif";
  betTypes: BetOffer[];
  horses: HorsePrediction[];
};

export type BetSimulation = {
  stake: number;
  odds: number;
  winProbability: number;
  expectedValue: number;
  potentialReturn: number;
  kellyStake: number;
  drawdownAdjustedStake: number;
  fairOdds: number;
  marketEdge: number;
  recommendation: "Eviter" | "Observer" | "Miser prudemment" | "Value bet";
};

export type ModelCard = {
  version: string;
  purpose: string;
  modelStack: string[];
  featureFamilies: string[];
  calibration: {
    method: string;
    rationale: string;
  };
  leakageControls: string[];
  bankrollPolicy: {
    kellyFraction: number;
    maxStakeFraction: number;
    drawdownRules: Array<{
      from: number;
      to: number | null;
      multiplier: number;
    }>;
  };
  limitations: string[];
};
