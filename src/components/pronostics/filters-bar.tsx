"use client";

import type { ReactNode, RefObject } from "react";
import { LayoutGrid, Rows3, Search, X } from "lucide-react";
import {
  DEFAULT_FILTERS,
  DISCIPLINES,
  SORT_LABELS,
  activeFilterCount,
  countWith,
  type PronosticFilters,
  type PronosticPrefs,
  type PronosticRace,
  type SortKey,
} from "@/lib/pronostics-filters";
import { ShortcutsHelp } from "./shortcuts-help";

type Props = {
  races: PronosticRace[];
  prefs: PronosticPrefs;
  now: Date;
  shown: number;
  onChange: (patch: Partial<PronosticPrefs>) => void;
  searchRef: RefObject<HTMLInputElement | null>;
  helpOpen: boolean;
  onHelpToggle: (open: boolean) => void;
};

type Toggle = { key: "quinte" | "value" | "lisible" | "upcoming"; label: string };

const TOGGLES: Toggle[] = [
  { key: "quinte", label: "Quinté+" },
  { key: "value", label: "Avec écart IA / marché" },
  { key: "lisible", label: "Lisibles" },
  { key: "upcoming", label: "À venir" },
];

/**
 * Recherche, filtres rapides, tri et vue. Chaque filtre affiche le nombre de
 * courses qu'il donnerait combiné aux autres : on sait avant de cliquer s'il
 * reste quelque chose à voir.
 */
export function FiltersBar({ races, prefs, now, shown, onChange, searchRef, helpOpen, onHelpToggle }: Props) {
  const { filters } = prefs;
  const setFilters = (patch: Partial<PronosticFilters>) => onChange({ filters: { ...filters, ...patch } });
  const active = activeFilterCount(filters);

  return (
    <div className="mb-4 rounded-2xl border border-border bg-surface p-3 shadow-sm sm:p-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-0 flex-[1_1_16rem]">
          <label htmlFor="recherche-courses" className="sr-only">
            Rechercher un cheval, un jockey ou driver, un entraîneur ou un hippodrome
          </label>
          <Search aria-hidden="true" size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input
            ref={searchRef}
            id="recherche-courses"
            type="search"
            autoComplete="off"
            spellCheck={false}
            value={filters.query}
            onChange={(event) => setFilters({ query: event.target.value })}
            placeholder="Cheval, jockey, entraîneur, hippodrome…"
            className="h-10 w-full rounded-xl border border-border bg-surface-sub pl-9 pr-9 text-sm text-fg placeholder:text-muted"
          />
          {filters.query && (
            <button
              type="button"
              onClick={() => {
                setFilters({ query: "" });
                searchRef.current?.focus();
              }}
              className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-muted hover:text-fg"
            >
              <X aria-hidden="true" size={14} />
              <span className="sr-only">Effacer la recherche</span>
            </button>
          )}
        </div>

        <label className="flex items-center gap-2 text-sm text-muted">
          <span className="whitespace-nowrap">Trier par</span>
          <select
            value={prefs.sort}
            onChange={(event) => onChange({ sort: event.target.value as SortKey })}
            className="h-10 rounded-xl border border-border bg-surface-sub px-2 text-sm font-semibold text-fg"
          >
            {(Object.keys(SORT_LABELS) as SortKey[]).map((key) => (
              <option key={key} value={key}>{SORT_LABELS[key]}</option>
            ))}
          </select>
        </label>

        <div role="group" aria-label="Affichage" className="flex rounded-xl border border-border bg-surface-sub p-0.5">
          <ViewButton pressed={prefs.view === "cartes"} onClick={() => onChange({ view: "cartes" })} icon={<LayoutGrid aria-hidden="true" size={15} />} label="Cartes" />
          <ViewButton pressed={prefs.view === "compacte"} onClick={() => onChange({ view: "compacte" })} icon={<Rows3 aria-hidden="true" size={15} />} label="Compacte" />
        </div>

        <ShortcutsHelp open={helpOpen} onToggle={onHelpToggle} />
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-1.5" role="group" aria-label="Filtres rapides">
        {DISCIPLINES.map((discipline) => {
          const pressed = filters.disciplines.includes(discipline);
          const next = pressed ? filters.disciplines.filter((d) => d !== discipline) : [...filters.disciplines, discipline];
          return (
            <Chip
              key={discipline}
              pressed={pressed}
              onClick={() => setFilters({ disciplines: next })}
              label={discipline}
              count={countWith(races, filters, { disciplines: [discipline] }, now)}
            />
          );
        })}
        <span aria-hidden="true" className="mx-1 h-5 w-px bg-border" />
        {TOGGLES.map((toggle) => (
          <Chip
            key={toggle.key}
            pressed={filters[toggle.key]}
            onClick={() => setFilters({ [toggle.key]: !filters[toggle.key] })}
            label={toggle.label}
            count={countWith(races, filters, { [toggle.key]: true }, now)}
          />
        ))}
        {active > 0 && (
          <button
            type="button"
            onClick={() => onChange({ filters: DEFAULT_FILTERS })}
            className="ml-1 rounded-full px-2.5 py-1 text-xs font-bold text-accent-text underline-offset-2 hover:underline"
          >
            Réinitialiser
          </button>
        )}
        <p className="ml-auto text-xs text-muted" aria-live="polite">
          {shown} course{shown > 1 ? "s" : ""} sur {races.length}
        </p>
      </div>
    </div>
  );
}

function Chip({ pressed, onClick, label, count }: { pressed: boolean; onClick: () => void; label: string; count: number }) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={`rounded-full border px-2.5 py-1 text-xs font-bold transition-colors ${
        pressed ? "border-accent bg-accent text-accent-fg" : "border-border bg-surface-sub text-fg hover:border-border-strong"
      }`}
    >
      {label} <span className={pressed ? "opacity-80" : "text-muted"}>({count})</span>
    </button>
  );
}

function ViewButton({ pressed, onClick, icon, label }: { pressed: boolean; onClick: () => void; icon: ReactNode; label: string }) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={`inline-flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-xs font-bold ${pressed ? "bg-surface text-fg shadow-sm" : "text-muted hover:text-fg"}`}
    >
      {icon}
      {label}
    </button>
  );
}
