import { enhancedArrival, watchedLongshot } from "@/lib/prediction-math";
import type { BetOffer, BetRecommendation, BetTicketVariant, HorsePrediction } from "@/lib/types";

const SUPPORTED_TYPES = [
  "SIMPLE_GAGNANT",
  "SIMPLE_PLACE",
  "COUPLE_GAGNANT",
  "COUPLE_PLACE",
  "COUPLE_ORDRE",
  "DEUX_SUR_QUATRE",
  "TRIO",
  "TRIO_ORDRE",
  "TIERCE",
  "MULTI",
  "SUPER_QUATRE",
  "QUARTE_PLUS",
  "QUINTE_PLUS",
  "PICK5",
  "TIC_TROIS",
];

export function probableArrival(horses: HorsePrediction[]) {
  return enhancedArrival(horses).map((item) => item.horse);
}

export function buildBetRecommendations(horses: HorsePrediction[], offers: BetOffer[]): BetRecommendation[] {
  const arrival = probableArrival(horses);
  const offerMap = new Map(offers.map((offer) => [offer.type, offer]));

  return SUPPORTED_TYPES.flatMap((type) => {
    const offer = offerMap.get(type);
    if (!offer) return [];

    const selection = selectionFor(type, arrival);
    if (selection.length < Math.max(1, offer.requiredHorses)) return [];

    const variantResult = variantsFor(type, arrival, offer);

    return [
      {
        audience: offer.audience,
        baseStake: offer.baseStake,
        confidence: confidenceFor(type, selection),
        horses: selection.map((horse) => ({ name: horse.horse, number: horse.number })),
        label: offer.label,
        rationale: rationaleFor(type, selection, variantResult.pool),
        strategy: strategyFor(type),
        ticket: ticketFor(type, selection),
        type,
        variantCount: variantResult.total,
        variants: variantResult.variants,
      },
    ];
  });
}

function selectionFor(type: string, arrival: HorsePrediction[]) {
  const longshot = watchedLongshot(arrival);
  const quartetWithLongshot = longshot ? includeHorse(arrival, longshot, 3) : arrival;
  const quintetWithLongshot = longshot ? includeHorse(arrival, longshot, 4) : arrival;

  if (type === "SIMPLE_GAGNANT" || type === "SIMPLE_PLACE") return arrival.slice(0, 1);
  if (type.startsWith("COUPLE") || type === "DEUX_SUR_QUATRE") return arrival.slice(0, 2);
  if (type.startsWith("TRIO") || type === "TIERCE") return arrival.slice(0, 3);
  if (type === "MULTI" || type === "SUPER_QUATRE" || type === "QUARTE_PLUS") return quartetWithLongshot.slice(0, 4);
  if (type === "QUINTE_PLUS" || type === "PICK5" || type === "TIC_TROIS") return quintetWithLongshot.slice(0, 5);
  return [];
}

function variantsFor(type: string, arrival: HorsePrediction[], offer: BetOffer): { pool: HorsePrediction[]; total: number; variants: BetTicketVariant[] } {
  const pool = poolFor(type, arrival);
  const required = Math.max(1, offer.requiredHorses || requiredHorsesFor(type));
  const ordered = isOrdered(type, offer);
  const groups = ordered ? permutations(pool, required) : combinations(pool, required);
  const variants = groups
    .map((group) => variantFor(type, group, ordered))
    .sort((a, b) => b.confidence - a.confidence || a.ticket.localeCompare(b.ticket, "fr"));

  return {
    pool,
    total: groups.length,
    variants,
  };
}

function poolFor(type: string, arrival: HorsePrediction[]) {
  const longshot = watchedLongshot(arrival);
  const basePool = (() => {
    if (type === "SIMPLE_GAGNANT" || type === "SIMPLE_PLACE") return arrival.slice(0, 6);
    if (type.startsWith("COUPLE") || type === "DEUX_SUR_QUATRE") return arrival.slice(0, 5);
    if (type.startsWith("TRIO") || type === "TIERCE") return arrival.slice(0, 5);
    if (type === "MULTI" || type === "SUPER_QUATRE" || type === "QUARTE_PLUS") return arrival.slice(0, 5);
    if (type === "QUINTE_PLUS" || type === "PICK5" || type === "TIC_TROIS") return arrival.slice(0, 6);
    return arrival.slice(0, 5);
  })();

  if (!longshot || basePool.some((horse) => horse.id === longshot.id)) return basePool;
  return [...basePool.slice(0, -1), longshot];
}

function ticketFor(type: string, horses: HorsePrediction[]) {
  const numbers = horses.map((horse) => horse.number).join("-");
  if (isOrderedType(type)) return `${numbers} dans l'ordre`;
  return numbers;
}

function variantFor(type: string, horses: HorsePrediction[], ordered: boolean): BetTicketVariant {
  const numbers = horses.map((horse) => horse.number);
  const averageScore = horses.reduce((sum, horse) => sum + enhancedArrival(horses).find((item) => item.horse.id === horse.id)!.score, 0) / horses.length;
  const orderedPenalty = ordered ? Math.max(4, horses.length * 4) : 0;
  const confidence = Math.max(1, Math.min(99, Math.round(averageScore - orderedPenalty)));

  return {
    confidence,
    numbers,
    rationale: ordered ? "Ordre calcule dans le champ IA priorise." : "Combinaison calculee dans le champ IA priorise.",
    ticket: ordered ? `${numbers.join("-")} ordre` : numbers.join("-"),
  };
}

function confidenceFor(type: string, horses: HorsePrediction[]) {
  const enhanced = enhancedArrival(horses);
  const average = enhanced.reduce((sum, item) => sum + item.score, 0) / Math.max(enhanced.length, 1);
  const orderedPenalty = isOrderedType(type) ? 12 : 0;
  const spreadPenalty = Math.max(0, horses.length - 2) * 3;
  return Math.max(1, Math.min(99, Math.round(average - orderedPenalty - spreadPenalty)));
}

function strategyFor(type: string): BetRecommendation["strategy"] {
  if (type === "SIMPLE_GAGNANT" || type === "COUPLE_ORDRE" || type === "TRIO_ORDRE" || type === "TIERCE") return "Confiance";
  if (type === "SIMPLE_PLACE" || type === "COUPLE_PLACE" || type === "DEUX_SUR_QUATRE") return "Couverture";
  if (type === "QUARTE_PLUS" || type === "QUINTE_PLUS" || type === "SUPER_QUATRE" || type === "TIC_TROIS") return "Speculatif";
  return "Value";
}

function rationaleFor(type: string, horses: HorsePrediction[], pool: HorsePrediction[]) {
  const lead = horses[0];
  const longshot = watchedLongshot(pool);

  if (type === "SIMPLE_PLACE") return `Base place sur le meilleur compromis KZ Score / Top 3: ${lead.horse}.`;
  if (type === "DEUX_SUR_QUATRE") return "Couverture sur les bases les plus regulieres du classement probable.";
  if (type.includes("ORDRE") || type === "TIERCE") return "Combinaisons ordre calculees depuis le champ IA priorise.";
  if ((type === "QUARTE_PLUS" || type === "QUINTE_PLUS") && longshot) return `Selection elargie avec tocard surveille #${longshot.number}, a jouer prudemment avec flexi si disponible.`;
  if (type === "QUARTE_PLUS" || type === "QUINTE_PLUS") return "Selection elargie, a jouer prudemment avec flexi si disponible.";
  return `Selection issue de l'ordre d'arrivee le plus probable, leader: ${lead.horse}.`;
}

function requiredHorsesFor(type: string) {
  if (type.startsWith("COUPLE") || type === "DEUX_SUR_QUATRE") return 2;
  if (type.startsWith("TRIO") || type === "TIERCE") return 3;
  if (type === "MULTI" || type === "SUPER_QUATRE" || type === "QUARTE_PLUS") return 4;
  if (type === "QUINTE_PLUS" || type === "PICK5" || type === "TIC_TROIS") return 5;
  return 1;
}

function isOrdered(type: string, offer: BetOffer) {
  return offer.ordered || isOrderedType(type);
}

function isOrderedType(type: string) {
  return type.includes("ORDRE") || type === "TIERCE" || type === "SUPER_QUATRE" || type === "QUARTE_PLUS" || type === "QUINTE_PLUS" || type === "TIC_TROIS";
}

function combinations<T>(items: T[], size: number): T[][] {
  if (size <= 0) return [[]];
  if (items.length < size) return [];
  if (size === 1) return items.map((item) => [item]);

  return items.flatMap((item, index) => combinations(items.slice(index + 1), size - 1).map((rest) => [item, ...rest]));
}

function permutations<T>(items: T[], size: number): T[][] {
  if (size <= 0) return [[]];
  if (items.length < size) return [];

  return items.flatMap((item, index) => {
    const rest = [...items.slice(0, index), ...items.slice(index + 1)];
    return permutations(rest, size - 1).map((tail) => [item, ...tail]);
  });
}

function includeHorse(arrival: HorsePrediction[], horse: HorsePrediction, maxIndex: number) {
  const withoutDuplicate = arrival.filter((item) => item.id !== horse.id);
  const index = Math.min(maxIndex, withoutDuplicate.length);
  return [...withoutDuplicate.slice(0, index), horse, ...withoutDuplicate.slice(index)];
}
