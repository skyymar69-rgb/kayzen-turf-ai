import Link from "next/link";
import { DAY_PARAMS, type DayParam } from "@/lib/pronostics-filters";

/**
 * Hier / Aujourd'hui / Demain. Aujourd'hui pointe sur /pronostics sans
 * paramètre : c'est l'adresse canonique de la page.
 */
export function DaySelector({ current }: { current: DayParam }) {
  return (
    <nav aria-label="Jour des courses" className="inline-flex rounded-xl border border-border bg-surface-sub p-1">
      {DAY_PARAMS.map(({ param, label }) => {
        const active = param === current;
        return (
          <Link
            key={param}
            href={param === "aujourdhui" ? "/pronostics" : `/pronostics?jour=${param}`}
            aria-current={active ? "page" : undefined}
            className={`rounded-lg px-3 py-1.5 text-sm font-bold transition-colors ${active ? "bg-surface text-fg shadow-sm" : "text-muted hover:text-fg"}`}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
