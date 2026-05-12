import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = "https://kayzen-pronostic.fr";
  const now  = new Date().toISOString();
  return [
    { url: base,                                  lastModified: now, changeFrequency: "daily",   priority: 1.0 },
    { url: `${base}/pronostics`,                  lastModified: now, changeFrequency: "daily",   priority: 0.9 },
    { url: `${base}/tarifs`,                      lastModified: now, changeFrequency: "monthly", priority: 0.8 },
    { url: `${base}/techniques-prediction`,       lastModified: now, changeFrequency: "monthly", priority: 0.7 },
    { url: `${base}/lexique`,                     lastModified: now, changeFrequency: "monthly", priority: 0.7 },
    { url: `${base}/mentions-legales`,            lastModified: now, changeFrequency: "yearly",  priority: 0.3 },
    { url: `${base}/cgu`,                         lastModified: now, changeFrequency: "yearly",  priority: 0.3 },
    { url: `${base}/confidentialite`,             lastModified: now, changeFrequency: "yearly",  priority: 0.3 },
    { url: `${base}/cookies`,                     lastModified: now, changeFrequency: "yearly",  priority: 0.3 },
    { url: `${base}/accessibilite`,               lastModified: now, changeFrequency: "yearly",  priority: 0.2 },
    { url: `${base}/jeu-responsable`,             lastModified: now, changeFrequency: "yearly",  priority: 0.4 },
    { url: `${base}/kz-score`,                    lastModified: now, changeFrequency: "monthly", priority: 0.7 },
  ];
}
