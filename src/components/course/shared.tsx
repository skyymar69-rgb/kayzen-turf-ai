import type { ReactNode } from "react";
import { PROFILE_LABELS, type Profile } from "@/lib/profiles";

/** Pastilles de profil — mêmes couleurs partout où un profil apparaît. */
export const PROFILE_STYLES: Record<Profile, string> = {
  base: "bg-accent text-white",
  cache: "bg-violet-100 text-violet-900 dark:bg-violet-950 dark:text-violet-200",
  value: "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200",
  favori: "bg-surface-inv text-white",
  outsider: "bg-accent-lo text-accent-text",
  tocard: "border border-border-strong bg-surface-sub text-fg",
  eviter: "bg-danger/10 text-danger",
  second: "bg-surface-sub text-muted",
};

export function ProfileBadge({ profile, className = "" }: { profile: Profile; className?: string }) {
  return (
    <span className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${PROFILE_STYLES[profile]} ${className}`}>
      {PROFILE_LABELS[profile]}
    </span>
  );
}

export function pct(value: number | null | undefined, digits = 0): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return `${value.toFixed(digits).replace(".", ",")} %`;
}

export function signedPct(value: number | null | undefined, digits = 0): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return `${value > 0 ? "+" : value < 0 ? "−" : ""}${Math.abs(value).toFixed(digits).replace(".", ",")} %`;
}

export function signedPts(value: number | null | undefined, digits = 1): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return `${value > 0 ? "+" : value < 0 ? "−" : ""}${Math.abs(value).toFixed(digits).replace(".", ",")} pt`;
}

/** ROI historique d'un signal, présenté avec son volume — jamais seul. */
export function roiLine(roi: number, bets: number): string {
  return `ROI ${signedPct(roi * 100)} sur ${new Intl.NumberFormat("fr-FR").format(bets)} paris`;
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-2xl border border-border bg-surface shadow-sm ${className}`}>{children}</section>;
}

export function Eyebrow({ children }: { children: ReactNode }) {
  return <p className="text-[10px] font-bold uppercase tracking-widest text-muted">{children}</p>;
}

export function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className={`rounded-xl border p-3 ${accent ? "border-accent/20 bg-accent-lo" : "border-border bg-surface-sub"}`}>
      <p className="text-[10px] font-bold uppercase tracking-widest text-muted">{label}</p>
      <p className={`mt-1 text-sm font-semibold ${accent ? "text-accent-text" : "text-fg"}`}>{value}</p>
    </div>
  );
}

export function minutesAgo(iso: string | null | undefined, now = Date.now()): number | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  return Number.isFinite(t) ? Math.max(0, Math.round((now - t) / 60_000)) : null;
}

export function formatAge(minutes: number | null): string {
  if (minutes === null) return "âge inconnu";
  if (minutes < 1) return "à l'instant";
  if (minutes < 60) return `il y a ${minutes} min`;
  const h = Math.floor(minutes / 60);
  return h < 24 ? `il y a ${h} h ${String(minutes % 60).padStart(2, "0")}` : `il y a ${Math.floor(h / 24)} j`;
}
