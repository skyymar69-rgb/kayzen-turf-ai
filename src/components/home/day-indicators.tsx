import Link from "next/link";
import { ArrowRight, BellRing, Gauge, TrendingUp } from "lucide-react";
import { ReadingBadge, titleCase } from "@/components/badges";
import { probableArrival, raceToContext } from "@/lib/bet-recommendations";
import { formatPct } from "@/lib/format";
import type { DayInsights } from "@/lib/home/meetings";
import { VALUE_THRESHOLD } from "@/lib/home/race-signals";
import { raceHref, type SignalsFor } from "./types";
import { InsightCard, MiniMetric } from "./ui";

/** Trois indicateurs du jour : courses lisibles, alerte prioritaire, courses incertaines. */
export function DayIndicators({ insights, raceCount }: { insights: DayInsights; raceCount: number }) {
  return (
    <section aria-label="Indicateurs du jour" className="mb-4 grid gap-3 sm:grid-cols-3">
      <InsightCard
        icon={<TrendingUp size={18} />}
        label="Courses lisibles"
        tone="green"
        value={`${insights.readable} sur ${raceCount}`}
        detail="Une base nette se dégage du peloton"
      />
      <InsightCard
        icon={<BellRing size={18} />}
        label="Alerte prioritaire"
        tone="amber"
        value={insights.bestAlert}
        detail={insights.nextPriority ? `${insights.nextPriority.programCode} — ${titleCase(insights.nextPriority.name)}` : "Aucune alerte forte"}
      />
      <InsightCard
        icon={<Gauge size={18} />}
        label="Courses incertaines"
        tone="dark"
        value={`${insights.open} ouverte${insights.open > 1 ? "s" : ""} · ${insights.traps} piège${insights.traps > 1 ? "s" : ""}`}
        detail="Sans base solide : prudence sur les tickets"
      />
    </section>
  );
}

/** Décision rapide : les trois courses au meilleur score de priorité. */
export function TopRaces({ insights, signalsFor }: { insights: DayInsights; signalsFor: SignalsFor }) {
  if (insights.topRaces.length === 0) return null;
  return (
    <section className="mb-4 rounded-2xl border border-border bg-surface shadow-sm">
      <div className="flex items-center justify-between border-b border-border px-5 py-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-muted">Décision rapide</p>
          <h2 className="font-display text-xl font-bold text-fg">Top {insights.topRaces.length} courses à jouer</h2>
        </div>
        <Link href="/pronostics" className="flex items-center gap-1.5 text-sm font-semibold text-accent-text transition hover:text-accent">
          Tout voir <ArrowRight size={14} />
        </Link>
      </div>
      <div className="grid gap-px bg-border sm:grid-cols-3">
        {insights.topRaces.map((race, i) => {
          const best = probableArrival(race.horses, raceToContext(race))[0];
          return (
            <Link key={race.id} href={raceHref(race)} className="group flex flex-col gap-3 bg-surface p-5 transition hover:bg-surface-sub">
              <div className="flex items-start justify-between gap-2">
                <span className="grid h-7 w-7 place-items-center rounded-lg bg-accent font-mono text-xs font-bold text-accent-fg">{i + 1}</span>
                <ReadingBadge horses={race.horses} />
              </div>
              <div>
                <p className="font-mono text-xs font-bold text-muted">{race.programCode} · {race.startTime}</p>
                <h3 className="mt-1 font-semibold text-fg group-hover:text-accent-text">{titleCase(race.name)}</h3>
                <p className="mt-0.5 text-xs text-muted">{titleCase(race.racecourse)}</p>
              </div>
              <div className="mt-auto grid grid-cols-3 gap-2">
                <MiniMetric label="Signal" value={signalsFor(race).signal} />
                <MiniMetric label="Partants" value={String(race.horses.length)} />
                <MiniMetric label="Départ" value={race.startTime} />
              </div>
              {best && best.valueIndex > VALUE_THRESHOLD && (
                <p className="rounded-lg bg-accent-lo px-2.5 py-1.5 text-xs font-bold text-accent-text">
                  Value bet n° {best.number} · espérance {formatPct(best.valueIndex, 0, true)}
                </p>
              )}
            </Link>
          );
        })}
      </div>
    </section>
  );
}
