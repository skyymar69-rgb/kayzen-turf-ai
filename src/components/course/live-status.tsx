"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { INDICATIVE_LABELS, predictionIndicative, type OddsSource } from "@/lib/odds-freshness";
import { instantDepart } from "@/lib/paris-time";
import { formatAge, minutesAgo } from "@/components/course/shared";

/** Relecture automatique chaque minute dans les dix dernières minutes. */
const AUTO_WINDOW_MINUTES = 10;
const AUTO_REFRESH_MS = 60_000;
/** Doit rester égal à `MAX_MINUTES_BEFORE` de la route /api/races/[id]/refresh. */
const MAX_MINUTES_BEFORE = 18 * 60;

export type RelaunchResult = {
  auto: boolean;
  status: "refreshed" | "skipped";
  reason?: string;
  oddsChanged?: number;
  scratched?: number[];
  oddsRefreshedAt: string | null;
};

/**
 * ÂGE DE LA COTE ET « RELANCER L'ANALYSE IA ».
 *
 * Le pari mutuel ne fixe la cote qu'après le départ : aucune cote affichée
 * n'est définitive. Ce bandeau dit donc toujours de quand elle date. Le bouton
 * relit le PMU et fait recalculer toute l'analyse, à tout moment avant le
 * départ ; dans les dix dernières minutes, la relance est en plus automatique
 * chaque minute. La page compare ensuite les deux lectures (voir
 * src/lib/analysis-diff.ts).
 */
export function LiveStatus({
  raceId,
  raceDate,
  startTime,
  lastObservation,
  finished,
  oddsSources = [],
  onStart,
  onDone,
}: {
  raceId: string;
  raceDate: string;
  startTime: string;
  lastObservation: string | null;
  finished: boolean;
  /** Origine de la cote de chaque partant : décide du bandeau « indicatif ». */
  oddsSources?: Array<OddsSource | null | undefined>;
  /** Appelé juste avant la relance : la page photographie son analyse. */
  onStart?: (auto: boolean) => void;
  /** Appelé une fois les données relues et la page en cours de recalcul. */
  onDone?: (result: RelaunchResult) => void;
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
  const available = minutesToStart !== null && minutesToStart >= -2 && minutesToStart <= MAX_MINUTES_BEFORE;
  const open = available && minutesToStart !== null && minutesToStart <= AUTO_WINDOW_MINUTES;

  const relaunch = useCallback(async (auto: boolean) => {
    if (busy.current) return;
    busy.current = true;
    setState("loading");
    setMessage(null);
    onStart?.(auto);
    try {
      const response = await fetch(`/api/races/${encodeURIComponent(raceId)}/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ auto }),
      });
      const body = (await response.json().catch(() => ({}))) as Partial<RelaunchResult> & { error?: string };
      if (!response.ok) throw new Error(body.error ?? "Relance impossible");
      router.refresh();
      onDone?.({
        auto,
        status: body.status === "refreshed" ? "refreshed" : "skipped",
        reason: body.reason,
        oddsChanged: body.oddsChanged,
        scratched: body.scratched,
        oddsRefreshedAt: body.oddsRefreshedAt ?? null,
      });
      setState("idle");
    } catch (error) {
      setState("error");
      setMessage((error as Error).message);
      onDone?.({ auto, status: "skipped", reason: "error", oddsRefreshedAt: null });
    } finally {
      busy.current = false;
    }
  }, [raceId, router, onStart, onDone]);

  useEffect(() => {
    if (!open) return;
    const id = setInterval(() => relaunch(true), AUTO_REFRESH_MS);
    return () => clearInterval(id);
  }, [open, relaunch]);

  if (finished || now === null || (minutesToStart !== null && minutesToStart < -2)) return null;

  const age = minutesAgo(lastObservation, now);
  const stale = age === null || age > 30;
  const indicative = predictionIndicative({ minutesToStart, oddsAgeMinutes: age, sources: oddsSources });

  return (
    <>
    {indicative && (
      <div className="mt-3 flex items-start gap-3 rounded-xl border border-warn/30 bg-warn-lo px-4 py-2.5 text-sm leading-6 text-warn" role="status">
        <AlertTriangle aria-hidden="true" className="mt-1 shrink-0" size={15} />
        <p>
          <strong className="font-bold">Pronostic indicatif</strong> : {INDICATIVE_LABELS[indicative]}. Le classement repose en partie sur
          ces cotes ; il sera recalculé dès la prochaine lecture des rapports directs.
        </p>
      </div>
    )}
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
        className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-accent px-4 text-sm font-bold text-accent-fg transition hover:bg-accent-hi disabled:cursor-not-allowed disabled:opacity-50"
        disabled={!available || state === "loading"}
        onClick={() => relaunch(false)}
        title={available ? "Relire les cotes PMU et recalculer tout le pronostic" : "Relance possible le jour de la course, jusqu'au départ"}
        type="button"
      >
        <RefreshCw aria-hidden="true" className={state === "loading" ? "animate-spin" : ""} size={15} />
        {state === "loading" ? "Analyse en cours…" : "Relancer l'analyse IA"}
      </button>
      {message && <p className="w-full text-xs text-danger">{message}</p>}
    </div>
    </>
  );
}
