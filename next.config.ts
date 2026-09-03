import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === "development";

/**
 * Content-Security-Policy.
 *
 * `unsafe-inline` sur script-src est nécessaire tant qu'il n'y a pas de nonce
 * par requête : layout.tsx injecte deux scripts inline (le JSON-LD et le
 * script de thème anti-FOUC, qui doit s'exécuter avant le premier rendu),
 * auxquels s'ajoute le bootstrap d'hydratation de Next.
 *
 * Retirer `unsafe-inline` est prévu et suppose un `proxy.ts` (nom du middleware
 * dans Next 16) qui génère un nonce par requête, le pose dans l'en-tête CSP de
 * la réponse et le transmet aux scripts inline via `headers()` ; la CSP ne
 * peut alors plus être statique ici. `unsafe-eval` reste réservé au
 * développement (rafraîchissement à chaud).
 *
 * Les casaques proviennent de assets.racingdata.pmu.fr ; les polices sont
 * empaquetées localement via @fontsource, d'où font-src limité à 'self'.
 */
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://assets.racingdata.pmu.fr",
  "font-src 'self' data:",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "frame-src 'none'",
  "manifest-src 'self'",
  "upgrade-insecure-requests",
].join("; ");

const nextConfig: NextConfig = {
  serverExternalPackages: ["@react-pdf/renderer"],
  // N'annonce pas la technologie sous-jacente dans les en-têtes de réponse.
  poweredByHeader: false,
  /**
   * `/kz-score` était indexé et lié depuis le pied de page, le sitemap et la
   * page 404. Le renommage de la marque déplace la page sur `/prono-score` :
   * sans redirection permanente, les liens entrants et l'antériorité de l'URL
   * seraient perdus, et le sitemap déclarerait une page absente.
   */
  async redirects() {
    return [{ source: "/kz-score", destination: "/prono-score", permanent: true }];
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: csp },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
          // Le site n'a aucune raison d'être encadré : bloque le clickjacking.
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          // Évite de fuiter les URL complètes (avec ?raceId=, ?date=) vers les
          // hôtes tiers sollicités pour les images.
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()",
          },
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
          { key: "X-DNS-Prefetch-Control", value: "off" },
        ],
      },
    ];
  },
};

export default nextConfig;
