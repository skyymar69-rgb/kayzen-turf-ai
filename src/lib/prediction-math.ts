import type { HorsePrediction, RaceAnalysis } from "@/lib/types";

// ─────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────

export type RaceContext = Partial<
  Pick<
    RaceAnalysis,
    | "marketVolatility"
    | "modelConsensus"
    | "raceQualityScore"
    | "riskLevel"
    | "discipline"
    | "going"
    | "distance"
    | "weather"
    | "specialty"
    | "raceDate"
  >
>;

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
  // Plackett-Luce coherent probabilities — derived from field-level scoring, guaranteed p_top5 ≥ p_top3 ≥ p_win
  plWinProbability: number;
  plTop3Probability: number;
  plTop5Probability: number;
};

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
  averageRk: number;
};

// ─────────────────────────────────────────────────────────────
// GOING / DISTANCE UTILITIES
// ─────────────────────────────────────────────────────────────

type GoingCode = "TB" | "B" | "BL" | "BS" | "S" | "L" | "TL";

function parseGoingCode(going?: string | null): GoingCode {
  const g = String(going ?? "").toLowerCase();
  if (g.includes("très bon") || g.includes("tres bon") || g.includes("très sec") || g.includes("tres sec")) return "TB";
  if (g.includes("bon à souple") || g.includes("bon a souple") || g.includes("bon souple")) return "BS";
  if (g.includes("bon à léger") || g.includes("bon a leger") || g.includes("bon leger")) return "BL";
  if (g.includes("très souple") || g.includes("tres souple") || g.includes("très lourd") || g.includes("tres lourd")) return "TL";
  if (g.includes("souple") || g.includes("léger") || g.includes("leger")) return "S";
  if (g.includes("lourd")) return "L";
  if (g.includes("bon")) return "B";
  return "B";
}

function parseDistanceMeters(distance?: string | null): number {
  const digits = String(distance ?? "").replace(/[\s ]/g, "").match(/(\d{3,4})/);
  return digits ? parseInt(digits[1]) : 1800;
}

type DistanceProfile = "sprint" | "mile" | "moyen" | "fond";

function getDistanceProfile(meters: number): DistanceProfile {
  if (meters <= 1400) return "sprint";
  if (meters <= 1800) return "mile";
  if (meters <= 2600) return "moyen";
  return "fond";
}

// ─────────────────────────────────────────────────────────────
// MUSIC PARSERS — Three discipline-specific versions
// ─────────────────────────────────────────────────────────────

type PlatMusicProfile = {
  score: number;
  recentWin: boolean;
  recentPlaces: number;
  badRecent: number;
  rebound: number;
};

type TrotMusicProfile = {
  score: number;
  recentWin: boolean;
  recentPlaces: number;
  badRecent: number;
  rebound: number;
  disqualifications: number;
  recentDQ: boolean;
  abandonments: number;
  completionRate: number;
  regularityScore: number;
};

type ObstacleMusicProfile = {
  score: number;
  recentWin: boolean;
  recentPlaces: number;
  badRecent: number;
  rebound: number;
  falls: number;
  recentFall: boolean;
  refused: number;
  pulledUp: number;
  jumpExperience: number;
  completionRate: number;
  cleanJumpScore: number;
};

function musicParserPlat(music?: string | null): PlatMusicProfile {
  const chars = String(music ?? "")
    .split("")
    .filter((c) => /[1-9]/.test(c))
    .slice(0, 8)
    .map(Number);

  if (chars.length === 0) {
    return { score: 0.05, recentWin: false, recentPlaces: 0, badRecent: 1, rebound: 0 };
  }

  // Exponential decay: recent races weighted more heavily
  const weights = chars.map((_, i) => Math.pow(0.75, i));
  const weightSum = weights.reduce((s, w) => s + w, 0);
  const weightedAvg = chars.reduce((s, v, i) => s + v * weights[i], 0) / weightSum;

  const recent = chars.slice(0, 3);
  const badRecent = recent.filter((v) => v >= 7).length;
  const recentPlaces = recent.filter((v) => v <= 3).length;
  const recentWin = recent.includes(1);
  const rebound = chars[0] <= 4 && chars.slice(1, 4).some((v) => v >= 7) ? 1 : 0;

  return {
    score: clamp((10 - weightedAvg) / 9, 0, 1),
    recentWin,
    recentPlaces,
    badRecent,
    rebound,
  };
}

function musicParserTrot(music?: string | null): TrotMusicProfile {
  // Handles 0/D (DQ), A/T (abandon/tombé), plus numeric positions
  const raw = String(music ?? "")
    .toUpperCase()
    .split("")
    .filter((c) => c !== " " && c !== "-" && c !== "(" && c !== ")");

  const disqualifications = raw.filter((c) => c === "0" || c === "D").length;
  const abandonments = raw.filter((c) => c === "A" || c === "T").length;
  const positions = raw.filter((c) => /[1-9]/.test(c)).map(Number);

  const totalRaces = raw.filter((c) => /[0-9ADT]/.test(c)).length;
  const incidents = disqualifications + abandonments;
  const completionRate = totalRaces > 0 ? Math.max(0, totalRaces - incidents) / totalRaces : 0;

  const recent3 = raw.slice(0, 3);
  const recentDQ = recent3.some((c) => c === "0" || c === "D");
  const recentPositions = recent3.filter((c) => /[1-9]/.test(c)).map(Number);
  const recentWin = recentPositions.includes(1);
  const recentPlaces = recentPositions.filter((v) => v <= 3).length;
  // DQ in recent window counts double as "bad"
  const badRecent = recentPositions.filter((v) => v >= 7).length + (recentDQ ? 2 : 0);

  const weights = positions.map((_, i) => Math.pow(0.75, i));
  const weightSum = weights.reduce((s, w) => s + w, 0.01);
  const weightedAvg =
    positions.length > 0 ? positions.reduce((s, v, i) => s + v * weights[i], 0) / weightSum : 8;

  const rebound =
    positions.length >= 2 && positions[0] <= 4 && positions.slice(1, 4).some((v) => v >= 7) ? 1 : 0;

  const regularityScore =
    positions.length > 0 ? positions.filter((v) => v <= 4).length / positions.length : 0;

  return {
    // Score penalised by completion rate: a horse that finishes is more reliable
    score: clamp(((10 - weightedAvg) / 9) * (0.5 + completionRate * 0.5), 0, 1),
    recentWin,
    recentPlaces,
    badRecent,
    rebound,
    disqualifications,
    recentDQ,
    abandonments,
    completionRate,
    regularityScore,
  };
}

function musicParserObstacle(music?: string | null): ObstacleMusicProfile {
  // Handles F (tombé), U (désarçonné), B (knocked-down), R (refus), P (pulled-up)
  const raw = String(music ?? "")
    .toUpperCase()
    .split("")
    .filter((c) => c !== " " && c !== "-" && c !== "(" && c !== ")");

  const falls = raw.filter((c) => c === "F" || c === "B").length;
  const unseated = raw.filter((c) => c === "U").length;
  const refused = raw.filter((c) => c === "R").length;
  const pulledUp = raw.filter((c) => c === "P").length;
  const positions = raw.filter((c) => /[1-9]/.test(c)).map(Number);

  const totalRaces = raw.filter((c) => /[1-9FBURP]/.test(c)).length;
  const incidents = falls + unseated + refused + pulledUp;
  const completionRate = totalRaces > 0 ? Math.max(0, totalRaces - incidents) / totalRaces : 0;
  // Refusals are more damaging to cleanJump than falls
  const cleanJumpScore = clamp(completionRate * (1 - refused * 0.2), 0, 1);
  const jumpExperience = totalRaces;

  const recent3 = raw.slice(0, 3);
  const recentFall = recent3.some((c) => c === "F" || c === "U" || c === "B");
  const recentPositions = recent3.filter((c) => /[1-9]/.test(c)).map(Number);
  const recentWin = recentPositions.includes(1);
  const recentPlaces = recentPositions.filter((v) => v <= 3).length;
  const badRecent =
    recentPositions.filter((v) => v >= 7).length + (recentFall ? 3 : 0) + (refused > 0 ? 2 : 0);

  const weights = positions.map((_, i) => Math.pow(0.75, i));
  const weightSum = weights.reduce((s, w) => s + w, 0.01);
  const weightedAvg =
    positions.length > 0 ? positions.reduce((s, v, i) => s + v * weights[i], 0) / weightSum : 8;

  const rebound =
    positions.length >= 2 && positions[0] <= 4 && positions.slice(1, 4).some((v) => v >= 7) ? 1 : 0;

  return {
    // Score weighted by cleanJump: a horse that completes and places is reliable
    score: clamp(((10 - weightedAvg) / 9) * cleanJumpScore, 0, 1),
    recentWin,
    recentPlaces,
    badRecent,
    rebound,
    falls,
    recentFall,
    refused,
    pulledUp,
    jumpExperience,
    completionRate,
    cleanJumpScore,
  };
}

// ─────────────────────────────────────────────────────────────
// PLAT-SPECIFIC SIGNALS
// ─────────────────────────────────────────────────────────────

function drawPositionSignalPlat(number: number, distanceMeters: number, fieldSize: number): number {
  if (distanceMeters <= 1200) {
    if (number <= 3) return 1.5;
    if (number <= 6) return 0.5;
    if (number <= 10) return -0.5;
    return -1.5 - Math.max(0, number - 14) * 0.1;
  }
  if (distanceMeters <= 1600) {
    if (number <= 4) return 0.8;
    if (number <= 8) return 0.2;
    return clamp(-0.5 - Math.max(0, number - 12) * 0.08, -1.2, 0);
  }
  // Long distances: outer draw is a minor disadvantage only in large fields
  if (fieldSize <= 8) return 0;
  if (number <= 4) return 0.3;
  if (number >= fieldSize - 2) return -0.3;
  return 0;
}

function ageSignalPlat(age?: number | null): number {
  if (!age) return 0;
  if (age >= 4 && age <= 6) return 1.0;
  if (age === 3) return 0.7;
  if (age === 7) return 0.6;
  if (age >= 8 && age <= 9) return 0.3;
  if (age < 3) return 0.1;
  return -0.2;
}

function equipmentSignalPlat(equipment?: string | null): number {
  const eq = String(equipment ?? "").toUpperCase();
  if (!eq || eq === "SANS_OEILLERES" || eq === "NEANT" || eq === "") return 0;
  if (eq.includes("AUSTRALIEN") || eq.includes("VISIERE")) return 0.6;
  if (eq.includes("OEILLERES")) return 0.5;
  if (eq.includes("DEF") || eq.includes("DEFL")) return 0.4;
  if (eq.includes("JUGULAIRE")) return 0.3;
  return 0.15;
}

function distanceProfileSignalPlat(profile: DistanceProfile, music?: string | null): number {
  // Heuristic: horses with shorter music (fewer races) may be sprinters
  // Full version needs per-race distance history from DB
  const positions = String(music ?? "").match(/[1-9]/g) ?? [];
  if (profile === "sprint" && positions.length <= 3) return 0.3;
  if (profile === "fond" && positions.length >= 6) return 0.3;
  return 0;
}

// ─────────────────────────────────────────────────────────────
// TROT-SPECIFIC SIGNALS
// ─────────────────────────────────────────────────────────────

function reductionKmSignal(reductionKm?: string | null): number {
  // Parse formats: "1'02\"5", "1.02.5", "1,025", "1'025"
  const raw = String(reductionKm ?? "")
    .replace(/[''`´]/g, ".")
    .replace(/["]/g, "")
    .trim();

  const match = raw.match(/(\d+)[.,](\d+)/);
  if (!match) return 0;

  const minutes = parseInt(match[1]);
  const frac = match[2];

  let totalMinutes: number;
  if (frac.length >= 3) {
    // Format like "1.025" = 1 min 02.5 sec
    totalMinutes = minutes + parseInt(frac) / 1000;
  } else {
    // Format like "1.02" = 1 min 02 sec
    totalMinutes = minutes + parseInt(frac) / 60;
  }

  if (totalMinutes <= 1.01) return 1.0;
  if (totalMinutes <= 1.03) return 0.90;
  if (totalMinutes <= 1.05) return 0.75;
  if (totalMinutes <= 1.07) return 0.55;
  if (totalMinutes <= 1.10) return 0.35;
  if (totalMinutes <= 1.15) return 0.15;
  return 0.05;
}

function innerRailSignalTrot(number: number, distanceMeters: number): number {
  if (distanceMeters <= 1750) {
    if (number === 1) return 3.0;
    if (number === 2) return 2.0;
    if (number === 3) return 1.2;
    if (number <= 6) return 0;
    if (number <= 9) return -1.5;
    return clamp(-3.0 - (number - 10) * 0.2, -5, -3);
  }
  if (distanceMeters <= 2200) {
    if (number <= 2) return 1.0;
    if (number <= 6) return 0.2;
    return -0.8;
  }
  // Long distances: draw less critical
  if (number <= 4) return 0.4;
  if (number <= 8) return 0;
  return -0.4;
}

function ageSignalTrot(age?: number | null): number {
  if (!age) return 0;
  if (age >= 5 && age <= 8) return 1.0;
  if (age === 4) return 0.7;
  if (age === 9) return 0.7;
  if (age === 10) return 0.4;
  if (age === 3) return 0.2;
  if (age >= 11) return 0;
  return -0.1;
}

function dqPenaltySignalTrot(profile: TrotMusicProfile): number {
  const pen = profile.disqualifications * 2.5 + (profile.recentDQ ? 5.0 : 0) + profile.abandonments * 1.5;
  return -clamp(pen, 0, 15);
}

function regularitySignalTrot(profile: TrotMusicProfile): number {
  return profile.regularityScore * 3 + profile.completionRate * 2;
}

function trotDistanceSpecSignal(distanceMeters: number, music?: string | null): number {
  const positions = String(music ?? "").match(/[1-9]/g) ?? [];
  if (distanceMeters <= 1750 && positions.length <= 4) return 0.4;
  if (distanceMeters >= 2500 && positions.length >= 6) return 0.4;
  return 0;
}

// ─────────────────────────────────────────────────────────────
// OBSTACLE-SPECIFIC SIGNALS
// ─────────────────────────────────────────────────────────────

function fallPenaltySignalObstacle(profile: ObstacleMusicProfile): number {
  const pen =
    profile.falls * 4.0 +
    (profile.recentFall ? 6.0 : 0) +
    profile.refused * 3.0 +
    profile.pulledUp * 1.5;
  return -clamp(pen, 0, 20);
}

function jumpExperienceSignalObstacle(profile: ObstacleMusicProfile): number {
  const exp = profile.jumpExperience;
  if (exp === 0) return -2.0;
  if (exp <= 3) return -0.5;
  if (exp <= 8) return 0.5;
  if (exp <= 15) return 1.5;
  return 2.0;
}

function goingLourdSignalObstacle(goingCode: GoingCode, profile: ObstacleMusicProfile): number {
  const isHeavy = goingCode === "L" || goingCode === "TL";
  const isSoft = goingCode === "S" || goingCode === "BS";

  if (!isHeavy && !isSoft) return 0;

  if (goingCode === "TL") {
    // Extreme going: massive differentiator; reward proven completers
    return profile.completionRate >= 0.7 ? 2.5 : profile.completionRate >= 0.4 ? 0.5 : -1.0;
  }
  if (isHeavy) {
    return profile.completionRate >= 0.65 ? 1.5 : 0;
  }
  // Soft going
  return profile.completionRate >= 0.6 ? 0.8 : 0;
}

function ageSignalObstacle(age?: number | null): number {
  if (!age) return 0;
  if (age >= 7 && age <= 9) return 1.0;
  if (age === 6) return 0.7;
  if (age === 10) return 0.6;
  if (age === 5) return 0.3;
  if (age === 11) return 0.2;
  if (age >= 12) return -0.2;
  return 0;
}

function winterFormSignalObstacle(raceDate?: string | null): number {
  if (!raceDate) return 0;
  const month = new Date(raceDate).getMonth() + 1; // 1-12
  // Oct–Mar = peak obstacle season
  return month <= 3 || month >= 10 ? 0.8 : -0.3;
}

function subDisciplineSignalObstacle(specialty?: string | null): number {
  const spec = String(specialty ?? "").toUpperCase();
  if (spec.includes("CROSS")) return 0.5;
  if (spec.includes("STEEPLE") || spec.includes("CHASE")) return 0.3;
  if (spec.includes("HAIE") || spec.includes("HURDLE")) return 0.2;
  return 0;
}

function obstacleRobustnessScore(profile: ObstacleMusicProfile, age?: number | null): number {
  const ageScore = clamp(ageSignalObstacle(age), 0, 1);
  const safetyScore = profile.cleanJumpScore;
  const expScore = clamp(profile.jumpExperience / 15, 0, 1);
  return (ageScore * 0.4 + safetyScore * 0.4 + expScore * 0.2) * 5;
}

function fieldSizeRiskObstacle(fieldSize: number): number {
  if (fieldSize <= 8) return 0;
  if (fieldSize <= 12) return -0.5;
  if (fieldSize <= 16) return -1.5;
  return -3.0;
}

// ─────────────────────────────────────────────────────────────
// SHARED SIGNAL FUNCTIONS
// ─────────────────────────────────────────────────────────────

function confidenceScore(confidence: HorsePrediction["confidence"]): number {
  if (confidence === "Forte") return 100;
  if (confidence === "Moyenne") return 62;
  return 34;
}

function handicapDistSignal(distance?: number | null): number {
  if (!distance) return 0;
  if (distance <= 0) return 0.6;
  if (distance <= 25) return 0.15;
  return -0.7;
}

function computeFavoriteFailureRisk(
  odds: number,
  top3: number,
  edge: number,
  badRecent: number,
  stats: FieldStats,
  discipline: string,
): number {
  const fieldPressure = clamp((stats.fieldSize - 8) * 1.8, -8, 18);
  const disciplineMultiplier = discipline === "Obstacle" ? 1.4 : discipline === "Trot" ? 0.9 : 1.0;

  return clamp(
    ((odds <= stats.favoriteOdds + 0.25 ? 18 : 0) +
      (top3 < stats.averageTop3 ? 14 : 0) +
      (edge < -8 ? 12 : 0) +
      badRecent * 5 +
      fieldPressure * 0.45) *
      disciplineMultiplier,
    0,
    60,
  );
}

function computeOutsiderWatchScore(
  odds: number,
  edge: number,
  top3: number,
  top5: number,
  stats: FieldStats,
  rebound: number,
  discipline: string,
): number {
  // Obstacle and Trot markets are less efficient → outsiders undervalued more often
  const disciplineBonus = discipline === "Obstacle" ? 1.6 : discipline === "Trot" ? 1.2 : 1.0;

  return clamp(
    ((odds >= 6 && odds <= 22 ? 15 : 0) +
      Math.max(0, edge) * 0.28 +
      Math.max(0, top3 - stats.averageTop3) * 0.38 +
      Math.max(0, top5 - top3) * 0.14 +
      rebound * 5 -
      Math.max(0, odds - 28) * 0.6) *
      disciplineBonus,
    0,
    55,
  );
}

// ─────────────────────────────────────────────────────────────
// FIELD STATS + RANK HELPERS
// ─────────────────────────────────────────────────────────────

function fieldStats(horses: HorsePrediction[]): FieldStats {
  const oddsList = horses.map((h) => sane(h.odds)).filter((o) => o > 1);
  const rkList = horses.map((h) => reductionKmSignal(h.reductionKm)).filter((v) => v > 0);

  return {
    averageOdds: average(oddsList, 12),
    averageTop3: average(
      horses.map((h) => sane(h.top3Probability)),
      24,
    ),
    averageWin: average(
      horses.map((h) => sane(h.winProbability)),
      8,
    ),
    earningsMax: Math.max(...horses.map((h) => sane(h.earnings)), 0),
    favoriteOdds: Math.min(...oddsList, 99),
    fieldSize: horses.length,
    kzMax: Math.max(...horses.map((h) => sane(h.kzScore)), 1),
    top3Max: Math.max(...horses.map((h) => sane(h.top3Probability)), 1),
    winMax: Math.max(...horses.map((h) => sane(h.winProbability)), 1),
    averageRk: average(rkList, 0.5),
  };
}

function rankBy(
  horse: HorsePrediction,
  horses: HorsePrediction[],
  getter: (h: HorsePrediction) => number,
  direction: "asc" | "desc",
): number {
  const sorted = horses
    .slice()
    .sort((a, b) => (direction === "asc" ? getter(a) - getter(b) : getter(b) - getter(a)));
  return sorted.findIndex((h) => h.id === horse.id) + 1 || sorted.length + 1;
}

function rankSnapshot(horse: HorsePrediction, horses: HorsePrediction[]) {
  return {
    kz: rankBy(horse, horses, (h) => sane(h.kzScore), "desc"),
    odds: rankBy(horse, horses, (h) => sane(h.odds, 99), "asc"),
    top3: rankBy(horse, horses, (h) => sane(h.top3Probability), "desc"),
    win: rankBy(horse, horses, (h) => sane(h.winProbability), "desc"),
  };
}

function rankStability(rank: { kz: number; odds: number; top3: number; win: number }): number {
  const ranks = [rank.kz, rank.odds, rank.top3, rank.win];
  const avg = average(ranks, 1);
  const variance = average(
    ranks.map((r) => Math.abs(r - avg)),
    0,
  );
  return clamp(10 - variance, 0, 10);
}

// ─────────────────────────────────────────────────────────────
// DISCIPLINE SCORERS
// ─────────────────────────────────────────────────────────────

function platScore(
  horse: HorsePrediction,
  horses: HorsePrediction[],
  context: RaceContext,
  stats: FieldStats,
): EnhancedPrediction {
  const rank = rankSnapshot(horse, horses);
  const odds = sane(horse.odds, horse.fairOdds || stats.averageOdds || 12);
  const win = clamp(sane(horse.winProbability), 0, 80);
  const top3 = clamp(sane(horse.top3Probability), 0, 99);
  const top5 = clamp(sane(horse.top5Probability), 0, 99);
  const edge = clamp(sane(horse.marketEdge, horse.valueIndex), -50, 100);
  const confidence = confidenceScore(horse.confidence);
  const music = musicParserPlat(horse.music);
  const volatility = clamp(sane(context.marketVolatility), 0, 40);
  const consensus = clamp(sane(context.modelConsensus, 55), 0, 100);
  const fieldPressure = clamp((stats.fieldSize - 8) * 1.8, -8, 18);
  const favoriteGap = clamp((stats.favoriteOdds || odds) - odds, -20, 20);

  const distanceMeters = parseDistanceMeters(context.distance);
  const profile = getDistanceProfile(distanceMeters);

  const favoriteFailureRisk = computeFavoriteFailureRisk(odds, top3, edge, music.badRecent, stats, "Plat");
  const outsiderWatchScore = computeOutsiderWatchScore(odds, edge, top3, top5, stats, music.rebound, "Plat");
  const top3UpsetScore = clamp(
    outsiderWatchScore * 0.62 +
      Math.max(0, top3 - win * 2.1) * 0.24 +
      Math.max(0, edge) * 0.16 +
      volatility * 0.18 -
      favoriteFailureRisk * (odds <= 4 ? 0.35 : 0),
    0,
    60,
  );

  const drawSig = drawPositionSignalPlat(horse.number, distanceMeters, stats.fieldSize);
  const ageSig = ageSignalPlat(horse.age);
  const equipSig = equipmentSignalPlat(horse.equipment);
  const distProfileSig = distanceProfileSignalPlat(profile, horse.music);

  const signals: PredictionSignal[] = [
    sig("KZ brut", horse.kzScore, 0.50),
    sig("Probabilite gagnant", win, 0.45),
    sig("Probabilite Top 3", top3, 0.38),
    sig("Probabilite Top 5", top5, 0.18),
    sig("Regularite place/gagnant", top3 - win, 0.11),
    sig("Reservoir Top 5", top5 - top3, 0.07),
    sig("Edge marche cape", clamp(edge, -18, 32), 0.19),
    sig("Value positive", Math.max(0, edge), 0.12),
    sig("Favorite gap", favoriteGap, 0.10),
    sig("Risque favori fragile", -favoriteFailureRisk, 0.34),
    sig("Rang KZ inverse", rank.kz, -1.15),
    sig("Rang gagnant inverse", rank.win, -0.92),
    sig("Rang Top 3 inverse", rank.top3, -1.06),
    sig("Rang cote inverse", rank.odds, -0.42),
    sig("Confiance source", confidence, 0.07),
    sig("Forme musique Plat", music.score, 10.5),
    sig("Victoire recente", music.recentWin ? 1 : 0, 3.8),
    sig("Places recentes", music.recentPlaces, 1.35),
    sig("Echecs recents", -music.badRecent, 1.45),
    sig("Signal rebond", music.rebound, 2.8),
    sig("Gains normalises", normalized(horse.earnings, stats.earningsMax), 5.4),
    sig("Age Plat", ageSig, 3.5),
    sig("Handicap distance", handicapDistSignal(horse.handicapDistance), 3.4),
    sig("Equipement Plat", equipSig, 2.2),
    sig("Position partant Plat", drawSig, 2.8),
    sig("Profil distance Plat", distProfileSig, 1.5),
    sig("Pression peloton", -fieldPressure, 0.16),
    sig("Consensus course", consensus - 50, 0.05),
    sig("Volatilite outsider", odds >= 6 ? volatility : -volatility, 0.07),
    sig("Stabilite des rangs", rankStability(rank), 1.85),
    sig("Tocard surveille Top 3", top3UpsetScore, 0.24),
  ];

  const rawScore = signals.reduce((sum, s) => sum + s.value * s.weight, 0);
  const exactOrderScore =
    win * 2.15 +
    top3 * 0.34 +
    top5 * 0.08 +
    music.score * 9 +
    normalized(horse.earnings, stats.earningsMax) * 5 +
    confidence * 0.04 -
    favoriteFailureRisk * 0.55 -
    outsiderWatchScore * 0.14 -
    Math.abs(odds - stats.favoriteOdds) * 0.34 -
    rank.win * 0.95 -
    rank.odds * 0.35 +
    rankStability(rank) * 0.5 +
    drawSig * 0.4;

  return {
    horse,
    score: clamp(Math.round(rawScore), 1, 99),
    exactOrderScore: round(exactOrderScore, 2),
    favoriteFailureRisk: round(favoriteFailureRisk, 1),
    outsiderWatchScore: round(outsiderWatchScore, 1),
    top3UpsetScore: round(top3UpsetScore, 1),
    signals,
    plWinProbability: 0,
    plTop3Probability: 0,
    plTop5Probability: 0,
  };
}

function trotScore(
  horse: HorsePrediction,
  horses: HorsePrediction[],
  context: RaceContext,
  stats: FieldStats,
): EnhancedPrediction {
  const rank = rankSnapshot(horse, horses);
  const odds = sane(horse.odds, horse.fairOdds || stats.averageOdds || 12);
  const win = clamp(sane(horse.winProbability), 0, 80);
  const top3 = clamp(sane(horse.top3Probability), 0, 99);
  const top5 = clamp(sane(horse.top5Probability), 0, 99);
  const edge = clamp(sane(horse.marketEdge, horse.valueIndex), -50, 100);
  const confidence = confidenceScore(horse.confidence);
  const music = musicParserTrot(horse.music);
  const volatility = clamp(sane(context.marketVolatility), 0, 40);
  const consensus = clamp(sane(context.modelConsensus, 55), 0, 100);
  const fieldPressure = clamp((stats.fieldSize - 8) * 1.8, -8, 18);
  const favoriteGap = clamp((stats.favoriteOdds || odds) - odds, -20, 20);

  const distanceMeters = parseDistanceMeters(context.distance);
  const rkSig = reductionKmSignal(horse.reductionKm);
  const innerRailSig = innerRailSignalTrot(horse.number, distanceMeters);
  const ageSig = ageSignalTrot(horse.age);
  const dqPen = dqPenaltySignalTrot(music);
  const regularitySig = regularitySignalTrot(music);
  const distSpecSig = trotDistanceSpecSignal(distanceMeters, horse.music);

  const favoriteFailureRisk = computeFavoriteFailureRisk(odds, top3, edge, music.badRecent, stats, "Trot");
  const outsiderWatchScore = computeOutsiderWatchScore(odds, edge, top3, top5, stats, music.rebound, "Trot");
  const top3UpsetScore = clamp(
    outsiderWatchScore * 0.62 +
      Math.max(0, top3 - win * 2.1) * 0.24 +
      Math.max(0, edge) * 0.16 +
      volatility * 0.18,
    0,
    65,
  );

  const signals: PredictionSignal[] = [
    sig("KZ brut", horse.kzScore, 0.35),
    sig("Probabilite gagnant", win, 0.38),
    sig("Probabilite Top 3", top3, 0.32),
    sig("Probabilite Top 5", top5, 0.14),
    sig("Regularite place/gagnant", top3 - win, 0.10),
    sig("Edge marche trot", clamp(edge, -18, 32), 0.22),
    sig("Value positive trot", Math.max(0, edge), 0.16),
    sig("Favorite gap", favoriteGap, 0.10),
    sig("Risque favori fragile trot", -favoriteFailureRisk, 0.28),
    sig("Rang KZ inverse", rank.kz, -0.90),
    sig("Rang gagnant inverse", rank.win, -0.78),
    sig("Rang Top 3 inverse", rank.top3, -0.88),
    sig("Rang cote inverse", rank.odds, -0.38),
    sig("Confiance source", confidence, 0.06),
    sig("Forme musique trot", music.score, 7.0),
    sig("Victoire recente trot", music.recentWin ? 1 : 0, 3.5),
    sig("Places recentes trot", music.recentPlaces, 1.20),
    sig("Echecs recents trot", -music.badRecent, 1.20),
    sig("Signal rebond trot", music.rebound, 2.5),
    sig("Reduction km primaire", rkSig, 8.5),
    sig("Penalite DQ trot", dqPen, 1.0),
    sig("Regularite trot", regularitySig, 1.0),
    sig("Corde interieure trot", innerRailSig, 1.0),
    sig("Specialisation distance trot", distSpecSig, 2.5),
    sig("Age optimal trot", ageSig, 3.8),
    sig("Gains normalises", normalized(horse.earnings, stats.earningsMax), 4.5),
    sig("Handicap metrique", handicapDistSignal(horse.handicapDistance), 3.0),
    sig("Pression peloton trot", -fieldPressure, 0.20),
    sig("Consensus course", consensus - 50, 0.04),
    sig("Stabilite des rangs", rankStability(rank), 1.60),
    sig("Tocard trot surveille", top3UpsetScore, 0.28),
  ];

  const rawScore = signals.reduce((sum, s) => sum + s.value * s.weight, 0);
  const exactOrderScore =
    win * 1.8 +
    top3 * 0.30 +
    top5 * 0.08 +
    music.score * 7 +
    rkSig * 8 +
    normalized(horse.earnings, stats.earningsMax) * 4 +
    confidence * 0.03 +
    innerRailSig * 0.8 -
    favoriteFailureRisk * 0.50 -
    rank.win * 0.85 -
    rank.odds * 0.30 +
    rankStability(rank) * 0.5 +
    dqPen * 0.5;

  return {
    horse,
    score: clamp(Math.round(rawScore), 1, 99),
    exactOrderScore: round(exactOrderScore, 2),
    favoriteFailureRisk: round(favoriteFailureRisk, 1),
    outsiderWatchScore: round(outsiderWatchScore, 1),
    top3UpsetScore: round(top3UpsetScore, 1),
    signals,
    plWinProbability: 0,
    plTop3Probability: 0,
    plTop5Probability: 0,
  };
}

function obstacleScore(
  horse: HorsePrediction,
  horses: HorsePrediction[],
  context: RaceContext,
  stats: FieldStats,
): EnhancedPrediction {
  const rank = rankSnapshot(horse, horses);
  const odds = sane(horse.odds, horse.fairOdds || stats.averageOdds || 12);
  const win = clamp(sane(horse.winProbability), 0, 80);
  const top3 = clamp(sane(horse.top3Probability), 0, 99);
  const top5 = clamp(sane(horse.top5Probability), 0, 99);
  const edge = clamp(sane(horse.marketEdge, horse.valueIndex), -50, 100);
  const confidence = confidenceScore(horse.confidence);
  const music = musicParserObstacle(horse.music);
  const volatility = clamp(sane(context.marketVolatility), 0, 40);
  const consensus = clamp(sane(context.modelConsensus, 55), 0, 100);
  const fieldPressure = clamp((stats.fieldSize - 8) * 1.8, -8, 18);
  const favoriteGap = clamp((stats.favoriteOdds || odds) - odds, -20, 20);

  const goingCode = parseGoingCode(context.going);

  const fallPen = fallPenaltySignalObstacle(music);
  const jumpExpSig = jumpExperienceSignalObstacle(music);
  const goingSig = goingLourdSignalObstacle(goingCode, music);
  const ageSig = ageSignalObstacle(horse.age);
  const robustness = obstacleRobustnessScore(music, horse.age);
  const fieldRisk = fieldSizeRiskObstacle(stats.fieldSize);
  const subDiscSig = subDisciplineSignalObstacle(context.specialty);
  const winterSig = winterFormSignalObstacle(context.raceDate ?? null);

  const favoriteFailureRisk = computeFavoriteFailureRisk(odds, top3, edge, music.badRecent, stats, "Obstacle");
  const outsiderWatchScore = computeOutsiderWatchScore(odds, edge, top3, top5, stats, music.rebound, "Obstacle");
  const top3UpsetScore = clamp(
    outsiderWatchScore * 0.70 +
      Math.max(0, top3 - win * 2.1) * 0.28 +
      Math.max(0, edge) * 0.18 +
      volatility * 0.20,
    0,
    70,
  );

  const signals: PredictionSignal[] = [
    sig("KZ brut", horse.kzScore, 0.30),
    sig("Probabilite gagnant", win, 0.35),
    sig("Probabilite Top 3", top3, 0.30),
    sig("Probabilite Top 5", top5, 0.12),
    sig("Regularite place/gagnant", top3 - win, 0.09),
    sig("Edge marche obstacle", clamp(edge, -18, 32), 0.25),
    sig("Value positive obstacle", Math.max(0, edge), 0.18),
    sig("Favorite gap", favoriteGap, 0.10),
    sig("Risque favori obstacle", -favoriteFailureRisk, 0.42),
    sig("Rang KZ inverse", rank.kz, -0.75),
    sig("Rang gagnant inverse", rank.win, -0.65),
    sig("Rang Top 3 inverse", rank.top3, -0.80),
    sig("Rang cote inverse", rank.odds, -0.35),
    sig("Confiance source", confidence, 0.06),
    sig("Forme musique obstacle", music.score, 9.0),
    sig("Victoire recente obstacle", music.recentWin ? 1 : 0, 3.5),
    sig("Places recentes obstacle", music.recentPlaces, 1.20),
    sig("Echecs recents obstacle", -music.badRecent, 1.60),
    sig("Signal rebond obstacle", music.rebound, 2.5),
    sig("Penalite chutes obstacle", fallPen, 1.0),
    sig("Experience obstacle", jumpExpSig, 4.5),
    sig("Going lourd specialist", goingSig, 8.5),
    sig("Age optimal obstacle", ageSig, 4.0),
    sig("Robustesse composite", robustness, 1.0),
    sig("Risque taille champ", fieldRisk, 1.0),
    sig("Sous-discipline match", subDiscSig, 2.0),
    sig("Forme hivernale obstacle", winterSig, 1.5),
    sig("Gains normalises", normalized(horse.earnings, stats.earningsMax), 4.0),
    sig("Pression peloton obstacle", -fieldPressure, 0.22),
    sig("Stabilite des rangs", rankStability(rank), 1.50),
    sig("Tocard obstacle surveille", top3UpsetScore, 0.32),
  ];

  const rawScore = signals.reduce((sum, s) => sum + s.value * s.weight, 0);
  const exactOrderScore =
    win * 1.6 +
    top3 * 0.28 +
    top5 * 0.07 +
    music.score * 8.5 +
    normalized(horse.earnings, stats.earningsMax) * 3.5 +
    goingSig * 1.2 +
    jumpExpSig * 0.5 +
    ageSig * 0.8 -
    favoriteFailureRisk * 0.65 -
    outsiderWatchScore * 0.12 -
    rank.win * 0.80 -
    rank.odds * 0.30 +
    rankStability(rank) * 0.5 +
    fallPen * 0.5;

  return {
    horse,
    score: clamp(Math.round(rawScore), 1, 99),
    exactOrderScore: round(exactOrderScore, 2),
    favoriteFailureRisk: round(favoriteFailureRisk, 1),
    outsiderWatchScore: round(outsiderWatchScore, 1),
    top3UpsetScore: round(top3UpsetScore, 1),
    signals,
    plWinProbability: 0,
    plTop3Probability: 0,
    plTop5Probability: 0,
  };
}

// ─────────────────────────────────────────────────────────────
// PLACKETT-LUCE — field-level coherent probability model
// ─────────────────────────────────────────────────────────────

// Temperature: divides scores before exp. Lower = sharper distribution.
const PL_TEMPERATURE = 10;
// Monte Carlo simulations per field. 2000 gives ±1.5pp std error at n=15 in <5ms.
const PL_N_SIM = 2000;

function gumbelNoise(): number {
  // Gumbel(0,1) via inverse CDF: -log(-log(U)), U ~ Uniform(0,1)
  return -Math.log(-Math.log(Math.random() + 1e-12));
}

function plSoftmax(scores: number[]): number[] {
  const maxS = Math.max(...scores);
  const exps = scores.map((s) => Math.exp((s - maxS) / PL_TEMPERATURE));
  const sum = exps.reduce((a, b) => a + b, 0);
  return exps.map((e) => (e / sum) * 100);
}

function monteCarloTopKMulti(scores: number[], ks: [number, number], nSim: number): [number[], number[]] {
  const n = scores.length;
  const maxK = Math.max(...ks);
  const counts: [number[], number[]] = [new Array(n).fill(0), new Array(n).fill(0)];
  const scaled = scores.map((s) => s / PL_TEMPERATURE);

  for (let sim = 0; sim < nSim; sim++) {
    // Gumbel-max trick: argmax(score_i + Gumbel_i) ~ Plackett-Luce draw
    const perturbed = scaled.map((s) => s + gumbelNoise());
    // Partial sort: only top maxK indices needed
    const ranked: number[] = [];
    for (let i = 0; i < n; i++) ranked.push(i);
    ranked.sort((a, b) => perturbed[b] - perturbed[a]);

    for (let pos = 0; pos < maxK && pos < n; pos++) {
      const idx = ranked[pos];
      if (pos < ks[0]) counts[0][idx]++;
      if (pos < ks[1]) counts[1][idx]++;
    }
  }

  return [
    counts[0].map((c) => (c / nSim) * 100),
    counts[1].map((c) => (c / nSim) * 100),
  ];
}

function placketLucePostProcess(predictions: EnhancedPrediction[]): EnhancedPrediction[] {
  if (predictions.length === 0) return predictions;
  const scores = predictions.map((p) => p.score);
  const pWin = plSoftmax(scores);
  const [pTop3, pTop5] = monteCarloTopKMulti(scores, [3, 5], PL_N_SIM);

  return predictions.map((pred, i) => {
    const plWin  = round(pWin[i], 1);
    const plTop3 = round(pTop3[i], 1);
    const plTop5 = round(pTop5[i], 1);
    return {
      ...pred,
      // Overwrite horse-level probabilities with coherent PL values
      // so that Σ(top3) ≈ 3 × n_bets / n and p_win ≤ p_top3 ≤ p_top5 always holds
      horse: { ...pred.horse, winProbability: plWin, top3Probability: plTop3, top5Probability: plTop5 },
      plWinProbability: plWin,
      plTop3Probability: plTop3,
      plTop5Probability: plTop5,
    };
  });
}

// ─────────────────────────────────────────────────────────────
// MAIN ROUTER — public API entry point
// ─────────────────────────────────────────────────────────────

export function explainPredictionScore(
  horse: HorsePrediction,
  horses: HorsePrediction[],
  context: RaceContext = {},
): EnhancedPrediction {
  const stats = fieldStats(horses);
  const discipline = context.discipline ?? "Plat";

  if (discipline === "Trot") return trotScore(horse, horses, context, stats);
  if (discipline === "Obstacle") return obstacleScore(horse, horses, context, stats);
  return platScore(horse, horses, context, stats);
}

export function probableArrivalScore(
  horse: HorsePrediction,
  horses: HorsePrediction[],
  context: RaceContext = {},
): number {
  return explainPredictionScore(horse, horses, context).score;
}

export function enhancedArrival(
  horses: HorsePrediction[],
  context: RaceContext = {},
): EnhancedPrediction[] {
  const raw = horses.map((horse) => explainPredictionScore(horse, horses, context));
  return placketLucePostProcess(raw).sort(
    (a, b) =>
      b.score - a.score ||
      b.plWinProbability - a.plWinProbability ||
      b.exactOrderScore - a.exactOrderScore ||
      a.horse.odds - b.horse.odds,
  );
}

export function exactArrival(
  horses: HorsePrediction[],
  context: RaceContext = {},
): EnhancedPrediction[] {
  const raw = horses.map((horse) => explainPredictionScore(horse, horses, context));
  return placketLucePostProcess(raw).sort(
    (a, b) =>
      b.exactOrderScore - a.exactOrderScore ||
      b.plWinProbability - a.plWinProbability ||
      b.horse.winProbability - a.horse.winProbability ||
      a.horse.odds - b.horse.odds,
  );
}

export function coverageArrival(
  horses: HorsePrediction[],
  context: RaceContext = {},
): EnhancedPrediction[] {
  return enhancedArrival(horses, context);
}

export function watchedLongshot(
  horses: HorsePrediction[],
  context: RaceContext = {},
): HorsePrediction | undefined {
  return enhancedArrival(horses, context)
    .filter((item) => item.horse.odds >= 6)
    .sort(
      (a, b) =>
        b.top3UpsetScore - a.top3UpsetScore ||
        b.outsiderWatchScore - a.outsiderWatchScore ||
        b.horse.valueIndex - a.horse.valueIndex,
    )[0]?.horse;
}

// ─────────────────────────────────────────────────────────────
// UTILITY FUNCTIONS
// ─────────────────────────────────────────────────────────────

function sig(label: string, value: number, weight: number): PredictionSignal {
  return { label, value: round(sane(value), 3), weight };
}

function sane(value: unknown, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function normalized(value: unknown, max: number): number {
  if (max <= 0) return 0;
  return clamp(sane(value) / max, 0, 1);
}

function average(values: number[], fallback: number): number {
  const clean = values.filter((v) => Number.isFinite(v));
  if (clean.length === 0) return fallback;
  return clean.reduce((s, v) => s + v, 0) / clean.length;
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(Math.max(value, min), max);
}

function round(value: number, decimals: number): number {
  if (!Number.isFinite(value)) return 0;
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}
