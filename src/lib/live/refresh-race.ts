import { getSql } from "@/lib/db";
import { fetchPmuJson, participantOdds, pmuRaceUrl, type PmuParticipant } from "@/lib/pmu/client";
import { freezePrediction } from "@/lib/live/freeze";

/**
 * RAFRAÎCHISSEMENT D'UNE COURSE — partagé par la boucle planifiée
 * (scripts/live-refresh.ts) et par le bouton « Relancer l'analyse IA ».
 *
 * Ce qui est écrit, dans l'ordre :
 *   1. `entries.odds` et `entries.pool_*` — la valeur courante, lue par la page ;
 *   2. les non-partants déclarés, retirés (même garde-fou que l'ancien script) ;
 *   3. `odds_snapshots` et `pool_snapshots` — l'historique, espacé selon la
 *      distance au départ pour tenir le budget de stockage ;
 *   4. `prediction_snapshots` — le pronostic gelé à H-60, H-15 et H-2.
 *
 * Le verrou est `races.odds_refreshed_at` : une mise à jour conditionnelle ne
 * réussit que si le dernier rafraîchissement est plus ancien que `minInterval`.
 * Deux appels simultanés (la boucle et un visiteur) n'interrogent donc jamais
 * le PMU deux fois pour la même course.
 */

export type RefreshOutcome =
  | { status: "skipped"; reason: "recent" | "unknown-race" | "no-runners" }
  | {
      status: "refreshed";
      oddsChanged: number;
      runners: number;
      scratched: number[];
      /** Chevaux retirés, pour prévenir ceux qui les suivent. */
      scratchedHorseIds: string[];
      snapshotRecorded: boolean;
      frozen: string[];
    };

/**
 * Écart minimal entre deux relevés historisés, selon la distance au départ.
 * Huit à dix relevés par cheval et par course au plus : c'est ce qui garde
 * `odds_snapshots` sous ~1 Mo par jour, et c'est exactement la résolution dont
 * le backtest a besoin (H-60, H-30, H-15, H-5, H-2).
 */
export function snapshotGapMinutes(minutesToStart: number): number {
  if (minutesToStart > 60) return 30;
  if (minutesToStart > 15) return 10;
  return 4;
}

/** Écart minimal entre deux interrogations du PMU pour une même course. */
export function refreshIntervalSeconds(minutesToStart: number): number {
  if (minutesToStart > 60) return 15 * 60;
  if (minutesToStart > 15) return 4 * 60;
  return 45;
}

/**
 * Numéros à retirer : présents en base mais absents des partants PMU.
 *
 * `listedNumbers` est la liste PMU complète, non-partants compris. C'est sur
 * elle, et non sur les seuls partants, qu'on juge une réponse tronquée (moins
 * de 70 % des chevaux connus) : comparer les partants seuls prenait les
 * forfaits d'un petit peloton pour une troncature — 6 chevaux dont 2 retirés
 * donnaient 4 < 4,2, et rien n'était jamais retiré. Sur une réponse tronquée,
 * seuls les non-partants déclarés comme tels sont retirés.
 */
export function planScratches(presentNumbers: number[], runningNumbers: number[], listedNumbers: number[] = runningNumbers): number[] {
  const running = new Set(runningNumbers);
  if (listedNumbers.length < presentNumbers.length * 0.7) {
    const declared = new Set(listedNumbers.filter((n) => !running.has(n)));
    return presentNumbers.filter((n) => declared.has(n));
  }
  return presentNumbers.filter((n) => !running.has(n));
}

type Citation = { typePari?: string; participants?: Array<{ numPmu: number | string; citations?: Array<{ ratio?: number }> }> };

export async function refreshRace(
  raceId: string,
  { minutesToStart, minIntervalSeconds = refreshIntervalSeconds(minutesToStart) }: { minutesToStart: number; minIntervalSeconds?: number },
): Promise<RefreshOutcome> {
  const sql = getSql();
  const participantsUrl = pmuRaceUrl(raceId, "/participants");
  if (!participantsUrl) return { status: "skipped", reason: "unknown-race" };

  const locked = (await sql.query(
    `with previous as (select odds_refreshed_at from races where id = $1)
     update races set odds_refreshed_at = now()
       from previous
      where races.id = $1
        and (races.odds_refreshed_at is null or races.odds_refreshed_at < now() - make_interval(secs => $2))
      returning previous.odds_refreshed_at as previous`,
    [raceId, minIntervalSeconds],
  )) as Array<{ previous: string | null }>;
  if (locked.length === 0) return { status: "skipped", reason: "recent" };

  // `odds_refreshed_at` sert de verrou ET d'âge de la cote affiché. Si le PMU
  // ne répond pas, la date reprend sa valeur : la page ne doit jamais annoncer
  // des cotes « relevées à l'instant » qui n'ont pas été relues.
  const release = () => sql.query(`update races set odds_refreshed_at = $2 where id = $1`, [raceId, locked[0]!.previous]);
  let running: PmuParticipant[];
  let listedNumbers: number[];
  try {
    const payload = await fetchPmuJson<{ participants?: PmuParticipant[] }>(participantsUrl);
    const listed = payload?.participants ?? [];
    listedNumbers = listed.map((p) => Number(p.numPmu));
    running = listed.filter((p) => !p.statut || p.statut === "PARTANT");
  } catch (error) {
    await release();
    throw error;
  }
  if (running.length === 0) {
    await release();
    return { status: "skipped", reason: "no-runners" };
  }

  // Une étape SQL qui échoue après la lecture PMU rend aussi le verrou : sinon
  // l'en-tête annoncerait des cotes « relevées à l'instant » jamais écrites.
  try {
    return await applyRefresh(raceId, running, listedNumbers, minutesToStart);
  } catch (error) {
    await release().catch(() => undefined);
    throw error;
  }
}

async function applyRefresh(raceId: string, running: PmuParticipant[], listedNumbers: number[], minutesToStart: number): Promise<RefreshOutcome> {
  const sql = getSql();

  // Les pools n'existent qu'une fois les paris ouverts : leur absence est normale.
  let pools = new Map<number, { win: number | null; place: number | null; quinte: number | null }>();
  try {
    const citations = await fetchPmuJson<{ listeCitations?: Citation[] }>(pmuRaceUrl(raceId, "/citations")!);
    const share = (type: string) => {
      const bloc = (citations?.listeCitations ?? []).find((b) => b.typePari === type);
      return new Map((bloc?.participants ?? []).map((p) => [Number(p.numPmu), finiteOrNull(p.citations?.[0]?.ratio)]));
    };
    const win = share("SIMPLE_GAGNANT");
    const place = share("SIMPLE_PLACE");
    const quinte = share("QUINTE_PLUS");
    pools = new Map([...win.keys()].map((n) => [n, { win: win.get(n) ?? null, place: place.get(n) ?? null, quinte: quinte.get(n) ?? null }]));
  } catch {
    // Pas de pools : on continue avec les cotes seules.
  }

  // Non-partants (voir `planScratches`). Leur ligne `entries` est supprimée
  // AVANT la mise à jour des cotes et le gel : les probabilités calibrées
  // (marché dévigé, modèle fondamental, calibrateField) sont recalculées sur
  // le peloton réduit à chaque lecture de la course, et le gel H-2 de ce même
  // passage — réécrit à chaque passage du dernier quart d'heure — porte donc
  // déjà le peloton réduit.
  const runningNumbers = running.map((p) => Number(p.numPmu));
  const present = (await sql.query(`select number from entries where race_id = $1`, [raceId])) as Array<{ number: number }>;
  const toRemove = planScratches(present.map((r) => Number(r.number)), runningNumbers, listedNumbers);
  let scratched: number[] = [];
  let scratchedHorseIds: string[] = [];
  if (toRemove.length > 0) {
    const removed = (await sql.query(
      `delete from entries where race_id = $1 and number = any($2::int[]) returning number, horse_id`,
      [raceId, toRemove],
    )) as Array<{ number: number; horse_id: string }>;
    scratched = removed.map((r) => r.number);
    scratchedHorseIds = removed.map((r) => r.horse_id);
  }

  const oddsRows = running
    .map((p) => ({ number: Number(p.numPmu), odds: participantOdds(p) }))
    .filter((r) => r.odds > 1);

  let oddsChanged = 0;
  if (oddsRows.length > 0) {
    const changed = await sql.query(
      `update entries e set odds = v.odds
         from unnest($2::int[], $3::numeric[]) as v(number, odds)
        where e.race_id = $1 and e.number = v.number and e.odds is distinct from v.odds
        returning e.id`,
      [raceId, oddsRows.map((r) => r.number), oddsRows.map((r) => r.odds)],
    );
    oddsChanged = changed.length;
  }

  const poolRows = running
    .map((p) => ({ number: Number(p.numPmu), ...(pools.get(Number(p.numPmu)) ?? { win: null, place: null, quinte: null }) }))
    .filter((r) => r.win !== null);
  if (poolRows.length > 0) {
    await sql.query(
      `update entries e set pool_win = v.win, pool_place = v.place, pool_quinte = v.quinte
         from unnest($2::int[], $3::numeric[], $4::numeric[], $5::numeric[]) as v(number, win, place, quinte)
        where e.race_id = $1 and e.number = v.number
          and (e.pool_win is distinct from v.win or e.pool_place is distinct from v.place)`,
      [raceId, poolRows.map((r) => r.number), poolRows.map((r) => r.win), poolRows.map((r) => r.place), poolRows.map((r) => r.quinte)],
    );
  }

  // Réduction kilométrique relevée avant la course, puis gelée (voir schema.sql).
  const figures = running
    .map((p) => ({ number: Number(p.numPmu), figure: Number(p.reductionKilometrique) }))
    .filter((r) => Number.isFinite(r.figure) && r.figure > 40000 && r.figure < 200000);
  if (figures.length > 0 && minutesToStart > 0) {
    await sql.query(
      `update entries e set speed_figure = v.figure
         from unnest($2::int[], $3::numeric[]) as v(number, figure)
        where e.race_id = $1 and e.number = v.number and e.speed_figure is null`,
      [raceId, figures.map((r) => r.number), figures.map((r) => r.figure)],
    );
  }

  // Historique, espacé : un relevé seulement si le précédent de la course est
  // plus ancien que l'écart prévu pour cette distance au départ.
  const gap = snapshotGapMinutes(minutesToStart);
  let snapshotRecorded = false;
  if (oddsRows.length > 0) {
    const inserted = await sql.query(
      `insert into odds_snapshots (race_id, horse_id, odds, source, observed_at)
       select e.race_id, e.horse_id, v.odds, 'PMU', now()
         from unnest($2::int[], $3::numeric[]) as v(number, odds)
         join entries e on e.race_id = $1 and e.number = v.number
        where not exists (
                select 1 from odds_snapshots recent
                 where recent.race_id = $1 and recent.observed_at > now() - make_interval(mins => $4))
          and v.odds is distinct from (
                select previous.odds from odds_snapshots previous
                 where previous.race_id = e.race_id and previous.horse_id = e.horse_id and previous.source = 'PMU'
                 order by previous.observed_at desc limit 1)
       returning 1`,
      [raceId, oddsRows.map((r) => r.number), oddsRows.map((r) => r.odds), gap],
    );
    snapshotRecorded = inserted.length > 0;
  }
  if (poolRows.length > 0) {
    await sql.query(
      `insert into pool_snapshots (race_id, observed_at, numbers, pool_win, pool_place)
       select $1, now(), $2::smallint[], $3::real[], $4::real[]
        where not exists (
          select 1 from pool_snapshots recent
           where recent.race_id = $1 and recent.observed_at > now() - make_interval(mins => $5))`,
      [raceId, poolRows.map((r) => r.number), poolRows.map((r) => r.win), poolRows.map((r) => r.place), gap],
    );
  }

  const frozen = minutesToStart > 0 ? await freezePrediction(raceId, minutesToStart) : [];

  return { status: "refreshed", oddsChanged, runners: running.length, scratched, scratchedHorseIds, snapshotRecorded, frozen };
}

function finiteOrNull(value: unknown): number | null {
  const n = Number(value);
  return value != null && Number.isFinite(n) ? n : null;
}

/** Courses à rafraîchir : départ entre `pastMinutes` passées et `aheadMinutes` à venir. */
export async function imminentRaces(aheadMinutes = 90, pastMinutes = 2) {
  const sql = getSql();
  return (await sql.query(
    `select id,
            (extract(epoch from (((race_date + replace(start_time, 'h', ':')::time) at time zone 'Europe/Paris') - now())) / 60)::float8 as minutes_to_start
       from races
      where race_date between (now() at time zone 'Europe/Paris')::date - 1 and (now() at time zone 'Europe/Paris')::date
        and start_time ~ '^\\d{1,2}[:h]\\d{2}$'
        and ((race_date + replace(start_time, 'h', ':')::time) at time zone 'Europe/Paris')
            between now() - make_interval(mins => $2) and now() + make_interval(mins => $1)
      order by 2`,
    [aheadMinutes, pastMinutes],
  )) as Array<{ id: string; minutes_to_start: number }>;
}

/** Minutes jusqu'au prochain départ connu (aujourd'hui ou demain), null si aucun. */
export async function minutesToNextRace(): Promise<number | null> {
  const sql = getSql();
  const rows = (await sql.query(
    `select min(extract(epoch from (((race_date + replace(start_time, 'h', ':')::time) at time zone 'Europe/Paris') - now())) / 60)::float8 as minutes
       from races
      where race_date between (now() at time zone 'Europe/Paris')::date and (now() at time zone 'Europe/Paris')::date + 1
        and start_time ~ '^\\d{1,2}[:h]\\d{2}$'
        and ((race_date + replace(start_time, 'h', ':')::time) at time zone 'Europe/Paris') > now()`,
  )) as Array<{ minutes: number | null }>;
  return finiteOrNull(rows[0]?.minutes);
}
