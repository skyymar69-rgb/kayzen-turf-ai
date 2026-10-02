import modelFile from "@/lib/fundamental/model.json";
import { FEATURE_LABELS, FEATURE_NAMES, fieldFeatures, type Discipline, type FeatureName, type FundamentalInput } from "@/lib/fundamental/features";

/**
 * MODÈLE FONDAMENTAL — probabilité de victoire estimée SANS la cote.
 *
 * Logit conditionnel ajusté par scripts/train-fundamental.ts sur les courses
 * antérieures à `trainCutoff`. Mesure hors échantillon (juin-septembre 2026) :
 * il trouve le gagnant bien plus souvent que le hasard (trot : 25 % contre 5 %),
 * mais moins souvent que le marché (33 %), et le mélanger aux cotes de clôture
 * ne les améliore pas. C'est une seconde opinion indépendante, pas un oracle :
 * elle sert à repérer les désaccords avec le marché, dont le backtest mesure la
 * valeur réelle (page /track-record).
 */

type DisciplineModel = { means: number[]; sds: number[]; coef: number[] };
const MODELS = (modelFile as { disciplines: Partial<Record<Discipline, DisciplineModel>> }).disciplines;

export const FUNDAMENTAL_VERSION: string = (modelFile as { version: string }).version;
export const FUNDAMENTAL_TRAIN_CUTOFF: string = (modelFile as { trainCutoff: string }).trainCutoff;

function softmax(logits: number[]) {
  const max = Math.max(...logits);
  const e = logits.map((l) => Math.exp(l - max));
  const sum = e.reduce((a, b) => a + b, 0);
  return e.map((v) => v / sum);
}

/** Probabilités (0-1) du peloton, ou `null` si la discipline n'a pas de modèle. */
export function fundamentalProbabilities(field: FundamentalInput[], discipline: Discipline): number[] | null {
  const model = MODELS[discipline];
  if (!model || field.length === 0) return null;
  const x = fieldFeatures(field, discipline);
  return softmax(x.map((row) => row.reduce((acc, v, j) => acc + model.coef[j] * ((v - model.means[j]) / model.sds[j]), 0)));
}

export type Contribution = { feature: FeatureName; label: string; value: number; contribution: number };

/**
 * Contribution de chaque variable au logit du cheval, RELATIVEMENT à la moyenne
 * du peloton. Une contribution positive pousse le cheval au-dessus de ses
 * adversaires. La somme des contributions d'un cheval est exactement l'écart de
 * son logit à la moyenne : c'est une décomposition, pas une illustration.
 */
export function fundamentalContributions(field: FundamentalInput[], discipline: Discipline): Contribution[][] | null {
  const model = MODELS[discipline];
  if (!model || field.length === 0) return null;
  const x = fieldFeatures(field, discipline);
  const means = FEATURE_NAMES.map((_, j) => x.reduce((s, row) => s + row[j], 0) / x.length);
  return x.map((row) =>
    FEATURE_NAMES.map((feature, j) => ({
      feature,
      label: FEATURE_LABELS[feature],
      value: row[j],
      contribution: (model.coef[j] * (row[j] - means[j])) / model.sds[j],
    })),
  );
}
