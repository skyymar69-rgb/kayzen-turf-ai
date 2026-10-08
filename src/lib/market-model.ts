/**
 * OUTILS MATHÉMATIQUES DU MARCHÉ — partagés par l'application
 * (src/lib/probability.ts) et par le script d'ajustement
 * (scripts/fit-market.ts), pour que la formule servie soit exactement celle
 * qui a été mesurée.
 *
 * Aucune dépendance, aucun état : uniquement des fonctions pures.
 */

const EPS = 1e-12;

/** Inverse des cotes connues (cote absente ou ≤ 1 → 0). */
export function impliedFromOdds(odds: number[]): number[] {
  return odds.map((o) => (Number.isFinite(o) && o > 1 ? 1 / o : 0));
}

/** Normalise un vecteur positif pour que sa somme vaille 1. */
export function normalize(values: number[]): number[] {
  const total = values.reduce((a, b) => a + b, 0);
  if (!(total > 0)) return values.map(() => 1 / Math.max(values.length, 1));
  return values.map((v) => v / total);
}

/** Retrait proportionnel de la marge : p_i = q_i / Σq. Biais favori-tocard non corrigé. */
export function proportionalDevig(implied: number[]): number[] {
  return normalize(implied);
}

/**
 * Méthode « puissance » : p_i = q_i^k, avec k résolu course par course pour
 * que Σ q_i^k = 1. Comme q_i < 1, élever à k > 1 réduit davantage les petites
 * probabilités que les grandes : la marge est prélevée surtout sur les tocards.
 */
export function powerDevig(implied: number[]): number[] {
  const known = implied.filter((q) => q > 0 && q < 1);
  if (known.length < 2) return normalize(implied);
  const sum = (k: number) => known.reduce((a, q) => a + q ** k, 0);
  // Σq^k est décroissante en k : bissection sur [0,05 ; 20].
  let lo = 0.05;
  let hi = 20;
  if (sum(hi) > 1 || sum(lo) < 1) return normalize(implied);
  for (let it = 0; it < 80; it++) {
    const mid = (lo + hi) / 2;
    if (sum(mid) > 1) lo = mid;
    else hi = mid;
  }
  const k = (lo + hi) / 2;
  return normalize(implied.map((q) => (q > 0 ? q ** k : 0)));
}

/**
 * Méthode de Shin (1993) : la marge est attribuée à une part z de parieurs
 * initiés. p_i = (√(z² + 4(1−z)·q_i²/Σq) − z) / (2(1−z)), z résolu pour Σp = 1.
 */
export function shinDevig(implied: number[]): number[] {
  const total = implied.reduce((a, b) => a + b, 0);
  if (!(total > 1)) return normalize(implied);
  const probs = (z: number) =>
    implied.map((q) => (q > 0 ? (Math.sqrt(z * z + (4 * (1 - z) * q * q) / total) - z) / (2 * (1 - z)) : 0));
  const sum = (z: number) => probs(z).reduce((a, b) => a + b, 0);
  let lo = 0;
  let hi = 0.999;
  if (sum(lo) <= 1) return normalize(implied);
  for (let it = 0; it < 80; it++) {
    const mid = (lo + hi) / 2;
    if (sum(mid) > 1) lo = mid;
    else hi = mid;
  }
  return normalize(probs((lo + hi) / 2));
}

/**
 * Exposant calibré : p_i ∝ q_i^γ, γ ajusté une fois pour toutes (par
 * discipline) au maximum de vraisemblance sur des arrivées réelles. γ = 1
 * redonne la méthode proportionnelle.
 */
export function exponentDevig(implied: number[], gamma: number): number[] {
  return normalize(implied.map((q) => (q > 0 ? q ** gamma : 0)));
}

/**
 * Logit conditionnel (Benter, 1994) : p_i ∝ exp(Σ_k θ_k · x_ik).
 * `features[i]` = variables du cheval i, `theta` = coefficients.
 */
export function conditionalLogit(features: number[][], theta: number[]): number[] {
  if (features.length === 0) return [];
  const scores = features.map((x) => x.reduce((a, v, k) => a + v * (theta[k] ?? 0), 0));
  const max = Math.max(...scores);
  return normalize(scores.map((s) => Math.exp(s - max)));
}

/** log borné, pour qu'une probabilité nulle ne produise pas −∞. */
export function safeLog(p: number): number {
  return Math.log(Math.max(p, EPS));
}

/**
 * Forces de tirage par place pour le modèle d'ordre d'arrivée.
 *
 * Harville (1973) tire chaque place avec les probabilités de victoire : il
 * surestime les favoris aux places d'honneur. Henery (1981) et Stern (1990)
 * ont montré qu'aplatir les forces pour les places suivantes (p^λ, λ < 1)
 * corrige ce biais. `lambdas[0]` vaut pour la 2e place, `lambdas[1]` pour la
 * 3e et toutes les suivantes. La 1re place utilise toujours p.
 */
export function placeStrengths(pWin: number[], lambdas: readonly number[], depth: number): number[][] {
  const rows: number[][] = [];
  for (let pos = 0; pos < depth; pos++) {
    if (pos === 0) {
      rows.push(pWin.map((p) => Math.max(p, 0)));
      continue;
    }
    const lambda = lambdas[Math.min(pos - 1, lambdas.length - 1)] ?? 1;
    rows.push(pWin.map((p) => (p > 0 ? p ** lambda : 0)));
  }
  return rows;
}

/**
 * Probabilité exacte d'un ordre partiel (les chevaux de `order` aux places
 * 1, 2, 3… dans cet ordre) sous le modèle de Henery/Stern.
 */
export function orderProbability(strengths: number[][], order: number[]): number {
  let prob = 1;
  const taken = new Set<number>();
  for (let pos = 0; pos < order.length; pos++) {
    const row = strengths[Math.min(pos, strengths.length - 1)];
    let total = 0;
    for (let j = 0; j < row.length; j++) if (!taken.has(j)) total += row[j];
    if (!(total > 0)) return 0;
    prob *= row[order[pos]] / total;
    taken.add(order[pos]);
  }
  return prob;
}

/**
 * Probabilité exacte d'être dans les 3 premiers, pour chaque cheval
 * (O(n³), utilisée par le script d'ajustement pour la calibration Top 3).
 */
export function exactTop3(pWin: number[], lambdas: readonly number[]): number[] {
  const n = pWin.length;
  const [s1, s2, s3] = placeStrengths(pWin, lambdas, 3);
  const t1 = s1.reduce((a, b) => a + b, 0);
  const t2 = s2.reduce((a, b) => a + b, 0);
  const t3 = s3.reduce((a, b) => a + b, 0);
  const out = new Array<number>(n).fill(0);
  for (let i = 0; i < n; i++) {
    const pi = s1[i] / t1;
    if (pi <= 0) continue;
    out[i] += pi;
    const rest2 = t2 - s2[i];
    for (let j = 0; j < n; j++) {
      if (j === i || rest2 <= 0) continue;
      const pij = pi * (s2[j] / rest2);
      if (pij <= 0) continue;
      out[j] += pij;
      const rest3 = t3 - s3[i] - s3[j];
      if (rest3 <= 0) continue;
      for (let k = 0; k < n; k++) {
        if (k === i || k === j) continue;
        out[k] += pij * (s3[k] / rest3);
      }
    }
  }
  return out;
}
