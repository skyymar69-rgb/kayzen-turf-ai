import modelFile from "@/lib/fundamental/model.json";
import {
  ALL_FEATURE_LABELS,
  computeFeatures,
  isFeatureName,
  type Discipline,
  type FeatureName,
  type FundamentalInput,
  type FundamentalRaceContext,
} from "@/lib/fundamental/features";

/**
 * MODÈLE FONDAMENTAL — probabilité de victoire estimée SANS la cote.
 *
 * Logit conditionnel ajusté par scripts/train-fundamental.ts sur les courses
 * antérieures à `trainCutoff`. C'est une seconde opinion indépendante, pas un
 * oracle : elle sert à repérer les désaccords avec le marché, dont le backtest
 * mesure la valeur réelle (page /track-record).
 *
 * Deux formats de model.json sont lus :
 *   - format 1 (historique) : une liste `features` commune aux disciplines,
 *     logit sur le gagnant seul ;
 *   - format 2 : `formatVersion: 2`, une liste `features` PAR discipline
 *     (groupes retenus par validation glissante), logit « éclaté » sur les
 *     trois premiers.
 * Dans les deux cas les variables calculées sont exactement celles que liste
 * le fichier, dans son ordre : un ancien modèle donne les mêmes probabilités
 * qu'avant l'ajout des nouvelles variables.
 */

type RawDisciplineModel = { features?: string[]; means: number[]; sds: number[]; coef: number[] };
type RawModelFile = {
  formatVersion?: number;
  version: string;
  trainCutoff: string;
  features?: string[];
  disciplines: Partial<Record<Discipline, RawDisciplineModel>>;
};

export type DisciplineModel = { features: FeatureName[]; means: number[]; sds: number[]; coef: number[] };
export type LoadedModel = { formatVersion: number; version: string; trainCutoff: string; disciplines: Partial<Record<Discipline, DisciplineModel>> };

/** Lit un model.json (format 1 ou 2) ; lève une erreur si une variable est inconnue ou si les tailles divergent. */
export function loadModel(raw: unknown): LoadedModel {
  const file = raw as RawModelFile;
  const disciplines: Partial<Record<Discipline, DisciplineModel>> = {};
  for (const [discipline, m] of Object.entries(file.disciplines ?? {}) as Array<[Discipline, RawDisciplineModel | undefined]>) {
    if (!m) continue;
    const names = m.features ?? file.features ?? [];
    const unknown = names.filter((n) => !isFeatureName(n));
    if (unknown.length) throw new Error(`model.json (${discipline}) : variables inconnues ${unknown.join(", ")}`);
    if (m.coef.length !== names.length || m.means.length !== names.length || m.sds.length !== names.length) {
      throw new Error(`model.json (${discipline}) : ${names.length} variables mais ${m.coef.length} coefficients`);
    }
    disciplines[discipline] = { features: names as FeatureName[], means: m.means, sds: m.sds, coef: m.coef };
  }
  return { formatVersion: file.formatVersion ?? 1, version: file.version, trainCutoff: file.trainCutoff, disciplines };
}

const MODEL = loadModel(modelFile);

export const FUNDAMENTAL_VERSION: string = MODEL.version;
export const FUNDAMENTAL_TRAIN_CUTOFF: string = MODEL.trainCutoff;
export const FUNDAMENTAL_FORMAT: number = MODEL.formatVersion;

/** Variables réellement utilisées par le modèle chargé, par discipline (pour l'affichage). */
export function fundamentalFeatureNames(discipline: Discipline): FeatureName[] {
  return MODEL.disciplines[discipline]?.features ?? [];
}

function softmax(logits: number[]) {
  const max = Math.max(...logits);
  const e = logits.map((l) => Math.exp(l - max));
  const sum = e.reduce((a, b) => a + b, 0);
  return e.map((v) => v / sum);
}

/** Probabilités d'un peloton pour un modèle donné (utilisé aussi par l'entraînement et les tests). */
export function probabilitiesWith(
  model: DisciplineModel,
  field: FundamentalInput[],
  discipline: Discipline,
  context?: FundamentalRaceContext | null,
): number[] {
  const x = computeFeatures(field, discipline, model.features, context);
  return softmax(x.map((row) => row.reduce((acc, v, j) => acc + model.coef[j] * ((v - model.means[j]) / model.sds[j]), 0)));
}

/**
 * Probabilités (0-1) du peloton, ou `null` si la discipline n'a pas de modèle.
 * `context` (spécialité, départ, distance…) est facultatif : à défaut, le
 * `raceContext` porté par les partants est utilisé.
 */
export function fundamentalProbabilities(
  field: FundamentalInput[],
  discipline: Discipline,
  context?: FundamentalRaceContext | null,
): number[] | null {
  const model = MODEL.disciplines[discipline];
  if (!model || field.length === 0) return null;
  return probabilitiesWith(model, field, discipline, context);
}

export type Contribution = { feature: FeatureName; label: string; value: number; contribution: number };

/**
 * Contribution de chaque variable au logit du cheval, RELATIVEMENT à la moyenne
 * du peloton. Une contribution positive pousse le cheval au-dessus de ses
 * adversaires. La somme des contributions d'un cheval est exactement l'écart de
 * son logit à la moyenne : c'est une décomposition, pas une illustration.
 */
export function fundamentalContributions(
  field: FundamentalInput[],
  discipline: Discipline,
  context?: FundamentalRaceContext | null,
): Contribution[][] | null {
  const model = MODEL.disciplines[discipline];
  if (!model || field.length === 0) return null;
  const x = computeFeatures(field, discipline, model.features, context);
  const means = model.features.map((_, j) => x.reduce((s, row) => s + row[j], 0) / x.length);
  return x.map((row) =>
    model.features.map((feature, j) => ({
      feature,
      label: ALL_FEATURE_LABELS[feature],
      value: row[j],
      contribution: (model.coef[j] * (row[j] - means[j])) / model.sds[j],
    })),
  );
}
