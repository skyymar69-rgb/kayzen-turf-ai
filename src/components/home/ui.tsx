import type { ReactNode } from "react";
import type { MeetingDifficulty } from "@/lib/home/meetings";
import { raceStatusAt, statusLabel } from "@/lib/home/race-signals";
import type { RaceAnalysis } from "@/lib/types";

/* Petites briques d'affichage de l'accueil. */

export function InsightCard({ icon, label, tone, value, detail }: {
  icon: ReactNode; label: string; tone: "green" | "amber" | "dark"; value: string; detail: string;
}) {
  const cls = {
    green: "border-accent/20 bg-accent-lo text-fg",
    amber: "border-warn/30  bg-warn-lo  text-fg",
    dark: "border-surface-inv bg-surface-inv text-white",
  }[tone];
  return (
    <article className={`rounded-2xl border p-4 shadow-sm ${cls}`}>
      <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest opacity-70">{icon}{label}</div>
      <p className="mt-2 font-display text-2xl font-bold">{value}</p>
      <p className={`mt-1 text-sm ${tone === "dark" ? "text-white/60" : "text-muted"}`}>{detail}</p>
    </article>
  );
}

export function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-surface-sub p-2.5">
      <p className="text-[10px] font-bold uppercase tracking-widest text-muted">{label}</p>
      <p className="mt-0.5 text-xs font-bold text-fg">{value}</p>
    </div>
  );
}

export function SmMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-surface-sub p-3">
      <p className="text-[10px] font-bold uppercase tracking-widest text-muted">{label}</p>
      <p className="mt-1 text-sm font-bold text-fg">{value}</p>
    </div>
  );
}

export function DifficultyPip({ difficulty, active }: { difficulty: MeetingDifficulty; active: boolean }) {
  const cls = active ? "bg-accent-fg/15 text-accent-fg" :
    difficulty === "Facile" ? "bg-accent-lo text-accent-text" :
    difficulty === "Complexe" ? "bg-danger/10 text-danger" :
    "bg-surface-sub text-muted";
  return <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${cls}`}>{difficulty}</span>;
}

/**
 * État d'une course en toutes lettres (« Départ à 15:15 », « Départ imminent
 * 15:15 », « Arrivée disponible »). L'état vient de `raceStatus`, compté à
 * l'heure de Paris ; `dark` sert au bandeau vert du programme.
 */
export function StatusChip({ race, nowMs, dark }: { race: RaceAnalysis; nowMs: number | null; dark?: boolean }) {
  const status = raceStatusAt(race, nowMs === null ? null : new Date(nowMs));
  const label = statusLabel(status, race.startTime);
  const isImminent = status === "imminente";
  if (dark) {
    return (
      <span className={`text-[10px] font-semibold ${isImminent ? "text-cta font-bold" : "text-slate-400"}`}>
        {isImminent && <span aria-hidden="true" className="mr-1 inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-cta align-middle" />}
        {label}
      </span>
    );
  }
  return (
    <span className={`text-xs font-semibold ${isImminent ? "text-accent-text font-bold" : "text-muted"}`}>
      {isImminent && <span aria-hidden="true" className="mr-1 inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-accent align-middle" />}
      {label}
    </span>
  );
}
