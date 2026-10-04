import Link from "next/link";
import { ArrowRight, Flag } from "lucide-react";
import { DAY_ORDER, formatRelativeDay } from "@/lib/home/days";
import type { RaceAnalysis } from "@/lib/types";
import type { DisciplineFilter } from "./types";

/** Aucun programme (ou aucune course de la discipline choisie) pour le jour affiché. */
export function EmptyProgramme({ dayFilter, disciplineFilter, onSelectDay }: {
  dayFilter: RaceAnalysis["relativeDay"];
  disciplineFilter: DisciplineFilter;
  onSelectDay: (day: RaceAnalysis["relativeDay"]) => void;
}) {
  const filtered = disciplineFilter !== "Tous";
  const day = formatRelativeDay(dayFilter).toLowerCase();
  return (
    <main className="grid min-h-[60vh] place-items-center px-4" id="contenu-principal">
      <div className="max-w-md rounded-2xl border border-border bg-surface p-10 text-center shadow-sm">
        <div className="mx-auto mb-5 grid h-16 w-16 place-items-center rounded-2xl border border-border bg-surface-sub">
          <Flag className="text-accent" size={30} />
        </div>
        <h1 className="font-display text-2xl font-bold text-fg">
          {filtered ? `Aucune course de ${disciplineFilter.toLowerCase()}` : "Aucun programme"}
        </h1>
        <p className="mt-2 text-sm leading-6 text-muted">
          {filtered
            ? `Pas de course de ${disciplineFilter.toLowerCase()} ${day} dans notre programme.`
            : `Aucune course française n'est encore disponible pour ${day}. Le programme est importé chaque matin.`}
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2" role="group" aria-label="Changer de jour">
          {DAY_ORDER.filter((d) => d !== dayFilter || filtered).map((d) => (
            <button
              key={d}
              className="inline-flex min-h-10 items-center justify-center rounded-xl bg-cta px-4 text-sm font-semibold text-cta-text transition hover:bg-cta-hi"
              onClick={() => onSelectDay(d)}
              type="button"
            >
              {d === dayFilter ? "Toutes disciplines" : formatRelativeDay(d)}
            </button>
          ))}
          <Link
            href="/pronostics"
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-border px-5 py-2.5 text-sm font-semibold text-fg transition hover:bg-surface-sub"
          >
            Pronostics <ArrowRight size={13} />
          </Link>
        </div>
      </div>
    </main>
  );
}
