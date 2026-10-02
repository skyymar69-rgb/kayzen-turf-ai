import { tokenizeMusic } from "@/lib/prediction-math";

/**
 * VARIABLES DU MODÈLE FONDAMENTAL — tout ce qu'on sait d'un partant SANS sa cote.
 *
 * Le PronoScore historique est calculé à partir des probabilités du marché : le
 * comparer au marché revient à comparer le marché à lui-même. Pour qu'un écart
 * « IA contre marché » ait un sens, il faut une estimation qui n'a jamais vu la
 * cote. C'est l'objet de ce module : forme (musique), gains, âge, sexe,
 * entourage, recul au trot, corde au plat, œillères.
 *
 * Les mêmes fonctions servent à l'entraînement (scripts/train-fundamental.ts)
 * et au calcul en ligne : une variable ne peut pas être calculée différemment
 * entre les deux.
 */

export type Discipline = "Plat" | "Trot" | "Obstacle";

export type FundamentalInput = {
  number: number;
  music?: string | null;
  earnings?: number | null;
  age?: number | null;
  sex?: string | null;
  equipment?: string | null;
  handicapDistance?: number | null;
  /** Courses et victoires du jockey/driver AVANT cette course. */
  jockeyRuns?: number | null;
  jockeyWins?: number | null;
  trainerRuns?: number | null;
  trainerWins?: number | null;
};

export const FEATURE_LABELS = {
  formAvg: "Forme récente (musique pondérée)",
  lastRace: "Dernière course",
  winsLast5: "Victoires sur les 5 dernières",
  placesLast5: "Places sur les 5 dernières",
  incidentsLast5: "Incidents récents (disq., chute, arrêt)",
  experience: "Expérience (courses lues)",
  noMusic: "Aucune course connue",
  earningsRel: "Gains (relatifs au peloton)",
  age: "Âge",
  female: "Femelle",
  male: "Entier",
  blinkers: "Œillères",
  jockeyRate: "Réussite du jockey/driver",
  trainerRate: "Réussite de l'entraîneur",
  recul: "Recul (trot, en mètres)",
  drawRel: "Numéro relatif (plat)",
} as const;

export type FeatureName = keyof typeof FEATURE_LABELS;
export const FEATURE_NAMES = Object.keys(FEATURE_LABELS) as FeatureName[];

/** Taux de victoire rétréci vers la moyenne : 3 victoires en 5 montes ne valent pas 60 %. */
function shrunkRate(wins: number | null | undefined, runs: number | null | undefined, prior = 0.09, strength = 30) {
  const r = Math.max(0, Number(runs) || 0);
  const w = Math.max(0, Math.min(r, Number(wins) || 0));
  return (w + prior * strength) / (r + strength);
}

/**
 * Vecteur de variables de chaque partant d'une course. Les variables relatives
 * (gains, recul, numéro) se calculent à l'échelle du peloton : c'est pourquoi la
 * fonction prend la course entière.
 */
export function fieldFeatures(field: FundamentalInput[], discipline: Discipline): number[][] {
  const fieldSize = field.length;
  const logEarnings = field.map((h) => Math.log1p(Math.max(0, Number(h.earnings) || 0)));
  const meanEarnings = logEarnings.reduce((a, b) => a + b, 0) / Math.max(fieldSize, 1);
  const distances = field.map((h) => Number(h.handicapDistance)).filter((d) => Number.isFinite(d) && d > 0);
  const baseDistance = distances.length ? Math.min(...distances) : null;

  return field.map((horse, i) => {
    const tokens = tokenizeMusic(horse.music, 8);
    const values = tokens.map((t) => (t.kind === "pos" ? t.value : 10));
    const last5 = tokens.slice(0, 5);
    const weights = values.map((_, k) => Math.pow(0.75, k));
    const weightSum = weights.reduce((a, b) => a + b, 0);
    const formAvg = values.length ? values.reduce((s, v, k) => s + v * weights[k], 0) / weightSum : 7.5;

    const features: Record<FeatureName, number> = {
      formAvg,
      lastRace: values[0] ?? 7.5,
      winsLast5: last5.filter((t) => t.kind === "pos" && t.value === 1).length,
      placesLast5: last5.filter((t) => t.kind === "pos" && t.value <= 3).length,
      incidentsLast5: last5.filter((t) => t.kind === "inc").length,
      experience: Math.min(tokens.length, 8),
      noMusic: tokens.length === 0 ? 1 : 0,
      earningsRel: logEarnings[i] - meanEarnings,
      age: Number(horse.age) || 5,
      female: horse.sex === "FEMELLES" ? 1 : 0,
      male: horse.sex === "MALES" ? 1 : 0,
      blinkers: horse.equipment && horse.equipment !== "SANS_OEILLERES" ? 1 : 0,
      jockeyRate: shrunkRate(horse.jockeyWins, horse.jockeyRuns),
      trainerRate: shrunkRate(horse.trainerWins, horse.trainerRuns),
      recul:
        discipline === "Trot" && baseDistance !== null && Number(horse.handicapDistance) > 0
          ? (Number(horse.handicapDistance) - baseDistance) / 25
          : 0,
      drawRel: discipline === "Plat" && fieldSize > 1 ? (horse.number - 1) / (fieldSize - 1) : 0,
    };

    return FEATURE_NAMES.map((name) => features[name]);
  });
}
