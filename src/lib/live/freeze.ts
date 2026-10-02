import { getSql } from "@/lib/db";
import { MODEL_VERSION } from "@/lib/probability";
import { PROFILES_VERSION, type Profile } from "@/lib/profiles";
import { getRaceById } from "@/lib/race-repository";
import { buildSelection } from "@/lib/selection";
import type { RaceAnalysis } from "@/lib/types";

/**
 * PRONOSTIC GELÉ — ce que le site affichait avant le départ, conservé tel quel.
 *
 * Le suivi de performance ne doit jamais recalculer un pronostic après coup :
 * la page relit les cotes en base, qui deviennent les cotes FINALES après
 * l'arrivée. Un pronostic « rejoué » connaîtrait donc le marché de clôture,
 * que personne n'avait au moment de jouer.
 */

export type FrozenPayload = {
  numbers: number[];
  odds: Array<number | null>;
  /** Probabilité de victoire affichée, en %. */
  win: number[];
  top3: number[];
  /** Probabilité implicite du marché, overround retiré, en %. */
  market: number[];
  /** Avis de l'IA sans cote, en %. */
  ai: Array<number | null>;
  profile: Profile[];
  profilesVersion: string;
};

export function buildFrozenPayload(race: RaceAnalysis): FrozenPayload {
  // L'ordre est celui du classement publié : `field` vient de la même
  // classification que la page.
  const field = buildSelection(race.horses).field;
  return {
    numbers: field.map((s) => s.horse.number),
    odds: field.map((s) => (Number.isFinite(s.horse.odds) && s.horse.odds > 1 ? s.horse.odds : null)),
    win: field.map((s) => s.horse.winProbability),
    top3: field.map((s) => s.horse.top3Probability),
    market: field.map((s) => s.horse.marketProbability ?? 0),
    ai: field.map((s) => (Number.isFinite(Number(s.horse.fundamentalProbability)) ? Number(s.horse.fundamentalProbability) : null)),
    profile: field.map((s) => s.profile),
    profilesVersion: PROFILES_VERSION,
  };
}

/**
 * Étapes à écrire pour cette distance au départ. Une étape manquée n'est pas
 * rattrapée sous une fausse étiquette : un premier relevé à H-5 n'écrit pas
 * « H-60 ». H-2 est réécrit à chaque passage jusqu'au départ.
 */
export function stagesFor(minutesToStart: number): Array<"H-60" | "H-15" | "H-2"> {
  const stages: Array<"H-60" | "H-15" | "H-2"> = [];
  if (minutesToStart > 15 && minutesToStart <= 60) stages.push("H-60");
  if (minutesToStart > 3 && minutesToStart <= 15) stages.push("H-15");
  if (minutesToStart <= 15) stages.push("H-2");
  return stages;
}

export async function freezePrediction(raceId: string, minutesToStart: number): Promise<string[]> {
  const stages = stagesFor(minutesToStart);
  if (stages.length === 0) return [];

  const race = await getRaceById(raceId);
  if (!race || !race.oddsAvailable) return [];

  const payload = JSON.stringify(buildFrozenPayload(race));
  const minutes = Math.round(minutesToStart);
  const sql = getSql();
  const written: string[] = [];

  for (const stage of stages) {
    const rows = await sql.query(
      `insert into prediction_snapshots (race_id, stage, captured_at, minutes_to_start, model_version, payload)
       values ($1, $2, now(), $3, $4, $5::jsonb)
       on conflict (race_id, stage) do update
         set captured_at = excluded.captured_at, minutes_to_start = excluded.minutes_to_start,
             model_version = excluded.model_version, payload = excluded.payload
         where prediction_snapshots.stage = 'H-2'
       returning stage`,
      [raceId, stage, minutes, MODEL_VERSION, payload],
    );
    if (rows.length > 0) written.push(stage);
  }
  return written;
}
