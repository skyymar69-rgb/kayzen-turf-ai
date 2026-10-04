import type { Metadata } from "next";
import Link from "next/link";
import { WifiOff } from "lucide-react";

export const metadata: Metadata = {
  title: "Hors ligne",
  robots: { index: false, follow: false },
};

/**
 * Page de secours servie par le service worker quand le réseau manque et
 * qu'aucune copie de la page demandée n'a été gardée. Statique : elle doit
 * s'afficher sans aucune donnée.
 */
export default function HorsLignePage() {
  return (
    <main className="min-h-[60vh] bg-bg px-4 py-16" id="contenu-principal">
      <div className="mx-auto max-w-lg rounded-2xl border border-border bg-surface p-8 text-center shadow-sm">
        <WifiOff aria-hidden="true" className="mx-auto text-muted" size={36} />
        <h1 className="mt-4 font-display text-2xl font-bold text-fg">Vous êtes hors ligne</h1>
        <p className="mt-3 text-sm leading-6 text-muted">
          Cette page n&apos;a pas encore été consultée sur cet appareil. Les pages déjà ouvertes (programme, pronostics,
          courses) restent lisibles hors ligne, dans leur dernière version — les cotes y sont figées et ne doivent pas
          servir à jouer.
        </p>
        <Link className="mt-6 inline-flex rounded-xl bg-accent px-5 py-3 text-sm font-bold text-accent-fg hover:bg-accent-hi" href="/">
          Réessayer
        </Link>
      </div>
    </main>
  );
}
