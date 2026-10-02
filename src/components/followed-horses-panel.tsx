"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { BellRing, Star } from "lucide-react";
import { useFollowedHorses } from "@/hooks/use-followed-horses";
import { formatOdds } from "@/lib/format";
import { instantDepart } from "@/lib/paris-time";
import { buildSelection } from "@/lib/selection";
import type { RaceAnalysis } from "@/lib/types";
import { ProfileBadge } from "@/components/course/shared";

/**
 * MES CHEVAUX — les engagements des chevaux suivis sur le programme chargé
 * (hier, aujourd'hui, demain), avec leur profil du moment. Une alerte s'allume
 * quand l'un d'eux part dans moins de 30 minutes. Le suivi vit dans le
 * navigateur du visiteur : aucun compte, aucune donnée transmise.
 */
export function FollowedHorsesPanel({ races }: { races: RaceAnalysis[] }) {
  const { followed, toggle } = useFollowedHorses();
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    const first = setTimeout(() => setNow(Date.now()), 0);
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => {
      clearTimeout(first);
      clearInterval(id);
    };
  }, []);

  const engagements = useMemo(() => {
    if (followed.size === 0) return [];
    return races
      .flatMap((race) => {
        const field = buildSelection(race.horses).field;
        return field
          .filter((s) => s.horse.horseId && followed.has(s.horse.horseId))
          .map((s) => ({ race, entry: s, start: instantDepart(race.raceDate, race.startTime)?.getTime() ?? 0 }));
      })
      .sort((a, b) => a.start - b.start);
  }, [races, followed]);

  if (followed.size === 0) return null;

  return (
    <section className="mt-4 rounded-2xl border border-border bg-surface shadow-sm" aria-labelledby="mes-chevaux">
      <div className="flex items-center gap-3 border-b border-border px-5 py-4">
        <Star aria-hidden="true" className="fill-amber-400 text-amber-400" size={18} />
        <div>
          <h2 id="mes-chevaux" className="font-display text-lg font-bold text-fg">Mes chevaux suivis</h2>
          <p className="text-xs text-muted">{followed.size} cheval{followed.size > 1 ? "x" : ""} suivi{followed.size > 1 ? "s" : ""} · mémorisé{followed.size > 1 ? "s" : ""} dans ce navigateur</p>
        </div>
      </div>

      {engagements.length === 0 ? (
        <p className="px-5 py-4 text-sm text-muted">Aucun de vos chevaux ne court hier, aujourd&apos;hui ou demain.</p>
      ) : (
        <ul className="divide-y divide-border">
          {engagements.map(({ race, entry, start }) => {
            const minutes = now !== null ? Math.round((start - now) / 60_000) : null;
            const soon = minutes !== null && minutes >= 0 && minutes <= 30;
            const finished = entry.horse.finishPosition != null;
            return (
              <li key={`${race.id}-${entry.horse.number}`} className={`flex flex-wrap items-center gap-3 px-5 py-3 ${soon ? "bg-accent-lo" : ""}`}>
                <span className="w-24 shrink-0 font-mono text-xs text-muted">
                  {race.relativeDay === "today" ? "Aujourd'hui" : race.relativeDay === "tomorrow" ? "Demain" : "Hier"} {race.startTime}
                </span>
                <span className="min-w-0 flex-1">
                  <Link className="font-semibold text-fg hover:text-accent-text" href={`/races/${encodeURIComponent(race.id)}`}>
                    {entry.horse.horse}
                  </Link>
                  <span className="ml-2 text-xs text-muted">n° {entry.horse.number} · {race.programCode} {race.racecourse}</span>
                </span>
                <ProfileBadge profile={entry.profile} />
                <span className="font-mono text-xs text-muted">{finished ? `Arrivé ${entry.horse.finishPosition}e` : `cote ${formatOdds(entry.horse.odds, 1)} · rang ${entry.rank}`}</span>
                {soon && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-cta/15 px-2 py-0.5 text-[11px] font-bold text-accent-text" role="status">
                    <BellRing aria-hidden="true" size={12} /> Départ dans {minutes} min
                  </span>
                )}
                <button
                  aria-label={`Ne plus suivre ${entry.horse.horse}`}
                  className="text-xs text-muted underline-offset-2 hover:underline"
                  onClick={() => toggle({ id: entry.horse.horseId!, name: entry.horse.horse })}
                  type="button"
                >
                  Retirer
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
