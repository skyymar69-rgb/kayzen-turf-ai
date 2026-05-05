import type { HorsePrediction, RaceAnalysis } from "@/lib/types";

type RaceContext = Partial<Pick<RaceAnalysis, "marketVolatility" | "modelConsensus" | "raceQualityScore" | "riskLevel">>;

type FieldStats = {
  averageOdds: number;
  averageTop3: number;
  averageWin: number;
  earningsMax: number;
  fieldSize: number;
  favoriteOdds: number;
  kzMax: number;
  top3Max: number;
  winMax: number;
};

export type PredictionSignal = {
  label: string;
  value: number;
  weight: number;
};

export type EnhancedPrediction = {
  horse: HorsePrediction;
  score: number;
  exactOrderScore: number;
  top3UpsetScore: number;
  favoriteFailureRisk: number;
  outsiderWatchScore: number;
  signals: PredictionSignal[];
};

export function probableArrivalScore(horse: HorsePrediction, horses: HorsePrediction[], context: RaceContext = {}) {
  return explainPredictionScore(horse, horses, context).score;
}

export function explainPredictionScore(
  horse: HorsePrediction,
  horses: HorsePrediction[],
  context: RaceContext = {},
): EnhancedPrediction {
  const stats = fieldStats(horses);
  const rank = rankSnapshot(horse, horses);
  const odds = sane(horse.odds, horse.fairOdds || stats.averageOdds || 12);
  const win = clamp(sane(horse.winProbability), 0, 80);
  const top3 = clamp(sane(horse.top3Probability), 0, 99);
  const top5 = clamp(sane(horse.top5Probability), 0, 99);
  const edge = clamp(sane(horse.marketEdge, horse.valueIndex), -50, 100);
  const confidence = confidenceScore(horse.confidence);
  const music = musicProfile(horse.music);
  const volatility = clamp(sane(context.marketVolatility), 0, 40);
  const consensus = clamp(sane(context.modelConsensus, 55), 0, 100);
  const fieldPressure = clamp((stats.fieldSize - 8) * 1.8, -8, 18);
  const favoriteGap = clamp((stats.favoriteOdds || odds) - odds, -20, 20);
  const favoriteFailureRisk = clamp(
    (odds <= stats.favoriteOdds + 0.25 ? 18 : 0) +
      (top3 < stats.averageTop3 ? 14 : 0) +
      (edge < -8 ? 12 : 0) +
      (music.badRecent * 5) +
      fieldPressure * 0.45 +
      volatility * 0.4 -
      confidence * 0.08,
    0,
    60,
  );
  const outsiderWatchScore = clamp(
    (odds >= 6 && odds <= 22 ? 15 : 0) +
      Math.max(0, edge) * 0.28 +
      Math.max(0, top3 - stats.averageTop3) * 0.38 +
      Math.max(0, top5 - top3) * 0.14 +
      music.rebound * 5 -
      Math.max(0, odds - 28) * 0.6,
    0,
    45,
  );
  const top3UpsetScore = clamp(
    outsiderWatchScore * 0.62 +
      Math.max(0, top3 - win * 2.1) * 0.24 +
      Math.max(0, edge) * 0.16 +
      volatility * 0.18 -
      favoriteFailureRisk * (odds <= 4 ? 0.35 : 0),
    0,
    60,
  );

  const signals: PredictionSignal[] = [
    signal("KZ brut", horse.kzScore, 0.54),
    signal("Probabilite gagnant", win, 0.42),
    signal("Probabilite Top 3", top3, 0.38),
    signal("Probabilite Top 5", top5, 0.18),
    signal("Regularite place/gagnant", top3 - win, 0.11),
    signal("Reservoir Top 5", top5 - top3, 0.07),
    signal("Edge marche cappe", clamp(edge, -18, 32), 0.19),
    signal("Value positive", Math.max(0, edge), 0.12),
    signal("Favorite gap", favoriteGap, 0.1),
    signal("Risque favori fragile", -favoriteFailureRisk, 0.34),
    signal("Rang KZ inverse", rank.kz, -1.15),
    signal("Rang gagnant inverse", rank.win, -0.92),
    signal("Rang Top 3 inverse", rank.top3, -1.06),
    signal("Rang cote inverse", rank.odds, -0.42),
    signal("Confiance source", confidence, 0.07),
    signal("Forme moyenne musique", music.score, 10.5),
    signal("Victoire recente", music.recentWin ? 1 : 0, 3.8),
    signal("Places recentes", music.recentPlaces, 1.35),
    signal("Echecs recents", -music.badRecent, 1.45),
    signal("Signal rebond", music.rebound, 2.8),
    signal("Gains normalises", normalized(horse.earnings, stats.earningsMax), 5.4),
    signal("Age optimal", ageSignal(horse.age), 3.2),
    signal("Handicap distance", handicapSignal(horse.handicapDistance), 3.4),
    signal("Reduction kilometrique", reductionSignal(horse.reductionKm), 2.6),
    signal("Equipement lisible", equipmentSignal(horse.equipment), 1.9),
    signal("Pression peloton", -fieldPressure, 0.16),
    signal("Consensus course", consensus - 50, 0.05),
    signal("Volatilite outsider", odds >= 6 ? volatility : -volatility, 0.07),
    signal("Stabilite des rangs", rankStability(rank), 1.85),
    signal("Tocard surveille Top 3", top3UpsetScore, 0.24),
  ];

  const rawScore = signals.reduce((sum, item) => sum + item.value * item.weight, 0);
  const exactOrderScore = rawScore + win * 0.38 + top3 * 0.18 - favoriteFailureRisk * 0.4 - rankStability(rank) * 0.8;
  const score = clamp(Math.round(rawScore), 1, 99);

  return {
    exactOrderScore: round(exactOrderScore, 2),
    favoriteFailureRisk: round(favoriteFailureRisk, 1),
    horse,
    outsiderWatchScore: round(outsiderWatchScore, 1),
    score,
    signals,
    top3UpsetScore: round(top3UpsetScore, 1),
  };
}

export function enhancedArrival(horses: HorsePrediction[], context: RaceContext = {}) {
  return horses
    .map((horse) => explainPredictionScore(horse, horses, context))
    .sort(
      (a, b) =>
        b.score - a.score ||
        b.exactOrderScore - a.exactOrderScore ||
        b.horse.top3Probability - a.horse.top3Probability ||
        a.horse.odds - b.horse.odds,
    );
}

export function watchedLongshot(horses: HorsePrediction[], context: RaceContext = {}) {
  return enhancedArrival(horses, context)
    .filter((item) => item.horse.odds >= 6)
    .sort(
      (a, b) =>
        b.top3UpsetScore - a.top3UpsetScore ||
        b.outsiderWatchScore - a.outsiderWatchScore ||
        b.horse.valueIndex - a.horse.valueIndex,
    )[0]?.horse;
}

function fieldStats(horses: HorsePrediction[]): FieldStats {
  const oddsList = horses.map((horse) => sane(horse.odds)).filter((odds) => odds > 1);
  return {
    averageOdds: average(oddsList, 12),
    averageTop3: average(horses.map((horse) => sane(horse.top3Probability)), 24),
    averageWin: average(horses.map((horse) => sane(horse.winProbability)), 8),
    earningsMax: Math.max(...horses.map((horse) => sane(horse.earnings)), 0),
    favoriteOdds: Math.min(...oddsList, 99),
    fieldSize: horses.length,
    kzMax: Math.max(...horses.map((horse) => sane(horse.kzScore)), 1),
    top3Max: Math.max(...horses.map((horse) => sane(horse.top3Probability)), 1),
    winMax: Math.max(...horses.map((horse) => sane(horse.winProbability)), 1),
  };
}

function rankSnapshot(horse: HorsePrediction, horses: HorsePrediction[]) {
  return {
    kz: rankBy(horse, horses, (item) => sane(item.kzScore), "desc"),
    odds: rankBy(horse, horses, (item) => sane(item.odds, 99), "asc"),
    top3: rankBy(horse, horses, (item) => sane(item.top3Probability), "desc"),
    win: rankBy(horse, horses, (item) => sane(item.winProbability), "desc"),
  };
}

function rankBy(horse: HorsePrediction, horses: HorsePrediction[], getter: (horse: HorsePrediction) => number, direction: "asc" | "desc") {
  const sorted = horses.slice().sort((a, b) => direction === "asc" ? getter(a) - getter(b) : getter(b) - getter(a));
  return sorted.findIndex((item) => item.id === horse.id) + 1 || sorted.length + 1;
}

function rankStability(rank: { kz: number; odds: number; top3: number; win: number }) {
  const ranks = [rank.kz, rank.odds, rank.top3, rank.win];
  const avg = average(ranks, 1);
  const variance = average(ranks.map((item) => Math.abs(item - avg)), 0);
  return clamp(10 - variance, 0, 10);
}

function musicProfile(music?: string | null) {
  const digits = String(music ?? "").match(/[1-9]/g)?.slice(0, 6).map(Number) ?? [];
  if (digits.length === 0) {
    return { badRecent: 1, rebound: 0, recentPlaces: 0, recentWin: false, score: 0.05 };
  }
  const averagePlace = average(digits, 8);
  const recent = digits.slice(0, 3);
  const badRecent = recent.filter((value) => value >= 7).length;
  const recentPlaces = recent.filter((value) => value <= 3).length;
  const recentWin = recent.includes(1);
  const rebound = digits[0] <= 4 && digits.slice(1, 4).some((value) => value >= 7) ? 1 : 0;

  return {
    badRecent,
    rebound,
    recentPlaces,
    recentWin,
    score: clamp((10 - averagePlace) / 9, 0, 1),
  };
}

function confidenceScore(confidence: HorsePrediction["confidence"]) {
  if (confidence === "Forte") return 100;
  if (confidence === "Moyenne") return 62;
  return 34;
}

function ageSignal(age?: number | null) {
  if (!age) return 0;
  if (age >= 4 && age <= 7) return 1;
  if (age >= 3 && age <= 9) return 0.55;
  return -0.35;
}

function handicapSignal(distance?: number | null) {
  if (!distance) return 0;
  if (distance <= 0) return 0.6;
  if (distance <= 25) return 0.15;
  return -0.7;
}

function reductionSignal(value?: string | null) {
  const number = Number(String(value ?? "").replace(",", ".").match(/\d+(?:\.\d+)?/)?.[0] ?? 0);
  if (!number) return 0;
  if (number <= 1.13) return 0.8;
  if (number <= 1.16) return 0.35;
  return -0.3;
}

function equipmentSignal(value?: string | null) {
  const normalizedValue = String(value ?? "").toUpperCase();
  if (!normalizedValue || normalizedValue === "SANS_OEILLERES") return 0;
  if (normalizedValue.includes("OEILLERES") || normalizedValue.includes("DEF")) return 0.45;
  return 0.15;
}

function signal(label: string, value: number, weight: number): PredictionSignal {
  return { label, value: round(value, 3), weight };
}

function sane(value: unknown, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function normalized(value: unknown, max: number) {
  if (max <= 0) return 0;
  return clamp(sane(value) / max, 0, 1);
}

function average(values: number[], fallback: number) {
  const clean = values.filter((value) => Number.isFinite(value));
  if (clean.length === 0) return fallback;
  return clean.reduce((sum, value) => sum + value, 0) / clean.length;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function round(value: number, decimals: number) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}
