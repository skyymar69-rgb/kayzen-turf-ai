#!/usr/bin/env node
/**
 * Récupération ponctuelle de l'archive des arrivées PMU depuis open-pmu-api.
 *
 * Pourquoi un script séparé et non une dépendance : la source n'a plus aucune
 * donnée depuis le 06/07/2026 et repose sur un déploiement tiers. Elle est donc
 * inutilisable en temps réel — l'API officielle PMU s'en charge. Son intérêt est
 * ailleurs : son archive remonte à 2004 et fournit le couple (cote, position
 * d'arrivée) sur des dizaines de milliers de courses, matière indispensable pour
 * calibrer le modèle sur de l'historique réel.
 *
 * Les données atterrissent dans `historical_results`, table isolée de la
 * production : aucune jointure, donc aucun risque pour l'affichage.
 *
 * Usage :
 *   node scripts/backfill-historical-results.mjs --from 01/01/2024 --to 31/12/2024
 *   node scripts/backfill-historical-results.mjs --from 01/06/2026 --to 06/07/2026 --dry-run
 *
 * Reprenable : une journée déjà enregistrée dans `historical_backfill_log` est
 * ignorée, sauf --force.
 */

import { neon } from "@neondatabase/serverless";
import { readFileSync } from "node:fs";

const API = "https://open-pmu-api.vercel.app/api/arrivees";
const DELAY_MS = 400;          // courtoisie envers un service tiers gratuit
const MAX_RETRIES = 3;

function loadDatabaseUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  try {
    const env = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
    const match = env.match(/^DATABASE_URL=(.+)$/m);
    if (match) return match[1].trim().replace(/^["']|["']$/g, "");
  } catch {}
  return null;
}

function parseArgs() {
  const args = process.argv.slice(2);
  const get = (name) => {
    const i = args.indexOf(`--${name}`);
    return i >= 0 ? args[i + 1] : null;
  };
  return {
    from: get("from"),
    to: get("to"),
    dryRun: args.includes("--dry-run"),
    force: args.includes("--force"),
  };
}

/** "JJ/MM/AAAA" -> Date UTC. Renvoie null si le format ne convient pas. */
function parseFrDate(value) {
  const m = String(value ?? "").match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return null;
  const [, d, mo, y] = m;
  const date = new Date(Date.UTC(Number(y), Number(mo) - 1, Number(d)));
  return Number.isNaN(date.getTime()) ? null : date;
}

const toFr = (date) => {
  const d = String(date.getUTCDate()).padStart(2, "0");
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${d}/${m}/${date.getUTCFullYear()}`;
};
const toIso = (date) => date.toISOString().slice(0, 10);

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function fetchDay(frDate) {
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await fetch(`${API}?date=${encodeURIComponent(frDate)}`, {
        headers: { accept: "application/json" },
        signal: AbortSignal.timeout(30000),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const payload = await response.json();
      // La source répond {error:true, message:[]} pour une journée sans donnée —
      // ce n'est pas une panne, juste une absence.
      if (payload?.error) return [];
      return Array.isArray(payload?.message) ? payload.message : [];
    } catch (error) {
      if (attempt === MAX_RETRIES) {
        console.warn(`[backfill] ${frDate} : abandon après ${MAX_RETRIES} tentatives (${error.message})`);
        return null;
      }
      await delay(DELAY_MS * attempt * 2);
    }
  }
  return null;
}

/** La cote finale est la dernière du tableau `cotes`. */
function finalOdds(cotes) {
  if (!Array.isArray(cotes) || cotes.length === 0) return null;
  const value = Number(String(cotes[cotes.length - 1]).replace(",", "."));
  return Number.isFinite(value) && value > 0 ? value : null;
}

const toInt = (value) => {
  const n = Number(value);
  return Number.isFinite(n) ? Math.round(n) : null;
};

/**
 * Aplatit une course en une ligne par cheval classé.
 *
 * On s'appuie sur `isoDate`, la date demandée, et non sur le champ `date` de la
 * réponse : la source y intervertit jour et mois (une requête 06/07/2026 renvoie
 * "2026-06-07"), ce qui décalerait tout l'historique.
 */
function rowsForRace(race, isoDate) {
  const details = race?.arrivee_details ?? {};
  const order = Array.isArray(race?.arrivee) ? race.arrivee : [];
  const programCode = String(race?.["r/c"] ?? "").replace(/\s/g, "") || null;
  const rows = [];

  for (let i = 0; i < order.length; i++) {
    const position = i + 1;
    const horseNumber = order[i];
    // `arrivee_details` est indexé par NUMÉRO de cheval, pas par position.
    // Indexer par position renvoyait le mauvais cheval dès qu'un numéro
    // coïncidait avec un rang (place 2 et 3 rendaient le même nom).
    const detail = details[String(horseNumber)];
    if (!detail) continue;

    rows.push({
      id: `${isoDate}|${programCode ?? "NA"}|${position}`,
      race_date: isoDate,
      program_code: programCode,
      racecourse: race?.lieu ?? null,
      race_name: race?.prix ?? null,
      discipline: detail.discipline ?? race?.type ?? null,
      distance: toInt(detail.distance ?? race?.distance),
      prize: toInt(race?.montant),
      starters: toInt(race?.partants),
      finish_position: position,
      horse_name: detail.nom_cheval ?? null,
      sex: detail.sexe ?? null,
      birth_year: toInt(detail.annee_de_naissance),
      jockey: detail.nom_jockey ?? null,
      trainer: detail.nom_entraineur ?? null,
      music: typeof detail.musique === "string" ? detail.musique.trim() : null,
      final_odds: finalOdds(detail.cotes),
      earnings: toInt(detail.gains),
      draw: toInt(detail.corde),
    });
  }

  return rows.filter((row) => row.horse_name);
}

async function main() {
  const { from, to, dryRun, force } = parseArgs();
  const start = parseFrDate(from);
  const end = parseFrDate(to);

  if (!start || !end) {
    console.error("Usage : --from JJ/MM/AAAA --to JJ/MM/AAAA [--dry-run] [--force]");
    process.exit(1);
  }
  if (start > end) {
    console.error("La date de début est postérieure à la date de fin.");
    process.exit(1);
  }

  const databaseUrl = loadDatabaseUrl();
  if (!databaseUrl && !dryRun) {
    console.error("DATABASE_URL introuvable (environnement ou .env.local).");
    process.exit(1);
  }
  const sql = databaseUrl ? neon(databaseUrl) : null;

  let done = new Set();
  if (sql && !force && !dryRun) {
    const rows = await sql`select race_date::text as d from historical_backfill_log`;
    done = new Set(rows.map((r) => r.d));
  }

  let days = 0, races = 0, inserted = 0, skipped = 0, failed = 0;

  for (let cursor = new Date(start); cursor <= end; cursor.setUTCDate(cursor.getUTCDate() + 1)) {
    const iso = toIso(cursor);
    if (done.has(iso)) { skipped++; continue; }

    const payload = await fetchDay(toFr(cursor));
    if (payload === null) { failed++; continue; }

    days++;
    const rows = payload.flatMap((race) => rowsForRace(race, iso));
    races += payload.length;

    if (dryRun) {
      if (rows.length > 0) console.log(`[backfill] ${iso} : ${payload.length} courses, ${rows.length} lignes (simulation)`);
    } else if (sql) {
      for (const row of rows) {
        await sql`
          insert into historical_results (
            id, race_date, program_code, racecourse, race_name, discipline, distance,
            prize, starters, finish_position, horse_name, sex, birth_year, jockey,
            trainer, music, final_odds, earnings, draw
          ) values (
            ${row.id}, ${row.race_date}, ${row.program_code}, ${row.racecourse}, ${row.race_name},
            ${row.discipline}, ${row.distance}, ${row.prize}, ${row.starters}, ${row.finish_position},
            ${row.horse_name}, ${row.sex}, ${row.birth_year}, ${row.jockey}, ${row.trainer},
            ${row.music}, ${row.final_odds}, ${row.earnings}, ${row.draw}
          )
          on conflict (id) do update set
            final_odds = excluded.final_odds,
            music      = excluded.music,
            earnings   = excluded.earnings
        `;
      }
      await sql`
        insert into historical_backfill_log (race_date, races_found, rows_inserted)
        values (${iso}, ${payload.length}, ${rows.length})
        on conflict (race_date) do update set
          races_found   = excluded.races_found,
          rows_inserted = excluded.rows_inserted,
          fetched_at    = now()
      `;
      inserted += rows.length;
      if (rows.length > 0) console.log(`[backfill] ${iso} : ${payload.length} courses, ${rows.length} lignes`);
    }

    await delay(DELAY_MS);
  }

  console.log(
    `\n[backfill] terminé — ${days} journées interrogées, ${races} courses, ${inserted} lignes écrites` +
    `${skipped > 0 ? `, ${skipped} journées déjà traitées` : ""}` +
    `${failed > 0 ? `, ${failed} journées en échec` : ""}`,
  );
}

main().catch((error) => {
  console.error("[backfill] échec :", error);
  process.exit(1);
});
