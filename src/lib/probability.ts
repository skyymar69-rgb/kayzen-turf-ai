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

/** Poids du modèle face au marché. 0 = on recopie le marché, 1 = modèle seul. */
export const MODEL_WEIGHT = 0.3;

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
  const usable = scores.map((s) => (Number.isFinite(s) ? s : 0));

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
