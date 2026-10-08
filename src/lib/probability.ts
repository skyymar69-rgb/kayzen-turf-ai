import type { HorsePrediction, RaceAnalysis } from "@/lib/types";
import calibration from "@/lib/market-calibration.json";
import {
  conditionalLogit,
  exponentDevig,
  impliedFromOdds,
  normalize,
  placeStrengths,
  proportionalDevig,
  safeLog,
} from "@/lib/market-model";
import { expectedValueAtStart } from "@/lib/value-signal";

/**
 * CALIBRATION DES PROBABILITÉS — source unique de vérité.
 *
 * Tout consommateur (page course, accueil, tickets, API) passe par ici, ce qui
 * garantit qu'un même cheval affiche la même probabilité partout. Trois étages,
 * tous ajustés au maximum de vraisemblance sur des arrivées réelles par
 * scripts/fit-market.ts (coefficients et mesures : market-calibration.json) :
 *
 *   1. Marché : cotes PMU → probabilités, marge retirée par un exposant γ.
 *   2. Mélange de Benter : p ∝ exp(α·log p_marché + β·log p_IA).
 *   3. Ordre d'arrivée : Plackett-Luce corrigé de Henery/Stern (forces p^λ aux
 *      places d'honneur), d'où Top 3 / Top 5 et la probabilité des tickets.
 *
 * Période de mesure : 1 562 courses françaises courues du 24/08 au 07/10/2026,
 * ajustement sur les 767 courses avant le 16/09, validation sur les 795
 * suivantes. Le log loss est la moyenne de −ln(probabilité du gagnant).
 */

/**
 * ÉTAGE 1 — retrait de la marge. Comparaison sur la validation (log loss) :
 *
 *     proportionnel  q_i / Σq                      1,9747   (référence)
 *     puissance      q_i^k, k résolu par course    1,9757
 *     Shin (1993)                                   1,9776
 *     exposant γ par discipline                    1,9738
 *     exposant γ unique = 1,076 ± 0,046            1,9737   ← retenu
 *
 * L'écart avec le proportionnel est faible (−0,0010, IC 95 % [−0,005 ; +0,003]) :
 * le biais favori-tocard du PMU est modeste sur cette période. L'exposant
 * unique est retenu parce qu'il est le meilleur et le plus parcimonieux
 * (les γ par discipline, 1,055 / 1,087 / 1,065, ne s'écartent pas de lui au
 * regard de leurs erreurs types). Réel / attendu des gagnants (validation) :
 *
 *     cote         1-3    3-5    5-10   10-20  20-50  50+
 *     proportionnel 1,03   1,12   0,92   0,89   1,13   0,88
 *     exposant γ    0,97   1,08   0,92   0,93   1,26   1,06
 *
 * Les favoris ne sont plus sous-estimés ; la tranche 20-50 reste bruitée
 * (73 gagnants). Les deux méthodes restent dans l'erreur d'échantillonnage.
 */
export const MARKET_GAMMA: number = calibration.devig.gammaGlobal;

type DisciplineName = RaceAnalysis["discipline"];
type BlendCoefficients = { alpha: number; beta: number };

/**
 * ÉTAGE 2 — mélange de Benter, p ∝ exp(α·log p_marché + β·log p_IA), α et β
 * par discipline, logit conditionnel ajusté avant le 16/09, testé après :
 *
 *                β ajusté        log loss validation   gain du mélange (IC 95 %)
 *     Plat      0,077 ± 0,150    1,9229 → 1,9253       −0,0024 [−0,0058 ; +0,0010]
 *     Trot      0,012 ± 0,071    2,0356 → 2,0356       +0,0000 [−0,0008 ; +0,0008]
 *     Obstacle −0,220 ± 0,261    1,8525 → 1,8763       −0,0238 [−0,0447 ; −0,0024]
 *
 * β n'est significatif nulle part et n'améliore la validation nulle part : il
 * est donc fixé à 0, et la probabilité servie EST le marché recalibré
 * (α ≈ 1). Le modèle fondamental reste affiché à part (« avis IA », écart
 * IA / marché), sans prétendre corriger la cote.
 *
 * Limite : les cotes de ces données sont les DERNIÈRES (≈ finales). Contre des
 * cotes anciennes (3 h 30 d'âge médian, scripts/backtest.ts), l'IA apportait
 * +0,5 % de log loss ; avec le rafraîchissement continu, la cote servie se
 * rapproche de la finale et ce gain disparaît. Relancer l'ajustement sur les
 * cotes de décision quand elles seront exportables.
 */
export const BLEND_COEFFICIENTS: Record<DisciplineName, BlendCoefficients> = {
  Plat: { alpha: calibration.blend.Plat.alpha, beta: calibration.blend.Plat.beta },
  Trot: { alpha: calibration.blend.Trot.alpha, beta: calibration.blend.Trot.beta },
  Obstacle: { alpha: calibration.blend.Obstacle.alpha, beta: calibration.blend.Obstacle.beta },
};

/** Discipline inconnue : marché recalibré tel quel. */
export const DEFAULT_BLEND: BlendCoefficients = { alpha: 1, beta: 0 };

/**
 * ÉTAGE 3 — ordre d'arrivée. Harville tire chaque place avec la probabilité de
 * victoire et surestime les favoris aux places. Forces p^λ2 pour la 2e place,
 * p^λ3 pour les suivantes, ajustées sur les 2e et 3e réels (avant le 16/09) :
 *
 *     λ2 = 0,774 ± 0,039     λ3 = 0,526 ± 0,037
 *
 * Validation, réel / attendu d'une place dans les 3 premiers :
 *
 *     cote       1-3    3-5    5-10   10-20  20-50  50+
 *     Harville   0,87   0,88   0,94   1,07   1,40   1,65
 *     Henery     0,99   1,01   1,00   1,00   1,04   0,86
 *
 * Log loss de l'ordre 1-2-3 exact : 6,167 (Harville) → 6,079 (Henery).
 */
export const PLACE_LAMBDAS: readonly number[] = calibration.henery.lambdas;

/**
 * Ancien poids géométrique du modèle, p ∝ marché^(1−w) · modèle^w.
 *
 * Conservé pour scripts/backtest.ts, qui balaie plusieurs poids et compare au
 * servi : la valeur équivalente au mélange retenu (β = 0) est 0. L'ancienne
 * valeur 0,10 coûtait du log loss sur toutes les mesures contre la cote
 * finale (1,7576 contre 1,7514 sur 6 557 courses ; 30/08/2026).
 */
export const MODEL_WEIGHT = 0;

/**
 * Version de la chaîne de calcul servie, gravée dans chaque pronostic gelé
 * (`prediction_snapshots.model_version`). À changer dès que la calibration,
 * les entrées du modèle ou les règles de profil changent : le suivi de
 * performance sépare les résultats par version.
 */
export const MODEL_VERSION = "2026.10-marche-gamma-henery";

/**
 * Étalement du modèle, appliqué sur des scores centrés-réduits.
 * Travailler en z-score rend le réglage indépendant de l'amplitude brute des
 * kzScore — c'est précisément ce qui manquait à l'ancienne constante
 * `PL_TEMPERATURE = 10`, qui écrasait un écart réel de 23 points à 2,3 en
 * espace logit, sous un bruit de Gumbel d'écart-type 1,28.
 */
export const MODEL_SPREAD = 1.0;

/** Tirages Monte-Carlo par course. 20 000 → erreur type ≈ 0,3 pp sur le Top 3. */
const N_SIM = 20000;


/** Cheval dont les champs de calibration sont garantis présents. */
export type CalibratedHorse = HorsePrediction & Required<Pick<HorsePrediction, "marketProbability" | "valueRatio">>;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const round1 = (v: number) => Math.round(v * 10) / 10;
const round2 = (v: number) => Number(v.toFixed(2));

/**
 * Probabilités implicites du marché, marge retirée par l'exposant calibré
 * (p_i ∝ (1/cote_i)^γ, voir MARKET_GAMMA) puis, si la discipline est connue,
 * recalibrées par son α (étage 2 avec β = 0). Signature historique conservée :
 * `devig(cotes)` sert aussi scripts/backtest.ts et evaluate-confrontation.ts.
 *
 * Une cote absente ou ≤ 1 est une information manquante. Elle recevait la
 * probabilité MOYENNE du peloton : un cheval sans cote — le plus souvent un
 * non-partant ou un cheval que le marché ignore — pouvait ainsi finir deuxième
 * de la sélection. Il reçoit la plus PETITE probabilité implicite connue de la
 * course : sans prix, il n'est pas un prétendant.
 */
export function devig(odds: number[], discipline?: DisciplineName): number[] {
  const filled = fillMissingImplied(odds);
  if (!filled) return odds.map(() => 1 / Math.max(odds.length, 1));
  const market = exponentDevig(filled, MARKET_GAMMA);
  const alpha = discipline ? BLEND_COEFFICIENTS[discipline]?.alpha ?? 1 : 1;
  return alpha === 1 ? market : normalize(market.map((p) => (p > 0 ? p ** alpha : 0)));
}

/**
 * Probabilités que le PUBLIC prête aux chevaux : retrait proportionnel de la
 * marge, sans recalibrage. C'est sur elles que se forment les rapports des
 * paris combinés (voir src/lib/bet-recommendations.ts).
 */
export function publicProbabilities(odds: number[]): number[] {
  const filled = fillMissingImplied(odds);
  return filled ? proportionalDevig(filled) : odds.map(() => 1 / Math.max(odds.length, 1));
}

function fillMissingImplied(odds: number[]): number[] | null {
  const raw = impliedFromOdds(odds);
  const known = raw.filter((r) => r > 0);
  if (known.length === 0) return null;
  const minKnown = Math.min(...known);
  return raw.map((r) => (r > 0 ? r : minKnown));
}

/**
 * Graine déterministe dérivée du vecteur de probabilités.
 *
 * La graine ne dépendait que du nombre de partants : toutes les courses à 16
 * chevaux partageaient la même suite pseudo-aléatoire, donc des erreurs de
 * Monte-Carlo corrélées d'une course à l'autre. Le contenu du vecteur entre
 * maintenant dans la graine, en arithmétique 32 bits pour rester exact.
 */
function seedFrom(pWin: number[], salt: number): number {
  let seed = (salt + pWin.length * 2654435761) >>> 0;
  for (let i = 0; i < pWin.length; i++) {
    seed = (seed ^ Math.round((Number.isFinite(pWin[i]) ? pWin[i] : 0) * 1e6)) >>> 0;
    seed = Math.imul(seed, 1664525) + 1013904223;
    seed >>>= 0;
  }
  return seed;
}

/** Softmax sur scores centrés-réduits — l'échelle ne dépend plus de l'amplitude brute. */
export function modelProbabilities(scores: number[], spread = MODEL_SPREAD): number[] {
  const n = scores.length;
  if (n === 0) return [];

  // Un score manquant (kz_score NULL en base → NaN) doit valoir la moyenne du
  // peloton, pas zéro : le remplacer par 0 revenait à décréter le cheval pire
  // que tous les autres, ce qui écrasait sa probabilité à près de rien alors
  // que la seule information dont on dispose est l'absence d'information.
  const known = scores.filter((s): s is number => Number.isFinite(s));
  if (known.length === 0) return scores.map(() => 1 / n);
  const knownMean = known.reduce((a, b) => a + b, 0) / known.length;
  const usable = scores.map((s) => (Number.isFinite(s) ? s : knownMean));

  const mean = usable.reduce((a, b) => a + b, 0) / n;
  const variance = usable.reduce((a, s) => a + (s - mean) ** 2, 0) / n;
  const sd = Math.sqrt(variance);
  // Peloton homogène (ou score unique) : aucune information à extraire.
  if (sd < 1e-9) return usable.map(() => 1 / n);

  const logits = usable.map((s) => (spread * (s - mean)) / sd);
  const max = Math.max(...logits);
  const exps = logits.map((l) => Math.exp(l - max));
  const total = exps.reduce((a, b) => a + b, 0);
  return exps.map((e) => e / total);
}

/**
 * Mélange marché × modèle, renormalisé.
 *
 *   - avec des coefficients { alpha, beta } : mélange de Benter ajusté,
 *     p ∝ exp(α·log p_marché + β·log p_modèle) — c'est le mélange servi ;
 *   - avec un nombre w (ancienne API, scripts/backtest.ts) : mélange
 *     géométrique p ∝ marché^(1−w) · modèle^w, cas particulier α = 1−w, β = w.
 */
export function blendProbabilities(
  market: number[],
  model: number[],
  weight: number | BlendCoefficients = MODEL_WEIGHT,
): number[] {
  const { alpha, beta } = typeof weight === "number" ? { alpha: 1 - weight, beta: weight } : weight;
  if (beta === 0 && alpha === 1) return market;
  const features = market.map((m, i) => [safeLog(m), safeLog(model[i] ?? 0)]);
  const blended = conditionalLogit(features, [alpha, beta]);
  return blended.every(Number.isFinite) ? blended : market;
}

/** Options du modèle d'ordre d'arrivée. */
export type OrderModelOptions = {
  /** Exposants de Henery pour la 2e place puis les suivantes ; [1, 1] = Harville. */
  lambdas?: readonly number[];
  /** Graine imposée : deux simulations de même graine partagent leurs tirages (variance réduite des rapports). */
  seed?: number;
};

/**
 * Tire des ordres d'arrivée partiels selon Plackett-Luce corrigé de
 * Henery/Stern : la 1re place est tirée avec p, la 2e avec p^λ2, les suivantes
 * avec p^λ3 (PLACE_LAMBDAS). `visit(pos, cheval)` reçoit chaque place tirée.
 */
function sampleOrders(
  pWin: number[],
  depth: number,
  nSim: number,
  seed: number,
  lambdas: readonly number[],
  visit: (sim: number, pos: number, horse: number) => void,
) {
  const n = pWin.length;
  const strengths = placeStrengths(pWin, lambdas, Math.max(depth, 1));
  let state = seed >>> 0;
  const rand = () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
  const idx = new Array<number>(n);
  for (let sim = 0; sim < nSim; sim++) {
    for (let i = 0; i < n; i++) idx[i] = i;
    let remaining = n;
    for (let pos = 0; pos < depth && remaining > 0; pos++) {
      const row = strengths[pos];
      let total = 0;
      for (let j = 0; j < remaining; j++) total += row[idx[j]];
      if (!(total > 0)) break;
      const target = rand() * total;
      let acc = 0;
      let picked = remaining - 1;
      for (let j = 0; j < remaining; j++) {
        acc += row[idx[j]];
        if (acc >= target) {
          picked = j;
          break;
        }
      }
      visit(sim, pos, idx[picked]);
      idx[picked] = idx[remaining - 1];
      remaining--;
    }
  }
}

/**
 * Probabilités Top-K par échantillonnage (modèle d'ordre de Henery/Stern).
 * Garantit Σ(topK) = K × 100 % et la monotonie p_win ≤ p_top3 ≤ p_top5.
 *
 * Le générateur est déterministe (LCG semé sur le vecteur de probabilités) :
 * deux rendus de la même course donnent le même chiffre, sinon l'affichage
 * bougerait à chaque rafraîchissement et deviendrait invérifiable.
 */
export function monteCarloTopK(
  pWin: number[],
  ks: number[],
  nSim = N_SIM,
  options: OrderModelOptions = {},
): Map<number, number[]> {
  const n = pWin.length;
  const result = new Map<number, number[]>();
  if (n === 0) return result;
  const counts = new Map(ks.map((k) => [k, new Array<number>(n).fill(0)]));
  const seed = options.seed ?? seedFrom(pWin, 1013904223);
  sampleOrders(pWin, Math.max(...ks), nSim, seed, options.lambdas ?? PLACE_LAMBDAS, (_sim, pos, horse) => {
    for (const k of ks) if (pos < k) counts.get(k)![horse]++;
  });
  for (const k of ks) result.set(k, counts.get(k)!.map((c) => (c / nSim) * 100));
  return result;
}

/**
 * Tire `nSim` ordres d'arrivée partiels (les `depth` premières places) selon le
 * même modèle que `monteCarloTopK`. Chaque ligne contient les indices des
 * chevaux, dans l'ordre d'arrivée.
 *
 * Sert à estimer la probabilité qu'un ticket passe : il suffit de compter la
 * fraction des ordres simulés qui le satisfont. `depth` = 5 couvre tous les
 * paris PMU jusqu'au Quinté.
 */
export function simulateTopOrders(pWin: number[], depth = 5, nSim = 4000, options: OrderModelOptions = {}): number[][] {
  const n = pWin.length;
  if (n === 0) return [];
  const orders: number[][] = Array.from({ length: nSim }, () => []);
  const seed = options.seed ?? seedFrom(pWin, 2463534242);
  sampleOrders(pWin, Math.min(depth, n), nSim, seed, options.lambdas ?? PLACE_LAMBDAS, (sim, _pos, horse) => {
    orders[sim].push(horse);
  });
  return orders;
}

/** Graine d'une course, exposée pour partager les tirages entre deux simulations (variance réduite). */
export function orderSeed(pWin: number[]): number {
  return seedFrom(pWin, 2463534242);
}

/**
 * Probabilité (0-100) qu'un ticket passe, estimée sur des ordres simulés.
 *
 * @param picks   indices des chevaux joués
 * @param places  nombre de places à couvrir (1 = gagnant, 3 = trio…)
 * @param ordered true si l'ordre exact est exigé
 */
export function ticketProbability(orders: number[][], picks: number[], places: number, ordered: boolean): number {
  if (orders.length === 0 || picks.length === 0) return 0;

  let hits = 0;
  for (const order of orders) {
    const window = order.slice(0, places);
    if (window.length < places) continue;

    if (ordered) {
      // L'ordre exact exige que chaque cheval soit à sa position annoncée.
      let ok = picks.length <= window.length;
      for (let i = 0; ok && i < picks.length; i++) if (window[i] !== picks[i]) ok = false;
      if (ok) hits++;
    } else {
      // Sinon il suffit que tous les chevaux joués figurent dans la fenêtre.
      if (picks.every((p) => window.includes(p))) hits++;
    }
  }
  return (hits / orders.length) * 100;
}

/** Contexte facultatif d'une recalibration. */
export type CalibrationOptions = {
  /** Discipline de la course : choisit α et β du mélange ; absente → marché recalibré seul (α = 1, β = 0). */
  discipline?: DisciplineName;
  /** Minutes avant le départ, pour la cote finale attendue ; absentes → hypothèse la plus prudente. */
  minutesToStart?: number | null;
};

/**
 * Recalibre tout un peloton d'un coup et renvoie les chevaux enrichis.
 * Les champs `winProbability`, `top3Probability`, `top5Probability`,
 * `fairOdds`, `marketEdge` et `valueIndex` sont écrasés par des valeurs
 * cohérentes entre elles.
 *
 * `marketEdge` / `valueIndex` = espérance (%) d'un simple gagnant à la cote
 * FINALE attendue (src/lib/value-signal.ts), pas à la cote affichée : sans
 * délai connu, toute l'espérance apparente est supposée rattrapée.
 *
 * L'ordre du tableau d'entrée est préservé — le tri relève de l'appelant.
 */
export function calibrateField(horses: HorsePrediction[], options: CalibrationOptions = {}): CalibratedHorse[] {
  if (horses.length === 0) return [];

  // Peloton d'un seul partant : la normalisation n'a pas de sens.
  if (horses.length === 1) {
    const h = horses[0];
    return [{ ...h, marketProbability: 100, valueRatio: 1, winProbability: 100, top3Probability: 100, top5Probability: 100 }];
  }

  const market = devig(horses.map((h) => h.odds));
  // Le modèle fondamental (sans cote) remplace le PronoScore dès qu'il est
  // disponible : le PronoScore étant dérivé des cotes, le mélanger au marché
  // revenait à mélanger le marché avec lui-même. Repli sur l'ancien score pour
  // une discipline sans modèle ajusté.
  const fundamental = horses.map((h) => Number(h.fundamentalProbability));
  const hasFundamental = fundamental.every((p) => Number.isFinite(p) && p > 0);
  const model = hasFundamental ? fundamental.map((p) => p / 100) : modelProbabilities(horses.map((h) => h.kzScore));
  // Aucune cote publiée : le « marché » n'est qu'une répartition uniforme, et
  // le mélanger écrasait l'IA — 30 % devenait 11,6 % sur 10 partants — alors
  // que la page annonce un classement « sur l'IA seule ».
  const noMarket = horses.every((h) => !(Number.isFinite(h.odds) && h.odds > 1));
  // Le mélange n'a été ajusté qu'avec le modèle fondamental : sans lui, β = 0.
  const coefficients = (options.discipline && BLEND_COEFFICIENTS[options.discipline]) || DEFAULT_BLEND;
  const pWin = noMarket
    ? model
    : blendProbabilities(market, model, hasFundamental ? coefficients : { alpha: coefficients.alpha, beta: 0 });

  const topK = monteCarloTopK(pWin, [3, 5]);
  const pTop3 = topK.get(3)!;
  const pTop5 = topK.get(5)!;

  return horses.map((horse, i) => {
    const win = pWin[i] * 100;
    const marketPct = market[i] * 100;
    const ratio = marketPct > 0 ? win / marketPct : 1;

    // Cote juste = inverse de la probabilité retenue.
    const fairOdds = win > 0 ? 100 / win : horse.odds;
    // Espérance d'un enjeu unitaire à la cote finale attendue, en %.
    const edge = expectedValueAtStart(horse.odds, options.minutesToStart, win) ?? 0;

    return {
      ...horse,
      winProbability: round1(win),
      // Top 3 / Top 5 ne peuvent pas descendre sous la proba gagnant.
      top3Probability: round1(Math.max(pTop3[i], win)),
      top5Probability: round1(Math.max(pTop5[i], pTop3[i], win)),
      fairOdds: round1(clamp(fairOdds, 1.01, 999)),
      marketEdge: round1(clamp(edge, -95, 400)),
      valueIndex: round1(clamp(edge, -95, 400)),
      marketProbability: round1(marketPct),
      valueRatio: round2(ratio),
    };
  });
}
