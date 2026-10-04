import Link from "next/link";
import { useMemo } from "react";
import { PROFILE_LABELS } from "@/lib/profiles";
import { hasValueBet } from "@/lib/home/race-signals";
import { buildSelection } from "@/lib/selection";
import type { RaceAnalysis } from "@/lib/types";
import { raceHref } from "./types";

const PROFILES = ["base", "cache", "value", "outsider", "eviter"] as const;

/** Profils du jour (histogramme) et value bets du programme. */
export function ProfilesPanel({ races }: { races: RaceAnalysis[] }) {
  const profiled = useMemo(() => races.map((race) => buildSelection(race.horses)), [races]);
  if (races.length === 0) return null;

  const counts = PROFILES.map((profile) => ({
    profile,
    count: profiled.reduce((t, selection) => t + selection.field.filter((f) => f.profile === profile).length, 0),
  }));
  const maxCount = Math.max(...counts.map((c) => c.count), 1);
  const valueBetRaces = races.filter(hasValueBet);
  const runners = races.reduce((t, r) => t + r.horses.length, 0);
  const readable = profiled.filter((s) => s.verdict.reading === "lisible").length;
  const traps = profiled.filter((s) => s.verdict.reading === "piege").length;

  return (
    <section className="mt-4 grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-2" aria-label="Profils du jour et value bets">
      <div className="rounded-2xl border border-border bg-surface p-5 shadow-sm">
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted">Profils · {runners} partants</p>
        <h2 className="mt-0.5 font-display text-lg font-bold text-fg">Lecture du programme</h2>
        <div className="mt-4 flex items-end gap-2">
          {counts.map(({ profile, count }) => (
            <div key={profile} className="flex flex-1 flex-col items-center gap-1">
              <span className="text-[10px] font-bold text-accent-text">{count > 0 ? count : ""}</span>
              <div className="flex w-full items-end overflow-hidden rounded-t-md bg-border" style={{ height: 64 }}>
                <div className="w-full rounded-t-md bg-accent/70 transition-all" style={{ height: `${Math.round((count / maxCount) * 100)}%` }} />
              </div>
              <span className="text-[11px] text-muted">{PROFILE_LABELS[profile]}</span>
            </div>
          ))}
        </div>
        <p className="mt-3 text-xs text-muted">
          <strong className="text-fg">{races.length}</strong> courses ·{" "}
          <strong className="text-fg">{readable}</strong> lisibles ·{" "}
          <strong className="text-fg">{traps}</strong> pièges ·{" "}
          <Link className="font-semibold text-accent-text hover:underline" href="/methode">règles des profils</Link>
        </p>
      </div>

      <div className="rounded-2xl border border-border bg-surface p-5 shadow-sm">
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted">Timeline · {valueBetRaces.length} course{valueBetRaces.length !== 1 ? "s" : ""}</p>
        <h2 className="mt-0.5 font-display text-lg font-bold text-fg">Value Bets du jour</h2>
        {valueBetRaces.length === 0 ? (
          <p className="mt-4 text-sm text-muted">Aucun signal value détecté sur ce programme.</p>
        ) : (
          <div className="mt-4 grid gap-2">
            {valueBetRaces.slice(0, 5).map((race) => {
              const best = [...race.horses].sort((a, b) => b.valueIndex - a.valueIndex)[0];
              return (
                <Link
                  key={race.id}
                  href={raceHref(race)}
                  className="flex items-center gap-3 rounded-xl border border-border bg-surface-sub px-3 py-2.5 transition hover:border-accent/30 hover:bg-accent-lo"
                >
                  <span className="w-12 shrink-0 font-mono text-xs font-bold text-muted">{race.startTime}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-semibold text-fg">{race.programCode} · {race.name.charAt(0).toUpperCase() + race.name.slice(1).toLowerCase()}</p>
                  </div>
                  <span className="shrink-0 rounded-full bg-warn-lo px-2 py-0.5 text-[10px] font-bold text-warn">
                    #{best.number} +{Math.round(best.valueIndex)}%
                  </span>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
