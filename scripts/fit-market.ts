#!/usr/bin/env -S npx tsx
/**
 * AJUSTEMENT DU MARCHÉ, DU MÉLANGE IA ET DU MODÈLE D'ORDRE D'ARRIVÉE.
 *
 * Trois questions, toutes tranchées par la vraisemblance d'arrivées réelles,
 * avec une séparation TEMPORELLE (ajustement avant --split, validation après) :
 *
 *   1. Retrait de la marge PMU : proportionnel, puissance (k par course),
 *      Shin, ou exposant γ calibré par discipline ?
 *   2. Mélange de Benter : p ∝ exp(α·log p_marché + β·log p_IA), α et β par
 *      discipline au maximum de vraisemblance (logit conditionnel). β n'est
 *      conservé que s'il est significatif sur l'ajustement ET s'il améliore
 *      le log loss de la validation (IC 95 % par bootstrap de courses).
 *   3. Biais de Harville aux places : forces p^λ2 (2e place) et p^λ3 (3e et
 *      suivantes), λ ajustés sur les 2e et 3e réels.
 *
 * Entrée : un JSON de partants { race, day, disc, number, odds, ai, fin }
 *   - odds : dernière cote PMU connue (≈ cote finale) ;
 *   - ai   : probabilité du modèle fondamental (fraction, Σ = 1 par course),
 *            recalculée SANS information postérieure à la course ;
 *   - fin  : place à l'arrivée (null = non classé).
 *
 * Usage : npx tsx scripts/fit-market.ts --file <clean.json> [--split 2026-09-16] [--write]
 *   --write enregistre les coefficients dans src/lib/market-calibration.json.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  conditionalLogit,
  exactTop3,
  exponentDevig,
  impliedFromOdds,
  orderProbability,
  placeStrengths,
  powerDevig,
  proportionalDevig,
  safeLog,
  shinDevig,
} from "../src/lib/market-model";

type Runner = { race: string; day: string; disc: string; number: number; odds: number; ai: number; fin: number | null };
type Race = { id: string; day: string; disc: string; runners: Runner[]; winner: number; second: number; third: number };
type Choice = { x: number[][]; y: number };
type DevigName = "proportionnel" | "puissance" | "shin" | "exposant" | "exposant-global";

const DISCIPLINES = ["Plat", "Trot", "Obstacle"] as const;
const BANDS: Array<[number, number]> = [[1, 3], [3, 5], [5, 10], [10, 20], [20, 50], [50, Infinity]];

function arg(name: string, fallback?: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? fallback : process.argv[i + 1];
}

// ── Chargement ─────────────────────────────────────────────────────────────

function loadRaces(file: string): Race[] {
  const rows = JSON.parse(readFileSync(file, "utf8")) as Runner[];
  const byRace = new Map<string, Runner[]>();
  for (const r of rows) byRace.set(r.race, [...(byRace.get(r.race) ?? []), r]);
  const races: Race[] = [];
  for (const [id, runners] of byRace) {
    if (runners.length < 2 || runners.some((r) => !(r.odds > 1))) continue;
    const at = (place: number) => {
      const hits = runners.flatMap((r, i) => (r.fin === place ? [i] : []));
      return hits.length === 1 ? hits[0] : -1; // ex aequo ou place absente : inutilisable
    };
    const winner = at(1);
    if (winner < 0) continue;
    races.push({ id, day: runners[0].day, disc: runners[0].disc, runners, winner, second: at(2), third: at(3) });
  }
  return races.sort((a, b) => a.day.localeCompare(b.day) || a.id.localeCompare(b.id));
}

// ── Logit conditionnel : Newton-Raphson ────────────────────────────────────

function solve(a: number[][], b: number[]): number[] {
  const n = b.length;
  const m = a.map((row, i) => [...row, b[i]]);
  for (let c = 0; c < n; c++) {
    let piv = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(m[r][c]) > Math.abs(m[piv][c])) piv = r;
    [m[c], m[piv]] = [m[piv], m[c]];
    for (let r = 0; r < n; r++) {
      if (r === c || m[c][c] === 0) continue;
      const f = m[r][c] / m[c][c];
      for (let k = c; k <= n; k++) m[r][k] -= f * m[c][k];
    }
  }
  return m.map((row, i) => row[n] / row[i]);
}

/** Diagonale de l'inverse de `a` (variances des coefficients). */
function inverseDiagonal(a: number[][]): number[] {
  return a.map((_, k) => solve(a, a.map((__, i) => (i === k ? 1 : 0)))[k]);
}

/** θ au maximum de vraisemblance et erreurs types (inverse de l'information de Fisher). */
function fitLogit(choices: Choice[], dim: number, start?: number[]): { theta: number[]; se: number[]; logLik: number } {
  let theta = start ?? new Array<number>(dim).fill(1);
  let hessian: number[][] = [];
  for (let it = 0; it < 50; it++) {
    const grad = new Array<number>(dim).fill(0);
    hessian = Array.from({ length: dim }, () => new Array<number>(dim).fill(0));
    for (const { x, y } of choices) {
      const p = conditionalLogit(x, theta);
      const mean = new Array<number>(dim).fill(0);
      p.forEach((pi, i) => x[i].forEach((v, k) => (mean[k] += pi * v)));
      for (let k = 0; k < dim; k++) grad[k] += x[y][k] - mean[k];
      p.forEach((pi, i) => {
        for (let k = 0; k < dim; k++)
          for (let l = 0; l < dim; l++) hessian[k][l] += pi * (x[i][k] - mean[k]) * (x[i][l] - mean[l]);
      });
    }
    const step = solve(hessian, grad);
    theta = theta.map((t, k) => t + step[k]);
    if (Math.max(...step.map(Math.abs)) < 1e-9) break;
  }
  const se = inverseDiagonal(hessian).map((v) => Math.sqrt(Math.max(v, 0)));
  const logLik = choices.reduce((a, { x, y }) => a + safeLog(conditionalLogit(x, theta)[y]), 0);
  return { theta, se, logLik };
}

// ── Mesures ────────────────────────────────────────────────────────────────

const logLoss = (races: Race[], probs: (r: Race) => number[]) =>
  races.reduce((a, r) => a - safeLog(probs(r)[r.winner]), 0) / Math.max(races.length, 1);

/** Gain de log loss (référence − candidat, > 0 = candidat meilleur), IC 95 % par bootstrap de courses. */
function pairedGain(races: Race[], ref: (r: Race) => number[], cand: (r: Race) => number[]) {
  const diffs = races.map((r) => -safeLog(ref(r)[r.winner]) + safeLog(cand(r)[r.winner]));
  const mean = diffs.reduce((a, b) => a + b, 0) / Math.max(diffs.length, 1);
  let seed = 12345;
  const rand = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
  const boots: number[] = [];
  for (let b = 0; b < 2000; b++) {
    let s = 0;
    for (let i = 0; i < diffs.length; i++) s += diffs[Math.floor(rand() * diffs.length)];
    boots.push(s / diffs.length);
  }
  boots.sort((a, b) => a - b);
  return { gain: mean, lo: boots[Math.floor(0.025 * boots.length)], hi: boots[Math.floor(0.975 * boots.length)] };
}

/** Réel / attendu par tranche de cote (A/E = 1 : calibration parfaite). */
function aeByBand(races: Race[], probs: (r: Race) => number[], hit: (r: Race, i: number) => boolean) {
  return BANDS.map(([lo, hi]) => {
    let expected = 0;
    let actual = 0;
    let n = 0;
    for (const r of races) {
      const p = probs(r);
      r.runners.forEach((h, i) => {
        if (h.odds < lo || h.odds >= hi) return;
        n++;
        expected += p[i];
        if (hit(r, i)) actual++;
      });
    }
    return { band: `${lo}-${hi === Infinity ? "+" : hi}`, n, actual, expected: round(expected, 1), ae: round(actual / Math.max(expected, 1e-9), 3) };
  });
}

const round = (v: number, d = 4) => Number(v.toFixed(d));

// ── Programme ──────────────────────────────────────────────────────────────

function main() {
  const file = arg("file");
  if (!file) throw new Error("Usage : npx tsx scripts/fit-market.ts --file <clean.json> [--split AAAA-MM-JJ] [--write]");
  const split = arg("split", "2026-09-16")!;
  const races = loadRaces(resolve(file));
  const fit = races.filter((r) => r.day < split);
  const val = races.filter((r) => r.day >= split);
  const days = [...new Set(races.map((r) => r.day))].sort();
  console.log(`Courses : ${races.length} (ajustement ${fit.length}, validation ${val.length}) — ${days[0]} → ${days.at(-1)}`);

  const implied = new Map(races.map((r) => [r.id, impliedFromOdds(r.runners.map((h) => h.odds))]));
  const q = (r: Race) => implied.get(r.id)!;
  const ofDisc = (list: Race[], d: string) => list.filter((r) => r.disc === d);

  // 1. Retrait de la marge ----------------------------------------------------
  const gamma: Record<string, number> = {};
  for (const d of DISCIPLINES) {
    const { theta, se } = fitLogit(ofDisc(fit, d).map((r) => ({ x: q(r).map((v) => [safeLog(v)]), y: r.winner })), 1);
    gamma[d] = round(theta[0]);
    console.log(`γ ${d} = ${theta[0].toFixed(3)} ± ${se[0].toFixed(3)}`);
  }
  const globalFit = fitLogit(fit.map((r) => ({ x: q(r).map((v) => [safeLog(v)]), y: r.winner })), 1);
  const gammaGlobal = round(globalFit.theta[0]);
  console.log(`γ toutes disciplines = ${globalFit.theta[0].toFixed(3)} ± ${globalFit.se[0].toFixed(3)}`);
  const devigs: Record<DevigName, (r: Race) => number[]> = {
    proportionnel: (r) => proportionalDevig(q(r)),
    puissance: (r) => powerDevig(q(r)),
    shin: (r) => shinDevig(q(r)),
    exposant: (r) => exponentDevig(q(r), gamma[r.disc] ?? 1),
    "exposant-global": (r) => exponentDevig(q(r), gammaGlobal),
  };
  const cache = new Map<string, number[]>();
  const memo = (name: string, f: (r: Race) => number[]) => (r: Race) => {
    const key = `${name}|${r.id}`;
    if (!cache.has(key)) cache.set(key, f(r));
    return cache.get(key)!;
  };
  const devigMemo = Object.fromEntries(Object.entries(devigs).map(([k, f]) => [k, memo(k, f)])) as typeof devigs;

  const devigReport = Object.fromEntries(
    (Object.keys(devigs) as DevigName[]).map((name) => [
      name,
      {
        logLossFit: round(logLoss(fit, devigMemo[name])),
        logLossValidation: round(logLoss(val, devigMemo[name])),
        gainVsProportional: (({ gain, lo, hi }) => ({ gain: round(gain, 5), lo: round(lo, 5), hi: round(hi, 5) }))(
          pairedGain(val, devigMemo.proportionnel, devigMemo[name]),
        ),
        byDiscipline: Object.fromEntries(DISCIPLINES.map((d) => [d, round(logLoss(ofDisc(val, d), devigMemo[name]))])),
      },
    ]),
  );
  console.table(Object.fromEntries(Object.entries(devigReport).map(([k, v]) => [k, { fit: v.logLossFit, validation: v.logLossValidation, gain: v.gainVsProportional.gain, ic95: `${v.gainVsProportional.lo} ; ${v.gainVsProportional.hi}`, ...v.byDiscipline }])));
  const best = (Object.keys(devigs) as DevigName[]).reduce((a, b) =>
    devigReport[b].logLossValidation < devigReport[a].logLossValidation ? b : a,
  );
  console.log(`Retrait retenu : ${best}`);
  const aeWin = Object.fromEntries(
    (["proportionnel", best] as DevigName[]).map((name) => [name, aeByBand(val, devigMemo[name], (r, i) => i === r.winner)]),
  );
  for (const [name, rows] of Object.entries(aeWin)) {
    console.log(`A/E gagnant (validation) — ${name}`);
    console.table(rows);
  }
  const market = devigMemo[best];

  // 2. Mélange de Benter ------------------------------------------------------
  const blendFeatures = (r: Race) => market(r).map((p, i) => [safeLog(p), safeLog(r.runners[i].ai)]);
  const blend: Record<string, { alpha: number; beta: number; betaFit: number; betaSe: number; kept: boolean; logLossMarket: number; logLossBlend: number; gain: number; gainLo: number; gainHi: number; nFit: number; nValidation: number }> = {};
  for (const d of DISCIPLINES) {
    const fitD = ofDisc(fit, d);
    const valD = ofDisc(val, d);
    const full = fitLogit(fitD.map((r) => ({ x: blendFeatures(r), y: r.winner })), 2);
    const marketOnly = fitLogit(fitD.map((r) => ({ x: market(r).map((p) => [safeLog(p)]), y: r.winner })), 1);
    const blended = (r: Race) => conditionalLogit(blendFeatures(r), full.theta);
    const recal = (r: Race) => conditionalLogit(market(r).map((p) => [safeLog(p)]), marketOnly.theta);
    const test = pairedGain(valD, recal, blended);
    const significantFit = full.theta[1] > 2 * full.se[1];
    const kept = significantFit && test.lo > 0;
    blend[d] = {
      alpha: round(kept ? full.theta[0] : marketOnly.theta[0]),
      beta: round(kept ? full.theta[1] : 0),
      betaFit: round(full.theta[1]),
      betaSe: round(full.se[1]),
      kept,
      logLossMarket: round(logLoss(valD, recal)),
      logLossBlend: round(logLoss(valD, blended)),
      gain: round(test.gain, 5),
      gainLo: round(test.lo, 5),
      gainHi: round(test.hi, 5),
      nFit: fitD.length,
      nValidation: valD.length,
    };
    console.log(
      `${d} : α=${full.theta[0].toFixed(3)} β=${full.theta[1].toFixed(3)} ± ${full.se[1].toFixed(3)} | marché seul α=${marketOnly.theta[0].toFixed(3)} | ` +
        `validation ${blend[d].logLossMarket} → ${blend[d].logLossBlend} (gain ${test.gain.toFixed(4)} [${test.lo.toFixed(4)} ; ${test.hi.toFixed(4)}]) → β ${kept ? "conservé" : "mis à 0"}`,
    );
  }
  const served = (r: Race) => {
    const c = blend[r.disc] ?? { alpha: 1, beta: 0 };
    return conditionalLogit(blendFeatures(r), [c.alpha, c.beta]);
  };
  const servedReport = {
    logLossValidation: round(logLoss(val, served)),
    logLossProportionalValidation: round(logLoss(val, devigMemo.proportionnel)),
    aeWin: aeByBand(val, served, (r, i) => i === r.winner),
  };
  console.log(`Probabilité servie — validation ${servedReport.logLossValidation} (proportionnel ${servedReport.logLossProportionalValidation})`);

  // 3. Henery / Stern ---------------------------------------------------------
  const placeChoices = (list: Race[], place: 2 | 3): Choice[] =>
    list.flatMap((r) => {
      const p = served(r);
      const target = place === 2 ? r.second : r.third;
      if (target < 0 || (place === 3 && r.second < 0)) return [];
      const excluded = place === 2 ? [r.winner] : [r.winner, r.second];
      const keep = p.map((_, i) => i).filter((i) => !excluded.includes(i));
      return [{ x: keep.map((i) => [safeLog(p[i])]), y: keep.indexOf(target) }];
    });
  const l2 = fitLogit(placeChoices(fit, 2), 1);
  const l3 = fitLogit(placeChoices(fit, 3), 1);
  const lambdas = [round(l2.theta[0], 3), round(l3.theta[0], 3)];
  console.log(`λ2 = ${l2.theta[0].toFixed(3)} ± ${l2.se[0].toFixed(3)} ; λ3 = ${l3.theta[0].toFixed(3)} ± ${l3.se[0].toFixed(3)}`);
  const lambdaByDisc = Object.fromEntries(
    DISCIPLINES.map((d) => [d, [round(fitLogit(placeChoices(ofDisc(fit, d), 2), 1).theta[0], 3), round(fitLogit(placeChoices(ofDisc(fit, d), 3), 1).theta[0], 3)]]),
  );
  console.log("λ par discipline (information) :", lambdaByDisc);

  const placeLogLik = (list: Race[], lam: number[]) => {
    let sum = 0;
    let n = 0;
    for (const r of list) {
      if (r.second < 0 || r.third < 0) continue;
      const s = placeStrengths(served(r), lam, 3);
      sum += safeLog(orderProbability(s, [r.winner, r.second, r.third]));
      n++;
    }
    return round(-sum / Math.max(n, 1));
  };
  const withThree = val.filter((r) => r.third >= 0 && r.runners.length >= 4);
  const top3Hit = (r: Race, i: number) => r.runners[i].fin != null && r.runners[i].fin! <= 3;
  const top3Memo = (lam: number[]) => memo(`top3|${lam.join(",")}`, (r) => exactTop3(served(r), lam));
  const henery = {
    lambdas,
    lambdaSe: [round(l2.se[0]), round(l3.se[0])],
    lambdaByDiscipline: lambdaByDisc,
    orderLogLossValidationHarville: placeLogLik(val, [1, 1]),
    orderLogLossValidationHenery: placeLogLik(val, lambdas),
    top3AeHarville: aeByBand(withThree, top3Memo([1, 1]), top3Hit),
    top3AeHenery: aeByBand(withThree, top3Memo(lambdas), top3Hit),
  };
  console.log(`Ordre 1-2-3, log loss validation : Harville ${henery.orderLogLossValidationHarville} → Henery ${henery.orderLogLossValidationHenery}`);
  console.log("A/E Top 3 (validation) — Harville");
  console.table(henery.top3AeHarville);
  console.log("A/E Top 3 (validation) — Henery");
  console.table(henery.top3AeHenery);

  const output = {
    generatedBy: "scripts/fit-market.ts",
    period: { from: days[0], to: days.at(-1), split, fitRaces: fit.length, validationRaces: val.length, runners: races.reduce((a, r) => a + r.runners.length, 0) },
    devig: { method: best, gamma: best === "exposant-global" ? Object.fromEntries(DISCIPLINES.map((d) => [d, gammaGlobal])) : best === "exposant" ? gamma : {}, gammaByDiscipline: gamma, gammaGlobal, gammaGlobalSe: round(globalFit.se[0]), comparison: devigReport, aeWinValidation: aeWin },
    blend,
    served: servedReport,
    henery,
  };
  if (process.argv.includes("--write")) {
    const target = resolve("src/lib/market-calibration.json");
    writeFileSync(target, `${JSON.stringify(output, null, 2)}\n`);
    console.log(`Écrit : ${target}`);
  }
}

main();
