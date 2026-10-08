import type { FundamentalRaceContext } from "@/lib/fundamental/features";
import type { HorseHistory } from "@/lib/fundamental/history";

export type Confidence = "Faible" | "Moyenne" | "Forte";

export type HorsePrediction = {
  id: string;
  /** Identifiant du cheval, stable d'une course à l'autre (sert au suivi). */
  horseId?: string;
  number: number;
  horse: string;
  age?: number | null;
  sex?: string | null;
  music?: string | null;
  earnings?: number | null;
  handicapDistance?: number | null;
  reductionKm?: string | null;
  /** Réduction kilométrique relevée avant la course, en millièmes de seconde (74300 = 1'14"3). */
  speedFigure?: number | null;
  /** Place à la corde (placeCorde PMU), distincte du numéro de dossard. */
  draw?: number | null;
  /** Œillères seules (champ `oeilleres` PMU) — le déferrage n'y figure plus. */
  equipment?: string | null;
  /** Œillères, colonne explicite `entries.blinkers` (même valeur qu'`equipment`). */
  blinkers?: string | null;
  silksUrl?: string | null;
  jockey: string;
  trainer: string;
  odds: number;
  /**
   * Origine de la cote : rapport direct, cote de référence ou rapport probable.
   * `null` pour l'historique antérieur à la colonne. Voir src/lib/odds-freshness.ts.
   */
  oddsSource?: "direct" | "reference" | "probable" | null;
  fairOdds: number;
  marketEdge: number;
  winProbability: number;
  top3Probability: number;
  top5Probability: number;
  kzScore: number;
  valueIndex: number;
  confidence: Confidence;
  factors: string[];
  finishPosition?: number | null;
  won?: boolean | null;
  /** Probabilité implicite du marché, overround retiré (%). Renseigné par `calibrateField`. */
  marketProbability?: number;
  /** Probabilité retenue ÷ probabilité marché. > 1 = sous-coté. Renseigné par `calibrateField`. */
  valueRatio?: number;
  /**
   * Probabilité de victoire du modèle fondamental, qui n'a jamais vu la cote (%).
   * C'est l'« avis IA » comparable au marché — voir src/lib/fundamental.
   */
  fundamentalProbability?: number | null;
  /**
   * Courses et victoires du jockey/driver et de l'entraîneur CONNUES AVANT LA
   * COURSE (valeurs figées à l'import), `null` pour une course passée sans
   * valeur figée. Voir src/lib/point-in-time.ts.
   */
  jockeyRuns?: number | null;
  jockeyWins?: number | null;
  trainerRuns?: number | null;
  trainerWins?: number | null;
  /** Part des enjeux PMU sur ce cheval, au dernier relevé (%). */
  poolWin?: number | null;
  poolPlace?: number | null;
  /** Poids porté (entries.weight), lu par le modèle fondamental (plat/obstacle). */
  weight?: number | null;
  /** Code de déferrage (entries.shoeing), lu par le modèle fondamental (trot). */
  shoeing?: string | null;
  /** Données de la course utiles au modèle fondamental (spécialité, départ, distance, allocation, terrain). */
  raceContext?: FundamentalRaceContext | null;
  /** Historique en base du cheval, strictement antérieur à la course (src/lib/fundamental/history.ts). */
  history?: HorseHistory | null;
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
  variants: BetTicketVariant[];
  variantCount: number;
  /**
   * Retour estimé pour 1 € misé (0,82 = on récupère 82 centimes en moyenne),
   * `null` quand il n'est pas estimable (pas de cote, combinaison trop rare).
   * Voir `expectedTicketReturn` dans src/lib/bet-recommendations.ts.
   */
  expectedReturn?: number | null;
};

export type BetTicketVariant = {
  ticket: string;
  numbers: number[];
  confidence: number;
  rationale: string;
  /** Retour estimé pour 1 € misé, comme `BetRecommendation.expectedReturn`. */
  expectedReturn?: number | null;
};

export type PostRaceAnalysis = {
  status: "pending" | "complete";
  predictedArrival: number[];
  actualArrival: number[];
  metrics: {
    winnerHit: boolean;
    top3Hits: number;
    top5Hits: number;
    averagePositionError: number | null;
    confidenceScore: number;
  };
  verdict: "Bon signal" | "Partiel" | "Erreur modèle" | "En attente";
  summary: string;
  lessons: string[];
  nextModelActions: string[];
};

export type RaceAnalysis = {
  id: string;
  name: string;
  raceDate: string;
  relativeDay: "yesterday" | "today" | "tomorrow" | "other";
  reunionNumber: number;
  courseNumber: number;
  programCode: string;
  sourceCountry: string;
  racecourse: string;
  startTime: string;
  discipline: "Plat" | "Trot" | "Obstacle";
  specialty: string;
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
  /**
   * Vrai dès qu'au moins un partant a une cote PMU publiée. Faux tant que le
   * marché n'a rien émis : le classement repose alors sur le modèle seul et
   * l'interface doit le dire, au lieu d'afficher une cote fabriquée.
   */
  oddsAvailable: boolean;
  /** Dernier rafraîchissement des cotes (ISO), `null` si jamais rafraîchie depuis l'import. */
  oddsRefreshedAt?: string | null;
  /** Type de départ au trot (texte `conditions` PMU), `null` hors trot ou inconnu. */
  startType?: "autostart" | "volte" | null;
  /** Allocation totale de la course, en euros. */
  prize?: number | null;
  /** Dernière relecture du terrain par la boucle live (ISO), `null` si seul l'import l'a écrit. */
  goingUpdatedAt?: string | null;
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
  recommendation: "Éviter" | "Observer" | "Miser prudemment" | "Value bet";
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
