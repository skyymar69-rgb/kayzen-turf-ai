import Link from "next/link";
import { useMemo } from "react";
import { Sparkles } from "lucide-react";
import { formatOdds } from "@/lib/format";
import { daySurprises } from "@/lib/home/surprises";
import type { RaceAnalysis } from "@/lib/types";
import { ScoreCell, SurpriseBadge } from "@/components/course/surprise-cells";
import { raceHref } from "./types";

/**
 * TOP 3 SURPRISES DU JOUR — la meilleure alerte du score de surprise de
 * chaque course, les trois plus fortes du programme, courses à venir d'abord.
 * Une course déjà courue affiche la place obtenue : le bloc montre aussi les
 * surprises qui n'en ont pas été.
 */
export function SurprisesOfDay({ races }: { races: RaceAnalysis[] }) {
  const picks = useMemo(() => daySurprises(races), [races]);
  if (races.length === 0) return null;

  return (
    <section aria-labelledby="titre-surprises-jour" className="mt-4 rounded-2xl border border-border bg-surface p-5 shadow-sm">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted">Chevaux cachés · Surprise IA</p>
          <h2 className="mt-0.5 flex items-center gap-2 font-display text-lg font-bold text-fg" id="titre-surprises-jour">
            <Sparkles aria-hidden="true" className="text-accent-text" size={18} /> Top 3 surprises du jour
          </h2>
        </div>
        <Link className="text-xs font-semibold text-accent-text hover:underline" href="/methode#surprise">
          Comment le score est calculé
        </Link>
      </div>

      {picks.length === 0 ? (
        <p className="mt-4 text-sm text-muted">Aucune surprise nette sur ce programme : l&apos;IA ne voit aucun cheval nettement au-dessus de sa cote.</p>
      ) : (
        <ol className="mt-4 grid gap-3 md:grid-cols-3">
          {picks.map(({ race, row, finished }, i) => {
            const position = row.horse.finishPosition;
            return (
              <li key={race.id}>
                <Link
                  className="flex h-full flex-col gap-2 rounded-xl border border-border bg-surface-sub p-3 transition hover:border-accent/40 hover:bg-accent-lo"
                  href={raceHref(race)}
                >
                  <span className="flex items-center gap-2">
                    <span className="grid size-6 shrink-0 place-items-center rounded-full bg-surface-inv text-xs font-bold text-white">{i + 1}</span>
                    <span className="min-w-0 flex-1 truncate text-xs font-semibold text-muted">
                      {race.programCode} · {race.startTime}
                    </span>
                    <SurpriseBadge alert={row.surprise.alert} />
                  </span>
                  <span className="flex items-center justify-between gap-2">
                    <span className="min-w-0 truncate font-bold text-fg">
                      <span className="font-mono">{row.horse.number}</span> {row.horse.horse}
                    </span>
                    <ScoreCell surprise={row.surprise} />
                  </span>
                  <span className="text-xs leading-5 text-muted">{row.surprise.reasons[0] ?? row.surprise.conclusion}</span>
                  <span className="mt-auto text-[11px] text-muted">
                    Cote {formatOdds(row.horse.odds, 1)}
                    {finished && (
                      <>
                        {" · "}
                        <strong className={position != null && position <= 3 ? "text-accent-text" : "text-fg"}>
                          {position != null && position > 0 ? `arrivé ${position}${position === 1 ? "er" : "e"}` : "non classé"}
                        </strong>
                      </>
                    )}
                  </span>
                </Link>
              </li>
            );
          })}
        </ol>
      )}
      <p className="mt-3 text-[11px] leading-5 text-muted">
        Une surprise signale un désaccord entre l&apos;IA et le marché, pas un gagnant annoncé : la cote finale rattrape souvent ces chevaux.
        Ici, la note ne tient pas compte du marché du jour (MVT, argent) : sur la page course, elle peut varier de quelques points.
      </p>
    </section>
  );
}
