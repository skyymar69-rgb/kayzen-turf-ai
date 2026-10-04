import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Flag } from "lucide-react";
import { AiDisclosure } from "@/components/ai-disclosure";
import { BetBadge } from "@/components/badges";
import { DaySelector } from "@/components/pronostics/day-selector";
import { PronosticsExplorer } from "@/components/pronostics/pronostics-explorer";
import { parseDayParam, type RelativeDay } from "@/lib/pronostics-filters";
import { loadPronostics } from "./load-pronostics";

// Le calcul des pronostics est mis en cache 60 s par jour dans
// `loadPronostics` ; la page reste rafraîchie au même rythme.
export const revalidate = 60;

type PageProps = { searchParams: Promise<{ jour?: string | string[] }> };

const TITLES: Record<RelativeDay, string> = {
  yesterday: "Pronostics PMU d’hier",
  today: "Pronostics PMU du jour",
  tomorrow: "Pronostics PMU de demain",
};

const EYEBROWS: Record<RelativeDay, string> = {
  yesterday: "Toutes les courses d’hier",
  today: "Toutes les courses du jour",
  tomorrow: "Toutes les courses de demain",
};

const EMPTY: Record<RelativeDay, string> = {
  yesterday: "Aucune course disponible pour hier.",
  today: "Aucune course disponible aujourd’hui.",
  tomorrow: "Le programme de demain n’est pas encore publié.",
};

export async function generateMetadata({ searchParams }: PageProps): Promise<Metadata> {
  const { day } = parseDayParam((await searchParams).jour);
  return {
    title: TITLES[day],
    description: "Toutes les courses françaises avec ordre probable, base IA, value bet prioritaire et tickets proposés — hier, aujourd’hui, demain.",
    // Une seule adresse de référence, quel que soit le jour affiché.
    alternates: { canonical: "/pronostics" },
  };
}

export default async function PronosticsPage({ searchParams }: PageProps) {
  const { param, day } = parseDayParam((await searchParams).jour);
  const races = await loadPronostics(day);
  // Instant de rendu : l'hydratation part des mêmes états de course que le HTML.
  // eslint-disable-next-line react-hooks/purity -- composant serveur, rendu une fois par requête
  const serverNow = Date.now();

  const totalHorses = races.reduce((t, r) => t + r.horses.length, 0);
  const valueRaces = races.filter((r) => r.valueBet).length;
  const bets = new Set(races.flatMap((r) => r.bets));

  return (
    <main className="min-h-screen bg-bg pb-24" id="contenu-principal">
      <div className="mx-auto max-w-[1480px] px-4 pt-8 sm:px-6 lg:px-8">

        {/* En-tête de page */}
        <section className="mb-6 rounded-2xl border border-border bg-surface p-6 shadow-sm sm:p-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <span className="inline-flex items-center gap-2 rounded-full border border-accent/30 bg-accent-lo px-3 py-1 text-xs font-bold uppercase tracking-widest text-accent-text">
                <Flag aria-hidden="true" size={11} />
                {EYEBROWS[day]}
              </span>
              <h1 className="mt-4 font-display text-4xl font-bold text-fg sm:text-5xl">{TITLES[day]}</h1>
              <p className="mt-3 max-w-2xl text-base leading-7 text-muted">
                Récapitulatif de toutes les courses françaises avec ordre probable, base IA, value bet
                et tickets proposés. Données rafraîchies toutes les minutes.
              </p>
              <div className="mt-5">
                <DaySelector current={param} />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3 lg:min-w-[180px] lg:shrink-0 lg:grid-cols-1">
              <QuickStat label="Courses" value={races.length} />
              <QuickStat label="Partants" value={totalHorses} />
              <QuickStat label="Value bets" value={valueRaces} accent />
            </div>
          </div>

          {bets.size > 0 && (
            <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-border pt-4 text-xs text-muted">
              <span className="font-semibold text-fg">Paris phares :</span>
              {(["QUINTE_PLUS", "QUARTE_PLUS", "PICK5"] as const).filter((b) => bets.has(b)).map((b) => (
                <BetBadge key={b} bet={b} className="text-xs" />
              ))}
            </div>
          )}
        </section>

        <AiDisclosure />

        {races.length === 0 ? (
          <div className="rounded-2xl border border-border bg-surface p-12 text-center">
            <Flag aria-hidden="true" className="mx-auto text-muted" size={36} />
            <p className="mt-4 text-lg font-semibold text-fg">{EMPTY[day]}</p>
            <Link href="/" className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-accent-text hover:text-accent">
              Voir le programme complet <ArrowRight aria-hidden="true" size={14} />
            </Link>
          </div>
        ) : (
          <PronosticsExplorer key={day} races={races} day={day} serverNow={serverNow} />
        )}

        {races.length > 0 && (
          <div className="mt-8 text-center">
            <Link href="/" className="inline-flex items-center gap-2 text-sm font-semibold text-accent-text hover:text-accent">
              ← Retour au programme complet
            </Link>
          </div>
        )}
      </div>
    </main>
  );
}

function QuickStat({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <div className={`rounded-xl border p-3 ${accent ? "border-accent/30 bg-accent-lo" : "border-border bg-surface-sub"}`}>
      <p className="text-xs font-bold uppercase tracking-widest text-muted">{label}</p>
      <p className={`mt-1 font-display text-2xl font-bold ${accent ? "text-accent-text" : "text-fg"}`}>{value}</p>
    </div>
  );
}
