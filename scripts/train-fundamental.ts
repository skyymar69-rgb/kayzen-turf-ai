#!/usr/bin/env -S npx tsx
/**
 * Entraînement du modèle fondamental (sans cote) — format 2.
 *
 * Modèle : logit conditionnel par discipline, ajusté sur l'ordre d'arrivée des
 * TROIS premiers (logit « éclaté », scripts/lib/exploded-logit.ts) au lieu du
 * seul gagnant ; étapes 2 et 3 pondérées (`--stage-weights`, défaut 1,0.5,0.25).
 *
 * Protocole (aucune fuite) :
 *   - les variables d'un partant sont celles connues AVANT la course
 *     (scripts/lib/dataset.ts : jockey/entraîneur et historique reconstitués
 *     jour par jour) ;
 *   - VALIDATION GLISSANTE (walk-forward) mensuelle sur les `--folds` derniers
 *     mois AVANT `--cutoff` : pour chaque mois M, ajustement sur tout ce qui
 *     précède M, mesure sur M. Cette validation choisit
 *       1. la pénalité L2 λ (grille `--lambdas`) ;
 *       2. les groupes de variables : partant du groupe `base`, un groupe n'est
 *          gardé que s'il baisse le log loss gagnant hors échantillon d'au
 *          moins `--min-gain` (ablation imprimée) ;
 *   - le modèle publié est ajusté sur TOUTES les courses avant `--cutoff` ; les
 *     courses à partir de `--cutoff` restent un banc final jamais vu (comparé
 *     aux cotes de clôture et à l'ancien modèle), pour que le backtest de la
 *     période suivante reste hors échantillon.
 *
 * Écrit src/lib/fundamental/model.json (sauf `--dry-run`, qui n'imprime que le
 * rapport). Workflow : .github/workflows/train_model.yml (artefact).
 *
 * Usage : npx tsx scripts/train-fundamental.ts [--cutoff 2026-06-01] [--folds 4]
 *           [--lambdas 0.0003,0.001,0.003,0.01,0.03] [--stage-weights 1,0.5,0.25]
 *           [--min-gain 0.0005] [--out src/lib/fundamental/model.json] [--dry-run]
 */

import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  FEATURE_GROUPS,
  FEATURE_GROUP_NAMES,
  computeFeatures,
  featuresOfGroups,
  type Discipline,
  type FeatureGroup,
  type FeatureName,
} from "@/lib/fundamental/features";
import { loadModel, probabilitiesWith, type LoadedModel } from "@/lib/fundamental/model";
import { fitExplodedLogit, type RankedRace } from "./lib/exploded-logit";
import { loadDataset, loadLocalEnv, type DatasetRace } from "./lib/dataset";

const MODEL_PATH = "src/lib/fundamental/model.json";
const ALL_V2 = featuresOfGroups(FEATURE_GROUP_NAMES);

function arg(name: string, fallback: string) {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? fallback : process.argv[i + 1];
}
const numList = (s: string) => s.split(",").map(Number).filter((v) => Number.isFinite(v));

type Sample = {
  race: DatasetRace;
  /** Variables brutes (toutes celles du format 2), ligne par partant. */
  x: number[][];
  /** Indices des trois premiers, dans l'ordre d'arrivée. */
  order: number[];
  winner: number;
  odds: Array<number | null>;
  hasOdds: boolean;
};

function toSample(race: DatasetRace): Sample {
  const order = race.field
    .map((h, i) => ({ i, p: h.position }))
    .filter((o): o is { i: number; p: number } => o.p != null && o.p >= 1)
    .sort((a, b) => a.p - b.p || a.i - b.i)
    .slice(0, 3)
    .map((o) => o.i);
  const odds = race.field.map((h) => h.closingOdds);
  return {
    race,
    x: computeFeatures(race.field, race.discipline, ALL_V2, race.context),
    order,
    winner: race.winner,
    odds,
    hasOdds: odds.some((o) => o != null && o > 1),
  };
}

// ─── Ajustement sur un sous-ensemble de colonnes ─────────────────────────────

type Fitted = { features: FeatureName[]; means: number[]; sds: number[]; coef: number[] };

function standardizer(samples: Sample[], cols: number[]) {
  const d = cols.length;
  const means = new Array(d).fill(0);
  const sds = new Array(d).fill(0);
  let n = 0;
  for (const s of samples) for (const row of s.x) { n++; cols.forEach((c, j) => (means[j] += row[c])); }
  means.forEach((_, j) => (means[j] /= Math.max(n, 1)));
  for (const s of samples) for (const row of s.x) cols.forEach((c, j) => (sds[j] += (row[c] - means[j]) ** 2));
  sds.forEach((_, j) => (sds[j] = Math.sqrt(sds[j] / Math.max(n, 1))));
  return { means, sds };
}

function fit(samples: Sample[], names: FeatureName[], lambda: number, stageWeights: number[]): Fitted {
  const allCols = names.map((n) => ALL_V2.indexOf(n));
  const st = standardizer(samples, allCols);
  // Une variable constante sur l'ajustement (ex. corde au trot) n'apporte rien : retirée.
  const keep = allCols.map((_, j) => j).filter((j) => st.sds[j] > 1e-9);
  const features = keep.map((j) => names[j]);
  const cols = keep.map((j) => allCols[j]);
  const means = keep.map((j) => st.means[j]);
  const sds = keep.map((j) => st.sds[j]);
  const d = cols.length;
  const races: RankedRace[] = samples
    .filter((s) => s.order.length > 0)
    .map((s) => {
      const z = new Float64Array(s.x.length * d);
      s.x.forEach((row, i) => cols.forEach((c, j) => (z[i * d + j] = (row[c] - means[j]) / sds[j])));
      return { z, n: s.x.length, order: s.order };
    });
  const { beta } = fitExplodedLogit(races, d, { lambda, stageWeights });
  return { features, means, sds, coef: beta };
}

function probs(sample: Sample, model: Fitted) {
  const cols = model.features.map((n) => ALL_V2.indexOf(n));
  const logits = sample.x.map((row) => cols.reduce((acc, c, j) => acc + model.coef[j] * ((row[c] - model.means[j]) / model.sds[j]), 0));
  return softmax(logits);
}

function softmax(logits: number[]) {
  const max = Math.max(...logits);
  const e = logits.map((l) => Math.exp(l - max));
  const sum = e.reduce((a, b) => a + b, 0);
  return e.map((v) => v / sum);
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

type Score = { logLoss: number; top1: number; n: number };

function score(list: Array<{ p: number[]; winner: number }>): Score {
  let ll = 0;
  let top1 = 0;
  for (const { p, winner } of list) {
    ll += -Math.log(Math.max(p[winner], 1e-12));
    if (p.indexOf(Math.max(...p)) === winner) top1++;
  }
  const n = list.length;
  return { logLoss: n ? ll / n : NaN, top1: n ? (100 * top1) / n : NaN, n };
}

// ─── Validation glissante ─────────────────────────────────────────────────────

type Fold = { month: string; train: Sample[]; test: Sample[] };

function monthOf(date: string) {
  return date.slice(0, 7);
}

function makeFolds(samples: Sample[], count: number): Fold[] {
  const months = [...new Set(samples.map((s) => monthOf(s.race.date)))].sort();
  const folds: Fold[] = [];
  for (const month of months.slice(-count)) {
    const train = samples.filter((s) => monthOf(s.race.date) < month);
    const test = samples.filter((s) => monthOf(s.race.date) === month);
    if (train.length >= 200 && test.length >= 30) folds.push({ month, train, test });
  }
  return folds;
}

type FoldResult = { month: string; fundamental: Score; fundamentalOnOdds: Score; market: Score };

function walkForward(folds: Fold[], names: FeatureName[], lambda: number, stageWeights: number[]) {
  const results: FoldResult[] = [];
  let ll = 0;
  let n = 0;
  for (const fold of folds) {
    const model = fit(fold.train, names, lambda, stageWeights);
    const fundamental = score(fold.test.map((s) => ({ p: probs(s, model), winner: s.winner })));
    const withOdds = fold.test.filter((s) => s.hasOdds);
    results.push({
      month: fold.month,
      fundamental,
      fundamentalOnOdds: score(withOdds.map((s) => ({ p: probs(s, model), winner: s.winner }))),
      market: score(withOdds.map((s) => ({ p: devig(s.odds), winner: s.winner }))),
    });
    ll += fundamental.logLoss * fundamental.n;
    n += fundamental.n;
  }
  return { logLoss: n ? ll / n : Infinity, folds: results };
}

function chooseLambda(folds: Fold[], names: FeatureName[], lambdas: number[], stageWeights: number[], label: string) {
  let best = { lambda: lambdas[0], logLoss: Infinity };
  for (const lambda of lambdas) {
    const { logLoss } = walkForward(folds, names, lambda, stageWeights);
    console.log(`   λ=${lambda}  (${label})  logLoss glissant ${logLoss.toFixed(4)}`);
    if (logLoss < best.logLoss) best = { lambda, logLoss };
  }
  return best;
}

const f4 = (v: number) => (Number.isFinite(v) ? v.toFixed(4) : "—");

// ─── Programme ─────────────────────────────────────────────────────────────────

export type TrainingOptions = { cutoff: string; foldCount: number; lambdas: number[]; stageWeights: number[]; minGain: number };

/** Sélection, ajustement et banc final ; renvoie le contenu de model.json (format 2). */
export function runTraining(races: DatasetRace[], options: TrainingOptions, previous: LoadedModel | null) {
  const { cutoff, foldCount, lambdas, stageWeights, minGain } = options;
  const samples = races.map(toSample);
  console.log(`${samples.length} courses chargées — sélection par validation glissante avant le ${cutoff}, banc final après\n`);

  const disciplines: Record<string, unknown> = {};
  const evaluation: Record<string, unknown> = {};
  const validation: Record<string, unknown> = {};
  const weights = [0, 0.05, 0.1, 0.15, 0.2, 0.3];

  for (const discipline of ["Plat", "Trot", "Obstacle"] as Discipline[]) {
    const pre = samples.filter((s) => s.race.discipline === discipline && s.race.date < cutoff);
    const post = samples.filter((s) => s.race.discipline === discipline && s.race.date >= cutoff && s.hasOdds);
    const folds = makeFolds(pre, foldCount);
    console.log(`══ ${discipline} : ${pre.length} courses avant le ${cutoff}, ${post.length} après (avec cotes), ${folds.length} plis mensuels`);
    if (pre.length < 200 || folds.length === 0) {
      // Pas de quoi valider un nouveau modèle : on garde celui qui est publié.
      const kept = previous?.disciplines[discipline];
      if (kept) disciplines[discipline] = { features: kept.features, means: kept.means, sds: kept.sds, coef: kept.coef, carriedOver: previous?.version };
      console.log(`   données insuffisantes : ${kept ? "modèle publié conservé" : "discipline ignorée"}\n`);
      continue;
    }

    // 1. λ sur l'ensemble complet des variables.
    const full = featuresOfGroups(FEATURE_GROUP_NAMES);
    const lambda0 = chooseLambda(folds, full, lambdas, stageWeights, "toutes variables").lambda;

    // 2. Sélection avant des groupes (ablation).
    let groups: FeatureGroup[] = ["base"];
    let current = walkForward(folds, featuresOfGroups(groups), lambda0, stageWeights).logLoss;
    const ablation: Array<{ group: string; logLossWithout: number; logLossWith: number; gain: number; kept: boolean }> = [];
    console.log(`   ablation (λ=${lambda0}) — base seule : logLoss glissant ${f4(current)}`);
    for (const group of FEATURE_GROUP_NAMES.filter((g) => g !== "base")) {
      const candidate = walkForward(folds, featuresOfGroups([...groups, group]), lambda0, stageWeights).logLoss;
      const gain = current - candidate;
      const kept = gain >= minGain;
      ablation.push({ group, logLossWithout: current, logLossWith: candidate, gain, kept });
      console.log(`   + ${group.padEnd(10)} ${f4(current)} → ${f4(candidate)}  gain ${gain >= 0 ? "+" : ""}${f4(gain)}  ${kept ? "GARDÉ" : "rejeté"}`);
      if (kept) {
        groups = [...groups, group];
        current = candidate;
      }
    }

    // 3. λ final sur les groupes retenus.
    const names = featuresOfGroups(groups);
    const { lambda } = chooseLambda(folds, names, lambdas, stageWeights, `groupes ${groups.join("+")}`);
    const wf = walkForward(folds, names, lambda, stageWeights);
    console.log(`   plis mensuels (λ=${lambda}) :`);
    for (const f of wf.folds) {
      console.log(
        `     ${f.month}  fondamental ${f4(f.fundamental.logLoss)} (n=${f.fundamental.n})  | sur courses avec cotes : fondamental ${f4(f.fundamentalOnOdds.logLoss)}  marché ${f4(f.market.logLoss)} (n=${f.market.n})`,
      );
    }

    // 4. Modèle publié : toutes les courses avant le cutoff.
    const model = fit(pre, names, lambda, stageWeights);
    console.log(`   coefficients : ${model.features.map((n, j) => `${n} ${model.coef[j] >= 0 ? "+" : ""}${model.coef[j].toFixed(3)}`).join(", ")}`);

    // 5. Banc final après le cutoff.
    let holdout: Record<string, unknown> | null = null;
    if (post.length >= 50) {
      const uniform = score(post.map((s) => ({ p: s.x.map(() => 1 / s.x.length), winner: s.winner })));
      const fundamental = score(post.map((s) => ({ p: probs(s, model), winner: s.winner })));
      const market = score(post.map((s) => ({ p: devig(s.odds), winner: s.winner })));
      const prevModel = previous?.disciplines[discipline];
      const previousScore = prevModel
        ? score(post.map((s) => ({ p: probabilitiesWith(prevModel, s.race.field, discipline, s.race.context), winner: s.winner })))
        : null;
      const sweep = weights.map((w) => ({ w, ...score(post.map((s) => ({ p: blend(devig(s.odds), probs(s, model), w), winner: s.winner }))) }));
      const best = sweep.reduce((a, b) => (b.logLoss < a.logLoss ? b : a));
      const bySpecialty: Record<string, { fundamental: Score; market: Score }> = {};
      for (const spec of [...new Set(post.map((s) => s.race.specialty ?? "inconnue"))]) {
        const sub = post.filter((s) => (s.race.specialty ?? "inconnue") === spec);
        bySpecialty[spec] = {
          fundamental: score(sub.map((s) => ({ p: probs(s, model), winner: s.winner }))),
          market: score(sub.map((s) => ({ p: devig(s.odds), winner: s.winner }))),
        };
      }
      console.log(`   BANC FINAL (après ${cutoff}, ${post.length} courses) :`);
      console.log(`     hasard          logLoss ${f4(uniform.logLoss)}  gagnant trouvé ${uniform.top1.toFixed(1)} %`);
      if (previousScore) console.log(`     ancien modèle   logLoss ${f4(previousScore.logLoss)}  gagnant trouvé ${previousScore.top1.toFixed(1)} %`);
      console.log(`     fondamental v2  logLoss ${f4(fundamental.logLoss)}  gagnant trouvé ${fundamental.top1.toFixed(1)} %`);
      console.log(`     marché (clôt.)  logLoss ${f4(market.logLoss)}  gagnant trouvé ${market.top1.toFixed(1)} %`);
      for (const s of sweep) console.log(`     mélange w=${s.w.toFixed(2)}   logLoss ${f4(s.logLoss)}  gagnant trouvé ${s.top1.toFixed(1)} %`);
      for (const [spec, v] of Object.entries(bySpecialty)) {
        console.log(`     ${spec.padEnd(14)} fondamental ${f4(v.fundamental.logLoss)}  marché ${f4(v.market.logLoss)}  (n=${v.market.n})`);
      }
      holdout = {
        trainRaces: pre.length,
        testRaces: post.length,
        uniform,
        fundamental,
        marketClosing: market,
        previousModel: previousScore,
        blendSweep: sweep,
        bestBlendWeight: best.w,
        bySpecialty,
      };
    } else {
      console.log(`   banc final trop petit (${post.length} courses) : pas de mesure après ${cutoff}`);
    }
    console.log("");

    disciplines[discipline] = {
      features: model.features,
      groups,
      lambda,
      means: model.means.map((v) => +v.toFixed(5)),
      sds: model.sds.map((v) => +v.toFixed(5)),
      coef: model.coef.map((v) => +v.toFixed(5)),
    };
    // La page /methode lit `evaluation` : on n'y met que des bancs complets.
    if (holdout) evaluation[discipline] = holdout;
    validation[discipline] = { lambdaFullSet: lambda0, ablation, folds: wf.folds, walkForwardLogLoss: wf.logLoss };
  }

  return {
    formatVersion: 2,
    version: `fondamental-v2-${cutoff}`,
    trainedAt: new Date().toISOString(),
    trainCutoff: cutoff,
    objective: { type: "exploded-logit-top3", stageWeights },
    featureGroups: FEATURE_GROUPS,
    disciplines,
    evaluation,
    validation,
  };
}

async function main() {
  loadLocalEnv();
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL manquant");
  const options: TrainingOptions = {
    cutoff: arg("cutoff", "2026-06-01"),
    foldCount: Number(arg("folds", "4")),
    lambdas: numList(arg("lambdas", "0.0003,0.001,0.003,0.01,0.03")),
    stageWeights: numList(arg("stage-weights", "1,0.5,0.25")),
    minGain: Number(arg("min-gain", "0.0005")),
  };
  const out = arg("out", MODEL_PATH);
  const dryRun = process.argv.includes("--dry-run");

  // Modèle actuellement publié, pour le comparer sur le même banc final.
  let previous: LoadedModel | null = null;
  try {
    previous = loadModel(JSON.parse(readFileSync(MODEL_PATH, "utf8")));
  } catch (error) {
    console.warn("Modèle publié illisible, pas de comparaison :", error);
  }

  const races = await loadDataset(process.env.DATABASE_URL);
  const file = runTraining(races, options, previous);
  if (dryRun) {
    console.log("--dry-run : model.json non écrit.");
    return;
  }
  if (Object.keys(file.disciplines).length === 0) throw new Error("Aucune discipline entraînée : model.json conservé.");
  writeFileSync(out, `${JSON.stringify(file, null, 2)}\n`);
  console.log(`Écrit : ${out}`);
}

// Exécuté seulement en script (pas à l'import, ex. banc synthétique).
if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
