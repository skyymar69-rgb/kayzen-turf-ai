/**
 * LOGIT « ÉCLATÉ » (rank-ordered logit, Beggs, Cardell & Hausman 1981).
 *
 * Le logit conditionnel n'apprend que du gagnant : une course de 16 partants
 * ne fournit qu'une observation. L'arrivée en donne davantage : le 2e est le
 * « gagnant » de la course privée du 1er, le 3e celui de la course privée des
 * deux premiers. La vraisemblance de l'ordre d'arrivée est le produit de ces
 * étapes ; les étapes 2 et 3 sont pondérées (plus bruitées : un cheval battu
 * pour la gagne peut être ménagé), poids `stageWeights`.
 *
 * Objectif minimisé (moyenne par course, pénalité L2) :
 *   L(β) = (1/R) Σ_r Σ_k w_k · [ log Σ_{i∈S_rk} exp(β·z_i) − β·z_{o_rk} ] + λ‖β‖²
 * où S_rk est le peloton privé des k−1 premiers et o_rk le k-ième arrivé.
 * L est convexe : la méthode de Newton (avec recherche linéaire) converge en
 * une dizaine d'itérations, sans réglage de pas.
 */

export type RankedRace = {
  /** Variables centrées-réduites, ligne par partant : z[i * d + j]. */
  z: Float64Array;
  /** Nombre de partants. */
  n: number;
  /** Indices des premiers arrivés, dans l'ordre (1er, 2e, 3e). */
  order: number[];
};

export const DEFAULT_STAGE_WEIGHTS = [1, 0.5, 0.25];

function stageCount(race: RankedRace, stageWeights: readonly number[]) {
  return Math.min(race.order.length, stageWeights.length, race.n - 1);
}

/** Valeur, gradient et (optionnellement) hessienne de L en β. */
export function explodedObjective(
  races: readonly RankedRace[],
  d: number,
  beta: ArrayLike<number>,
  lambda: number,
  stageWeights: readonly number[] = DEFAULT_STAGE_WEIGHTS,
  withHessian = true,
): { loss: number; grad: Float64Array; hess: Float64Array | null } {
  const grad = new Float64Array(d);
  const hess = withHessian ? new Float64Array(d * d) : null;
  const zbar = new Float64Array(d);
  let loss = 0;
  const R = Math.max(races.length, 1);

  for (const race of races) {
    const { z, n } = race;
    const eta = new Float64Array(n);
    for (let i = 0; i < n; i++) {
      let s = 0;
      for (let j = 0; j < d; j++) s += beta[j] * z[i * d + j];
      eta[i] = s;
    }
    const removed = new Uint8Array(n);
    const stages = stageCount(race, stageWeights);
    for (let k = 0; k < stages; k++) {
      const w = stageWeights[k] / R;
      const chosen = race.order[k];
      let max = -Infinity;
      for (let i = 0; i < n; i++) if (!removed[i] && eta[i] > max) max = eta[i];
      let sum = 0;
      const p = new Float64Array(n);
      for (let i = 0; i < n; i++) {
        if (removed[i]) continue;
        p[i] = Math.exp(eta[i] - max);
        sum += p[i];
      }
      loss += w * (Math.log(sum) + max - eta[chosen]);
      zbar.fill(0);
      for (let i = 0; i < n; i++) {
        if (removed[i]) continue;
        p[i] /= sum;
        const pi = p[i];
        for (let j = 0; j < d; j++) zbar[j] += pi * z[i * d + j];
        if (hess) {
          for (let a = 0; a < d; a++) {
            const za = pi * z[i * d + a];
            if (za === 0) continue;
            for (let b = a; b < d; b++) hess[a * d + b] += w * za * z[i * d + b];
          }
        }
      }
      for (let j = 0; j < d; j++) grad[j] += w * (zbar[j] - z[chosen * d + j]);
      if (hess) {
        for (let a = 0; a < d; a++) {
          if (zbar[a] === 0) continue;
          for (let b = a; b < d; b++) hess[a * d + b] -= w * zbar[a] * zbar[b];
        }
      }
      removed[chosen] = 1;
    }
  }

  for (let j = 0; j < d; j++) {
    loss += lambda * beta[j] * beta[j];
    grad[j] += 2 * lambda * beta[j];
  }
  if (hess) {
    for (let a = 0; a < d; a++) {
      hess[a * d + a] += 2 * lambda + 1e-9;
      for (let b = 0; b < a; b++) hess[a * d + b] = hess[b * d + a];
    }
  }
  return { loss, grad, hess };
}

/** Résout H x = g (H symétrique définie positive) par Cholesky. */
export function choleskySolve(h: Float64Array, g: Float64Array, d: number): Float64Array {
  const L = new Float64Array(d * d);
  for (let i = 0; i < d; i++) {
    for (let j = 0; j <= i; j++) {
      let s = h[i * d + j];
      for (let k = 0; k < j; k++) s -= L[i * d + k] * L[j * d + k];
      if (i === j) L[i * d + i] = Math.sqrt(Math.max(s, 1e-12));
      else L[i * d + j] = s / L[j * d + j];
    }
  }
  const y = new Float64Array(d);
  for (let i = 0; i < d; i++) {
    let s = g[i];
    for (let k = 0; k < i; k++) s -= L[i * d + k] * y[k];
    y[i] = s / L[i * d + i];
  }
  const x = new Float64Array(d);
  for (let i = d - 1; i >= 0; i--) {
    let s = y[i];
    for (let k = i + 1; k < d; k++) s -= L[k * d + i] * x[k];
    x[i] = s / L[i * d + i];
  }
  return x;
}

/** Ajuste β par Newton amorti. `init` permet un démarrage à chaud. */
export function fitExplodedLogit(
  races: readonly RankedRace[],
  d: number,
  options: { lambda: number; stageWeights?: readonly number[]; maxIter?: number; tol?: number; init?: ArrayLike<number> } ,
): { beta: number[]; loss: number; iterations: number } {
  const stageWeights = options.stageWeights ?? DEFAULT_STAGE_WEIGHTS;
  const maxIter = options.maxIter ?? 30;
  const tol = options.tol ?? 1e-12;
  let beta = Float64Array.from(options.init ?? new Array(d).fill(0));
  let current = explodedObjective(races, d, beta, options.lambda, stageWeights, true);
  let it = 0;
  for (; it < maxIter; it++) {
    const step = choleskySolve(current.hess!, current.grad, d);
    let decrement = 0;
    for (let j = 0; j < d; j++) decrement += current.grad[j] * step[j];
    if (decrement / 2 < tol) break;
    let t = 1;
    let next = beta;
    let nextLoss = Infinity;
    for (let ls = 0; ls < 30; ls++) {
      next = beta.map((b, j) => b - t * step[j]);
      nextLoss = explodedObjective(races, d, next, options.lambda, stageWeights, false).loss;
      if (nextLoss <= current.loss - 0.25 * t * decrement) break;
      t /= 2;
    }
    if (!(nextLoss < current.loss)) break;
    beta = next;
    current = explodedObjective(races, d, beta, options.lambda, stageWeights, true);
  }
  return { beta: Array.from(beta), loss: current.loss, iterations: it };
}
