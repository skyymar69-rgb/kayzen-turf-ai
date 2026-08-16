import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { neon } from "@neondatabase/serverless";

async function loadLocalEnv() {
  const envPath = resolve(process.cwd(), ".env.local");
  try {
    const content = await readFile(envPath, "utf8");
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
    // Vercel/CI can provide DATABASE_URL directly.
  }
}

async function main() {
  await loadLocalEnv();

  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required to apply the schema");
  }

  const sql = neon(process.env.DATABASE_URL);
  const schema = await readFile(resolve(process.cwd(), "db/schema.sql"), "utf8");

  // Le découpage se faisait sur un simple `split(";")`, sans retirer les
  // commentaires : un point-virgule dans un commentaire `--` coupait
  // l'instruction en deux et la seconde moitié partait telle quelle vers
  // PostgreSQL (« syntax error at or near … »). On retire donc les commentaires
  // de ligne avant de découper — en épargnant ceux qui vivent à l'intérieur
  // d'une chaîne littérale.
  const statements = retirerCommentaires(schema)
    .split(";")
    .map((statement) => statement.trim())
    .filter(Boolean);

  for (const statement of statements) {
    await sql.query(statement);
  }

  console.log("Database schema applied");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

/**
 * Retire les commentaires `--` jusqu'à la fin de ligne, sauf lorsqu'ils
 * apparaissent dans une chaîne littérale `'…'`.
 */
function retirerCommentaires(sql) {
  let sortie = "";
  let dansChaine = false;

  for (let i = 0; i < sql.length; i += 1) {
    const c = sql[i];

    if (dansChaine) {
      sortie += c;
      // `''` échappe une apostrophe à l'intérieur d'une chaîne SQL.
      if (c === "'" && sql[i + 1] === "'") {
        sortie += sql[i + 1];
        i += 1;
      } else if (c === "'") {
        dansChaine = false;
      }
      continue;
    }

    if (c === "'") {
      dansChaine = true;
      sortie += c;
      continue;
    }

    if (c === "-" && sql[i + 1] === "-") {
      const finLigne = sql.indexOf("\n", i);
      if (finLigne === -1) break;
      i = finLigne - 1;
      sortie += "\n";
      continue;
    }

    sortie += c;
  }

  return sortie;
}
