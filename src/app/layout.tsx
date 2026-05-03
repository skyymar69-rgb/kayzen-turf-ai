import type { Metadata } from "next";
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
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
