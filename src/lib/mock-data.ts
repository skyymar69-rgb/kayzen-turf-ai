import { classifyRaceTier, enrichHorsePrediction } from "@/lib/betting-engine";
import type { HorsePrediction, RaceAnalysis } from "@/lib/types";

export const raceAnalysis: RaceAnalysis = {
  id: "R1C3-2026-05-03",
  name: "Prix Kayzen Data",
  raceDate: "2026-05-03",
  relativeDay: "today",
  racecourse: "ParisLongchamp",
  startTime: "15:15",
  discipline: "Plat",
  distance: "2 100 m",
  going: "Bon souple",
  weather: "Nuageux, vent faible",
  marketVolatility: 18,
  modelConsensus: 76,
  raceQualityScore: 82,
  bettingTier: classifyRaceTier(82),
  riskLevel: "Equilibre",
  horses: [
    enrichHorsePrediction({
      id: "h-1",
      number: 4,
      horse: "Helios Prime",
      jockey: "M. Barzalona",
      trainer: "A. Fabre",
      odds: 4.8,
      winProbability: 24,
      top3Probability: 56,
      top5Probability: 72,
      kzScore: 91,
      confidence: "Forte",
      factors: ["Regularite recente", "Jockey en forme", "Profil piste favorable"],
    }),
    enrichHorsePrediction({
      id: "h-2",
      number: 8,
      horse: "Nuit de Seine",
      jockey: "C. Soumillon",
      trainer: "J. Reynier",
      odds: 7.2,
      winProbability: 18,
      top3Probability: 44,
      top5Probability: 63,
      kzScore: 84,
      confidence: "Forte",
      factors: ["Cote superieure au juste prix", "Bonne tenue", "Derniers 600 m solides"],
    }),
    enrichHorsePrediction({
      id: "h-3",
      number: 2,
      horse: "Atlas Green",
      jockey: "T. Piccone",
      trainer: "F. Chappet",
      odds: 5.6,
      winProbability: 17,
      top3Probability: 39,
      top5Probability: 58,
      kzScore: 78,
      confidence: "Moyenne",
      factors: ["Classe stable", "Terrain correct", "Marche deja ajuste"],
    }),
    enrichHorsePrediction({
      id: "h-4",
      number: 11,
      horse: "Orage Secret",
      jockey: "A. Lemaitre",
      trainer: "M. Delzangles",
      odds: 14.5,
      winProbability: 10,
      top3Probability: 31,
      top5Probability: 49,
      kzScore: 73,
      confidence: "Moyenne",
      factors: ["Outsider sous-estime", "Distance ideale", "Rythme probable avantageux"],
    }),
    enrichHorsePrediction({
      id: "h-5",
      number: 6,
      horse: "Silver Method",
      jockey: "S. Pasquier",
      trainer: "P. Bary",
      odds: 3.9,
      winProbability: 21,
      top3Probability: 48,
      top5Probability: 69,
      kzScore: 71,
      confidence: "Moyenne",
      factors: ["Favori logique", "Cote courte", "Peu de marge value"],
    }),
  ],
};

export const raceCards: RaceAnalysis[] = [
  {
    ...raceAnalysis,
  },
  {
    ...raceAnalysis,
    id: "R2C5-2026-05-04",
    name: "Prix Momentum IA",
    raceDate: "2026-05-04",
    relativeDay: "tomorrow",
    racecourse: "Chantilly",
    startTime: "16:40",
    distance: "1 600 m",
    going: "Bon",
    weather: "Eclaircies, piste reguliere",
    marketVolatility: 11,
    modelConsensus: 71,
    raceQualityScore: 74,
    bettingTier: classifyRaceTier(74),
    riskLevel: "Prudent",
    horses: raceAnalysis.horses.map((horse, index) =>
      enrichHorsePrediction({
        ...horse,
        id: `tomorrow-${horse.id}`,
        odds: [5.1, 8.4, 6.2, 12.8, 4.4][index] ?? horse.odds,
        winProbability: [23, 16, 18, 9, 22][index] ?? horse.winProbability,
        top3Probability: [53, 40, 42, 27, 51][index] ?? horse.top3Probability,
        top5Probability: [71, 59, 61, 45, 70][index] ?? horse.top5Probability,
        kzScore: [88, 80, 79, 69, 77][index] ?? horse.kzScore,
      }),
    ),
  },
  {
    ...raceAnalysis,
    id: "R1C2-2026-05-02",
    name: "Prix Backtest Live",
    raceDate: "2026-05-02",
    relativeDay: "yesterday",
    racecourse: "Auteuil",
    startTime: "14:25",
    discipline: "Obstacle",
    distance: "3 600 m",
    going: "Tres souple",
    weather: "Pluie faible",
    marketVolatility: 27,
    modelConsensus: 64,
    raceQualityScore: 58,
    bettingTier: classifyRaceTier(58),
    riskLevel: "Speculatif",
    horses: raceAnalysis.horses.map((horse, index) =>
      enrichHorsePrediction({
        ...horse,
        id: `yesterday-${horse.id}`,
        odds: [6.5, 9.2, 4.9, 18, 3.5][index] ?? horse.odds,
        winProbability: [18, 14, 22, 7, 25][index] ?? horse.winProbability,
        top3Probability: [46, 35, 50, 22, 55][index] ?? horse.top3Probability,
        top5Probability: [67, 54, 72, 39, 76][index] ?? horse.top5Probability,
        kzScore: [76, 70, 86, 61, 83][index] ?? horse.kzScore,
      }),
    ),
  },
];

export const predictions = raceCards
  .flatMap((race) => race.horses.map((horse) => ({ ...horse, raceId: race.id, raceName: race.name })))
  .slice()
  .sort((a, b) => b.kzScore - a.kzScore);

export const valueBets = raceCards
  .flatMap((race) => race.horses.map((horse) => ({ ...horse, raceId: race.id, raceName: race.name })))
  .filter((horse) => horse.valueIndex > 10)
  .sort((a, b) => b.valueIndex - a.valueIndex);

export function getTopPick(): HorsePrediction {
  return predictions[0];
}
