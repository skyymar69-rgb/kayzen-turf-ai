import { Clock3, CloudSun, Layers } from "lucide-react";
import { Countdown } from "@/components/countdown";
import type { RelaunchResult } from "@/components/course/live-status";
import { LiveStatus } from "@/components/course/live-status";
import { RaceNavigation } from "@/components/course/race-navigation";
import { Term } from "@/components/course/term";
import { BetBadges, ShareButton, formatLongDate } from "@/components/course/tools";
import { formatMeters, properName } from "@/lib/format";
import type { RaceIndexItem } from "@/lib/race-navigation";
import type { RaceAnalysis } from "@/lib/types";

/**
 * EN-TÊTE DE LA PAGE COURSE — discipline, distance, départ, terrain et météo,
 * état des cotes et relance de l'analyse, puis navigation dans la journée.
 */

/** Terrain et météo, tels que l'organisateur les publie. Rien n'est déduit. */
/** Heure de Paris d'un horodatage ISO (« 14:05 »), indépendante du fuseau du visiteur. */
const heureParis = new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Paris" });

function GoingWeather({ going, goingUpdatedAt, weather }: { going: string; goingUpdatedAt: string | null; weather: string }) {
  const g = going?.trim();
  const w = weather?.trim();
  if (!g && !w) return null;
  const relu = goingUpdatedAt && Number.isFinite(Date.parse(goingUpdatedAt)) ? heureParis.format(new Date(goingUpdatedAt)) : null;
  return (
    <div className="mt-3 rounded-xl border border-border bg-surface-sub px-3 py-2 text-xs leading-5">
      <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-fg">
        {g && (
          <span className="inline-flex items-center gap-1.5">
            <Layers aria-hidden="true" className="text-muted" size={13} />
            <Term name="Terrain (sol)">Terrain</Term> : <strong className="font-semibold">{g}</strong>
            {relu && <span className="text-muted">(relu à {relu})</span>}
          </span>
        )}
        {w && (
          <span className="inline-flex items-center gap-1.5">
            <CloudSun aria-hidden="true" className="text-muted" size={13} />
            Météo : <strong className="font-semibold">{w}</strong>
          </span>
        )}
      </p>
      <p className="mt-0.5 text-muted">
        Relevés de l&apos;organisateur. Le modèle IA n&apos;en tient pas compte : la préférence d&apos;un cheval pour un terrain se lit dans
        ses courses passées.
      </p>
    </div>
  );
}

export function CourseHeader({
  race,
  dayIndex,
  finished,
  lastObservation,
  onRelaunchStart,
  onRelaunchDone,
}: {
  race: RaceAnalysis;
  dayIndex: RaceIndexItem[];
  finished: boolean;
  lastObservation: string | null;
  onRelaunchStart: () => void;
  onRelaunchDone: (result: RelaunchResult) => void;
}) {
  return (
    <header className="overflow-hidden rounded-2xl border border-border bg-surface shadow-sm">
      <div className="border-t-4 border-accent px-5 py-4 sm:px-7">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 text-sm text-muted">
              <span className="font-bold text-fg">{race.discipline}</span>
              {race.specialty && <><span>·</span><span>{race.specialty}</span></>}
              {race.startType && <><span>·</span><span>{race.startType === "autostart" ? "Départ autostart" : "Départ à la volte"}</span></>}
              <span>·</span><span>{formatMeters(race.distance)}</span>
              <span>·</span><span>{race.horses.length} partants</span>
            </div>
            <h1 className="mt-1 font-display text-xl font-bold text-fg sm:text-2xl">
              {properName(race.racecourse)} — {formatLongDate(race.raceDate)}
            </h1>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <span className="flex items-center gap-2 font-bold text-accent-text">
              <Clock3 aria-hidden="true" size={18} />
              Départ {race.startTime}
              <Countdown relativeDay={race.relativeDay} startTime={race.startTime} />
            </span>
            <ShareButton name={race.name} programCode={race.programCode} />
          </div>
        </div>
        <BetBadges offers={race.betTypes} />
        <GoingWeather going={race.going} goingUpdatedAt={race.goingUpdatedAt ?? null} weather={race.weather} />
        <LiveStatus
          finished={finished}
          lastObservation={lastObservation}
          oddsSources={race.horses.map((horse) => horse.oddsSource ?? null)}
          raceDate={race.raceDate}
          raceId={race.id}
          startTime={race.startTime}
          onDone={onRelaunchDone}
          onStart={onRelaunchStart}
        />
        <RaceNavigation current={race} index={dayIndex} />
      </div>
    </header>
  );
}
