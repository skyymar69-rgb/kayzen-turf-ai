import { coverageArrival, exactArrival, watchedLongshot } from "@/lib/prediction-math";
import { calibrateField, simulateTopOrders, ticketProbability } from "@/lib/probability";
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

/**
 * Tout ce qu'une course fournit aux tickets, calculé UNE fois.
 *
 * `watchedLongshot` relance l'arrivée complète (scoring de tout le peloton +
 * simulation Plackett-Luce) : il était appelé dans `selectionFor`, `poolFor` et
 * `rationaleFor`, soit jusqu'à trois fois par type de pari — 47 appels pour
 * quinze types, plus une calibration et 4 000 ordres simulés par ticket.
 * Mesuré : 570 ms par course. Ici, chaque quantité n'est produite qu'une fois.
 */
type RaceMaterial = {
  exact: HorsePrediction[];
  coverage: HorsePrediction[];
  longshot: HorsePrediction | undefined;
  /** Peloton calibré, dans l'ordre de `coverage`. */
  calibrated: HorsePrediction[];
  /** Ordres d'arrivée simulés sur `calibrated` (indices dans ce tableau). */
  orders: number[][];
  fieldSize: number;
};

function prepareRace(horses: HorsePrediction[], context: RaceContext): RaceMaterial {
  const exact = probableArrival(horses, context);
  const coverage = coverageArrival(horses, context).map((item) => item.horse);
  const longshot = watchedLongshot(horses, context);
  const calibrated = calibrateField(coverage);
  const orders = simulateTopOrders(calibrated.map((h) => h.winProbability));
  return { exact, coverage, longshot, calibrated, orders, fieldSize: horses.length };
}

export function buildBetRecommendations(
  horses: HorsePrediction[],
  offers: BetOffer[],
  context: RaceContext = {},
): BetRecommendation[] {
  if (horses.length === 0) return [];
  const material = prepareRace(horses, context);
  const offerMap = new Map(offers.map((offer) => [offer.type, offer]));

  return SUPPORTED_TYPES.flatMap((type) => {
    const offer = offerMap.get(type);
    if (!offer) return [];

    const selection = selectionFor(type, material);
    if (selection.length < Math.max(1, offer.requiredHorses)) return [];

    const variantResult = variantsFor(type, poolSourceFor(type, material), offer, material);

    return [
      {
        audience: offer.audience,
        baseStake: offer.baseStake,
        confidence: confidenceFor(type, selection, material),
        horses: selection.map((horse) => ({ name: horse.horse, number: horse.number })),
        label: offer.label,
        rationale: rationaleFor(type, selection, material, context),
        strategy: strategyFor(type),
        ticket: ticketFor(type, selection),
        type,
        variantCount: variantResult.total,
        variants: variantResult.variants,
      },
    ];
  });
}

function selectionFor(type: string, { exact, coverage, longshot }: RaceMaterial) {
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

function poolSourceFor(type: string, { exact, coverage }: RaceMaterial) {
  if (type === "SIMPLE_GAGNANT" || type === "COUPLE_GAGNANT" || type === "COUPLE_ORDRE" || type === "TRIO_ORDRE" || type === "TIERCE") {
    return exact;
  }
  return coverage;
}

function variantsFor(
  type: string,
  arrival: HorsePrediction[],
  offer: BetOffer,
  material: RaceMaterial,
): { pool: HorsePrediction[]; total: number; variants: BetTicketVariant[] } {
  const pool = poolFor(type, arrival, material.longshot);
  const required = Math.max(1, offer.requiredHorses || requiredHorsesFor(type));
  const ordered = isOrdered(type, offer);
  const groups = ordered ? permutations(pool, required) : combinations(pool, required);

  const variants = groups
    .map((group) => variantFor(type, group, ordered, material))
    .sort((a, b) => b.confidence - a.confidence || a.ticket.localeCompare(b.ticket, "fr"));

  return { pool, total: groups.length, variants };
}

function poolFor(type: string, arrival: HorsePrediction[], longshot: HorsePrediction | undefined) {
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

function variantFor(
  type: string,
  horses: HorsePrediction[],
  ordered: boolean,
  material: RaceMaterial,
): BetTicketVariant {
  const numbers = horses.map((horse) => horse.number);

  // Même logique que `confidenceFor` : la confiance est la probabilité estimée
  // que la variante passe, et non une moyenne de scores saturés.
  const confidence = ticketConfidence(type, horses, material, ordered);

  return {
    confidence,
    numbers,
    rationale: ordered ? "Ordre calcule dans le champ IA priorise." : "Combinaison calculee dans le champ IA priorise.",
    ticket: ordered ? `${numbers.join("-")} ordre` : numbers.join("-"),
  };
}

/**
 * Nombre de places payées au placé selon la taille du peloton (règlement PMU) :
 * 3 places à partir de 8 partants, 2 places de 4 à 7, aucune en dessous — on
 * retombe alors sur le gagnant.
 */
export function placePositionsFor(fieldSize: number): number {
  if (fieldSize >= 8) return 3;
  if (fieldSize >= 4) return 2;
  return 1;
}

/**
 * Nombre de places que le ticket doit couvrir.
 * Pour la plupart des paris il y a autant de places que de chevaux joués ; les
 * paris « placé » et le 2 sur 4 élargissent la fenêtre.
 */
function placesCoveredFor(type: string, picks: number, fieldSize: number): number {
  if (type === "SIMPLE_PLACE" || type === "COUPLE_PLACE") return Math.max(picks, placePositionsFor(fieldSize));
  if (type === "DEUX_SUR_QUATRE") return 4;
  return picks;
}

/**
 * Confiance d'un ticket = probabilité estimée qu'il passe, en %.
 *
 * L'ancienne version moyennait le `score` enrichi des chevaux. Or ce score est
 * borné à 99 et sature en pratique pour la plupart des partants : tous les
 * tickets d'une course ressortaient à 99/99, quel que soit le type de pari.
 * Un Simple Gagnant et un Trio dans l'ordre affichaient la même confiance.
 *
 * La probabilité est désormais estimée sur des ordres d'arrivée simulés, avec
 * le même modèle que les probabilités affichées — un Trio est donc
 * mécaniquement moins « sûr » qu'un Simple Placé, comme il se doit.
 *
 * Elle est exprimée avec une décimale au-dessous de 10 %, sinon les paris
 * combinés (Tiercé, Quarté, Quinté) s'écrasaient tous sur le plancher 1.
 */
function ticketConfidence(type: string, selection: HorsePrediction[], material: RaceMaterial, ordered: boolean): number {
  const picks = selection
    .map((horse) => material.calibrated.findIndex((h) => h.id === horse.id))
    .filter((i) => i >= 0);
  if (picks.length === 0) return 0;

  const probability = ticketProbability(material.orders, picks, placesCoveredFor(type, picks.length, material.fieldSize), ordered);
  return roundConfidence(probability);
}

function confidenceFor(type: string, selection: HorsePrediction[], material: RaceMaterial) {
  return ticketConfidence(type, selection, material, isOrderedType(type));
}

/** 0,1 → 99 : une décimale sous 10 %, entier au-dessus, jamais 100. */
function roundConfidence(probability: number): number {
  if (!Number.isFinite(probability) || probability <= 0) return 0;
  if (probability < 10) return Math.max(0.1, Math.round(probability * 10) / 10);
  return Math.min(99, Math.round(probability));
}

function strategyFor(type: string): BetRecommendation["strategy"] {
  if (type === "SIMPLE_GAGNANT" || type === "COUPLE_ORDRE" || type === "TRIO_ORDRE" || type === "TIERCE") return "Confiance";
  if (type === "SIMPLE_PLACE" || type === "COUPLE_PLACE" || type === "DEUX_SUR_QUATRE") return "Couverture";
  if (type === "QUARTE_PLUS" || type === "QUINTE_PLUS" || type === "SUPER_QUATRE" || type === "TIC_TROIS") return "Speculatif";
  return "Value";
}

function rationaleFor(type: string, horses: HorsePrediction[], { longshot }: RaceMaterial, context: RaceContext) {
  const lead = horses[0];
  const discipline = context.discipline ?? "Plat";

  if (type === "SIMPLE_PLACE") return `Base place sur le meilleur compromis PronoScore / Top 3 (${discipline}): ${lead.horse}.`;
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

/**
 * Paris dont le ticket exige l'ordre exact.
 *
 * Quarté+ et Quinté+ en étaient : 720 permutations générées, confiance au
 * plancher, et un libellé « dans l'ordre » alors que `includeHorse` insère
 * volontairement le tocard en 4e position. Ils se jouent en désordre avec
 * bonus, comme le Pick 5 : on les traite ainsi.
 */
function isOrderedType(type: string) {
  return type.includes("ORDRE") || type === "TIERCE" || type === "SUPER_QUATRE" || type === "TIC_TROIS";
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
  confidence: number;   // 0.1-99, probabilité estimée que le ticket passe
  costEuros: number;    // estimated total cost in euros
};

/**
 * Part des ordres simulés dont les `places` premiers sont TOUS dans `picks`.
 * C'est la probabilité qu'un Multi (ou un ticket à X) passe : la sélection
 * doit contenir l'arrivée, pas seulement y figurer.
 */
function coverProbability(orders: number[][], picks: Set<number>, places: number): number {
  if (orders.length === 0 || picks.size === 0) return 0;
  let hits = 0;
  for (const order of orders) {
    if (order.length < places) continue;
    let ok = true;
    for (let i = 0; i < places && ok; i++) if (!picks.has(order[i])) ok = false;
    if (ok) hits++;
  }
  return (hits / orders.length) * 100;
}

export function buildXTickets(
  horses: HorsePrediction[],
  offers: BetOffer[],
  context: RaceContext = {},
): XTicket[] {
  if (horses.length === 0) return [];
  const material = prepareRace(horses, context);
  const { exact: arrival, coverage: cov, calibrated, orders } = material;
  const offerMap = new Map(offers.map((o) => [o.type, o]));
  const N = horses.length;
  const out: XTicket[] = [];

  const indexOf = (horse: HorsePrediction) => calibrated.findIndex((h) => h.id === horse.id);

  /**
   * Confiance d'un ticket à X : les bases doivent figurer dans les `positions`
   * premiers, les X couvrant le reste du peloton. Même échantillon d'ordres que
   * les tickets classiques — la confiance de « 1-2-3 » est donc identique dans
   * les deux panneaux, là où l'un affichait 1 et l'autre 87.
   */
  function add(betType: string, offer: BetOffer, bases: HorsePrediction[], xCount: number, positions: number) {
    const bn     = bases.map((h) => h.number);
    const combos = xCount === 0 ? 1 : ncr(Math.max(0, N - bn.length), xCount);
    if (combos < 1) return;
    const picks  = bases.map(indexOf).filter((i) => i >= 0);
    const conf   = roundConfidence(ticketProbability(orders, picks, positions, false));
    const xs     = Array(xCount).fill("X").join(" ");
    const ticket = xCount === 0 ? bn.join("-") : xs ? `${bn.join("-")} ${xs}` : bn.join("-");
    const label  = xCount === 0
      ? `${offer.label} — ${bn.length} ${bn.length > 1 ? "chevaux fixés" : "cheval fixé"}`
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
    if (b1 && b2 && b3) add(t, offer, [b1, b2, b3], 0, 3);
    if (b1 && b2)        add(t, offer, [b1, b2],     1, 3);
    if (b1)              add(t, offer, [b1],          2, 3);
  }

  // Quarté+ (4 positions)
  const q4 = offerMap.get("QUARTE_PLUS");
  if (q4 && arrival.length >= 1) {
    const [b1, b2, b3, b4] = arrival;
    if (b1 && b2 && b3 && b4) add("QUARTE_PLUS", q4, [b1, b2, b3, b4], 0, 4);
    if (b1 && b2 && b3)        add("QUARTE_PLUS", q4, [b1, b2, b3],    1, 4);
    if (b1 && b2)              add("QUARTE_PLUS", q4, [b1, b2],         2, 4);
    if (b1)                    add("QUARTE_PLUS", q4, [b1],             3, 4);
  }

  // Quinté+ / Pick5 (5 positions)
  for (const t of ["QUINTE_PLUS", "PICK5"] as const) {
    const offer = offerMap.get(t);
    if (!offer || arrival.length < 1) continue;
    const [b1, b2, b3, b4, b5] = arrival;
    if (b1 && b2 && b3 && b4 && b5) add(t, offer, [b1, b2, b3, b4, b5], 0, 5);
    if (b1 && b2 && b3 && b4)        add(t, offer, [b1, b2, b3, b4],    1, 5);
    if (b1 && b2 && b3)              add(t, offer, [b1, b2, b3],         2, 5);
    if (b1 && b2)                    add(t, offer, [b1, b2],             3, 5);
    if (b1)                          add(t, offer, [b1],                 4, 5);
  }

  // Multi — 4 à 7 chevaux pour occuper les 4 premières places
  const mOffer = offerMap.get("MULTI");
  if (mOffer && cov.length >= 4) {
    for (let n = 4; n <= Math.min(7, cov.length); n++) {
      const sel  = cov.slice(0, n);
      const nums = sel.map((h) => h.number);
      const picks = new Set(sel.map(indexOf).filter((i) => i >= 0));
      // Un Multi passe si les 4 premiers sont tous dans la sélection.
      const combosCount = n <= 4 ? 1 : ncr(n, 4);
      out.push({
        betType: "MULTI",
        label: `Multi — ${n} chevaux`,
        ticket: nums.join("-"),
        bases: nums,
        xPositions: 0,
        combinations: combosCount,
        confidence: roundConfidence(coverProbability(orders, picks, 4)),
        costEuros: +(combosCount * (mOffer.baseStake || 1.5)).toFixed(2),
      });
    }
  }

  // Mini-Multi — 4 chevaux (variante économique du Multi)
  // Identique à Multi 4 chevaux mais affiché séparément pour clarté
  if (mOffer && cov.length >= 4) {
    const sel  = cov.slice(0, 4);
    const nums = sel.map((h) => h.number);
    const picks = new Set(sel.map(indexOf).filter((i) => i >= 0));
    out.push({
      betType: "MINI_MULTI",
      label: "Mini-Multi — 4 chevaux (base)",
      ticket: nums.join("-"),
      bases: nums,
      xPositions: 0,
      combinations: 1,
      confidence: roundConfidence(coverProbability(orders, picks, 4)),
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
