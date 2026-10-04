"use client";

import { useEffect, useMemo, useState } from "react";
import { History, X } from "lucide-react";
import type { CourseViewModel } from "@/lib/course-view-model";
import { formatOdds } from "@/lib/format";
import {
  VISIT_MAX_AGE_MS,
  buildVisitSnapshot,
  diffVisit,
  parseVisitSnapshot,
  visitHasChanges,
  visitStorageKey,
  type VisitDiff,
} from "@/lib/visit-snapshot";
import { Card, formatAge, minutesAgo } from "@/components/course/shared";

/**
 * « CE QUI A CHANGÉ DEPUIS VOTRE DERNIÈRE VISITE » — comparaison avec la
 * photographie gardée dans ce navigateur (lib/visit-snapshot). Le stockage
 * peut être indisponible (navigation privée, cookies bloqués) : chaque accès
 * est protégé et la page fonctionne sans.
 */

function readStorage(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Stockage plein ou interdit : la fonction se tait, la page continue.
  }
}

function useVisitDiff(raceId: string, vm: CourseViewModel): VisitDiff | null {
  const [diff, setDiff] = useState<VisitDiff | null>(null);
  const snapshotInput = useMemo(
    () => ({
      horses: vm.rows.map((r) => ({ number: r.horse.number, odds: Number.isFinite(r.horse.odds) ? r.horse.odds : null, nonRunner: r.nonRunner })),
      sentence: vm.verdict.sentence,
      top3: vm.rows.slice(0, 3).map((r) => r.horse.number),
    }),
    [vm],
  );

  // Première lecture : comparer à la visite précédente, une seule fois par course.
  useEffect(() => {
    const key = visitStorageKey(raceId);
    const previous = parseVisitSnapshot(readStorage(key));
    const now = Date.now();
    const current = buildVisitSnapshot(snapshotInput, now);
    if (previous && now - previous.at <= VISIT_MAX_AGE_MS) {
      const d = diffVisit(previous, current);
      queueMicrotask(() => setDiff(visitHasChanges(d) ? d : null));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- la comparaison porte sur l'arrivée sur la page, pas sur chaque relance
  }, [raceId]);

  // Chaque état affiché devient la nouvelle référence de « dernière visite ».
  useEffect(() => {
    writeStorage(visitStorageKey(raceId), JSON.stringify(buildVisitSnapshot(snapshotInput, Date.now())));
  }, [raceId, snapshotInput]);

  return diff;
}

export function VisitChanges({ raceId, vm }: { raceId: string; vm: CourseViewModel }) {
  const diff = useVisitDiff(raceId, vm);
  const [dismissed, setDismissed] = useState(false);
  if (!diff || dismissed) return null;
  const age = minutesAgo(new Date(diff.since).toISOString());

  return (
    <Card className="mt-4 overflow-hidden">
      <div className="flex items-start gap-3 border-b border-border bg-surface-sub px-5 py-3 sm:px-6" role="status">
        <History aria-hidden="true" className="mt-0.5 shrink-0 text-accent-text" size={18} />
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-base font-bold text-fg">Ce qui a changé depuis votre dernière visite</h2>
          <p className="text-xs text-muted">Dernière visite {formatAge(age)} · comparaison gardée dans ce navigateur uniquement.</p>
        </div>
        <button
          aria-label="Masquer les changements depuis la dernière visite"
          className="grid size-8 shrink-0 place-items-center rounded-lg text-muted transition hover:bg-surface hover:text-fg"
          onClick={() => setDismissed(true)}
          type="button"
        >
          <X aria-hidden="true" size={16} />
        </button>
      </div>
      <ul className="grid gap-2 px-5 py-3 text-sm text-fg sm:px-6">
        {diff.newNonRunners.length > 0 && (
          <li className="font-semibold text-danger">
            Retiré{diff.newNonRunners.length > 1 ? "s" : ""} du départ : {diff.newNonRunners.map((n) => `n° ${n}`).join(", ")}
          </li>
        )}
        {diff.top3After && diff.top3Before && (
          <li>
            Top 3 : <span className="font-mono text-muted line-through">{diff.top3Before.join(" – ")}</span>{" "}
            → <span className="font-mono font-bold text-accent-text">{diff.top3After.join(" – ")}</span>
          </li>
        )}
        {diff.verdictAfter && (
          <li>
            Verdict : <span className="text-muted line-through">{diff.verdictBefore}</span> → <span className="font-semibold">{diff.verdictAfter}</span>
          </li>
        )}
        {diff.oddsChanges.length > 0 && (
          <li>
            Cotes :{" "}
            {diff.oddsChanges.slice(0, 8).map((c, i) => (
              <span key={c.number} className="whitespace-nowrap font-mono text-xs">
                {i > 0 && " · "}n° {c.number}{" "}
                <span className={c.before !== null && c.after !== null ? (c.after < c.before ? "font-bold text-accent-text" : "font-bold text-danger") : "font-bold"}>
                  {formatOdds(c.before)} → {formatOdds(c.after)}
                </span>
              </span>
            ))}
            {diff.oddsChanges.length > 8 && <span className="text-xs text-muted"> et {diff.oddsChanges.length - 8} autres</span>}
          </li>
        )}
      </ul>
    </Card>
  );
}
