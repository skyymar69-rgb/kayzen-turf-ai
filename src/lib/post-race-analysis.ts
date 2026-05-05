import { probableArrival } from "@/lib/bet-recommendations";
import { explainPredictionScore, watchedLongshot } from "@/lib/prediction-math";
import type { HorsePrediction, PostRaceAnalysis, RaceAnalysis } from "@/lib/types";

export function buildPostRaceAnalysis(race: RaceAnalysis): PostRaceAnalysis {
  const predicted = probableArrival(race.horses);
  const actual = race.horses
    .filter((horse) => typeof horse.finishPosition === "number")
    .sort((a, b) => Number(a.finishPosition) - Number(b.finishPosition));

  if (actual.length === 0) {
    return {
      status: "pending",
      predictedArrival: predicted.slice(0, 5).map((horse) => horse.number),
      actualArrival: [],
      metrics: {
        winnerHit: false,
        top3Hits: 0,
        top5Hits: 0,
        averagePositionError: null,
        confidenceScore: 0,
      },
      verdict: "En attente",
      summary: "Resultat officiel non encore disponible. L'analyse post-course sera calculee des que l'arrivée est importee.",
      lessons: [],
      nextModelActions: ["Attendre l'arrivée officielle PMU puis comparer prediction, tickets proposés et resultat."],
    };
  }

  const predictedTop5 = predicted.slice(0, 5);
  const actualTop5 = actual.slice(0, 5);
  const predictedNumbers = predictedTop5.map((horse) => horse.number);
  const actualNumbers = actualTop5.map((horse) => horse.number);
  const winnerHit = predicted[0]?.number === actual[0]?.number;
  const top3Hits = countIntersection(predicted.slice(0, 3), actual.slice(0, 3));
  const top5Hits = countIntersection(predictedTop5, actualTop5);
  const averagePositionError = averageError(predicted, actual);
  const confidenceScore = scoreReview(winnerHit, top3Hits, top5Hits, averagePositionError);
  const verdict = confidenceScore >= 72 ? "Bon signal" : confidenceScore >= 45 ? "Partiel" : "Erreur modèle";

  return {
    status: "complete",
    predictedArrival: predictedNumbers,
    actualArrival: actualNumbers,
    metrics: {
      winnerHit,
      top3Hits,
      top5Hits,
      averagePositionError,
      confidenceScore,
    },
    verdict,
    summary: summaryFor(race, actual, predicted, verdict, top3Hits, top5Hits),
    lessons: lessonsFor(actual, predicted),
    nextModelActions: nextActionsFor(actual, predicted, verdict),
  };
}

function countIntersection(predicted: HorsePrediction[], actual: HorsePrediction[]) {
  const actualNumbers = new Set(actual.map((horse) => horse.number));
  return predicted.filter((horse) => actualNumbers.has(horse.number)).length;
}

function averageError(predicted: HorsePrediction[], actual: HorsePrediction[]) {
  const predictedRank = new Map(predicted.map((horse, index) => [horse.number, index + 1]));
  const errors = actual
    .slice(0, 5)
    .map((horse, index) => Math.abs((predictedRank.get(horse.number) ?? predicted.length + 1) - (index + 1)));

  if (errors.length === 0) return null;
  return Number((errors.reduce((sum, value) => sum + value, 0) / errors.length).toFixed(1));
}

function scoreReview(winnerHit: boolean, top3Hits: number, top5Hits: number, averagePositionError: number | null) {
  const raw =
    (winnerHit ? 28 : 0) +
    top3Hits * 14 +
    top5Hits * 7 -
    Math.max(0, (averagePositionError ?? 5) - 1) * 6;

  return Math.max(0, Math.min(99, Math.round(raw)));
}

function summaryFor(
  race: RaceAnalysis,
  actual: HorsePrediction[],
  predicted: HorsePrediction[],
  verdict: PostRaceAnalysis["verdict"],
  top3Hits: number,
  top5Hits: number,
) {
  const winner = actual[0];
  const predictedWinner = predicted[0];

  if (verdict === "Bon signal") {
    return `${race.programCode}: lecture solide. Le modèle place ${top3Hits}/3 dans le Top 3 et ${top5Hits}/5 dans le Top 5.`;
  }

  if (winner && predictedWinner && winner.number !== predictedWinner.number) {
    return `${race.programCode}: le gagnant reel #${winner.number} ${winner.horse} devance notre base #${predictedWinner.number} ${predictedWinner.horse}. On doit analyser le signal sous-estimé.`;
  }

  return `${race.programCode}: resultat partiellement conforme, mais l'ordre exact reste insuffisant pour les paris ordre.`;
}

function lessonsFor(actual: HorsePrediction[], predicted: HorsePrediction[]) {
  const lessons: string[] = [];
  const winner = actual[0];
  const predictedWinner = predicted[0];
  const favorite = predicted.slice().sort((a, b) => a.odds - b.odds)[0];
  const longshot = watchedLongshot(predicted);

  if (!winner || !predictedWinner) return lessons;

  const winnerRank = predicted.findIndex((horse) => horse.number === winner.number) + 1;
  if (winnerRank > 3) {
    lessons.push(`Le gagnant #${winner.number} était classé ${winnerRank}e par le modèle: pénalité à remonter dans le feedback.`);
  }

  if (winner.valueIndex > 10) {
    lessons.push(`Le gagnant avait un signal value positif (+${winner.valueIndex}%): renforcer la pondération value quand elle converge avec Top 3/Top 5.`);
  }

  if (predictedWinner.finishPosition && predictedWinner.finishPosition > 3) {
    lessons.push(`Notre base #${predictedWinner.number} finit ${predictedWinner.finishPosition}e: reduire la confiance des profils similaires.`);
  }

  if (favorite && favorite.finishPosition && favorite.finishPosition > 3) {
    const favoriteRisk = explainPredictionScore(favorite, predicted).favoriteFailureRisk;
    lessons.push(`Favori #${favorite.number} hors Top 3: risque favori fragile mesure a ${favoriteRisk}/60, renforcer cette penalite si le profil se repete.`);
  }

  if (longshot && longshot.finishPosition && longshot.finishPosition <= 3) {
    const longshotSignal = explainPredictionScore(longshot, predicted).top3UpsetScore;
    lessons.push(`Tocard surveille #${longshot.number} dans les trois premiers: signal outsider Top 3 mesure a ${longshotSignal}/60, a remonter dans les tickets larges.`);
  }

  if (lessons.length === 0) {
    lessons.push("Les principaux signaux étaient coherents; conserver la calibration actuelle sur ce profil de course.");
  }

  return lessons;
}

function nextActionsFor(actual: HorsePrediction[], predicted: HorsePrediction[], verdict: PostRaceAnalysis["verdict"]) {
  const winner = actual[0];
  const predictedWinner = predicted[0];
  const actions = [
    "Enregistrer l'écart prediction/resultat dans le jeu d'apprentissage quotidien.",
    "Recalculer les poids KZ Score sur les courses terminées avant le prochain batch modèle.",
  ];

  if (verdict === "Erreur modèle") {
    actions.push("Baisser l'agressivite des tickets ordre sur ce profil tant que la calibration n'est pas corrigee.");
  }

  if (winner && predictedWinner && winner.number !== predictedWinner.number) {
    actions.push(`Comparer les facteurs de #${winner.number} et #${predictedWinner.number}: forme recente, cote observee, aptitude piste/distance.`);
  }

  return actions;
}
