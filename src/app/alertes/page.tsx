import type { Metadata } from "next";
import { Bell } from "lucide-react";
import { AlertHistory } from "@/components/alert-history";

export const metadata: Metadata = {
  title: "Mes alertes",
  description: "Historique des alertes push reçues sur cet appareil pour vos chevaux suivis.",
  alternates: { canonical: "/alertes" },
  robots: { index: false, follow: true },
};

export default function AlertesPage() {
  return (
    <main className="min-h-screen bg-bg pb-24" id="contenu-principal">
      <div className="mx-auto max-w-3xl px-4 pt-8 sm:px-6">
        <span className="inline-flex items-center gap-2 rounded-full border border-accent/30 bg-accent-lo px-3 py-1 text-xs font-bold uppercase tracking-widest text-accent-text">
          <Bell aria-hidden="true" size={12} />
          Alertes
        </span>
        <h1 className="mt-3 font-display text-3xl font-bold text-fg sm:text-4xl">Mes alertes</h1>
        <p className="mt-2 text-sm leading-6 text-muted">
          Les alertes envoyées à cet appareil pour vos chevaux suivis : départ imminent, non-partant, smart money,
          cheval délaissé et arrivée. Sans compte : l&apos;historique est lié à l&apos;abonnement de ce navigateur et
          disparaît avec lui.
        </p>
        <div className="mt-6">
          <AlertHistory />
        </div>
      </div>
    </main>
  );
}
