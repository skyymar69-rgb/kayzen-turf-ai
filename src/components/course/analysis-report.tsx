"use client";

import { ArrowDown, ArrowUp, BrainCircuit, X } from "lucide-react";
import { hasChanges, type AnalysisDiff } from "@/lib/analysis-diff";
import { formatOdds } from "@/lib/format";
import { PROFILE_LABELS, READING_LABELS } from "@/lib/profiles";
import type { RelaunchResult } from "@/components/course/live-status";
import { Card, ProfileBadge, formatAge, minutesAgo, pct } from "@/components/course/shared";

/**
 * ANALYSE RÉACTUALISÉE — ce que la dernière relance a changé : Top 3,
 * verdict, rang, cote, probabilité et profil de chaque cheval qui a bougé,
 * non-partants. Rien n'est recalculé ici : le panneau compare deux
 * photographies de la même analyse (src/lib/analysis-diff.ts).
 */
export function AnalysisReport({
  diff,
  result,
  onClose,
  onSelect,
}: {
  diff: AnalysisDiff;
  result: RelaunchResult;
  onClose: () => void;
  onSelect: (number: number) => void;
}) {
  const time = new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit", second: "2-digit", timeZone: "Europe/Paris" }).format(diff.after.at);
  const changed = hasChanges(diff);
  const age = minutesAgo(result.oddsRefreshedAt, diff.after.at);

  const source =
    result.reason === "error"
      ? "Le PMU n'a pas répondu : l'analyse est recalculée sur les dernières cotes connues."
      : result.status === "refreshed"
        ? `Cotes PMU relues à l'instant${result.oddsChanged ? ` · ${result.oddsChanged} cote${result.oddsChanged > 1 ? "s" : ""} modifiée${result.oddsChanged > 1 ? "s" : ""}` : ""}.`
        : `Cotes PMU déjà relues ${formatAge(age)}, les plus récentes disponibles : analyse recalculée.`;

  return (
    <Card className="mt-4 overflow-hidden border-2 border-accent/40" >
      <div className="flex items-start gap-3 border-b border-border bg-accent-lo px-5 py-3 sm:px-6" role="status" aria-live="polite">
        <BrainCircuit aria-hidden="true" className="mt-0.5 shrink-0 text-accent-text" size={20} />
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-base font-bold text-fg">Analyse réactualisée à {time}</h2>
          <p className="text-xs leading-5 text-muted">{source}</p>
        </div>
        <button
          aria-label="Fermer l'analyse réactualisée"
          className="grid size-8 shrink-0 place-items-center rounded-lg text-muted transition hover:bg-surface hover:text-fg"
          onClick={onClose}
          type="button"
        >
          <X aria-hidden="true" size={16} />
        </button>
      </div>

      <div className="grid gap-4 px-5 py-4 sm:px-6">
        {!changed && (
          <p className="text-sm text-fg">
            <strong>Aucun changement</strong> depuis la lecture précédente : classement, cotes, profils et verdict sont identiques.
          </p>
        )}

        {(diff.top3Changed || diff.verdictChanged) && (
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-border bg-surface-sub p-3">
              <p className="text-[11px] font-bold uppercase tracking-widest text-muted">Top 3</p>
              <p className="mt-1 font-mono text-sm text-muted line-through">{diff.before.top3.join(" – ")}</p>
              <p className="font-mono text-xl font-bold text-accent-text">{diff.after.top3.join(" – ")}</p>
            </div>
            <div className="rounded-xl border border-border bg-surface-sub p-3">
              <p className="text-[11px] font-bold uppercase tracking-widest text-muted">Verdict</p>
              {diff.verdictChanged ? (
                <>
                  <p className="mt-1 text-sm text-muted line-through">{READING_LABELS[diff.before.reading]} · {diff.before.sentence}</p>
                  <p className="text-sm font-semibold text-fg">{READING_LABELS[diff.after.reading]} · {diff.after.sentence}</p>
                </>
              ) : (
                <p className="mt-1 text-sm text-fg">Inchangé : {READING_LABELS[diff.after.reading]} · {diff.after.sentence}</p>
              )}
            </div>
          </div>
        )}

        {diff.scratched.length > 0 && (
          <p className="rounded-xl border border-danger/30 bg-danger/10 px-3 py-2 text-sm font-semibold text-danger">
            Non-partant{diff.scratched.length > 1 ? "s" : ""} : {diff.scratched.map((h) => `n° ${h.number} ${h.name}`).join(", ")}
          </p>
        )}

        {diff.changes.length > 0 && (
          <div>
            <h3 className="text-[11px] font-bold uppercase tracking-widest text-muted">Ce qui a bougé</h3>
            <ul className="mt-2 divide-y divide-border">
              {diff.changes.slice(0, 10).map((c) => {
                const moved = c.rankBefore - c.rankAfter;
                const oddsKnown = c.oddsBefore !== null && c.oddsAfter !== null;
                return (
                  <li key={c.number} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-2 text-sm">
                    <button className="min-w-0 basis-full text-left font-semibold text-fg hover:text-accent-text sm:basis-56" onClick={() => onSelect(c.number)} type="button">
                      <span className="font-mono">{c.number}</span> {c.name}
                    </button>
                    <span className="whitespace-nowrap font-mono text-xs">
                      <span className="font-sans text-muted">Rang </span>
                      {moved === 0 ? (
                        <span className="text-muted">{c.rankAfter}</span>
                      ) : (
                        <span className={`inline-flex items-center gap-0.5 font-bold ${moved > 0 ? "text-accent-text" : "text-danger"}`}>
                          {moved > 0 ? <ArrowUp aria-hidden="true" size={12} /> : <ArrowDown aria-hidden="true" size={12} />}
                          {c.rankBefore} → {c.rankAfter}
                          <span className="sr-only">{moved > 0 ? `, gagne ${moved} place${moved > 1 ? "s" : ""}` : `, perd ${-moved} place${moved < -1 ? "s" : ""}`}</span>
                        </span>
                      )}
                    </span>
                    <span className="whitespace-nowrap font-mono text-xs">
                      <span className="font-sans text-muted">Cote </span>
                      {c.oddsBefore === c.oddsAfter ? (
                        <span className="text-muted">{formatOdds(c.oddsAfter)}</span>
                      ) : (
                        <span className={!oddsKnown ? "font-bold text-fg" : c.oddsAfter! < c.oddsBefore! ? "font-bold text-accent-text" : "font-bold text-danger"}>
                          {formatOdds(c.oddsBefore)} → {formatOdds(c.oddsAfter)}
                        </span>
                      )}
                    </span>
                    <span className="whitespace-nowrap font-mono text-xs">
                      <span className="font-sans text-muted">Gagnant </span>
                      {pct(c.winBefore, 1)} → <strong className="text-fg">{pct(c.winAfter, 1)}</strong>
                    </span>
                    {c.profileBefore === c.profileAfter ? (
                      <ProfileBadge profile={c.profileAfter} />
                    ) : (
                      <span className="inline-flex flex-wrap items-center gap-1 text-xs text-muted">
                        <span className="line-through">{PROFILE_LABELS[c.profileBefore]}</span> → <ProfileBadge profile={c.profileAfter} />
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
            {diff.changes.length > 10 && <p className="mt-2 text-xs text-muted">Et {diff.changes.length - 10} autres chevaux, visibles dans le tableau.</p>}
          </div>
        )}

        <p className="text-[11px] leading-5 text-muted">
          Une cote qui baisse (en vert) signifie que le cheval est davantage joué. La cote finale n&apos;est connue qu&apos;après le départ, et
          aucune relance ne rend un pari gagnant : sur notre historique, aucun signal n&apos;est rentable une fois le prélèvement PMU déduit.
        </p>
      </div>
    </Card>
  );
}
