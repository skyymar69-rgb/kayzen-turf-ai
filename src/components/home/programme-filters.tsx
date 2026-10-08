"use client";

import { Search, Zap } from "lucide-react";
import { useEffect, useRef } from "react";
import { DISCIPLINES, type DisciplineFilter } from "./types";

/** Filtre discipline, écarts IA / marché et recherche (saisie temporisée de 200 ms). */
export function ProgrammeFilters({ disciplineFilter, onDiscipline, valueBetsOnly, onToggleValue, strategy, query, onQuery, resultCount }: {
  disciplineFilter: DisciplineFilter;
  onDiscipline: (d: DisciplineFilter) => void;
  valueBetsOnly: boolean;
  onToggleValue: () => void;
  strategy: string;
  query: string;
  onQuery: (q: string) => void;
  resultCount: number;
}) {
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const inputRef = useRef<HTMLInputElement>(null);

  function handleChange(value: string) {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => onQuery(value), 200);
  }
  // Un délai encore en attente au démontage appelait `setQuery` sur un
  // composant disparu : avertissement React, et fuite du minuteur.
  useEffect(() => () => clearTimeout(debounceRef.current), []);
  // Changement de jour : la recherche est remise à zéro par le parent, le champ suit.
  useEffect(() => {
    if (!query && inputRef.current) inputRef.current.value = "";
  }, [query]);

  function clear() {
    clearTimeout(debounceRef.current);
    onQuery("");
    if (inputRef.current) inputRef.current.value = "";
    inputRef.current?.focus();
  }

  return (
    <div className="flex flex-col gap-3 border-b border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex overflow-hidden rounded-lg border border-border bg-surface-sub text-xs font-bold" role="group" aria-label="Filtrer par discipline">
          {DISCIPLINES.map((d) => (
            <button
              key={d}
              aria-pressed={disciplineFilter === d}
              className={`px-3 py-1.5 transition ${disciplineFilter === d ? "bg-accent text-accent-fg" : "text-muted hover:bg-surface"}`}
              onClick={() => onDiscipline(d)}
              type="button"
            >
              {d}
            </button>
          ))}
        </div>
        <button
          aria-pressed={valueBetsOnly}
          className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-bold transition ${valueBetsOnly ? "border-warn bg-warn-lo text-warn" : "border-border bg-surface text-muted hover:border-warn/50 hover:text-warn"}`}
          onClick={onToggleValue}
          type="button"
        >
          <Zap size={12} /> Écarts IA / marché
        </button>
        <span className="hidden text-sm text-muted sm:inline">{strategy}</span>
      </div>
      <div className="relative flex items-center gap-2 rounded-xl border border-border bg-surface-sub px-3 py-2 text-sm sm:min-w-[220px]" role="search">
        <Search size={14} className="shrink-0 text-muted" />
        <label className="sr-only" htmlFor="race-search">Filtrer les courses</label>
        <input
          id="race-search"
          ref={inputRef}
          className="min-h-11 min-w-0 flex-1 bg-transparent text-fg outline-none placeholder:text-muted"
          placeholder="Filtrer par course, prix…"
          defaultValue=""
          onChange={(e) => handleChange(e.target.value)}
        />
        {query && (
          <button
            aria-label="Effacer la recherche"
            className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted/20 text-muted transition hover:bg-accent/20 hover:text-accent-text"
            onClick={clear}
            type="button"
          >
            <span aria-hidden="true" className="text-xs font-bold leading-none">×</span>
          </button>
        )}
      </div>
      {/* amélioration #23 — aria-live pour les résultats de recherche */}
      <span aria-live="polite" className="sr-only">
        {query ? `${resultCount} course${resultCount > 1 ? "s" : ""} affichée${resultCount > 1 ? "s" : ""}` : ""}
      </span>
    </div>
  );
}
