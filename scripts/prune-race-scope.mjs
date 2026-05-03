import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { neon } from "@neondatabase/serverless";

const DEFAULT_ALLOWED_COUNTRY_CODES = ["FRA"];

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

function allowedCountryCodes() {
  const configured = process.env.KAYZEN_ALLOWED_COUNTRIES;
  if (!configured) return DEFAULT_ALLOWED_COUNTRY_CODES;

  return configured
    .split(",")
    .map((code) => code.trim().toUpperCase())
    .filter(Boolean);
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

  const sql = neon(process.env.DATABASE_URL);
  const allowlist = allowedCountryCodes();

  const before = await countrySummary(sql);
  const removed = await sql`
    delete from races
    using racecourses
    where racecourses.id = races.racecourse_id
      and upper(coalesce(races.source_country, racecourses.country, '')) <> all(${allowlist})
    returning races.id, races.name, coalesce(races.source_country, racecourses.country, 'N/A') as country
  `;

  await sql`
    delete from racecourses
    where not exists (
      select 1 from races where races.racecourse_id = racecourses.id
    )
  `;

  const after = await countrySummary(sql);

  console.log("Allowed country codes:", allowlist.join(", "));
  console.log("Before:");
  console.table(before);
  console.log("Removed races:", removed.length);
  if (removed.length > 0) console.table(removed);
  console.log("After:");
  console.table(after);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
