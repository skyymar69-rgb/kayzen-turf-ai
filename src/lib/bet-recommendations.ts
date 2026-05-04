import type { BetOffer, BetRecommendation, HorsePrediction } from "@/lib/types";

const SUPPORTED_TYPES = [
  "SIMPLE_GAGNANT",
  "SIMPLE_PLACE",
  "COUPLE_GAGNANT",
  "COUPLE_PLACE",
  "COUPLE_ORDRE",
  "DEUX_SUR_QUATRE",
  "TRIO",
  "TRIO_ORDRE",
  "MULTI",
  "SUPER_QUATRE",
  "QUARTE_PLUS",
  "QUINTE_PLUS",
];

export function probableArrival(horses: HorsePrediction[]) {
  return horses
    .slice()
    .sort(
      (a, b) =>
        b.kzScore - a.kzScore ||
        b.winProbability - a.winProbability ||
        b.top3Probability - a.top3Probability,
    );
}

export function buildBetRecommendations(horses: HorsePrediction[], offers: BetOffer[]): BetRecommendation[] {
  const arrival = probableArrival(horses);
  const offerMap = new Map(offers.map((offer) => [offer.type, offer]));

  return SUPPORTED_TYPES.flatMap((type) => {
    const offer = offerMap.get(type);
    if (!offer) return [];

    const selection = selectionFor(type, arrival);
    if (selection.length < Math.max(1, offer.requiredHorses)) return [];

    return [
      {
        type,
        label: offer.label,
        audience: offer.audience,
        baseStake: offer.baseStake,
        strategy: strategyFor(type),
        horses: selection.map((horse) => ({ number: horse.number, name: horse.horse })),
        ticket: ticketFor(type, selection),
        confidence: confidenceFor(type, selection),
        rationale: rationaleFor(type, selection),
      },
    ];
  });
}

function selectionFor(type: string, arrival: HorsePrediction[]) {
  if (type === "SIMPLE_GAGNANT" || type === "SIMPLE_PLACE") return arrival.slice(0, 1);
  if (type.startsWith("COUPLE") || type === "DEUX_SUR_QUATRE") return arrival.slice(0, 2);
  if (type.startsWith("TRIO")) return arrival.slice(0, 3);
  if (type === "MULTI" || type === "SUPER_QUATRE" || type === "QUARTE_PLUS") return arrival.slice(0, 4);
  if (type === "QUINTE_PLUS") return arrival.slice(0, 5);
  return [];
}

function ticketFor(type: string, horses: HorsePrediction[]) {
  const numbers = horses.map((horse) => horse.number).join("-");
  if (type.includes("ORDRE") || type === "SUPER_QUATRE" || type === "QUARTE_PLUS" || type === "QUINTE_PLUS") {
    return `${numbers} dans l'ordre`;
  }
  return numbers;
}

function confidenceFor(type: string, horses: HorsePrediction[]) {
  const average = horses.reduce((sum, horse) => sum + horse.kzScore, 0) / Math.max(horses.length, 1);
  const orderedPenalty = type.includes("ORDRE") || type === "SUPER_QUATRE" || type === "QUARTE_PLUS" || type === "QUINTE_PLUS" ? 12 : 0;
  const spreadPenalty = Math.max(0, horses.length - 2) * 3;
  return Math.max(1, Math.min(99, Math.round(average - orderedPenalty - spreadPenalty)));
}

function strategyFor(type: string): BetRecommendation["strategy"] {
  if (type === "SIMPLE_GAGNANT" || type === "COUPLE_ORDRE" || type === "TRIO_ORDRE") return "Confiance";
  if (type === "SIMPLE_PLACE" || type === "COUPLE_PLACE" || type === "DEUX_SUR_QUATRE") return "Couverture";
  if (type === "QUARTE_PLUS" || type === "QUINTE_PLUS" || type === "SUPER_QUATRE") return "Speculatif";
  return "Value";
}

function rationaleFor(type: string, horses: HorsePrediction[]) {
  const lead = horses[0];
  if (type === "SIMPLE_PLACE") return `Base place sur le meilleur compromis KZ Score / Top 3: ${lead.horse}.`;
  if (type.includes("ORDRE")) return "Ticket ordre uniquement propose car le PMU ouvre ce pari sur cette course.";
  if (type === "DEUX_SUR_QUATRE") return "Couverture sur les deux bases les plus regulieres du classement probable.";
  if (type === "QUARTE_PLUS" || type === "QUINTE_PLUS") return "Sélection élargie, a jouer prudemment avec flexi si disponible.";
  return `Sélection issue de l'ordre d'arrivée le plus probable, leader: ${lead.horse}.`;
}


