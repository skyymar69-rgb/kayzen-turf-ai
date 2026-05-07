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

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <body>
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
