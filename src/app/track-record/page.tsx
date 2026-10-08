import Link from "next/link";
import type { Metadata } from "next";
import { ArrowLeft, LineChart } from "lucide-react";
import { TrackRecordBody } from "@/components/track/track-record-body";
import { getLatestTrackRecord } from "@/lib/race-repository";
import type { Report } from "./report-types";

export const metadata: Metadata = {
  title: "Suivi de performance — réussite et ROI de chaque signal",
  description:
    "Le rendement réel de chaque signal Kayzen Turf, calculé sur les rapports officiels PMU, net du prélèvement, hors échantillon d'abord, avec la marge d'erreur et la correction pour le nombre de signaux testés — même quand il est négatif.",
  alternates: { canonical: "/track-record" },
};

/** Le rapport est régénéré une fois par jour : une heure de cache suffit. */
export const revalidate = 3600;

export default async function TrackRecordPage() {
  const report = (await getLatestTrackRecord()) as unknown as Report | null;

  return (
    <main className="min-h-screen bg-bg pb-20" id="contenu-principal">
      <div className="mx-auto max-w-5xl px-4 pt-6 sm:px-6 lg:px-8">
        <Link
          className="mb-6 inline-flex items-center gap-2 rounded-xl border border-border bg-surface px-3.5 py-2 text-sm font-medium text-muted shadow-sm transition hover:border-accent hover:text-accent-text"
          href="/"
        >
          <ArrowLeft size={14} /> Accueil
        </Link>

        <div className="mb-8 flex items-center gap-4">
          <div className="grid size-14 place-items-center rounded-2xl bg-accent-lo">
            <LineChart className="text-accent-text" size={26} />
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-muted">Suivi de performance</p>
            <h1 className="font-display text-3xl font-bold text-fg">Ce que nos signaux ont réellement rapporté</h1>
            <p className="mt-1 text-sm text-muted">
              Calculé sur les rapports officiels du PMU, prélèvement déduit. Hors échantillon d&apos;abord. Publié même quand c&apos;est négatif.
            </p>
          </div>
        </div>

        {!report ? (
          <p className="rounded-2xl border border-border bg-surface p-6 text-sm text-muted">Le premier rapport est en cours de calcul.</p>
        ) : (
          <TrackRecordBody report={report} />
        )}
      </div>
    </main>
  );
}
