import { classifyRaceTier, enrichHorsePrediction } from "@/lib/betting-engine";
import { jourParis, minutesActuellesParis } from "@/lib/paris-time";
import type { HorsePrediction, RaceAnalysis } from "@/lib/types";

/**
 * Dates du jeu de démonstration, calculées à Paris au chargement du module.
 * Elles étaient figées à mai 2026 : le dépôt filtre sur hier / aujourd'hui /
 * demain, donc le mode démonstration n'affichait plus aucune course.
 */
function decalerJour(iso: string, delta: number): string {
  const date = new Date(`${iso}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + delta);
  return date.toISOString().slice(0, 10);
}

const DEMO_TODAY = jourParis();
const DEMO_YESTERDAY = decalerJour(DEMO_TODAY, -1);
const DEMO_TOMORROW = decalerJour(DEMO_TODAY, 1);

export const raceAnalysis: RaceAnalysis = {
  id: `R1C3-${DEMO_TODAY}`,
  name: "Prix Kayzen Turf Data",
  raceDate: DEMO_TODAY,
  oddsAvailable: true,
  relativeDay: "today",
  reunionNumber: 1,
  courseNumber: 3,
  programCode: "R1C3",
  sourceCountry: "FRA",
  racecourse: "ParisLongchamp",
  startTime: "15:15",
  discipline: "Plat",
  specialty: "Plat",
  distance: "2 100 m",
  going: "Bon souple",
  weather: "Nuageux, vent faible",
  marketVolatility: 18,
  modelConsensus: 76,
  raceQualityScore: 82,
  bettingTier: classifyRaceTier(82),
  riskLevel: "Equilibre",
  betTypes: [
    {
      type: "SIMPLE_GAGNANT",
      label: "Simple Gagnant",
      audience: "NATIONAL",
      baseStake: 2,
      ordered: false,
      combined: true,
      requiredHorses: 1,
      flexi: [],
      riskOptions: [],
      online: true,
      spotAllowed: true,
    },
    {
      type: "COUPLE_PLACE",
      label: "Couple Place",
      audience: "NATIONAL",
      baseStake: 2,
      ordered: false,
      combined: true,
      requiredHorses: 2,
      flexi: [50],
      riskOptions: [],
      online: true,
      spotAllowed: true,
    },
    {
      type: "TRIO",
      label: "Trio",
      audience: "NATIONAL",
      baseStake: 2,
      ordered: false,
      combined: true,
      requiredHorses: 3,
      flexi: [50],
      riskOptions: [],
      online: true,
      spotAllowed: true,
    },
  ],
  horses: [
    enrichHorsePrediction({
      id: "h-1",
      number: 4,
      horse: "Helios Prime",
      jockey: "M. Barzalona",
      trainer: "A. Fabre",
      odds: 4.8,
      fundamentalProbability: 26,
      winProbability: 24,
      top3Probability: 56,
      top5Probability: 72,
      kzScore: 91,
      confidence: "Forte",
      factors: ["Regularite recente", "Jockey en forme", "Profil piste favorable"],
      finishPosition: 2,
      won: false,
    }),
    enrichHorsePrediction({
      id: "h-2",
      number: 8,
      horse: "Nuit de Seine",
      jockey: "C. Soumillon",
      trainer: "J. Reynier",
      odds: 7.2,
      fundamentalProbability: 25,
      winProbability: 18,
      top3Probability: 44,
      top5Probability: 63,
      kzScore: 84,
      confidence: "Forte",
      factors: ["Cote superieure au juste prix", "Bonne tenue", "Derniers 600 m solides"],
      finishPosition: 1,
      won: true,
    }),
    enrichHorsePrediction({
      id: "h-3",
      number: 2,
      horse: "Atlas Green",
      jockey: "T. Piccone",
      trainer: "F. Chappet",
      odds: 5.6,
      fundamentalProbability: 13,
      winProbability: 17,
      top3Probability: 39,
      top5Probability: 58,
      kzScore: 78,
      confidence: "Moyenne",
      factors: ["Classe stable", "Terrain correct", "Marche deja ajuste"],
      finishPosition: 4,
      won: false,
    }),
    enrichHorsePrediction({
      id: "h-4",
      number: 11,
      horse: "Orage Secret",
      jockey: "A. Lemaitre",
      trainer: "M. Delzangles",
      odds: 14.5,
      fundamentalProbability: 6,
      winProbability: 10,
      top3Probability: 31,
      top5Probability: 49,
      kzScore: 73,
      confidence: "Moyenne",
      factors: ["Outsider sous-estimé", "Distance idéale", "Rythme probable avantageux"],
      finishPosition: 3,
      won: false,
    }),
    enrichHorsePrediction({
      id: "h-5",
      number: 6,
      horse: "Silver Method",
      jockey: "S. Pasquier",
      trainer: "P. Bary",
      odds: 3.9,
      fundamentalProbability: 30,
      winProbability: 21,
      top3Probability: 48,
      top5Probability: 69,
      kzScore: 71,
      confidence: "Moyenne",
      factors: ["Favori logique", "Cote courte", "Peu de marge value"],
    }),
  ],
};

/**
 * Courses fictives supplémentaires pour aujourd'hui : trois réunions, des
 * disciplines variées, un Quinté+, des courses déjà arrivées et d'autres à
 * venir — de quoi exercer la navigation de /pronostics en démonstration.
 * Les heures « à venir » sont posées par rapport à l'heure de Paris au
 * chargement du module, bornées à 23:55.
 */
function heureDansMinutes(delta: number): string {
  const minutes = Math.min(23 * 60 + 55, Math.max(0, minutesActuellesParis() + delta));
  const arrondi = minutes - (minutes % 5);
  return `${String(Math.floor(arrondi / 60)).padStart(2, "0")}:${String(arrondi % 60).padStart(2, "0")}`;
}

/** [numéro, cheval, jockey/driver, entraîneur, cote, probabilité IA %, place à l'arrivée] */
type DemoRunner = [number, string, string, string, number, number, number | null];

function demoField(prefix: string, runners: DemoRunner[]): HorsePrediction[] {
  const total = runners.reduce((t, r) => t + r[5], 0);
  return runners.map(([number, horse, jockey, trainer, odds, fundamental, finishPosition], index) => {
    const win = Math.round((fundamental / total) * 1000) / 10;
    return enrichHorsePrediction({
      id: `${prefix}-${number}`,
      number,
      horse,
      jockey,
      trainer,
      odds,
      fundamentalProbability: fundamental,
      winProbability: win,
      top3Probability: Math.min(90, Math.round(win * 2.4)),
      top5Probability: Math.min(95, Math.round(win * 3.3)),
      kzScore: Math.max(50, 90 - index * 5),
      confidence: index === 0 ? "Forte" : "Moyenne",
      factors: ["Donnée fictive de démonstration"],
      finishPosition,
      won: finishPosition === null ? null : finishPosition === 1,
    });
  });
}

const QUINTE_OFFER = {
  ...raceAnalysis.betTypes[2],
  type: "QUINTE_PLUS",
  label: "Quinté+",
  requiredHorses: 5,
  ordered: true,
};

const demoTodayExtras: RaceAnalysis[] = [
  {
    ...raceAnalysis,
    id: `R1C1-${DEMO_TODAY}`,
    name: "Prix de l'Aube Fictive",
    courseNumber: 1,
    programCode: "R1C1",
    startTime: "13:20",
    distance: "1 400 m",
    horses: demoField("r1c1", [
      [3, "Éclair d'Été", "M. Guyon", "C. Ferland", 3.2, 30, 1],
      [7, "Brise Marine", "A. Pouchin", "Y. Barberot", 6.5, 18, 4],
      [1, "Comète Bleue", "C. Demuro", "F. Rossi", 9, 15, 2],
      [5, "Douce Folie", "T. Bachelot", "S. Wattel", 12, 10, 3],
      [2, "Grand Tétras", "V. Cheminaud", "H. Pantall", 15, 8, 5],
    ]),
  },
  {
    ...raceAnalysis,
    id: `R1C5-${DEMO_TODAY}`,
    name: "Prix du Crépuscule Imaginaire",
    courseNumber: 5,
    programCode: "R1C5",
    startTime: heureDansMinutes(40),
    distance: "2 400 m",
    horses: demoField("r1c5", [
      [6, "Héron Cendré", "M. Barzalona", "A. Fabre", 4.2, 22, null],
      [9, "Île aux Moines", "C. Soumillon", "J. Reynier", 11, 21, null],
      [2, "Jade Impérial", "S. Pasquier", "P. Bary", 5, 17, null],
      [4, "Kalinka Rose", "T. Piccone", "F. Chappet", 8.5, 12, null],
      [8, "Lune Rousse", "A. Lemaitre", "M. Delzangles", 16, 7, null],
    ]),
  },
  {
    ...raceAnalysis,
    id: `R2C3-${DEMO_TODAY}`,
    name: "Prix de Démonstration Attelé",
    reunionNumber: 2,
    courseNumber: 3,
    programCode: "R2C3",
    racecourse: "Vincennes",
    startTime: "14:05",
    discipline: "Trot",
    specialty: "Attelé",
    distance: "2 700 m",
    horses: demoField("r2c3", [
      [5, "Fée du Logis", "É. Raffin", "S. Guarato", 2.8, 26, 6],
      [10, "Gamin d'Amour", "J.-M. Bazire", "J.-M. Bazire", 7, 15, 1],
      [1, "Hirondelle Sud", "M. Abrivard", "L.-C. Abrivard", 6, 16, 2],
      [12, "Ivoire du Val", "Y. Lebourgeois", "P. Allaire", 13, 9, 3],
      [3, "Joker Noir", "F. Nivard", "T. Duvaldestin", 18, 6, 4],
    ]),
  },
  {
    ...raceAnalysis,
    id: `R2C4-${DEMO_TODAY}`,
    name: "Prix Fictif du Quinté",
    reunionNumber: 2,
    courseNumber: 4,
    programCode: "R2C4",
    racecourse: "Vincennes",
    startTime: heureDansMinutes(12),
    discipline: "Trot",
    specialty: "Attelé",
    distance: "2 850 m",
    betTypes: [...raceAnalysis.betTypes, QUINTE_OFFER],
    horses: demoField("r2c4", [
      [8, "Lord du Bocage", "É. Raffin", "S. Guarato", 3.5, 25, null],
      [14, "Mistral Gagnant", "M. Abrivard", "L.-C. Abrivard", 9.5, 19, null],
      [2, "Nuit Câline", "F. Nivard", "T. Duvaldestin", 6.8, 14, null],
      [11, "Opale Rieuse", "J.-M. Bazire", "J.-M. Bazire", 21, 9, null],
      [6, "Pépite d'Or", "Y. Lebourgeois", "P. Allaire", 11, 8, null],
      [4, "Quartz Royal", "B. Rochard", "R. Bergh", 26, 5, null],
    ]),
  },
  {
    ...raceAnalysis,
    id: `R3C2-${DEMO_TODAY}`,
    name: "Prix des Haies de Papier",
    reunionNumber: 3,
    courseNumber: 2,
    programCode: "R3C2",
    racecourse: "Auteuil",
    startTime: heureDansMinutes(95),
    discipline: "Obstacle",
    specialty: "Haies",
    distance: "3 500 m",
    horses: demoField("r3c2", [
      [1, "Rocher Fier", "J. Reveley", "F. Nicolle", 3.8, 24, null],
      [4, "Saule Pleureur", "K. Nabet", "G. Cherel", 5.5, 20, null],
      [7, "Tempête Douce", "T. Beaurain", "D. Bressou", 8, 14, null],
      [3, "Urubu Blanc", "F. de Giles", "E. Leenders", 14, 9, null],
    ]),
  },
];

export const raceCards: RaceAnalysis[] = [
  {
    ...raceAnalysis,
  },
  {
    ...raceAnalysis,
    id: `R2C5-${DEMO_TOMORROW}`,
    name: "Prix Momentum IA",
    raceDate: DEMO_TOMORROW,
    relativeDay: "tomorrow",
    reunionNumber: 2,
    courseNumber: 5,
    programCode: "R2C5",
    sourceCountry: "FRA",
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
        // Une course de demain n'a pas encore d'arrivée.
        finishPosition: null,
        won: null,
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
    id: `R1C2-${DEMO_YESTERDAY}`,
    name: "Prix Backtest Live",
    raceDate: DEMO_YESTERDAY,
    relativeDay: "yesterday",
    reunionNumber: 1,
    courseNumber: 2,
    programCode: "R1C2",
    sourceCountry: "FRA",
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
  ...demoTodayExtras,
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
