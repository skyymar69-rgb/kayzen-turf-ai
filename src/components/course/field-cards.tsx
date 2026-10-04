"use client";

import { Star } from "lucide-react";
import type { Column } from "@/components/course/field-columns";
import { StanceBadge, STANCE_HINTS } from "@/components/course/field-cells";
import { ProfileBadge } from "@/components/course/shared";
import type { HorseRow } from "@/lib/course-view-model";

/**
 * LE TABLEAU EN CARTES — sous 640 px, une carte par partant au lieu d'un
 * tableau à faire défiler de côté. Mêmes colonnes, mêmes rendus que le
 * tableau : chaque valeur garde son intitulé, en grille de deux.
 */
export function FieldCards({
  rows,
  columns,
  marketView,
  confrontView,
  selectedNumber,
  onSelect,
  compare,
  compareFull,
  onToggleCompare,
  followed,
}: {
  rows: HorseRow[];
  columns: Column[];
  marketView: boolean;
  confrontView: boolean;
  selectedNumber: number | null;
  onSelect: (number: number) => void;
  compare: number[];
  compareFull: boolean;
  onToggleCompare: (number: number) => void;
  followed: { has: (id: string) => boolean };
}) {
  if (confrontView && rows.length === 0) {
    return <p className="px-4 py-6 text-center text-sm text-muted sm:hidden">Pas encore de confrontation : il faut les cotes du marché et l&apos;avis de l&apos;IA.</p>;
  }
  return (
    <ol className="divide-y divide-border sm:hidden" aria-label="Partants">
      {rows.map((row, index) => {
        const selected = selectedNumber === row.horse.number;
        const position = marketView ? index + 1 : row.rank;
        const groupStart = confrontView && row.stance !== null && row.stance !== rows[index - 1]?.stance;
        const compared = compare.includes(row.horse.number);
        return (
          <li key={row.horse.id} className={row.nonRunner ? "opacity-60" : ""}>
            {groupStart && (
              <div className="bg-surface-sub px-3 py-2">
                <StanceBadge stance={row.stance!} />
                <span className="ml-2 text-[11px] text-muted">{STANCE_HINTS[row.stance!]}</span>
              </div>
            )}
            <div className={`px-3 py-3 ${selected ? "bg-accent-lo" : ""}`}>
              <div className="flex items-center gap-2">
                <span className={`grid size-7 shrink-0 place-items-center rounded-lg font-mono text-xs font-bold ${position <= 3 ? "bg-accent text-accent-fg" : "bg-surface-sub text-muted"}`}>
                  {position}
                </span>
                <button
                  aria-label={`Voir la fiche du n° ${row.horse.number}, ${row.horse.horse}${row.nonRunner ? ", non-partant" : ""}`}
                  aria-pressed={selected}
                  className={`flex min-h-11 min-w-0 flex-1 items-center gap-2 text-left ${row.nonRunner ? "line-through decoration-danger decoration-2" : ""}`}
                  onClick={() => onSelect(row.horse.number)}
                  type="button"
                >
                  <span className="font-mono font-bold text-fg">{row.horse.number}</span>
                  <span className="truncate font-semibold text-fg">{row.horse.horse}</span>
                </button>
                {row.horse.horseId && followed.has(row.horse.horseId) && (
                  <Star aria-label="Cheval suivi" className="shrink-0 fill-amber-500 text-amber-700 dark:fill-amber-400 dark:text-amber-400" size={13} />
                )}
                <ProfileBadge profile={row.profile} />
                <label className="grid size-11 shrink-0 cursor-pointer place-items-center">
                  <span className="sr-only">Comparer le n° {row.horse.number}</span>
                  <input
                    checked={compared}
                    className="size-4 cursor-pointer accent-[var(--accent)] disabled:cursor-not-allowed"
                    disabled={!compared && compareFull}
                    onChange={() => onToggleCompare(row.horse.number)}
                    type="checkbox"
                  />
                </label>
              </div>
              <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1.5 pl-9 text-sm">
                {columns.map((c) => (
                  <div key={c.label} className="flex min-w-0 items-baseline justify-between gap-2">
                    <dt className="shrink-0 text-[10px] font-bold uppercase tracking-wider text-muted">{c.label}</dt>
                    <dd className={`min-w-0 truncate text-right ${c.align === "right" ? "font-mono" : ""}`}>{c.render(row)}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
