import Link from "next/link";
import { Star, Zap } from "lucide-react";
import { probableArrival, raceToContext } from "@/lib/bet-recommendations";
import { formatMeters } from "@/lib/format";
import type { RaceAnalysis } from "@/lib/types";
import { bestAiMarketGap, formatGap } from "@/lib/value-signal";
import { raceHref } from "./types";

const capitalize = (v: string) => v.charAt(0).toUpperCase() + v.slice(1).toLowerCase();

/* amélioration #24 — course phare : meilleur score parmi les courses du jour */
export function FeaturedRace({ race }: { race: RaceAnalysis }) {
  const top3 = probableArrival(race.horses, raceToContext(race)).slice(0, 3);
  // Écart IA / marché, jamais « Value » : la carte ne connaît pas l'heure de consultation.
  const gap = race.oddsAvailable === false ? null : bestAiMarketGap(top3);
  return (
    <section aria-label="Course phare du jour" className="mb-4">
      <Link
        href={raceHref(race)}
        className="group flex flex-col gap-4 overflow-hidden rounded-2xl border border-accent/30 bg-accent-lo p-5 shadow-sm transition hover:border-accent/60 hover:bg-accent-lo sm:flex-row sm:items-center"
      >
        <div className="flex shrink-0 items-center gap-3">
          <div className="grid h-12 w-12 place-items-center rounded-xl bg-accent font-mono text-lg font-bold text-accent-fg shadow">
            <Star size={22} />
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-accent-text">Course phare du jour</p>
            <p className="font-mono text-xs text-muted">{race.programCode} · {race.startTime}</p>
          </div>
        </div>
        <div className="flex flex-1 flex-col gap-1">
          <h2 className="font-display text-lg font-bold leading-tight text-fg group-hover:text-accent-text">{capitalize(race.name)}</h2>
          <p className="text-xs text-muted">{capitalize(race.racecourse)} · {formatMeters(race.distance)} · {race.discipline}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:shrink-0">
          {top3.map((h, i) => (
            <span key={h.id} className={`flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-bold ${i === 0 ? "bg-accent text-accent-fg" : "border border-border bg-surface text-fg"}`}>
              <span className="font-mono">#{h.number}</span> {h.horse.split(" ")[0]}
            </span>
          ))}
          {gap && (
            <span className="flex items-center gap-1 rounded-lg border border-border bg-surface px-2.5 py-1.5 text-xs font-bold text-accent-text">
              <Zap size={11} /> Écart IA / marché n° {gap.horse.number} {formatGap(gap.points)}
            </span>
          )}
        </div>
      </Link>
    </section>
  );
}
