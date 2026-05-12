import type { Metadata } from "next";
import { BackToTop } from "@/components/back-to-top";
import { CookieBanner } from "@/components/cookie-banner";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Kayzen Turf AI — Pronostics PMU assistés par IA",
    template: "%s — Kayzen Turf AI",
  },
  description:
    "Analysez les courses PMU avec l'intelligence artificielle : probabilités, value bets, tickets optimisés et suivi de performance. Hier, aujourd'hui, demain.",
  keywords: ["pronostics PMU", "turf IA", "value bet", "courses hippiques", "Quinte+", "analyse turf"],
  authors: [{ name: "Kayzen Lyon", url: "https://kayzen-lyon.fr" }],
  robots: { index: true, follow: true },
  openGraph: {
    type: "website",
    locale: "fr_FR",
    siteName: "Kayzen Turf AI",
    title: "Kayzen Turf AI — Pronostics PMU assistés par IA",
    description:
      "Analysez les courses PMU avec l'intelligence artificielle : probabilités, value bets, tickets optimisés et suivi de performance.",
  },
};

/* amélioration #11 — JSON-LD structured data */
const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebSite",
      "@id": "https://kayzen-turf-ai.vercel.app/#website",
      url: "https://kayzen-turf-ai.vercel.app/",
      name: "Kayzen Turf AI",
      description: "Plateforme d'aide à la décision pour pronostics hippiques PMU assistée par IA.",
      inLanguage: "fr-FR",
      potentialAction: {
        "@type": "SearchAction",
        target: "https://kayzen-turf-ai.vercel.app/?q={search_term_string}",
        "query-input": "required name=search_term_string",
      },
    },
    {
      "@type": "Organization",
      "@id": "https://kayzen-turf-ai.vercel.app/#organization",
      name: "Kayzen",
      url: "https://kayzen-lyon.fr",
      logo: {
        "@type": "ImageObject",
        url: "https://kayzen-turf-ai.vercel.app/logo.png",
      },
    },
  ],
};

/* amélioration #12 — ThemeScript : évite le flash (FOUC) en dark mode */
const themeScript = `
(function(){
  try {
    var s = localStorage.getItem('kayzen-theme');
    var d = document.documentElement;
    if (s === 'dark' || (!s && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
      d.dataset.theme = 'dark';
    } else {
      d.dataset.theme = 'light';
    }
  } catch(e){}
})();
`;

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <head>
        {/* amélioration #13 — preconnect pour les fonts */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* PWA manifest (#78) */}
        <link rel="manifest" href="/manifest.json" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="Kayzen Turf" />
        <meta name="theme-color" content="#16a34a" />
        {/* JSON-LD */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body>
        {/* amélioration #12 — ThemeScript inline (avant tout rendu) */}
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <a className="skip-link" href="#contenu-principal">
          Aller au contenu principal
        </a>
        <SiteHeader />
        {children}
        <SiteFooter />
        <CookieBanner />
        <BackToTop />
      </body>
    </html>
  );
}
