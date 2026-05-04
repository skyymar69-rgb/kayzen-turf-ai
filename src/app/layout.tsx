import type { Metadata } from "next";
import { CookieBanner } from "@/components/cookie-banner";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { ThemeToggle } from "@/components/theme-toggle";
import "./globals.css";

export const metadata: Metadata = {
  title: "Kayzen Pronostic Turf PMU",
  description: "Pronostics PMU, analyses IA et aide à la décision pour les courses hippiques françaises.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <body>
        <a className="skip-link" href="#contenu-principal">
          Aller au contenu principal
        </a>
        <SiteHeader />
        <ThemeToggle />
        {children}
        <SiteFooter />
        <CookieBanner />
      </body>
    </html>
  );
}
