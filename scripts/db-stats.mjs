import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { neon } from "@neondatabase/serverless";

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

async function count(sql, table) {
  const rows = await sql.query(`select count(*)::int as count from ${table}`);
  return rows[0].count;
}

async function main() {
  await loadLocalEnv();

  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required");
  }

  const sql = neon(process.env.DATABASE_URL);
  const [size] = await sql`
    select pg_size_pretty(pg_database_size(current_database())) as database_size
  `;
  const [range] = await sql`
    select min(race_date)::text as earliest_race_date, max(race_date)::text as latest_race_date
    from races
  `;

  const stats = {
    databaseSize: size.database_size,
    races: await count(sql, "races"),
    entries: await count(sql, "entries"),
    oddsSnapshots: await count(sql, "odds_snapshots"),
    results: await count(sql, "results"),
    predictions: await count(sql, "predictions"),
    valueBets: await count(sql, "value_bets"),
    earliestRaceDate: range.earliest_race_date,
    latestRaceDate: range.latest_race_date,
  };

  console.table(stats);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
