#!/usr/bin/env -S npx tsx
/**
 * Entraînement du modèle fondamental (sans cote) et mesure hors échantillon.
 *
 * Modèle : logit conditionnel par discipline — la probabilité d'un partant est
 * le softmax, sur le peloton, d'une combinaison linéaire de ses variables
 * (src/lib/fundamental/features.ts). C'est le modèle standard des courses
 * (Bolton & Chapman, 1986) : il compare les chevaux entre eux, course par course.
 *
 * Aucune fuite :
 *   - les statistiques jockey/entraîneur sont calculées au fil des dates,
 *     avec les seules courses ANTÉRIEURES au jour traité ;
 *   - le modèle est ajusté sur les courses avant `--cutoff` et mesuré après ;
 *   - le modèle publié est celui ajusté avant `--cutoff`, pour que le backtest
 *     de la période suivante reste hors échantillon.
 *
 * Écrit src/lib/fundamental/model.json et affiche le banc.
 *
 * Usage : npx tsx scripts/train-fundamental.ts [--cutoff 2026-06-01] [--dry-run]
 */

import { writeFileSync } from "node:fs";
import { FEATURE_NAMES, fieldFeatures, type Discipline } from "@/lib/fundamental/features";
import { loadDataset, loadLocalEnv } from "./lib/dataset";

type Sample = { race: string; date: string; discipline: Discipline; x: number[][]; winner: number; odds: Array<number | null> };

function arg(name: string, fallback: string) {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? fallback : process.argv[i + 1];
}

async function loadSamples(): Promise<Sample[]> {
  const races = await loadDataset(process.env.DATABASE_URL!);
  return races.map((r) => ({
    race: r.raceId,
    date: r.date,
    discipline: r.discipline,
    x: fieldFeatures(r.field, r.discipline),
    winner: r.winner,
    odds: r.field.map((h) => h.closingOdds),
  }));
}

type Fitted = { means: number[]; sds: number[]; coef: number[] };

function standardizer(samples: Sample[]) {
  const d = FEATURE_NAMES.length;
  const means = new Array(d).fill(0);
  const sds = new Array(d).fill(0);
  let n = 0;
  for (const s of samples) for (const x of s.x) { n++; x.forEach((v, j) => (means[j] += v)); }
  means.forEach((_, j) => (means[j] /= Math.max(n, 1)));
  for (const s of samples) for (const x of s.x) x.forEach((v, j) => (sds[j] += (v - means[j]) ** 2));
  sds.forEach((_, j) => (sds[j] = Math.sqrt(sds[j] / Math.max(n, 1)) || 1));
  return { means, sds };
}

function softmax(logits: number[]) {
  const max = Math.max(...logits);
  const e = logits.map((l) => Math.exp(l - max));
  const sum = e.reduce((a, b) => a + b, 0);
  return e.map((v) => v / sum);
}

function probs(sample: Sample, model: Fitted) {
  return softmax(sample.x.map((x) => x.reduce((acc, v, j) => acc + model.coef[j] * ((v - model.means[j]) / model.sds[j]), 0)));
}

/** Logit conditionnel, descente Adam en lot complet, pénalité L2. */
function fit(samples: Sample[], lambda = 0.002, iterations = 500): Fitted {
  const { means, sds } = standardizer(samples);
  const d = FEATURE_NAMES.length;
  const coef = new Array(d).fill(0);
  const m = new Array(d).fill(0);
  const v = new Array(d).fill(0);
  const z = samples.map((s) => s.x.map((x) => x.map((val, j) => (val - means[j]) / sds[j])));

  for (let t = 1; t <= iterations; t++) {
    const grad = coef.map((c) => 2 * lambda * c);
    for (let r = 0; r < samples.length; r++) {
      const p = softmax(z[r].map((x) => x.reduce((a, val, j) => a + coef[j] * val, 0)));
      for (let i = 0; i < p.length; i++) {
        const g = p[i] - (i === samples[r].winner ? 1 : 0);
        for (let j = 0; j < d; j++) grad[j] += (g * z[r][i][j]) / samples.length;
      }
    }
    for (let j = 0; j < d; j++) {
      m[j] = 0.9 * m[j] + 0.1 * grad[j];
      v[j] = 0.999 * v[j] + 0.001 * grad[j] ** 2;
      coef[j] -= (0.05 * (m[j] / (1 - 0.9 ** t))) / (Math.sqrt(v[j] / (1 - 0.999 ** t)) + 1e-8);
    }
  }
  return { means, sds, coef };
}

function devig(odds: Array<number | null>) {
  const raw = odds.map((o) => (o != null && o > 1 ? 1 / o : 0));
  const known = raw.filter((r) => r > 0);
  const floor = known.length ? Math.min(...known) : 1;
  const filled = raw.map((r) => (r > 0 ? r : floor));
  const total = filled.reduce((a, b) => a + b, 0);
  return filled.map((r) => r / total);
}

function blend(market: number[], model: number[], w: number) {
  const raw = market.map((p, i) => Math.max(p, 1e-9) ** (1 - w) * Math.max(model[i], 1e-9) ** w);
  const total = raw.reduce((a, b) => a + b, 0);
  return raw.map((r) => r / total);
}

function score(list: Array<{ p: number[]; winner: number }>) {
  let ll = 0;
  let top1 = 0;
  for (const { p, winner } of list) {
    ll += -Math.log(Math.max(p[winner], 1e-12));
    if (p.indexOf(Math.max(...p)) === winner) top1++;
  }
  return { logLoss: ll / list.length, top1: (100 * top1) / list.length, n: list.length };
}

async function main() {
  loadLocalEnv();
  const cutoff = arg("cutoff", "2026-06-01");
  const samples = await loadSamples();
  console.log(`${samples.length} courses chargées — ajustement avant le ${cutoff}, mesure après\n`);

  const output: Record<string, unknown> = {};
  const report: Record<string, unknown> = {};
  const weights = [0, 0.05, 0.1, 0.15, 0.2, 0.3];

  for (const discipline of ["Plat", "Trot", "Obstacle"] as Discipline[]) {
    const train = samples.filter((s) => s.discipline === discipline && s.date < cutoff);
    const test = samples.filter((s) => s.discipline === discipline && s.date >= cutoff && s.odds.some((o) => o != null && o > 1));
    if (train.length < 200 || test.length < 50) continue;

    const model = fit(train);
    const uniform = score(test.map((s) => ({ p: s.x.map(() => 1 / s.x.length), winner: s.winner })));
    const fundamental = score(test.map((s) => ({ p: probs(s, model), winner: s.winner })));
    const market = score(test.map((s) => ({ p: devig(s.odds), winner: s.winner })));
    const sweep = weights.map((w) => ({ w, ...score(test.map((s) => ({ p: blend(devig(s.odds), probs(s, model), w), winner: s.winner }))) }));
    const best = sweep.reduce((a, b) => (b.logLoss < a.logLoss ? b : a));

    console.log(`── ${discipline} : ${train.length} courses d'ajustement, ${test.length} de mesure`);
    console.log(`   hasard         logLoss ${uniform.logLoss.toFixed(4)}  gagnant trouvé ${uniform.top1.toFixed(1)} %`);
    console.log(`   fondamental    logLoss ${fundamental.logLoss.toFixed(4)}  gagnant trouvé ${fundamental.top1.toFixed(1)} %`);
    console.log(`   marché (clôt.) logLoss ${market.logLoss.toFixed(4)}  gagnant trouvé ${market.top1.toFixed(1)} %`);
    for (const s of sweep) console.log(`   mélange w=${s.w.toFixed(2)}  logLoss ${s.logLoss.toFixed(4)}  gagnant trouvé ${s.top1.toFixed(1)} %`);
    console.log(`   coefficients : ${FEATURE_NAMES.map((n, j) => `${n} ${model.coef[j] >= 0 ? "+" : ""}${model.coef[j].toFixed(3)}`).join(", ")}\n`);

    output[discipline] = { means: model.means.map((v) => +v.toFixed(5)), sds: model.sds.map((v) => +v.toFixed(5)), coef: model.coef.map((v) => +v.toFixed(5)) };
    report[discipline] = {
      trainRaces: train.length,
      testRaces: test.length,
      uniform,
      fundamental,
      marketClosing: market,
      blendSweep: sweep,
      bestBlendWeight: best.w,
    };
  }

  const file = {
    version: `fondamental-${cutoff}`,
    trainedAt: new Date().toISOString(),
    trainCutoff: cutoff,
    features: FEATURE_NAMES,
    disciplines: output,
    evaluation: report,
  };
  if (process.argv.includes("--dry-run")) return;
  writeFileSync("src/lib/fundamental/model.json", `${JSON.stringify(file, null, 2)}\n`);
  console.log("Écrit : src/lib/fundamental/model.json");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
