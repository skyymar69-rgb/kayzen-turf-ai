import Link from "next/link";
import { ArrowRight, ChevronDown } from "lucide-react";
import { RaceStatusPill, titleCase } from "@/components/badges";
import { BASE_OUTCOME_LABELS, baseOutcome, type BaseOutcome, type PronosticRace } from "@/lib/pronostics-filters";
import { officialArrival, type RaceStatus } from "@/lib/race-status";
import type { RaceAnalysis } from "@/lib/types";
import { DisciplineDot } from "./race-bits";
import { raceHref } from "./race-card";

/**
 * `officialArrival` est typé sur le peloton complet mais ne lit que le numéro
 * et la place, que `PronosticRace` porte aussi.
 */
type ArrivalInput = Pick<RaceAnalysis, "horses">;

const OUTCOME_STYLES: Record<BaseOutcome, string> = {
  gagnante: "bg-accent text-accent-fg",
  placee: "bg-accent-lo text-accent-text",
  perdue: "bg-danger/10 text-danger",
  "hors-arrivee": "bg-danger/10 text-danger",
  "en-attente": "bg-surface-sub text-muted",
  "sans-base": "bg-surface-sub text-muted",
};

function plural(count: number, word: string): string {
  return `${count} ${word}${count > 1 ? "s" : ""}`;
}

type Props = {
  races: PronosticRace[];
  statusOf: (race: PronosticRace) => RaceStatus;
  expanded: boolean;
  onToggle: () => void;
  activeAnchor: string | null;
};

/**
 * Courses parties ou arrivées, repliées en bas de page. Chacune montre
 * l'arrivée officielle et ce qu'est devenue la base IA — réussite comme échec,
 * lus sur la place publiée et rien d'autre.
 */
export function PastRaces({ races, statusOf, expanded, onToggle, activeAnchor }: Props) {
  if (races.length === 0) return null;
  const tally = races.reduce(
    (acc, race) => {
      const outcome = baseOutcome(race);
      return { ...acc, [outcome]: (acc[outcome] ?? 0) + 1 };
    },
    {} as Partial<Record<BaseOutcome, number>>,
  );
  const settled = (tally.gagnante ?? 0) + (tally.placee ?? 0) + (tally.perdue ?? 0) + (tally["hors-arrivee"] ?? 0);

  return (
    <section aria-labelledby="titre-courses-passees" className="mt-6 rounded-2xl border border-border bg-surface">
      <h2 id="titre-courses-passees" className="m-0">
        <button
          type="button"
          aria-expanded={expanded}
          aria-controls="liste-courses-passees"
          onClick={onToggle}
          className="flex w-full flex-wrap items-center gap-x-3 gap-y-1 rounded-2xl px-4 py-4 text-left sm:px-5"
        >
          <span className="font-display text-lg font-bold text-fg">Courses parties et arrivées ({races.length})</span>
          {settled > 0 && (
            <span className="text-xs text-muted">
              Base IA : {plural(tally.gagnante ?? 0, "gagnante")}, {plural(tally.placee ?? 0, "placée")},{" "}
              {plural((tally.perdue ?? 0) + (tally["hors-arrivee"] ?? 0), "non placée")} sur {plural(settled, "arrivée")}
            </span>
          )}
          <ChevronDown aria-hidden="true" size={18} className={`ml-auto text-muted transition-transform ${expanded ? "rotate-180" : ""}`} />
        </button>
      </h2>

      {expanded && (
        <ul id="liste-courses-passees" className="border-t border-border">
          {races.map((race) => {
            const arrival = officialArrival(race as unknown as ArrivalInput);
            const outcome = baseOutcome(race);
            return (
              <li
                key={race.id}
                id={race.anchor}
                tabIndex={-1}
                className={`scroll-mt-24 flex flex-wrap items-center gap-x-3 gap-y-1.5 border-b border-border px-4 py-3 last:border-b-0 sm:px-5 ${activeAnchor === race.anchor ? "bg-accent-lo" : ""}`}
              >
                <span className="font-mono text-sm font-bold text-fg">{race.startTime}</span>
                <span className="flex items-center gap-1.5 font-mono text-xs font-bold text-muted">
                  <DisciplineDot discipline={race.discipline} />
                  {race.anchor}
                </span>
                <span className="min-w-0 flex-1 truncate text-sm font-semibold text-fg">
                  {titleCase(race.name)} <span className="font-normal text-muted">· {titleCase(race.racecourse)}</span>
                </span>
                <RaceStatusPill status={statusOf(race)} />
                <span className="basis-full text-xs text-muted sm:basis-auto">
                  Arrivée :{" "}
                  <span className="font-mono font-bold text-fg">{arrival.length > 0 ? arrival.slice(0, 5).join(" – ") : "non publiée"}</span>
                </span>
                <span className={`whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-bold ${OUTCOME_STYLES[outcome]}`}>
                  {BASE_OUTCOME_LABELS[outcome]}
                  {race.base && outcome !== "en-attente" ? ` (n° ${race.base.number})` : ""}
                </span>
                <Link href={raceHref(race)} className="ml-auto inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-bold text-accent-text hover:bg-accent-lo">
                  Analyse <span className="sr-only">de la course {race.anchor}</span>
                  <ArrowRight aria-hidden="true" size={12} />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
