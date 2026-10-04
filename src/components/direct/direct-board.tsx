"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ArrowRight, CalendarClock } from "lucide-react";
import { DisciplinePill, RaceStatusPill, titleCase } from "@/components/badges";
import { EmptyState, RacecourseDot } from "@/components/ui-kit";
import { STANCE_LABELS } from "@/lib/confrontation";
import { directStatus, inDirectWindow, nextDirectRace, type DirectRace } from "@/lib/direct";
import { formatOdds } from "@/lib/format";
import { minutesToStart } from "@/lib/race-status";

const TICK_MS = 15_000;
const REFRESH_MS = 60_000;

/** Heure courante, rafraîchie toutes les 15 s — `null` au rendu serveur pour éviter un écart d'hydratation. */
function useNow(): Date | null {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    const tick = () => setNow(new Date());
    tick();
    const id = window.setInterval(tick, TICK_MS);
    return () => window.clearInterval(id);
  }, []);
  return now;
}

function countdownLabel(minutes: number): string {
  if (minutes <= 0) return `Parti il y a ${Math.max(1, Math.round(-minutes))} min`;
  if (minutes < 1) return "Départ imminent";
  return `Départ dans ${Math.round(minutes)} min`;
}

export function DirectBoard({ races }: { races: DirectRace[] }) {
  const router = useRouter();
  const now = useNow();

  // Les cotes et les arrivées changent côté serveur : on relit la page
  // chaque minute, sans recharger le navigateur.
  useEffect(() => {
    const id = window.setInterval(() => router.refresh(), REFRESH_MS);
    return () => window.clearInterval(id);
  }, [router]);

  const live = useMemo(() => (now ? inDirectWindow(races, now) : []), [races, now]);
  const upcoming = now ? nextDirectRace(races, now) : null;

  // Titre d'onglet : « 3 min · R1C4 », pour suivre depuis un autre onglet.
  useEffect(() => {
    const first = live[0];
    const minutes = first && now ? minutesToStart(first, now) : null;
    const base = "Direct — Kayzen Turf";
    const shown = first && minutes !== null && minutes > 0 ? `${Math.max(1, Math.round(minutes))} min · ${first.anchor} — Kayzen Turf` : base;
    document.title = shown;
    return () => {
      // Après une navigation, Next a déjà posé le titre de la page suivante :
      // on ne restaure que si le titre est encore le nôtre.
      if (document.title === shown) document.title = base;
    };
  }, [live, now]);

  if (!now) {
    return <div className="h-40 animate-pulse rounded-2xl border border-border bg-surface" aria-hidden="true" />;
  }

  if (live.length === 0) {
    return (
      <EmptyState icon={CalendarClock} title="Aucune course dans les 30 prochaines minutes.">
        {upcoming ? (
          <p>
            Prochaine : {upcoming.anchor} {titleCase(upcoming.racecourse)} à {upcoming.startTime}.{" "}
            <Link className="font-semibold text-accent-text underline-offset-2 hover:underline" href={`/races/${encodeURIComponent(upcoming.id)}`}>
              Voir l&apos;analyse
            </Link>
          </p>
        ) : (
          <p>Plus aucune course aujourd&apos;hui.</p>
        )}
      </EmptyState>
    );
  }

  return (
    <ol className="space-y-4" aria-label="Courses du direct">
      {live.map((race) => {
        const minutes = minutesToStart(race, now) ?? 0;
        const status = directStatus(race, now);
        return (
          <li key={race.id} className="overflow-hidden rounded-2xl border border-border bg-surface shadow-sm">
            <div className="flex flex-wrap items-center gap-3 border-b border-border bg-surface-sub px-5 py-3">
              <span className="font-mono text-lg font-bold text-fg">{race.anchor}</span>
              <span className="inline-flex items-center gap-1.5 text-sm text-muted"><RacecourseDot racecourse={race.racecourse} />{titleCase(race.racecourse)}</span>
              <DisciplinePill discipline={race.discipline} />
              <RaceStatusPill status={status} />
              <span className={`ml-auto font-mono text-xl font-bold ${minutes > 0 && minutes <= 5 ? "text-danger" : "text-fg"}`}>
                {countdownLabel(minutes)}
              </span>
            </div>
            <div className="grid gap-4 p-5 sm:grid-cols-[1fr_auto] sm:items-center">
              <div>
                <h2 className="font-display text-xl font-bold text-fg">{titleCase(race.name)}</h2>
                <p className="mt-0.5 text-sm text-muted">
                  {race.startTime} · {race.runners} partants
                </p>
                {race.arrival.length > 0 ? (
                  <p className="mt-3 font-mono text-2xl font-bold text-accent-text">Arrivée : {race.arrival.join(" – ")}</p>
                ) : (
                  <ul className="mt-3 grid gap-2 sm:grid-cols-3" aria-label="Ordre probable de l'IA">
                    {race.top.map((r, i) => (
                      <li key={r.number} className="rounded-xl border border-border bg-surface-sub p-3">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-muted">{i === 0 ? "Base IA" : `${i + 1}e`}</p>
                        <p className="mt-1 text-lg font-bold text-fg">
                          <span className="font-mono">{r.number}</span> {titleCase(r.name)}
                        </p>
                        <p className="text-sm text-muted">
                          {r.win.toFixed(0)} % · cote {formatOdds(r.odds ?? NaN, 1)}
                          {r.stance && <span className="block text-xs font-semibold text-accent-text">{STANCE_LABELS[r.stance]}</span>}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <Link
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-accent px-5 py-3 text-sm font-bold text-accent-fg transition hover:bg-accent-hi"
                href={`/races/${encodeURIComponent(race.id)}`}
              >
                Analyse <ArrowRight aria-hidden="true" size={14} />
              </Link>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
