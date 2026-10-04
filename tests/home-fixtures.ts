import type { HorsePrediction, RaceAnalysis } from "../src/lib/types";

/** Partant complet pour les tests de l'accueil ; seuls les champs utiles changent. */
export function horse(number: number, extra: Partial<HorsePrediction> = {}): HorsePrediction {
  return {
    id: `h${number}`,
    horseId: `cheval-${number}`,
    number,
    horse: `CHEVAL ${number}`,
    jockey: "J. Dupont",
    trainer: "E. Martin",
    odds: 10,
    fairOdds: 10,
    marketEdge: 0,
    winProbability: 8,
    top3Probability: 25,
    top5Probability: 40,
    kzScore: 50,
    valueIndex: 0,
    confidence: "Moyenne",
    factors: [],
    fundamentalProbability: 8,
    ...extra,
  };
}

/** Peloton avec un favori net (n° 1) : course « lisible ». */
export function clearField(size = 8): HorsePrediction[] {
  return Array.from({ length: size }, (_, i) =>
    i === 0
      ? horse(1, { odds: 1.6, fairOdds: 1.6, winProbability: 55, top3Probability: 85, top5Probability: 95, kzScore: 95, fundamentalProbability: 55 })
      : horse(i + 1, { odds: 12 + i, winProbability: 45 / (size - 1), top3Probability: 20, kzScore: 40 - i, fundamentalProbability: 45 / (size - 1) }),
  );
}

/** Peloton sans aucun cheval à 20 % : course « piège ». */
export function openField(size = 12): HorsePrediction[] {
  return Array.from({ length: size }, (_, i) =>
    horse(i + 1, { odds: 9 + i * 0.1, winProbability: 100 / size, top3Probability: 300 / size, kzScore: 50 - i * 0.1, fundamentalProbability: 100 / size }),
  );
}

export function race(id: string, extra: Partial<RaceAnalysis> = {}): RaceAnalysis {
  return {
    id,
    name: `PRIX ${id}`,
    raceDate: "2026-10-04",
    relativeDay: "today",
    reunionNumber: 1,
    courseNumber: 1,
    programCode: "R1C1",
    sourceCountry: "FRA",
    racecourse: "VINCENNES",
    startTime: "15:00",
    discipline: "Trot",
    specialty: "Attelé",
    distance: "2700",
    going: "Bon",
    weather: "",
    marketVolatility: 20,
    modelConsensus: 60,
    raceQualityScore: 60,
    bettingTier: "Value",
    riskLevel: "Equilibre",
    betTypes: [],
    horses: clearField(),
    oddsAvailable: true,
    ...extra,
  };
}
