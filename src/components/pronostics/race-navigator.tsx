"use client";

import { useEffect, useRef } from "react";
import { RaceStatusPill, titleCase } from "@/components/badges";
import type { PronosticRace, ReunionGroup } from "@/lib/pronostics-filters";
import type { RaceStatus } from "@/lib/race-status";
import { DisciplineDot } from "./race-bits";

type Props = {
  groups: ReunionGroup[];
  statusOf: (race: PronosticRace) => RaceStatus;
  activeAnchor: string | null;
  onSelect: (anchor: string) => void;
  /** Identifiant unique : le navigateur existe en barre latérale et dans le tiroir mobile. */
  idPrefix: string;
};

/**
 * Sommaire des courses par réunion. Chaque ligne est un vrai lien `#R1C3`
 * (ouvrable dans un nouvel onglet, copiable) ; le clic est intercepté pour
 * déplier les courses passées si besoin et défiler en douceur.
 */
export function RaceNavigator({ groups, statusOf, activeAnchor, onSelect, idPrefix }: Props) {
  const listRef = useRef<HTMLDivElement>(null);

  // Garde la course active visible dans la colonne, sans faire défiler la page.
  useEffect(() => {
    const container = listRef.current;
    if (!container || !activeAnchor) return;
    const item = container.querySelector<HTMLElement>(`[data-nav-anchor="${activeAnchor}"]`);
    if (!item) return;
    // Le conteneur est positionné : `offsetTop` se mesure depuis son bord haut.
    const top = item.offsetTop;
    if (top < container.scrollTop || top + item.offsetHeight > container.scrollTop + container.clientHeight) {
      container.scrollTo({ top: Math.max(0, top - container.clientHeight / 3) });
    }
  }, [activeAnchor]);

  if (groups.length === 0) {
    return <p className="px-3 py-4 text-sm text-muted">Aucune course ne correspond aux filtres.</p>;
  }

  return (
    <div ref={listRef} className="relative h-full overflow-y-auto overscroll-contain">
      {groups.map((group) => {
        const headingId = `${idPrefix}-${group.key}`;
        return (
          <section key={group.key} aria-labelledby={headingId} className="mb-3 last:mb-0">
            <h3 id={headingId} className="sticky top-0 z-10 bg-surface px-3 py-1.5 text-xs font-bold uppercase tracking-widest text-muted">
              {group.key} · {titleCase(group.racecourse)}
            </h3>
            <ul>
              {group.races.map((race) => {
                const active = race.anchor === activeAnchor;
                return (
                  <li key={race.id}>
                    <a
                      href={`#${race.anchor}`}
                      data-nav-anchor={race.anchor}
                      aria-current={active ? "location" : undefined}
                      onClick={(event) => {
                        if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
                        event.preventDefault();
                        onSelect(race.anchor);
                      }}
                      className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm transition-colors ${
                        active ? "bg-accent-lo font-bold text-accent-text" : "text-fg hover:bg-surface-sub"
                      }`}
                    >
                      <DisciplineDot discipline={race.discipline} />
                      <span className="w-7 font-mono text-xs font-bold">C{race.courseNumber}</span>
                      <span className="font-mono text-xs tabular-nums text-muted">{race.startTime}</span>
                      <RaceStatusPill status={statusOf(race)} className="ml-auto" />
                    </a>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
