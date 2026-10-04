import { Ban } from "lucide-react";
import type { HorseRow } from "@/lib/course-view-model";

/**
 * NON-PARTANTS — listés en tête de page, avec l'heure de l'information quand
 * la source la donne. Le bloc dépend des champs optionnels `nonRunner` et
 * `nonRunnerAt` (voir course-view-model) : tant que l'import ne les
 * renseigne pas, il ne s'affiche pas. Les chevaux restent barrés dans le
 * tableau.
 */

const timeFmt = new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Paris" });

function infoTime(iso: string | null): string | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  return Number.isFinite(t) ? timeFmt.format(new Date(t)) : null;
}

export function NonRunners({ rows }: { rows: HorseRow[] }) {
  if (rows.length === 0) return null;
  return (
    <div className="mt-4 flex items-start gap-3 rounded-2xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm leading-6 text-danger sm:px-5" role="status">
      <Ban aria-hidden="true" className="mt-1 shrink-0" size={16} />
      <div>
        <p className="font-bold">Non-partant{rows.length > 1 ? "s" : ""}</p>
        <ul className="flex flex-wrap gap-x-4">
          {rows.map((r) => {
            const time = infoTime(r.nonRunnerAt);
            return (
              <li key={r.horse.id}>
                <span className="font-mono font-bold line-through">{r.horse.number}</span> <span className="line-through">{r.horse.horse}</span>
                {time && <span className="text-xs"> (information de {time})</span>}
              </li>
            );
          })}
        </ul>
        <p className="text-xs">Un non-partant ne court pas : sa cote et ses probabilités ne sont plus à prendre en compte.</p>
      </div>
    </div>
  );
}
