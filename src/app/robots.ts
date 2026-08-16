import type { MetadataRoute } from "next";

import { SITE_URL } from "@/lib/site";

/**
 * /robots.txt renvoyait 404 : aucune directive de crawl, aucune déclaration de
 * sitemap. Les routes /api/ sont exclues — elles n'ont aucune valeur
 * d'indexation et leur exploration coûte du budget de crawl.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/api/"] }],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
