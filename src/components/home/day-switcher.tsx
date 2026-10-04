import { DAY_ORDER, dateForDay, formatRelativeDay, formatShortDate } from "@/lib/home/days";
import type { RaceAnalysis } from "@/lib/types";

/** Sélecteur Hier / Aujourd'hui / Demain du bandeau programme. */
export function DaySwitcher({ races, dayFilter, onSelect }: {
  races: RaceAnalysis[];
  dayFilter: RaceAnalysis["relativeDay"];
  onSelect: (day: RaceAnalysis["relativeDay"]) => void;
}) {
  return (
    <div className="flex flex-1">
      {DAY_ORDER.map((day) => {
        const active = dayFilter === day;
        const count = races.filter((r) => r.relativeDay === day).length;
        return (
          <button
            key={day}
            aria-pressed={active}
            className={`relative flex flex-1 flex-col items-center justify-center gap-0.5 py-3 text-center transition sm:py-4 ${
              active ? "bg-white/10" : "hover:bg-white/5"
            }`}
            onClick={() => onSelect(day)}
            type="button"
          >
            <span className={`text-[10px] font-bold uppercase tracking-widest ${active ? "text-cta" : "text-slate-400"}`}>
              {formatRelativeDay(day)}
            </span>
            <span className={`font-display text-base font-bold sm:text-lg ${active ? "text-white" : "text-slate-200"}`}>
              {formatShortDate(dateForDay(races, day))}
            </span>
            <span className={`text-[10px] ${active ? "text-white/65" : "text-slate-400"}`}>
              {count > 0 ? `${count} course${count > 1 ? "s" : ""}` : "—"}
            </span>
            {active && <span className="absolute bottom-0 left-2 right-2 h-0.5 rounded-t-full bg-cta" />}
          </button>
        );
      })}
    </div>
  );
}
