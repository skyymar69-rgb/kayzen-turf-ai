#!/usr/bin/env node
/**
 * Récupération de l'historique PMU depuis l'API officielle.
 *
 * POURQUOI CETTE SOURCE ET PAS UNE AUTRE
 *
 * Un sondage sur 69 dates réparties de 2004 à 2026 a montré que l'archive
 * open-pmu-api ne contient qu'une seule course par jour — le Quinté — sur 64 %
 * des journées, et seulement les chevaux arrivés. Deux défauts rédhibitoires
 * pour entraîner un modèle :
 *
 *   - un corpus limité aux Quintés est biaisé vers les gros handicaps à 16-20
 *     partants, alors que l'application couvre les 25 à 40 courses du jour,
 *     très majoritairement des courses ordinaires à petit peloton ;
 *   - sans les chevaux non placés, on ne connaît pas le champ complet, donc on
 *     ne peut ni normaliser les probabilités à 100 % ni calculer une
 *     vraisemblance Plackett-Luce. C'est précisément ce dont le modèle a besoin.
 *
 * L'API officielle, elle, fournit pour chaque journée toutes les réunions,
 * toutes les courses, tous les partants avec leurs cotes, et l'ordre d'arrivée
 * complet. Mesuré : 51 courses le 14/07/2024, 95 le 08/11/2015, 100 % avec
 * arrivée. Elle remonte jusqu'à 2013 (2012 et avant : indisponible).
 *
 * FONCTIONNEMENT
 *
 * Ce script ne réimplémente rien : il rejoue `import-pmu-day.mjs` jour par jour,
 * donc exactement le chemin de code testé en production, y compris le
 * remplacement intégral des arrivées.
 *
 * Usage :
 *   node scripts/backfill-history.mjs --from 01/01/2024 --to 31/12/2024
 *   node scripts/backfill-history.mjs --from 01/01/2013 --to 31/12/2026 --skip-existing
 *
 * Reprenable : avec --skip-existing, une journée déjà présente dans `races` est
 * ignorée. Le script est donc relançable après interruption.
 */

import { spawn } from "node:child_process";
import { neon } from "@neondatabase/serverless";
import { readFileSync } from "node:fs";

/** Première journée servie par l'API officielle (2012 et avant : 404). */
const EARLIEST = new Date(Date.UTC(2013, 0, 1));
const PAUSE_MS = 1500;

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
  const get = (n) => {
    const i = args.indexOf(`--${n}`);
    return i >= 0 ? args[i + 1] : null;
  };
  return { from: get("from"), to: get("to"), skipExisting: args.includes("--skip-existing") };
}

function parseFrDate(value) {
  const m = String(value ?? "").match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return null;
  const d = new Date(Date.UTC(Number(m[3]), Number(m[2]) - 1, Number(m[1])));
  return Number.isNaN(d.getTime()) ? null : d;
}

const toPmu = (d) =>
  `${String(d.getUTCDate()).padStart(2, "0")}${String(d.getUTCMonth() + 1).padStart(2, "0")}${d.getUTCFullYear()}`;
const toIso = (d) => d.toISOString().slice(0, 10);
const delay = (ms) => new Promise((r) => setTimeout(r, ms));

/** Rejoue l'import officiel pour une journée. Renvoie le nombre de courses importées. */
function importDay(pmuDate) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, ["scripts/import-pmu-day.mjs", "--date", pmuDate], {
      cwd: new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"),
      env: process.env,
    });

    let out = "";
    child.stdout.on("data", (c) => { out += c; });
    child.stderr.on("data", (c) => { out += c; });

    child.on("close", (code) => {
      const m = out.match(/imported (\d+) races/);
      resolve({ code, races: m ? Number(m[1]) : 0, out });
    });
    child.on("error", () => resolve({ code: 1, races: 0, out: "spawn failed" }));
  });
}

async function main() {
  const { from, to, skipExisting } = parseArgs();
  const start = parseFrDate(from);
  const end = parseFrDate(to);

  if (!start || !end) {
    console.error("Usage : --from JJ/MM/AAAA --to JJ/MM/AAAA [--skip-existing]");
    process.exit(1);
  }
  if (start > end) {
    console.error("La date de début est postérieure à la date de fin.");
    process.exit(1);
  }
  if (start < EARLIEST) {
    console.error(`L'API officielle ne remonte pas avant le ${toIso(EARLIEST)} — ajustez --from.`);
    process.exit(1);
  }

  const databaseUrl = loadDatabaseUrl();
  if (!databaseUrl) {
    console.error("DATABASE_URL introuvable (environnement ou .env.local).");
    process.exit(1);
  }
  const sql = neon(databaseUrl);

  let existing = new Set();
  if (skipExisting) {
    const rows = await sql`select distinct race_date::text as d from races`;
    existing = new Set(rows.map((r) => r.d));
    console.log(`[historique] ${existing.size} journées déjà en base seront ignorées`);
  }

  const totalDays = Math.round((end - start) / 86400000) + 1;
  let done = 0, races = 0, skipped = 0, failed = 0;

  for (let cursor = new Date(start); cursor <= end; cursor.setUTCDate(cursor.getUTCDate() + 1)) {
    const iso = toIso(cursor);
    if (existing.has(iso)) { skipped++; continue; }

    const result = await importDay(toPmu(cursor));
    done++;

    if (result.code !== 0) {
      failed++;
      console.warn(`[historique] ${iso} : échec (code ${result.code})`);
    } else {
      races += result.races;
      console.log(`[historique] ${iso} : ${result.races} courses  —  ${done}/${totalDays - skipped} journées, ${races} courses au total`);
    }

    await delay(PAUSE_MS);
  }

  console.log(
    `\n[historique] terminé — ${done} journées traitées, ${races} courses importées` +
    `${skipped > 0 ? `, ${skipped} déjà présentes` : ""}` +
    `${failed > 0 ? `, ${failed} en échec` : ""}`,
  );
}

main().catch((error) => {
  console.error("[historique] échec :", error);
  process.exit(1);
});
