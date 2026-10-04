import { FileText } from "lucide-react";
import { useMemo } from "react";
import { buildDaySummary } from "@/lib/home/day-summary";
import { formatRelativeDay } from "@/lib/home/days";
import type { RaceAnalysis } from "@/lib/types";

/** Résumé du jour en trois phrases au plus, tirées des seules données du programme. */
export function DaySummaryCard({ races, day }: { races: RaceAnalysis[]; day: RaceAnalysis["relativeDay"] }) {
  const { sentences } = useMemo(() => buildDaySummary(races), [races]);
  if (sentences.length === 0) return null;
  return (
    <section aria-labelledby="resume-du-jour" className="mb-4 rounded-2xl border border-border bg-surface p-5 shadow-sm">
      <div className="flex items-center gap-2">
        <FileText aria-hidden="true" className="text-accent-text" size={16} />
        <h2 id="resume-du-jour" className="text-xs font-bold uppercase tracking-widest text-muted">
          En bref · {formatRelativeDay(day)}
        </h2>
      </div>
      <p className="mt-2 text-sm leading-6 text-fg">{sentences.join(" ")}</p>
      <p className="mt-2 text-[11px] text-muted">Rédigé automatiquement à partir des profils et des cotes du programme, sans autre source.</p>
    </section>
  );
}
