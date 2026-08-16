import type { Metadata, Viewport } from "next";
import { BackToTop } from "@/components/back-to-top";
import { CookieBanner } from "@/components/cookie-banner";
import { DemoBanner } from "@/components/demo-banner";
import { JsonLd } from "@/components/json-ld";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { estModeDemonstration } from "@/lib/race-repository";
import { SITE_URL } from "@/lib/site";
import "./globals.css";

export const metadata: Metadata = {
  // Sans `metadataBase`, Next ne sait pas résoudre les URLs relatives : les
  // canonicals et les images Open Graph des pages filles restaient absents.
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Kayzen Turf AI — Pronostics PMU assistés par IA",
    template: "%s — Kayzen Turf AI",
  },
  description:
    "Analysez les courses PMU avec l'intelligence artificielle : probabilités, value bets, tickets optimisés et suivi de performance. Hier, aujourd'hui, demain.",
  keywords: ["pronostics PMU", "turf IA", "value bet", "courses hippiques", "Quinte+", "analyse turf"],
  authors: [{ name: "Kayzen Lyon", url: "https://kayzen-lyon.fr" }],
  robots: { index: true, follow: true },
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    locale: "fr_FR",
    siteName: "Kayzen Turf AI",
    url: "/",
    title: "Kayzen Turf AI — Pronostics PMU assistés par IA",
    description:
      "Analysez les courses PMU avec l'intelligence artificielle : probabilités, value bets, tickets optimisés et suivi de performance.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Kayzen Turf AI — Pronostics PMU assistés par IA",
    description:
      "Analysez les courses PMU avec l'intelligence artificielle : probabilités, value bets, tickets optimisés et suivi de performance.",
  },
  // Next génère lui-même les balises depuis src/app/icon.png et
  // src/app/apple-icon.png : rien à déclarer ici.
  formatDetection: { telephone: false },
};

/**
 * `theme-color` et le viewport se déclarent dans `viewport`, pas dans
 * `metadata` — Next 16 ignore silencieusement `themeColor` placé dans
 * `metadata`, ce qui privait Android de la couleur de barre système.
 *
 * `maximum-scale` et `user-scalable=no` sont volontairement absents : les
 * interdire empêche le zoom, ce que le critère WCAG 1.4.4 (redimensionnement
 * du texte, niveau AA) proscrit.
 */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#0c2318" },
    { media: "(prefers-color-scheme: dark)", color: "#0c1a11" },
  ],
};

/* JSON-LD structured data. Le domaine vient de `SITE_URL` pour ne plus
   diverger du sitemap et des canonicals. */
const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebSite",
      "@id": `${SITE_URL}/#website`,
      url: `${SITE_URL}/`,
      name: "Kayzen Turf AI",
      description: "Plateforme d'aide à la décision pour pronostics hippiques PMU assistée par IA.",
      inLanguage: "fr-FR",
      potentialAction: {
        "@type": "SearchAction",
        target: `${SITE_URL}/?q={search_term_string}`,
        "query-input": "required name=search_term_string",
      },
    },
    {
      "@type": "Organization",
      "@id": `${SITE_URL}/#organization`,
      name: "Kayzen",
      url: "https://kayzen-lyon.fr",
      logo: {
        "@type": "ImageObject",
        url: `${SITE_URL}/logo.png`,
      },
    },
  ],
};

/**
 * Applique le thème avant le premier rendu, pour éviter le flash de thème clair
 * (FOUC) sur un appareil en mode sombre.
 *
 * Le script journalise désormais son propre échec : `catch(e){}` masquait un
 * localStorage bloqué (navigation privée, cookies tiers refusés) et le thème
 * restait clair sans qu'on sache pourquoi. Le repli explicite garde un thème
 * cohérent avec la préférence système.
 */
const themeScript = `
(function(){
  var d = document.documentElement;
  try {
    var s = localStorage.getItem('kayzen-theme');
    var sombre = s === 'dark' || (!s && window.matchMedia('(prefers-color-scheme: dark)').matches);
    d.dataset.theme = sombre ? 'dark' : 'light';
  } catch (e) {
    d.dataset.theme = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
})();
`;

/**
 * Filet pour les rejets de promesses non traités.
 *
 * Sans lui, une promesse rejetée hors d'un `try` (un `fetch` avorté, une API
 * navigateur refusée) ne produisait qu'une trace console : ni frontière
 * d'erreur, ni journal exploitable. On les capte au plus tôt, avant même le
 * chargement du bundle React.
 */
const unhandledRejectionScript = `
window.addEventListener('unhandledrejection', function (e) {
  console.error('Promesse rejetée non traitée :', e.reason);
});
`;

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <head>
        {/* Les preconnect vers fonts.googleapis.com et fonts.gstatic.com ont été
            retirés : ils étaient inutiles — les polices sont auto-hébergées via
            @fontsource, importées dans globals.css — et ils transmettaient l'IP
            du visiteur à Google avant tout consentement (RGPD art. 6 et 44-49).

            Le `<link rel="manifest">` manuel a disparu : il pointait sur
            /manifest.json, dont les icônes n'existaient pas. Next injecte le lien
            à partir de src/app/manifest.ts. */}
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="Kayzen Turf" />
        {/* Données structurées, échappées contre la sortie de balise. */}
        <JsonLd data={jsonLd} />
      </head>
      <body>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <script dangerouslySetInnerHTML={{ __html: unhandledRejectionScript }} />
        <a className="skip-link" href="#contenu-principal">
          Aller au contenu principal
        </a>
        {estModeDemonstration() && <DemoBanner />}
        <SiteHeader />
        {children}
        <SiteFooter />
        <CookieBanner />
        <BackToTop />
      </body>
    </html>
  );
}
