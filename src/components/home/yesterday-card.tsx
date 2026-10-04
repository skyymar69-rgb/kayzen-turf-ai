import Link from "next/link";
import { History } from "lucide-react";
import { useMemo } from "react";
import { titleCase } from "@/components/badges";
import { buildYesterdayReport, type BaseOutcome } from "@/lib/home/yesterday";
import type { RaceAnalysis } from "@/lib/types";
import { raceHref } from "./types";

const OUTCOME: Record<BaseOutcome, { label: string; cls: string }> = {
  gagnee: { label: "Gagnée", cls: "bg-accent text-accent-fg" },
  placee: { label: "Placée", cls: "bg-accent-lo text-accent-text" },
  perdue: { label: "Perdue", cls: "bg-surface-sub text-muted" },
};

/**
 * HIER — la base IA de chaque course arrivée la veille, et ce qu'elle est
 * devenue. Masqué tant qu'aucune arrivée n'est publiée.
 */
export function YesterdayCard({ races }: { races: RaceAnalysis[] }) {
  const report = useMemo(() => buildYesterdayReport(races), [races]);
  const total = report.rows.length;
  if (total === 0) return null;

  return (
    <section aria-labelledby="bilan-hier" className="mb-4 rounded-2xl border border-border bg-surface shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border px-5 py-4">
        <div className="flex items-start gap-2">
          <History aria-hidden="true" className="mt-0.5 text-accent-text" size={16} />
          <div>
            <h2 id="bilan-hier" className="text-xs font-bold uppercase tracking-widest text-muted">Hier · base de l&apos;IA</h2>
            <p className="mt-1 text-sm text-fg">
              Sur <strong>{total}</strong> course{total > 1 ? "s" : ""} arrivée{total > 1 ? "s" : ""} :{" "}
              <strong>{report.won}</strong> gagnée{report.won > 1 ? "s" : ""}, <strong>{report.placed}</strong> placée{report.placed > 1 ? "s" : ""} (2e ou 3e),{" "}
              <strong>{report.lost}</strong> hors du podium.
            </p>
          </div>
        </div>
        <Link href="/track-record" className="text-xs font-semibold text-accent-text hover:underline">Suivi officiel →</Link>
      </div>
      <details className="group">
        <summary className="cursor-pointer px-5 py-3 text-xs font-semibold text-accent-text">Voir course par course</summary>
        <ul className="divide-y divide-border border-t border-border">
          {report.rows.map((row) => (
            <li key={row.race.id}>
              <Link href={raceHref(row.race)} className="flex items-center gap-3 px-5 py-2.5 transition hover:bg-surface-sub">
                <span className="w-24 shrink-0 font-mono text-xs text-muted">{row.race.programCode} · {row.race.startTime}</span>
                <span className="min-w-0 flex-1 truncate text-sm text-fg">
                  n° {row.baseNumber} {titleCase(row.baseName)}
                  <span className="text-muted"> · {row.finishPosition ? `${row.finishPosition}e` : "non classé"}</span>
                </span>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${OUTCOME[row.outcome].cls}`}>{OUTCOME[row.outcome].label}</span>
              </Link>
            </li>
          ))}
        </ul>
      </details>
      <p className="border-t border-border px-5 py-3 text-[11px] leading-5 text-muted">
        Base recalculée sur les données finales de chaque course, cotes de clôture comprises : ce n&apos;est pas le pronostic gelé avant le départ.
        Les résultats mesurés sur les pronostics gelés sont sur la page Suivi.
      </p>
    </section>
  );
}
