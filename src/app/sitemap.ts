import type { MetadataRoute } from "next";

import { getRaces } from "@/lib/race-repository";
import { SITE_URL } from "@/lib/site";

/**
 * Le sitemap déclarait `https://kayzen-pronostic.fr`, domaine qui ne résout pas
 * en DNS : les 12 URLs servies étaient inexploitables. Il ne listait par
 * ailleurs que les pages statiques, en omettant les pages de courses — le cœur
 * du contenu, plusieurs dizaines d'URLs par jour.
 */
/**
 * Le sitemap rejouait la cascade de requêtes base à chaque passage de robot —
 * et un sitemap est appelé souvent. Une heure de fraîcheur suffit : le
 * programme ne bouge qu'à l'import matinal.
 */
export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = SITE_URL;
  const now = new Date().toISOString();

  const statiques: MetadataRoute.Sitemap = [
    { url: base,                            lastModified: now, changeFrequency: "daily",   priority: 1.0 },
    { url: `${base}/pronostics`,            lastModified: now, changeFrequency: "daily",   priority: 0.9 },
    { url: `${base}/tarifs`,                lastModified: now, changeFrequency: "monthly", priority: 0.8 },
    { url: `${base}/techniques-prediction`, lastModified: now, changeFrequency: "monthly", priority: 0.7 },
    { url: `${base}/lexique`,               lastModified: now, changeFrequency: "monthly", priority: 0.7 },
    { url: `${base}/prono-score`,              lastModified: now, changeFrequency: "monthly", priority: 0.7 },
    { url: `${base}/jeu-responsable`,       lastModified: now, changeFrequency: "yearly",  priority: 0.4 },
    { url: `${base}/mentions-legales`,      lastModified: now, changeFrequency: "yearly",  priority: 0.3 },
    { url: `${base}/cgu`,                   lastModified: now, changeFrequency: "yearly",  priority: 0.3 },
    { url: `${base}/cgv`,                   lastModified: now, changeFrequency: "yearly",  priority: 0.3 },
    { url: `${base}/confidentialite`,       lastModified: now, changeFrequency: "yearly",  priority: 0.3 },
    { url: `${base}/cookies`,               lastModified: now, changeFrequency: "yearly",  priority: 0.3 },
    { url: `${base}/accessibilite`,         lastModified: now, changeFrequency: "yearly",  priority: 0.2 },
  ];

  let courses: MetadataRoute.Sitemap = [];
  try {
    const races = await getRaces();
    courses = races.map((race) => ({
      url: `${base}/races/${encodeURIComponent(race.id)}`,
      lastModified: now,
      changeFrequency: "hourly" as const,
      priority: 0.8,
    }));
  } catch {
    // Une panne base doit dégrader le sitemap, pas casser le build.
  }

  return [...statiques, ...courses];
}
