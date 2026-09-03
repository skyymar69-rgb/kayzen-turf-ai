import { neon, type NeonQueryFunction } from "@neondatabase/serverless";

/**
 * Un seul rôle Postgres sert à tout : lectures des pages, écritures du
 * formulaire RGPD, import PMU et migrations de schéma. Il a donc tous les
 * droits, y compris `drop table`. Recommandé : un rôle restreint pour
 * l'application (select sur les tables lues, insert sur `privacy_requests`) et
 * réserver le rôle propriétaire aux scripts d'import et de schéma, via une
 * `DATABASE_URL` distincte côté GitHub Actions.
 */
let sqlClient: NeonQueryFunction<false, false> | null = null;

export function hasDatabase() {
  return Boolean(process.env.DATABASE_URL);
}

export function getSql() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not configured");
  }

  if (!sqlClient) {
    sqlClient = neon(process.env.DATABASE_URL);
  }

  return sqlClient;
}
