import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { neon } from "@neondatabase/serverless";

/**
 * Retire du périmètre les courses hors France.
 *
 * Ce script supprime des courses avec cascade sur les partants, les cotes, les
 * arrivées et les retours d'apprentissage, et il tourne à chaque import en CI.
 * Trois garde-fous l'encadrent, tous absents à l'origine :
 *
 *  - une liste de pays vide est refusée (`KAYZEN_ALLOWED_COUNTRIES=" "` donnait
 *    `[]`, et `<> all('{}')` est vrai pour toute ligne : la base entière) ;
 *  - au-delà de `MAX_REMOVAL_SHARE` du programme, la purge est annulée — un
 *    hippodrome dont le pays a été réécrit en « N/A » par une réponse API
 *    incomplète ne doit pas emporter tout son historique ;
 *  - `--dry-run` montre ce qui serait supprimé sans rien écrire.
 *
 * Usage : node scripts/prune-race-scope.mjs [--dry-run]
 */

const DEFAULT_ALLOWED_COUNTRY_CODES = ["FRA"];

/** Part maximale des courses qu'un passage peut supprimer. */
const MAX_REMOVAL_SHARE = 0.05;
/** En deçà de ce nombre, le plafond proportionnel ne s'applique pas. */
const MIN_REMOVAL_FLOOR = 20;

async function loadLocalEnv() {
  try {
    const content = await readFile(resolve(process.cwd(), ".env.local"), "utf8");
    for (const line of content.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const separator = trimmed.indexOf("=");
      if (separator === -1) continue;
      const key = trimmed.slice(0, separator);
      const value = trimmed.slice(separator + 1).replace(/^"|"$/g, "");
      process.env[key] ||= value;
    }
  } catch {
    // CI can provide DATABASE_URL directly.
  }
}

export function allowedCountryCodes(configured = process.env.KAYZEN_ALLOWED_COUNTRIES) {
  if (configured === undefined) return DEFAULT_ALLOWED_COUNTRY_CODES;

  const codes = configured
    .split(",")
    .map((code) => code.trim().toUpperCase())
    .filter((code) => /^[A-Z]{3}$/.test(code));

  if (codes.length === 0) {
    throw new Error(
      `KAYZEN_ALLOWED_COUNTRIES est vide ou malformé (« ${configured} ») : refus de purger, une liste vide supprimerait toutes les courses`,
    );
  }

  return codes;
}

async function countrySummary(sql) {
  return sql`
    select coalesce(races.source_country, racecourses.country, 'N/A') as country, count(*)::int as races
    from races
    left join racecourses on racecourses.id = races.racecourse_id
    group by 1
    order by 1
  `;
}

async function main() {
  await loadLocalEnv();
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");

  const dryRun = process.argv.includes("--dry-run");
  const sql = neon(process.env.DATABASE_URL);
  const allowlist = allowedCountryCodes();

  const before = await countrySummary(sql);
  const total = before.reduce((sum, row) => sum + row.races, 0);

  const targets = await sql`
    select races.id, races.name, coalesce(races.source_country, racecourses.country, 'N/A') as country
    from races
    join racecourses on racecourses.id = races.racecourse_id
    where upper(coalesce(races.source_country, racecourses.country, '')) <> all(${allowlist})
  `;

  console.log("Allowed country codes:", allowlist.join(", "));
  console.log("Before:");
  console.table(before);
  console.log(`Courses hors périmètre : ${targets.length} / ${total}`);
  if (targets.length > 0) console.table(targets);

  if (targets.length === 0) return;

  const cap = Math.max(MIN_REMOVAL_FLOOR, Math.floor(total * MAX_REMOVAL_SHARE));
  if (targets.length > cap) {
    throw new Error(
      `${targets.length} courses ciblées sur ${total} — au-delà du plafond de ${cap}. ` +
        "Purge annulée : vérifier racecourses.country et KAYZEN_ALLOWED_COUNTRIES avant de relancer.",
    );
  }

  if (dryRun) {
    console.log("Simulation : aucune suppression effectuée.");
    return;
  }

  const ids = targets.map((row) => row.id);
  const removed = await sql`
    delete from races
    where id = any(${ids})
    returning id
  `;

  await sql`
    delete from racecourses
    where not exists (
      select 1 from races where races.racecourse_id = racecourses.id
    )
  `;

  const after = await countrySummary(sql);
  console.log("Removed races:", removed.length);
  console.log("After:");
  console.table(after);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
