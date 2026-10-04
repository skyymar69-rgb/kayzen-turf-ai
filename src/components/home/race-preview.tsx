import Link from "next/link";
import { ArrowRight, Sparkles } from "lucide-react";
import { titleCase } from "@/components/badges";
import { probableArrival, raceToContext } from "@/lib/bet-recommendations";
import { formatOdds, formatPct } from "@/lib/format";
import { READING_LABELS } from "@/lib/profiles";
import { buildSelection } from "@/lib/selection";
import type { RaceAnalysis } from "@/lib/types";
import { raceHref } from "./types";
import { SmMetric } from "./ui";

/** Probabilité à la française : « 12,3 % », ou « — » si absente. */
const fmtProb = (v: number | null | undefined) => formatPct(v, 1);

/** Aperçu de la course active : Top 5 Kayzen Turf et synthèse IA. */
export function RacePreview({ race }: { race: RaceAnalysis }) {
  const topArrival = probableArrival(race.horses, raceToContext(race)).slice(0, 5);
  if (topArrival.length === 0) return null;
  const { verdict } = buildSelection(race.horses);

  return (
    <section className="mt-4 grid gap-4 lg:grid-cols-[1.3fr_1fr]" aria-label="Aperçu de la course active">
      <div className="rounded-2xl border border-border bg-surface shadow-sm">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-muted">Course active</p>
            <h2 className="font-display text-lg font-bold text-fg">{race.programCode} — {titleCase(race.name)}</h2>
          </div>
          <Link href={raceHref(race)} className="flex items-center gap-1.5 text-sm font-semibold text-accent-text hover:text-accent">
            Analyse complète <ArrowRight size={14} />
          </Link>
        </div>

        <div className="hidden overflow-x-auto sm:block">
          <table className="w-full border-collapse text-left">
            <caption className="sr-only">Top 5 partants Kayzen Turf</caption>
            <thead>
              <tr className="border-b border-border bg-surface-sub text-xs font-bold uppercase tracking-widest text-muted">
                <th className="px-5 py-3" scope="col">N°</th>
                <th className="px-5 py-3" scope="col">Cheval</th>
                <th className="px-5 py-3" scope="col">{race.discipline === "Trot" ? "Driver" : "Jockey"}</th>
                <th className="px-5 py-3 text-right" scope="col">Cote</th>
                <th className="px-5 py-3 text-right" scope="col" title="Probabilité de victoire selon l'IA, sans cote">IA</th>
                <th className="px-5 py-3 text-right" scope="col">Top 3</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {topArrival.map((horse, idx) => (
                <tr key={horse.id} className={idx === 0 ? "bg-accent-lo" : "hover:bg-surface-sub"}>
                  <td className={`px-5 py-3 font-mono font-bold ${idx === 0 ? "text-accent-text" : "text-fg"}`}>{horse.number}</td>
                  <td className="px-5 py-3 font-semibold text-fg">{horse.horse}</td>
                  <td className="px-5 py-3 text-sm text-muted">{horse.jockey}</td>
                  <td className="px-5 py-3 text-right font-mono text-sm text-fg">
                    {race.oddsAvailable === false ? <span className="font-sans text-xs text-muted">cotes à venir</span> : formatOdds(horse.odds)}
                  </td>
                  <td className={`px-5 py-3 text-right font-mono font-bold ${idx === 0 ? "text-accent-text" : "text-muted"}`}>
                    {fmtProb(horse.fundamentalProbability ?? NaN)}
                  </td>
                  <td className="px-5 py-3 text-right font-mono text-sm text-muted">{fmtProb(horse.top3Probability)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="grid gap-2 p-4 sm:hidden">
          {topArrival.map((horse, idx) => (
            <div key={horse.id} className={`flex items-center gap-3 rounded-xl border p-3 ${idx === 0 ? "border-accent/30 bg-accent-lo" : "border-border"}`}>
              <span className={`w-8 shrink-0 text-center font-mono font-bold ${idx === 0 ? "text-accent-text" : "text-muted"}`}>{horse.number}</span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold text-fg">{horse.horse}</p>
                <p className="truncate text-xs text-muted">{horse.jockey}</p>
              </div>
              <div className="text-right">
                <p className={`font-mono text-sm font-bold ${idx === 0 ? "text-accent-text" : "text-fg"}`}>IA {fmtProb(horse.fundamentalProbability ?? NaN)}</p>
                <p className="text-xs text-muted">Top3 {fmtProb(horse.top3Probability)}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-surface shadow-sm">
        <div className="flex items-center gap-3 border-b border-border px-5 py-4">
          <div className="grid h-9 w-9 place-items-center rounded-lg bg-accent-lo">
            <Sparkles size={18} className="text-accent-text" />
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-muted">Synthèse IA</p>
            <h2 className="font-display text-lg font-bold text-fg">Lecture rapide</h2>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 p-5">
          <div className="col-span-2 rounded-xl border border-border bg-surface-sub p-3">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted">{READING_LABELS[verdict.reading]}</p>
            <p className="mt-1 text-sm font-bold text-fg">{verdict.sentence}</p>
          </div>
          <SmMetric label="Bases" value={verdict.bases.length ? verdict.bases.join(", ") : "Aucune"} />
          <SmMetric label="Cachés" value={verdict.hidden.length ? verdict.hidden.join(", ") : "Aucun"} />
          <SmMetric label="Discipline" value={[race.discipline, race.specialty].filter(Boolean).join(" · ")} />
          <SmMetric label="Partants" value={String(race.horses.length)} />
        </div>
        <div className="border-t border-border px-5 pb-5">
          <div className="rounded-xl border border-warn/30 bg-warn-lo px-4 py-3 text-xs leading-5 text-warn">
            Outil d’aide à la décision — aucun pronostic ne garantit un gain.
          </div>
        </div>
      </div>
    </section>
  );
}
