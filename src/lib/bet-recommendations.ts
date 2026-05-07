import { coverageArrival, exactArrival, enhancedArrival, watchedLongshot } from "@/lib/prediction-math";
import type { RaceContext } from "@/lib/prediction-math";
import type { BetOffer, BetRecommendation, BetTicketVariant, HorsePrediction, RaceAnalysis } from "@/lib/types";

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

export function raceToContext(race: Pick<RaceAnalysis, "discipline" | "going" | "distance" | "weather" | "specialty" | "raceDate" | "marketVolatility" | "modelConsensus" | "raceQualityScore" | "riskLevel">): RaceContext {
  return {
    discipline: race.discipline,
    going: race.going,
    distance: race.distance,
    weather: race.weather,
    specialty: race.specialty,
    raceDate: race.raceDate,
    marketVolatility: race.marketVolatility,
    modelConsensus: race.modelConsensus,
    raceQualityScore: race.raceQualityScore,
    riskLevel: race.riskLevel,
  };
}

export function probableArrival(horses: HorsePrediction[], context: RaceContext = {}) {
  return exactArrival(horses, context).map((item) => item.horse);
}

export function buildBetRecommendations(
  horses: HorsePrediction[],
  offers: BetOffer[],
  context: RaceContext = {},
): BetRecommendation[] {
  const exact = probableArrival(horses, context);
  const coverage = coverageArrival(horses, context).map((item) => item.horse);
  const offerMap = new Map(offers.map((offer) => [offer.type, offer]));

  return SUPPORTED_TYPES.flatMap((type) => {
    const offer = offerMap.get(type);
    if (!offer) return [];

    const selection = selectionFor(type, exact, coverage, context);
    if (selection.length < Math.max(1, offer.requiredHorses)) return [];

    const variantResult = variantsFor(type, poolSourceFor(type, exact, coverage), offer, context);

    return [
      {
        audience: offer.audience,
        baseStake: offer.baseStake,
        confidence: confidenceFor(type, selection, context),
        horses: selection.map((horse) => ({ name: horse.horse, number: horse.number })),
        label: offer.label,
        rationale: rationaleFor(type, selection, variantResult.pool, context),
        strategy: strategyFor(type),
        ticket: ticketFor(type, selection),
        type,
        variantCount: variantResult.total,
        variants: variantResult.variants,
      },
    ];
  });
}

function selectionFor(type: string, exact: HorsePrediction[], coverage: HorsePrediction[], context: RaceContext) {
  const longshot = watchedLongshot(coverage, context);
  const quartetWithLongshot = longshot ? includeHorse(coverage, longshot, 3) : coverage;
  const quintetWithLongshot = longshot ? includeHorse(coverage, longshot, 4) : coverage;

  if (type === "SIMPLE_GAGNANT") return exact.slice(0, 1);
  if (type === "SIMPLE_PLACE") return coverage.slice(0, 1);
  if (type === "COUPLE_GAGNANT" || type === "COUPLE_ORDRE") return exact.slice(0, 2);
  if (type === "COUPLE_PLACE" || type === "DEUX_SUR_QUATRE") return coverage.slice(0, 2);
  if (type === "TRIO_ORDRE" || type === "TIERCE") return exact.slice(0, 3);
  if (type === "TRIO") return coverage.slice(0, 3);
  if (type === "MULTI" || type === "SUPER_QUATRE" || type === "QUARTE_PLUS") return quartetWithLongshot.slice(0, 4);
  if (type === "QUINTE_PLUS" || type === "PICK5" || type === "TIC_TROIS") return quintetWithLongshot.slice(0, 5);
  return [];
}

function poolSourceFor(type: string, exact: HorsePrediction[], coverage: HorsePrediction[]) {
  if (type === "SIMPLE_GAGNANT" || type === "COUPLE_GAGNANT" || type === "COUPLE_ORDRE" || type === "TRIO_ORDRE" || type === "TIERCE") {
    return exact;
  }
  return coverage;
}

function variantsFor(
  type: string,
  arrival: HorsePrediction[],
  offer: BetOffer,
  context: RaceContext,
): { pool: HorsePrediction[]; total: number; variants: BetTicketVariant[] } {
  const pool = poolFor(type, arrival, context);
  const required = Math.max(1, offer.requiredHorses || requiredHorsesFor(type));
  const ordered = isOrdered(type, offer);
  const groups = ordered ? permutations(pool, required) : combinations(pool, required);
  const variants = groups
    .map((group) => variantFor(type, group, ordered, context))
    .sort((a, b) => b.confidence - a.confidence || a.ticket.localeCompare(b.ticket, "fr"));

  return { pool, total: groups.length, variants };
}

function poolFor(type: string, arrival: HorsePrediction[], context: RaceContext) {
  const longshot = watchedLongshot(arrival, context);
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

function variantFor(type: string, horses: HorsePrediction[], ordered: boolean, context: RaceContext): BetTicketVariant {
  const numbers = horses.map((horse) => horse.number);
  const scored = enhancedArrival(horses, context);
  const averageScore = safeAverage(horses.map((horse) => scored.find((item) => item.horse.id === horse.id)?.score));
  const orderedPenalty = ordered ? Math.max(4, horses.length * 4) : 0;
  const confidence = Math.max(1, Math.min(99, Math.round(averageScore - orderedPenalty)));

  return {
    confidence,
    numbers,
    rationale: ordered ? "Ordre calcule dans le champ IA priorise." : "Combinaison calculee dans le champ IA priorise.",
    ticket: ordered ? `${numbers.join("-")} ordre` : numbers.join("-"),
  };
}

function confidenceFor(type: string, horses: HorsePrediction[], context: RaceContext) {
  const enhanced = enhancedArrival(horses, context);
  const avg = safeAverage(enhanced.map((item) => item.score));
  const orderedPenalty = isOrderedType(type) ? 12 : 0;
  const spreadPenalty = Math.max(0, horses.length - 2) * 3;
  return Math.max(1, Math.min(99, Math.round(avg - orderedPenalty - spreadPenalty)));
}

function safeAverage(values: Array<number | undefined>) {
  const clean = values.filter((value): value is number => Number.isFinite(value));
  if (clean.length === 0) return 1;
  return clean.reduce((sum, value) => sum + value, 0) / clean.length;
}

function strategyFor(type: string): BetRecommendation["strategy"] {
  if (type === "SIMPLE_GAGNANT" || type === "COUPLE_ORDRE" || type === "TRIO_ORDRE" || type === "TIERCE") return "Confiance";
  if (type === "SIMPLE_PLACE" || type === "COUPLE_PLACE" || type === "DEUX_SUR_QUATRE") return "Couverture";
  if (type === "QUARTE_PLUS" || type === "QUINTE_PLUS" || type === "SUPER_QUATRE" || type === "TIC_TROIS") return "Speculatif";
  return "Value";
}

function rationaleFor(type: string, horses: HorsePrediction[], pool: HorsePrediction[], context: RaceContext) {
  const lead = horses[0];
  const longshot = watchedLongshot(pool, context);
  const discipline = context.discipline ?? "Plat";

  if (type === "SIMPLE_PLACE") return `Base place sur le meilleur compromis KZ Score / Top 3 (${discipline}): ${lead.horse}.`;
  if (type === "DEUX_SUR_QUATRE") return "Couverture sur les bases les plus regulieres du classement probable.";
  if (type.includes("ORDRE") || type === "TIERCE") return `Combinaisons ordre calculees depuis le champ IA ${discipline} priorise.`;
  if ((type === "QUARTE_PLUS" || type === "QUINTE_PLUS") && longshot) return `Selection elargie avec tocard surveille #${longshot.number}, a jouer prudemment avec flexi si disponible.`;
  if (type === "QUARTE_PLUS" || type === "QUINTE_PLUS") return "Selection elargie, a jouer prudemment avec flexi si disponible.";
  return `Selection issue de l'ordre d'arrivee le plus probable (algo ${discipline}), leader: ${lead.horse}.`;
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

// ── X-FORMAT TICKET SYSTEM ─────────────────────────────────────────

export type XTicket = {
  betType: string;
  label: string;
  ticket: string;       // "2-3 X" or "2 X X X" or "2-3-5-7" (multi)
  bases: number[];      // fixed horse numbers
  xPositions: number;  // number of X (field) positions
  combinations: number; // number of combinations this represents
  confidence: number;   // 1-99
  costEuros: number;    // estimated total cost in euros
};

export function buildXTickets(
  horses: HorsePrediction[],
  offers: BetOffer[],
  context: RaceContext = {},
): XTicket[] {
  const arrival = probableArrival(horses, context);
  const cov     = coverageArrival(horses, context).map((i) => i.horse);
  const offerMap = new Map(offers.map((o) => [o.type, o]));
  const N = horses.length;
  const out: XTicket[] = [];

  function add(betType: string, offer: BetOffer, bases: HorsePrediction[], xCount: number) {
    const bn     = bases.map((h) => h.number);
    const combos = xCount === 0 ? 1 : ncr(Math.max(0, N - bn.length), xCount);
    if (combos < 1) return;
    const avgKz  = bases.reduce((s, h) => s + (h.kzScore ?? 50), 0) / (bases.length || 1);
    const conf   = Math.max(1, Math.min(99, Math.round(avgKz - xCount * 10)));
    const xs     = Array(xCount).fill("X").join(" ");
    const ticket = xCount === 0 ? bn.join("-") : xs ? `${bn.join("-")} ${xs}` : bn.join("-");
    const label  = xCount === 0
      ? `${offer.label} — ${bn.length} cheval${bn.length > 1 ? "x" : ""} fixé${bn.length > 1 ? "s" : ""}`
      : `${offer.label} — ${bn.length} base${bn.length > 1 ? "s" : ""} + ${xCount} X`;
    out.push({
      betType, label, ticket, bases: bn, xPositions: xCount,
      combinations: combos, confidence: conf,
      costEuros: +(combos * (offer.baseStake || 1.5)).toFixed(2),
    });
  }

  // Trio / Tiercé (3 positions)
  for (const t of ["TIERCE", "TRIO", "TRIO_ORDRE"] as const) {
    const offer = offerMap.get(t);
    if (!offer || arrival.length < 1) continue;
    const [b1, b2, b3] = arrival;
    if (b1 && b2 && b3) add(t, offer, [b1, b2, b3], 0);
    if (b1 && b2)        add(t, offer, [b1, b2],     1);
    if (b1)              add(t, offer, [b1],          2);
  }

  // Quarté+ (4 positions)
  const q4 = offerMap.get("QUARTE_PLUS");
  if (q4 && arrival.length >= 1) {
    const [b1, b2, b3, b4] = arrival;
    if (b1 && b2 && b3 && b4) add("QUARTE_PLUS", q4, [b1, b2, b3, b4], 0);
    if (b1 && b2 && b3)        add("QUARTE_PLUS", q4, [b1, b2, b3],    1);
    if (b1 && b2)              add("QUARTE_PLUS", q4, [b1, b2],         2);
    if (b1)                    add("QUARTE_PLUS", q4, [b1],             3);
  }

  // Quinté+ / Pick5 (5 positions)
  for (const t of ["QUINTE_PLUS", "PICK5"] as const) {
    const offer = offerMap.get(t);
    if (!offer || arrival.length < 1) continue;
    const [b1, b2, b3, b4, b5] = arrival;
    if (b1 && b2 && b3 && b4 && b5) add(t, offer, [b1, b2, b3, b4, b5], 0);
    if (b1 && b2 && b3 && b4)        add(t, offer, [b1, b2, b3, b4],    1);
    if (b1 && b2 && b3)              add(t, offer, [b1, b2, b3],         2);
    if (b1 && b2)                    add(t, offer, [b1, b2],             3);
    if (b1)                          add(t, offer, [b1],                 4);
  }

  // Multi — 4 à 7 chevaux pour occuper les 4 premières places
  const mOffer = offerMap.get("MULTI");
  if (mOffer && cov.length >= 4) {
    for (let n = 4; n <= Math.min(7, cov.length); n++) {
      const sel  = cov.slice(0, n);
      const nums = sel.map((h) => h.number);
      const avgKz = sel.reduce((s, h) => s + (h.kzScore ?? 50), 0) / n;
      // For Multi: we select n horses and any 4 can be in top 4
      // Cost = C(n,4) × 24 combinations × baseStake (but PMU charges differently)
      // Simplified: 1 base stake for 4 horses, n-3 for 5, etc.
      const combosCount = n <= 4 ? 1 : ncr(n, 4);
      out.push({
        betType: "MULTI",
        label: `Multi — ${n} cheval${n > 1 ? "x" : ""}`,
        ticket: nums.join("-"),
        bases: nums,
        xPositions: 0,
        combinations: combosCount,
        confidence: Math.max(1, Math.min(99, Math.round(avgKz - (n - 4) * 8))),
        costEuros: +(combosCount * (mOffer.baseStake || 1.5)).toFixed(2),
      });
    }
  }

  // Mini-Multi — 4 chevaux (variante économique du Multi)
  // Identique à Multi 4 chevaux mais affiché séparément pour clarté
  if (mOffer && cov.length >= 4) {
    const sel  = cov.slice(0, 4);
    const nums = sel.map((h) => h.number);
    const avgKz = sel.reduce((s, h) => s + (h.kzScore ?? 50), 0) / 4;
    out.push({
      betType: "MINI_MULTI",
      label: "Mini-Multi — 4 chevaux (base)",
      ticket: nums.join("-"),
      bases: nums,
      xPositions: 0,
      combinations: 1,
      confidence: Math.max(1, Math.min(99, Math.round(avgKz))),
      costEuros: +(mOffer.baseStake || 1.5),
    });
  }

  // Déduplication : garder le ticket le plus confiant pour chaque (betType + ticket) pair
  const seen = new Set<string>();
  return out
    .sort((a, b) => b.confidence - a.confidence)
    .filter((t) => {
      const key = `${t.betType}|${t.ticket}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function ncr(n: number, k: number): number {
  if (k < 0 || k > n || n < 0) return 0;
  if (k === 0 || k === n) return 1;
  let r = 1;
  for (let i = 0; i < k; i++) r = r * (n - i) / (i + 1);
  return Math.round(r);
}
