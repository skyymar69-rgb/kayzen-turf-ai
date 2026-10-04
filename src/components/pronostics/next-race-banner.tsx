import { ArrowDown, Timer } from "lucide-react";
import { titleCase } from "@/components/badges";
import type { PronosticRace } from "@/lib/pronostics-filters";
import { IMMINENT_MINUTES, minutesToStart } from "@/lib/race-status";

/** « 12 min », « 1 h 05 » ; « moins d'une minute » plutôt que « 0 min ». */
export function formatDelay(minutes: number): string {
  const rounded = Math.max(0, Math.floor(minutes));
  if (rounded < 1) return "moins d’une minute";
  if (rounded < 60) return `${rounded} min`;
  return `${Math.floor(rounded / 60)} h ${String(rounded % 60).padStart(2, "0")}`;
}

type Props = { race: PronosticRace | null; now: Date; onJump: (anchor: string) => void };

/**
 * Bandeau de la prochaine course. Le délai suit l'horloge de la page (20 s) :
 * pas de région live, qui ferait relire le bandeau à chaque tic.
 */
export function NextRaceBanner({ race, now, onJump }: Props) {
  if (!race) return null;
  const minutes = minutesToStart(race, now);
  if (minutes === null) return null;
  const imminent = minutes <= IMMINENT_MINUTES;

  return (
    <div
      className={`mb-4 flex flex-wrap items-center gap-3 rounded-2xl border px-4 py-3 ${
        imminent ? "border-warn/40 bg-warn-lo" : "border-accent/30 bg-accent-lo"
      }`}
    >
      <Timer aria-hidden="true" size={18} className={imminent ? "text-warn" : "text-accent-text"} />
      <p className="min-w-0 flex-1 text-sm text-fg">
        <span className="font-bold">Prochaine course dans {formatDelay(minutes)}</span>
        <span className="text-muted"> — </span>
        <span className="font-mono font-bold">{race.anchor}</span> {titleCase(race.racecourse)}
        <span className="text-muted"> · départ {race.startTime}</span>
      </p>
      <button
        type="button"
        onClick={() => onJump(race.anchor)}
        className="inline-flex items-center gap-1.5 rounded-xl bg-accent px-3 py-2 text-sm font-bold text-accent-fg hover:bg-accent-hi"
      >
        Voir la course <ArrowDown aria-hidden="true" size={14} />
      </button>
    </div>
  );
}
