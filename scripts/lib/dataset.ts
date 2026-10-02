/**
 * Jeu de données historique, partagé par l'entraînement du modèle fondamental
 * et le backtest. Chaque course arrive avec les variables de ses partants
 * telles qu'elles étaient connues AVANT elle : les statistiques jockey et
 * entraîneur sont accumulées date par date et mises à jour après chaque jour.
 */

import { readFileSync } from "node:fs";
import { neon } from "@neondatabase/serverless";
import type { Discipline, FundamentalInput } from "@/lib/fundamental/features";

export type DatasetRace = {
  raceId: string;
  date: string;
  discipline: Discipline;
  field: Array<FundamentalInput & { horseId: string; closingOdds: number | null; position: number | null }>;
  /** Index du gagnant dans `field`. */
  winner: number;
};

type Row = FundamentalInput & {
  race_id: string;
  race_date: string;
  discipline: Discipline;
  horse_id: string;
  jockey_id: string | null;
  trainer_id: string | null;
  odds: number | null;
  pos: number | null;
};

export async function loadDataset(databaseUrl: string): Promise<DatasetRace[]> {
  const sql = neon(databaseUrl);
  const rows = (await sql`
    select e.race_id, r.race_date::text as race_date, r.discipline, e.horse_id, e.number, e.music,
           e.earnings::float8 as earnings, coalesce(e.age, h.age) as age, e.sex, e.equipment,
           e.handicap_distance as "handicapDistance", e.jockey_id::text as jockey_id, e.trainer_id::text as trainer_id,
           e.odds::float8 as odds, res.finish_position as pos
      from entries e
      join races r on r.id = e.race_id
      join horses h on h.id = e.horse_id
      left join results res on res.race_id = e.race_id and res.horse_id = e.horse_id
     where exists (select 1 from results w where w.race_id = e.race_id and w.finish_position = 1)
     order by r.race_date, e.race_id, e.number
  `) as Row[];

  const byDate = new Map<string, Map<string, Row[]>>();
  for (const row of rows) {
    const day = byDate.get(row.race_date) ?? new Map<string, Row[]>();
    const race = day.get(row.race_id) ?? [];
    race.push(row);
    day.set(row.race_id, race);
    byDate.set(row.race_date, day);
  }

  const jockey = new Map<string, { runs: number; wins: number }>();
  const trainer = new Map<string, { runs: number; wins: number }>();
  const races: DatasetRace[] = [];

  for (const date of [...byDate.keys()].sort()) {
    const day = byDate.get(date)!;
    for (const [raceId, field] of day) {
      const winner = field.findIndex((h) => h.pos === 1);
      if (winner < 0 || field.length < 4) continue;
      races.push({
        raceId,
        date,
        discipline: field[0].discipline,
        winner,
        field: field.map((h) => ({
          number: h.number,
          music: h.music,
          earnings: h.earnings,
          age: h.age,
          sex: h.sex,
          equipment: h.equipment,
          handicapDistance: h.handicapDistance,
          jockeyRuns: jockey.get(h.jockey_id ?? "")?.runs ?? 0,
          jockeyWins: jockey.get(h.jockey_id ?? "")?.wins ?? 0,
          trainerRuns: trainer.get(h.trainer_id ?? "")?.runs ?? 0,
          trainerWins: trainer.get(h.trainer_id ?? "")?.wins ?? 0,
          horseId: h.horse_id,
          closingOdds: h.odds,
          position: h.pos,
        })),
      });
    }
    // Les résultats du jour n'entrent dans les statistiques qu'après le jour.
    for (const field of day.values()) {
      for (const h of field) {
        for (const [map, id] of [[jockey, h.jockey_id], [trainer, h.trainer_id]] as const) {
          if (!id) continue;
          const s = map.get(id) ?? { runs: 0, wins: 0 };
          s.runs += 1;
          if (h.pos === 1) s.wins += 1;
          map.set(id, s);
        }
      }
    }
  }
  return races;
}

export function loadLocalEnv() {
  try {
    for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
      const i = line.indexOf("=");
      if (i > 0 && !line.startsWith("#")) process.env[line.slice(0, i)] ||= line.slice(i + 1).replace(/^"|"$/g, "");
    }
  } catch {
    // En CI, DATABASE_URL vient des secrets.
  }
}
