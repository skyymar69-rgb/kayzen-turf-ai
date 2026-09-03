#!/usr/bin/env node
/**
 * Veille sur le registre des demandes RGPD.
 *
 * Le formulaire de /confidentialite écrit dans `privacy_requests`, mais rien
 * n'avertissait personne : une demande pouvait dormir en base au-delà du délai
 * d'un mois de l'article 12.3. Ce script est le mécanisme de notification :
 * lancé chaque jour par le workflow `privacy_requests_check.yml`, il sort avec
 * le code 1 dès qu'au moins une demande est encore au statut `received`. Le
 * workflow échoue alors, et GitHub envoie un email au propriétaire du dépôt —
 * sans service tiers ni clé supplémentaire. Le jour où toutes les demandes
 * sont prises en charge (`in_progress` ou `closed`), le workflow repasse au
 * vert et les emails cessent.
 *
 * Il applique aussi la durée de conservation : une demande close depuis plus
 * de trois ans (délai de prescription d'une action en responsabilité, art. 2224
 * du Code civil) n'a plus de raison d'être conservée avec l'email du
 * demandeur ; elle est supprimée et le nombre de lignes effacées est affiché.
 *
 * Usage : node scripts/check-privacy-requests.mjs
 * (DATABASE_URL dans l'environnement, ou à défaut dans .env.local)
 */

import { neon } from "@neondatabase/serverless";
import { readFileSync } from "node:fs";

function databaseUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  let env = "";
  try {
    env = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
  } catch {
    // Pas de fichier local : on retombe sur l'erreur explicite ci-dessous.
  }
  const url = (env.match(/^DATABASE_URL=(.+)$/m)?.[1] ?? "").trim().replace(/^["']|["']$/g, "");
  if (!url) {
    console.error("DATABASE_URL absente : ni dans l'environnement, ni dans .env.local.");
    process.exit(2);
  }
  return url;
}

const sql = neon(databaseUrl());

// Rétention : les demandes closes depuis plus de trois ans sont effacées.
const [{ supprimees }] = await sql`
  with effacees as (
    delete from privacy_requests
    where status = 'closed'
      and handled_at is not null
      and handled_at < now() - interval '3 years'
    returning id
  )
  select count(*)::int as supprimees from effacees
`;
console.log(`Rétention : ${supprimees} demande(s) close(s) depuis plus de trois ans supprimée(s).`);

// Veille : ce qui attend encore d'être pris en charge.
const [{ en_attente, plus_ancienne }] = await sql`
  select
    count(*)::int as en_attente,
    min(created_at) as plus_ancienne
  from privacy_requests
  where status = 'received'
`;

if (en_attente === 0) {
  console.log("Aucune demande RGPD en attente.");
  process.exit(0);
}

const ancienneteJours = Math.floor((Date.now() - new Date(plus_ancienne).getTime()) / 86_400_000);
console.error(
  `${en_attente} demande(s) RGPD au statut « received ». La plus ancienne date du ${new Date(plus_ancienne).toISOString()} (${ancienneteJours} jour(s)) ; délai légal de réponse : 30 jours.`,
);
console.error("Passez chaque demande à « in_progress » ou « closed » dans privacy_requests pour faire repasser ce contrôle au vert.");
// Code de sortie non nul : le workflow échoue et GitHub prévient le propriétaire.
process.exit(1);
