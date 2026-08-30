import type { HorsePrediction } from "@/lib/types";

/**
 * CALIBRATION DES PROBABILITÉS — source unique de vérité.
 *
 * Contexte : le script d'import calcule une probabilité par cheval de façon
 * isolée, sans normalisation à l'échelle de la course. Résultat en base :
 * Σ(win) ≈ 185 % et Σ(top3) ≈ 510 % au lieu de 100 % et 300 %. Le kzScore étant
 * dérivé de ces valeurs, il en hérite le biais.
 *
 * Ce module recalcule les probabilités au moment de la lecture, pour toute la
 * course d'un coup. Tout consommateur (page course, dashboard, tickets, API)
 * passe par ici, ce qui garantit qu'un même cheval affiche la même probabilité
 * partout.
 *
 * Méthode : le marché (cotes dé-viggées) sert d'ancrage, le modèle ne fait que
 * le corriger — mélange log-linéaire p ∝ p_marché^(1-w) · p_modèle^w. Les
 * probabilités Top 3 / Top 5 sont ensuite tirées du même vecteur par
 * échantillonnage Plackett-Luce, ce qui impose par construction
 * Σ(top3) = 300 %, Σ(top5) = 500 % et p_win ≤ p_top3 ≤ p_top5.
 */

/**
 * Poids du modèle face au marché. 0 = on recopie le marché, 1 = modèle seul.
 *
 * Valeur fixée par la mesure, pas par intuition. Évaluation sur 6 557 courses
 * réelles (scripts/evaluate-model.mjs) :
 *
 *     marché seul     logLoss 1.7514   Top1 36,8 %   Top3 70,8 %
 *     modèle seul     logLoss 2.0278   Top1 32,7 %   Top3 60,1 %
 *     w = 0.30        logLoss 1.7847   (-1,90 % vs marché)
 *     w = 0.10        logLoss 1.7576   (-0,36 %, dans le bruit)
 *
 * Le kzScore actuel dégrade la prédiction, de façon monotone : chaque part de
 * modèle ajoutée coûte de la précision. La raison est structurelle — il est
 * calculé à partir de probabilités elles-mêmes dérivées des cotes, il ré-encode
 * donc le marché en y ajoutant du bruit.
 *
 * 0.10 est retenu plutôt que 0 : statistiquement équivalent au marché, mais
 * conserve l'expression du modèle (donc la détection de value) sans coût de
 * précision mesurable. À remonter dès qu'une variable aura démontré un gain sur
 * le banc de mesure — et pas avant.
 *
 * Mesure du 30/08/2026 (scripts/evaluate-weight-by-field.mjs, 7 552 courses) :
 * le modèle dégrade le log loss dans TOUTES les tranches de peloton, de 5-8
 * partants à 18 et plus. Il n'existe donc aucun segment où le relever se
 * justifierait, et la piste « poids variable selon la taille du peloton » est
 * close. Le coût du réglage actuel est mesuré : 0,11 cheval par Quinté
 * (2,41 contre 2,52 pour le marché seul, sur 56 Quintés).
 *
 * Passer à 0 rendrait la prédiction strictement meilleure, mais annulerait
 * `valueRatio` — donc la détection de value et le tocard signalé, qui n'ont
 * elles-mêmes aucune base mesurée. C'est un arbitrage produit, pas technique :
 * il n'est pas tranché ici.
 */
export const MODEL_WEIGHT = 0.1;

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

/** Au-delà de ce rapport modèle/marché, un cheval est considéré en value. */
export const VALUE_RATIO = 1.3;

/** Cote minimale pour qu'un cheval en value soit qualifiable de tocard. */
export const TOCARD_MIN_ODDS = 12;

/** Cheval dont les champs de calibration sont garantis présents. */
export type CalibratedHorse = HorsePrediction & Required<Pick<HorsePrediction, "marketProbability" | "valueRatio">>;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const round1 = (v: number) => Math.round(v * 10) / 10;
const round2 = (v: number) => Number(v.toFixed(2));

/**
 * Probabilités implicites du marché, overround retiré.
 * Une cote absente ou ≤ 1 est traitée comme une information manquante et reçoit
 * la probabilité moyenne du peloton plutôt que zéro.
 */
export function devig(odds: number[]): number[] {
  const raw = odds.map((o) => (Number.isFinite(o) && o > 1 ? 1 / o : 0));
  const known = raw.filter((r) => r > 0);
  if (known.length === 0) return odds.map(() => 1 / Math.max(odds.length, 1));

  const meanKnown = known.reduce((a, b) => a + b, 0) / known.length;
  const filled = raw.map((r) => (r > 0 ? r : meanKnown));
  const total = filled.reduce((a, b) => a + b, 0);
  return filled.map((r) => r / total);
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

/** Mélange log-linéaire marché × modèle, renormalisé. */
export function blendProbabilities(market: number[], model: number[], weight = MODEL_WEIGHT): number[] {
  const eps = 1e-9;
  const raw = market.map((m, i) => Math.max(m, eps) ** (1 - weight) * Math.max(model[i] ?? eps, eps) ** weight);
  const total = raw.reduce((a, b) => a + b, 0);
  return total > 0 ? raw.map((r) => r / total) : market;
}

/**
 * Probabilités Top-K par échantillonnage Plackett-Luce (tirage sans remise
 * pondéré par p_win). Garantit Σ(topK) = K × 100 % et la monotonie
 * p_win ≤ p_top3 ≤ p_top5.
 *
 * Le générateur est déterministe (LCG semé sur la taille du peloton) : deux
 * rendus de la même course donnent le même chiffre, sinon l'affichage bougerait
 * à chaque rafraîchissement et deviendrait invérifiable.
 */
export function monteCarloTopK(pWin: number[], ks: number[], nSim = N_SIM): Map<number, number[]> {
  const n = pWin.length;
  const result = new Map<number, number[]>();
  if (n === 0) return result;

  const maxK = Math.max(...ks);
  const counts = new Map(ks.map((k) => [k, new Array<number>(n).fill(0)]));

  let seed = 1013904223 + n * 2654435761;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };

  const idx = new Array<number>(n);
  const weights = new Array<number>(n);

  for (let sim = 0; sim < nSim; sim++) {
    for (let i = 0; i < n; i++) {
      idx[i] = i;
      weights[i] = pWin[i];
    }
    let remaining = n;
    let total = weights.reduce((a, b) => a + b, 0);

    for (let pos = 0; pos < maxK && remaining > 0 && total > 0; pos++) {
      const target = rand() * total;
      let acc = 0;
      let picked = remaining - 1;
      for (let j = 0; j < remaining; j++) {
        acc += weights[j];
        if (acc >= target) {
          picked = j;
          break;
        }
      }
      const horse = idx[picked];
      for (const k of ks) if (pos < k) counts.get(k)![horse]++;

      total -= weights[picked];
      idx[picked] = idx[remaining - 1];
      weights[picked] = weights[remaining - 1];
      remaining--;
    }
  }

  for (const k of ks) result.set(k, counts.get(k)!.map((c) => (c / nSim) * 100));
  return result;
}

/**
 * Tire `nSim` ordres d'arrivée partiels (les `depth` premières places) selon le
 * même modèle Plackett-Luce que `monteCarloTopK`. Chaque ligne contient les
 * indices des chevaux, dans l'ordre d'arrivée.
 *
 * Sert à estimer la probabilité qu'un ticket passe : il suffit de compter la
 * fraction des ordres simulés qui le satisfont. C'est la seule façon d'obtenir
 * une confiance qui discrimine un Simple Gagnant d'un Trio dans l'ordre, là où
 * une moyenne de scores les rendait tous équivalents.
 *
 * `depth` = 5 couvre tous les paris PMU jusqu'au Quinté.
 */
export function simulateTopOrders(pWin: number[], depth = 5, nSim = 4000): number[][] {
  const n = pWin.length;
  if (n === 0) return [];
  const realDepth = Math.min(depth, n);

  let seed = 2463534242 + n * 40503;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };

  const orders: number[][] = new Array(nSim);
  const idx = new Array<number>(n);
  const weights = new Array<number>(n);

  for (let sim = 0; sim < nSim; sim++) {
    for (let i = 0; i < n; i++) {
      idx[i] = i;
      weights[i] = pWin[i];
    }
    let remaining = n;
    let total = weights.reduce((a, b) => a + b, 0);
    const order: number[] = [];

    for (let pos = 0; pos < realDepth && remaining > 0 && total > 0; pos++) {
      const target = rand() * total;
      let acc = 0;
      let picked = remaining - 1;
      for (let j = 0; j < remaining; j++) {
        acc += weights[j];
        if (acc >= target) {
          picked = j;
          break;
        }
      }
      order.push(idx[picked]);
      total -= weights[picked];
      idx[picked] = idx[remaining - 1];
      weights[picked] = weights[remaining - 1];
      remaining--;
    }
    orders[sim] = order;
  }

  return orders;
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

/**
 * Recalibre tout un peloton d'un coup et renvoie les chevaux enrichis.
 * Les champs `winProbability`, `top3Probability`, `top5Probability`,
 * `fairOdds`, `marketEdge` et `valueIndex` sont écrasés par des valeurs
 * cohérentes entre elles.
 *
 * L'ordre du tableau d'entrée est préservé — le tri relève de l'appelant.
 */
export function calibrateField(horses: HorsePrediction[]): CalibratedHorse[] {
  if (horses.length === 0) return [];

  // Peloton d'un seul partant : la normalisation n'a pas de sens.
  if (horses.length === 1) {
    const h = horses[0];
    return [{ ...h, marketProbability: 100, valueRatio: 1, winProbability: 100, top3Probability: 100, top5Probability: 100 }];
  }

  const market = devig(horses.map((h) => h.odds));
  const model = modelProbabilities(horses.map((h) => h.kzScore));
  const pWin = blendProbabilities(market, model);

  const topK = monteCarloTopK(pWin, [3, 5]);
  const pTop3 = topK.get(3)!;
  const pTop5 = topK.get(5)!;

  return horses.map((horse, i) => {
    const win = pWin[i] * 100;
    const marketPct = market[i] * 100;
    const ratio = marketPct > 0 ? win / marketPct : 1;

    // Cote juste = inverse de la probabilité retenue.
    const fairOdds = win > 0 ? 100 / win : horse.odds;
    // Edge = espérance d'un enjeu unitaire à la cote proposée, en %.
    // Plus de plafond artificiel à +95 % : la valeur reste lisible et comparable.
    const edge = horse.odds > 1 ? horse.odds * (win / 100) * 100 - 100 : 0;

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
