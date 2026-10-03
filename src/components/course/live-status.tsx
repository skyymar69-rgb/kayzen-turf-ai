"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { instantDepart } from "@/lib/paris-time";
import { formatAge, minutesAgo } from "@/components/course/shared";

/** Doit rester égal à `WINDOW_MINUTES` de la route /api/races/[id]/refresh. */
const WINDOW_MINUTES = 10;
const AUTO_REFRESH_MS = 60_000;

/**
 * ÂGE DE LA COTE ET « ANALYSER MAINTENANT ».
 *
 * Le pari mutuel ne fixe la cote qu'après le départ : aucune cote affichée
 * n'est définitive. Ce bandeau dit donc toujours de quand elle date. Dans les
 * dix dernières minutes, la page se rafraîchit seule chaque minute et le bouton
 * force une lecture immédiate du PMU.
 */
export function LiveStatus({
  raceId,
  raceDate,
  startTime,
  lastObservation,
  finished,
}: {
  raceId: string;
  raceDate: string;
  startTime: string;
  lastObservation: string | null;
  finished: boolean;
}) {
  const router = useRouter();
  const [now, setNow] = useState<number | null>(null);
  const [state, setState] = useState<"idle" | "loading" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);
  const busy = useRef(false);

  // L'heure n'est lue qu'après l'hydratation : le rendu serveur et le premier
  // rendu client doivent être identiques.
  useEffect(() => {
    const first = setTimeout(() => setNow(Date.now()), 0);
    const id = setInterval(() => setNow(Date.now()), 15_000);
    return () => {
      clearTimeout(first);
      clearInterval(id);
    };
  }, []);

  const depart = instantDepart(raceDate, startTime)?.getTime() ?? null;
  const minutesToStart = now !== null && depart !== null ? (depart - now) / 60_000 : null;
  const open = minutesToStart !== null && minutesToStart <= WINDOW_MINUTES && minutesToStart >= -2;

  const refresh = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    setState("loading");
    setMessage(null);
    try {
      const response = await fetch(`/api/races/${encodeURIComponent(raceId)}/refresh`, { method: "POST" });
      const body = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) throw new Error(body.error ?? "Actualisation impossible");
      router.refresh();
      setState("idle");
    } catch (error) {
      setState("error");
      setMessage((error as Error).message);
    } finally {
      busy.current = false;
    }
  }, [raceId, router]);

  useEffect(() => {
    if (!open) return;
    const id = setInterval(refresh, AUTO_REFRESH_MS);
    return () => clearInterval(id);
  }, [open, refresh]);

  if (finished || now === null || (minutesToStart !== null && minutesToStart < -2)) return null;

  const age = minutesAgo(lastObservation, now);
  const stale = age === null || age > 30;

  return (
    <div className="mt-3 flex flex-wrap items-center gap-3 rounded-xl border border-border bg-surface-sub px-4 py-2.5 text-sm" role="status">
      <span className={`size-2 shrink-0 rounded-full ${open ? "animate-pulse bg-cta" : stale ? "bg-warn" : "bg-accent"}`} aria-hidden="true" />
      <p className="min-w-0 flex-1 basis-[240px] text-fg">
        Cotes PMU relevées <strong>{formatAge(age)}</strong>
        {open
          ? " · actualisation automatique chaque minute jusqu'au départ"
          : minutesToStart !== null && minutesToStart <= 15
            ? " · actualisées chaque minute jusqu'au départ"
            : minutesToStart !== null && minutesToStart <= 60
              ? " · actualisées toutes les 4 min jusqu'à H-15, puis chaque minute"
              : minutesToStart !== null && minutesToStart <= 90
                ? " · actualisées toutes les 15 min jusqu'à H-60, puis toutes les 4 min"
                : ""}
        . La cote finale n&apos;est connue qu&apos;après le départ.
      </p>
      <button
        className="inline-flex min-h-9 items-center gap-2 rounded-lg bg-accent px-3 text-xs font-bold text-accent-fg transition hover:bg-accent-hi disabled:cursor-not-allowed disabled:opacity-50"
        disabled={!open || state === "loading"}
        onClick={refresh}
        title={open ? "Relire le PMU maintenant" : `Disponible dans les ${WINDOW_MINUTES} dernières minutes avant le départ`}
        type="button"
      >
        <RefreshCw aria-hidden="true" className={state === "loading" ? "animate-spin" : ""} size={14} />
        Analyser maintenant
      </button>
      {message && <p className="w-full text-xs text-danger">{message}</p>}
    </div>
  );
}
