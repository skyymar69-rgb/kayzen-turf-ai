/**
 * URL canonique du site, source unique.
 *
 * Le sitemap déclarait `https://kayzen-pronostic.fr`, un domaine qui ne résout
 * pas en DNS, alors que le JSON-LD du layout utilisait bien l'URL Vercel. Les
 * deux doivent venir d'ici pour ne plus diverger.
 *
 * Renseigner NEXT_PUBLIC_SITE_URL le jour de la bascule sur le domaine
 * définitif, sans avoir à toucher au code.
 */
export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ?? "https://kayzen-turf-ai.vercel.app";
