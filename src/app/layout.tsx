import type { Metadata } from "next";
import { ThemeToggle } from "@/components/theme-toggle";
import "./globals.css";

export const metadata: Metadata = {
  title: "KAYZEN TURF AI",
  description: "Plateforme SaaS open source pour l'analyse predictive des courses hippiques.",
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
        <ThemeToggle />
        {children}
      </body>
    </html>
  );
}
