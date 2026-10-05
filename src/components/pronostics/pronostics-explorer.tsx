"use client";

import { useCallback, useEffect, useEffectEvent, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { ListOrdered } from "lucide-react";
import {
  DEFAULT_FILTERS,
  adjacentAnchor,
  applyFilters,
  groupByReunion,
  isUpcoming,
  nextUpcoming,
  sortRaces,
  splitPast,
  statusOf,
  type PronosticRace,
  type RelativeDay,
} from "@/lib/pronostics-filters";
import type { RaceStatus } from "@/lib/race-status";
import { FiltersBar } from "./filters-bar";
import { NavigatorDrawer } from "./navigator-drawer";
import { NextRaceBanner } from "./next-race-banner";
import { PastRaces } from "./past-races";
import { RaceCard } from "./race-card";
import { RaceNavigator } from "./race-navigator";
import { RaceRow } from "./race-row";
import { useNow } from "./use-now";
import { usePrefs } from "./use-prefs";
import { useScrollMemory } from "./use-scroll-memory";
import { useScrollSpy } from "./use-scroll-spy";
import { useShortcuts } from "./use-shortcuts";

type Props = { races: PronosticRace[]; day: RelativeDay; serverNow: number };

/**
 * Explorateur de /pronostics : sommaire collant par réunion, filtres, tri,
 * recherche, vue compacte, courses passées repliées, raccourcis clavier.
 * Les données arrivent toutes calculées du serveur ; ici on ne fait que
 * filtrer, trier et faire défiler.
 */
export function PronosticsExplorer({ races, day, serverNow }: Props) {
  const now = useNow(serverNow);
  const { prefs, update } = usePrefs();
  /** `null` : repli automatique (déplié seulement s'il ne reste rien à venir). */
  const [pastOpen, setPastOpen] = useState<boolean | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const cursorRef = useRef<string | null>(null);

  useScrollMemory(day);

  const statuses = useMemo(() => new Map(races.map((r) => [r.anchor, statusOf(r, now)])), [races, now]);
  const getStatus = useCallback((race: PronosticRace): RaceStatus => statuses.get(race.anchor) ?? "a-venir", [statuses]);

  const filtered = useMemo(() => applyFilters(races, prefs.filters, now), [races, prefs.filters, now]);
  const { active, past } = useMemo(() => splitPast(filtered, now), [filtered, now]);
  const activeSorted = useMemo(() => sortRaces(active, prefs.sort), [active, prefs.sort]);
  const groups = useMemo(() => groupByReunion(filtered), [filtered]);
  const pastExpanded = pastOpen ?? active.length === 0;

  const rendered = [...activeSorted, ...(pastExpanded ? past : [])].map((r) => r.anchor);
  const activeAnchor = useScrollSpy(rendered);
  const next = day === "today" ? nextUpcoming(races, now) : null;

  useEffect(() => {
    cursorRef.current = activeAnchor;
  }, [activeAnchor]);

  /**
   * Amène une course à l'écran : retire les filtres qui la cachent, déplie
   * les courses passées si elle en fait partie, puis défile et y pose le
   * focus. L'adresse prend l'ancre (#R1C3) pour pouvoir être partagée.
   */
  function scrollToRace(anchor: string, smooth = true) {
    const race = races.find((r) => r.anchor === anchor);
    if (!race) return;
    const hidden = !filtered.some((r) => r.anchor === anchor);
    const isPast = !isUpcoming(getStatus(race));
    if (hidden || (isPast && !pastExpanded)) {
      flushSync(() => {
        if (hidden) update({ filters: DEFAULT_FILTERS });
        if (isPast) setPastOpen(true);
      });
    }
    const el = document.getElementById(anchor);
    if (!el) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollIntoView({ behavior: smooth && !reduced ? "smooth" : "auto", block: "start" });
    el.focus({ preventScroll: true });
    cursorRef.current = anchor;
    window.history.replaceState(window.history.state, "", `#${anchor}`);
  }

  const order = [...activeSorted, ...past].map((r) => r.anchor);
  useShortcuts({
    next: () => {
      const target = adjacentAnchor(order, cursorRef.current, 1);
      if (target) scrollToRace(target);
    },
    previous: () => {
      const target = adjacentAnchor(order, cursorRef.current, -1);
      if (target) scrollToRace(target);
    },
    focusSearch: () => searchRef.current?.focus(),
    toggleHelp: () => setHelpOpen((open) => !open),
  });

  // Lien partagé (/pronostics#R1C3) et changements d'ancre ultérieurs.
  const onHash = useEffectEvent((smooth: boolean) => {
    // Une ancre mal encodée (#%E0) fait lever decodeURIComponent : on l'ignore.
    let anchor = "";
    try {
      anchor = decodeURIComponent(window.location.hash.slice(1));
    } catch {
      return;
    }
    if (anchor) scrollToRace(anchor, smooth);
  });
  useEffect(() => {
    const timer = setTimeout(() => onHash(false), 0);
    const listener = () => onHash(true);
    window.addEventListener("hashchange", listener);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("hashchange", listener);
    };
  }, []);

  return (
    <div className="lg:grid lg:grid-cols-[15.5rem_minmax(0,1fr)] lg:gap-6">
      {/* Liens d'évitement : sauter la barre de navigation, ou y aller directement. */}
      <div className="lg:col-span-2">
        <a className="sr-only rounded-lg bg-accent px-3 py-2 text-sm font-bold text-accent-fg focus:not-sr-only focus:mb-3 focus:inline-block" href="#liste-courses">
          Aller à la liste des courses
        </a>
        <a className="hidden rounded-lg bg-accent px-3 py-2 text-sm font-bold text-accent-fg lg:sr-only lg:inline-block lg:focus:not-sr-only lg:focus:mb-3 lg:focus:ml-2" href="#navigation-courses">
          Aller à la navigation des courses
        </a>
      </div>
      <aside className="hidden lg:block">
        <div className="sticky top-20 flex max-h-[calc(100dvh-6rem)] flex-col rounded-2xl border border-border bg-surface py-3 shadow-sm">
          <h2 className="flex items-center gap-2 px-4 pb-2 font-display text-base font-bold text-fg">
            <ListOrdered aria-hidden="true" size={16} className="text-muted" />
            Courses ({filtered.length})
          </h2>
          <nav aria-label="Courses de la journée" className="min-h-0 flex-1 px-1" id="navigation-courses" tabIndex={-1}>
            <RaceNavigator groups={groups} statusOf={getStatus} activeAnchor={activeAnchor} onSelect={scrollToRace} idPrefix="barre" />
          </nav>
        </div>
      </aside>

      <div className="min-w-0" id="liste-courses" tabIndex={-1}>
        <NextRaceBanner race={next} now={now} onJump={scrollToRace} />
        <FiltersBar
          races={races}
          prefs={prefs}
          now={now}
          shown={filtered.length}
          onChange={update}
          searchRef={searchRef}
          helpOpen={helpOpen}
          onHelpToggle={setHelpOpen}
        />

        {filtered.length === 0 ? (
          <div className="rounded-2xl border border-border bg-surface p-10 text-center">
            <p className="text-base font-semibold text-fg">Aucune course ne correspond à ces filtres.</p>
            <button
              type="button"
              onClick={() => update({ filters: DEFAULT_FILTERS })}
              className="mt-3 text-sm font-bold text-accent-text hover:underline"
            >
              Réinitialiser les filtres
            </button>
          </div>
        ) : activeSorted.length === 0 ? (
          <p className="rounded-2xl border border-border bg-surface p-5 text-sm text-muted">
            Plus aucune course à venir dans cette sélection : arrivées et bilans de la base IA ci-dessous.
          </p>
        ) : prefs.view === "compacte" ? (
          <ul aria-label="Courses à venir" className="overflow-hidden rounded-2xl border border-border bg-surface shadow-sm">
            {activeSorted.map((race) => (
              <RaceRow key={race.id} race={race} status={getStatus(race)} active={race.anchor === activeAnchor} />
            ))}
          </ul>
        ) : (
          <div className="space-y-3">
            {activeSorted.map((race) => (
              <RaceCard key={race.id} race={race} status={getStatus(race)} active={race.anchor === activeAnchor} />
            ))}
          </div>
        )}

        <PastRaces
          races={past}
          statusOf={getStatus}
          expanded={pastExpanded}
          onToggle={() => setPastOpen(!pastExpanded)}
          activeAnchor={activeAnchor}
        />
      </div>

      <NavigatorDrawer groups={groups} count={filtered.length} statusOf={getStatus} activeAnchor={activeAnchor} onSelect={scrollToRace} />
    </div>
  );
}
