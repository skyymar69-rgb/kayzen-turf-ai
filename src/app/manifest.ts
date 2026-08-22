import type { MetadataRoute } from "next";

/**
 * `public/manifest.json` déclarait /icon-192.png et /icon-512.png : deux
 * fichiers absents du dépôt. Le manifeste était donc invalide et la PWA
 * non installable. Les icônes sont désormais générées par
 * `scripts/generate-icons.mjs`, et le manifeste passe en TypeScript pour être
 * vérifié à la compilation plutôt qu'à l'exécution.
 *
 * Next injecte lui-même le `<link rel="manifest">` : le lien manuel du layout
 * a été retiré pour éviter la double déclaration.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "PronoTurf",
    short_name: "PronoTurf",
    description: "Pronostics hippiques PMU assistés par IA — analyses, value bets, tickets Quinté+",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#0c1a11",
    theme_color: "#0c2318",
    orientation: "portrait-primary",
    lang: "fr-FR",
    dir: "ltr",
    categories: ["sports", "finance"],
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      // `purpose: "maskable any"` sur une icône à bords perdus faisait rogner le
      // monogramme par le masque circulaire d'Android. La variante maskable
      // réserve la zone de sécurité de 80 % et vit dans son propre fichier.
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      {
        name: "Programme du jour",
        short_name: "Programme",
        description: "Voir les courses du jour",
        url: "/",
        icons: [{ src: "/icon-192.png", sizes: "192x192", type: "image/png" }],
      },
      {
        name: "Pronostics PMU",
        short_name: "Pronostics",
        description: "Tous les pronostics disponibles",
        url: "/pronostics",
        icons: [{ src: "/icon-192.png", sizes: "192x192", type: "image/png" }],
      },
    ],
  };
}
