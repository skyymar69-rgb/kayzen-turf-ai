/**
 * Lectures en base communes au backtest et aux scripts d'évaluation hors ligne.
 * Toutes bornent les relevés AVANT la décision : jamais la cote finale.
 */

import type { NeonQueryFunction } from "@neondatabase/serverless";
import type { PoolSnapshot } from "@/lib/market";

type Sql = NeonQueryFunction<false, false>;

/** `t` : horodatage du relevé (ms), pour savoir si la cote finale lui est postérieure. */
export type DecisionOdds = { race_id: string; horse_id: string; odds: number; age: number; t: number };
export type PayoutTable = { SG: Map<number, number>; SP: Map<number, number> };

/**
 * Cote de décision : pour chaque cheval, le dernier relevé observé au moins
 * `leadMinutes` avant le départ, avec son âge en minutes. Clé `course|cheval`.
 */
export async function decisionOdds(sql: Sql, raceIds: string[], leadMinutes: number) {
  const rows = (await sql.query(
    `select distinct on (o.race_id, o.horse_id) o.race_id, o.horse_id, o.odds::float8 as odds,
            (extract(epoch from (((r.race_date + replace(r.start_time, 'h', ':')::time) at time zone 'Europe/Paris') - o.observed_at)) / 60)::float8 as age,
            (extract(epoch from o.observed_at) * 1000)::float8 as t
       from odds_snapshots o
       join races r on r.id = o.race_id
      where o.race_id = any($1)
        and o.observed_at <= ((r.race_date + replace(r.start_time, 'h', ':')::time) at time zone 'Europe/Paris') - make_interval(mins => $2)
      order by o.race_id, o.horse_id, o.observed_at desc`,
    [raceIds, leadMinutes],
  )) as DecisionOdds[];
  return new Map(rows.map((d) => [`${d.race_id}|${d.horse_id}`, d]));
}

/**
 * Cote du matin : premier relevé du jour de la course, par numéro, pris au plus
 * tard `leadMinutes` avant le départ (même référence que la page course).
 */
export async function morningOdds(sql: Sql, raceIds: string[], leadMinutes: number) {
  const rows = (await sql.query(
    `select distinct on (o.race_id, o.horse_id) o.race_id, e.number, o.odds::float8 as odds
       from odds_snapshots o
       join races r on r.id = o.race_id
       join entries e on e.race_id = o.race_id and e.horse_id = o.horse_id
      where o.race_id = any($1)
        and (o.observed_at at time zone 'Europe/Paris')::date = r.race_date
        and o.observed_at <= ((r.race_date + replace(r.start_time, 'h', ':')::time) at time zone 'Europe/Paris') - make_interval(mins => $2)
      order by o.race_id, o.horse_id, o.observed_at`,
    [raceIds, leadMinutes],
  )) as Array<{ race_id: string; number: number; odds: number }>;
  return new Map(rows.map((r) => [`${r.race_id}|${r.number}`, r.odds]));
}

/**
 * Parts des mises par course, relevés antérieurs à la décision seulement :
 * `cutoff` (SQL) borne `observed_at`, comme la cote de décision.
 */
export async function poolsUntil(sql: Sql, raceIds: string[], cutoff: string, params: unknown[]) {
  const rows = (await sql.query(
    `select p.race_id, to_char(p.observed_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') as t, p.numbers, p.pool_win
       from pool_snapshots p
       join races r on r.id = p.race_id
      where p.race_id = any($1) and p.observed_at <= ${cutoff}
      order by p.race_id, p.observed_at`,
    [raceIds, ...params],
  )) as Array<{ race_id: string; t: string; numbers: number[]; pool_win: number[] }>;
  const pools = new Map<string, PoolSnapshot[]>();
  for (const r of rows) {
    const list = pools.get(r.race_id) ?? [];
    list.push({ t: r.t, numbers: r.numbers.map(Number), win: r.pool_win.map(Number) });
    pools.set(r.race_id, list);
  }
  return pools;
}

/**
 * Cote finale approchée : dernier relevé observé AVANT l'heure de départ
 * prévue, par numéro (clé `course|numéro`), avec son horodatage (ms). Le PMU
 * ne publie pas de cote de clôture distincte ; ce relevé ne sert qu'à mesurer
 * la CLV, jamais à décider.
 */
export async function closingOdds(sql: Sql, raceIds: string[]) {
  const rows = (await sql.query(
    `select distinct on (o.race_id, o.horse_id) o.race_id, e.number, o.odds::float8 as odds,
            (extract(epoch from o.observed_at) * 1000)::float8 as t
       from odds_snapshots o
       join races r on r.id = o.race_id
       join entries e on e.race_id = o.race_id and e.horse_id = o.horse_id
      where o.race_id = any($1)
        and o.observed_at <= ((r.race_date + replace(r.start_time, 'h', ':')::time) at time zone 'Europe/Paris')
      order by o.race_id, o.horse_id, o.observed_at desc`,
    [raceIds],
  )) as Array<{ race_id: string; number: number; odds: number; t: number }>;
  return new Map(rows.map((r) => [`${r.race_id}|${Number(r.number)}`, { odds: Number(r.odds), t: Number(r.t) }]));
}

/** Spécialité, distance et terrain de chaque course : contexte des tickets et ventilation. */
export async function raceMeta(sql: Sql, raceIds: string[]) {
  const rows = (await sql.query(`select id, specialty, distance, going from races where id = any($1)`, [raceIds])) as Array<{
    id: string;
    specialty: string | null;
    distance: string | null;
    going: string | null;
  }>;
  return new Map(rows.map((r) => [r.id, { specialty: r.specialty ?? "", distance: r.distance ?? "", going: r.going ?? "" }]));
}

/** Tous les rapports officiels conservés (tous types de paris), pour chiffrer les tickets. */
export async function allPayoutRows(sql: Sql, raceIds: string[]) {
  return (await sql.query(
    `select race_id, bet_type, combination, dividend::float8 as dividend from race_payouts where race_id = any($1)`,
    [raceIds],
  )) as Array<{ race_id: string; bet_type: string; combination: string; dividend: number }>;
}

/** Rapports officiels simple gagnant et simple placé, pour 1 €, par course puis par numéro. */
export async function officialPayouts(sql: Sql, raceIds: string[]) {
  const rows = (await sql.query(
    `select race_id, bet_type, combination, dividend::float8 as dividend
       from race_payouts where race_id = any($1) and bet_type in ('SIMPLE_GAGNANT', 'SIMPLE_PLACE')`,
    [raceIds],
  )) as Array<{ race_id: string; bet_type: string; combination: string; dividend: number }>;
  const payouts = new Map<string, PayoutTable>();
  for (const p of rows) {
    const entry = payouts.get(p.race_id) ?? { SG: new Map(), SP: new Map() };
    entry[p.bet_type === "SIMPLE_GAGNANT" ? "SG" : "SP"].set(Number(p.combination), p.dividend);
    payouts.set(p.race_id, entry);
  }
  return payouts;
}
