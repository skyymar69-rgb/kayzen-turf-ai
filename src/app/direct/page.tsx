import type { Metadata } from "next";
import { Radio } from "lucide-react";
import { DirectBoard } from "@/components/direct/direct-board";
import { summarizeForDirect } from "@/lib/direct";
import { getRaces } from "@/lib/race-repository";
import { compareRaceTime } from "@/lib/race-status";

// Les cotes sont relues chaque minute dans le dernier quart d'heure : une
// page plus fraîche que 30 s n'apporterait rien et chargerait la base.
export const revalidate = 30;

export const metadata: Metadata = {
  title: "Direct — courses imminentes",
  description: "Les courses PMU des 30 prochaines minutes : ordre probable de l'IA, cotes et compte à rebours, rafraîchis automatiquement.",
  alternates: { canonical: "/direct" },
};

export default async function DirectPage() {
  const races = (await getRaces({ day: "today" })).sort(compareRaceTime).map(summarizeForDirect);

  return (
    <main className="min-h-screen bg-bg pb-24" id="contenu-principal">
      <div className="mx-auto max-w-5xl px-4 pt-8 sm:px-6">
        <header className="mb-6">
          <span className="inline-flex items-center gap-2 rounded-full border border-danger/30 bg-danger/10 px-3 py-1 text-xs font-bold uppercase tracking-widest text-danger">
            <Radio aria-hidden="true" size={12} />
            Direct
          </span>
          <h1 className="mt-3 font-display text-3xl font-bold text-fg sm:text-4xl">Courses imminentes</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
            Les courses des 30 prochaines minutes, et celles parties il y a moins de 10 minutes. La page se met à jour
            seule ; aucune cote n&apos;est définitive avant le départ.
          </p>
        </header>
        <DirectBoard races={races} />
      </div>
    </main>
  );
}
