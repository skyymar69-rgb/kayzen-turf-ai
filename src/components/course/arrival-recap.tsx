import { Trophy } from "lucide-react";
import { groupPayouts, pickResult, type Payout } from "@/lib/arrival-recap";
import type { CourseViewModel } from "@/lib/course-view-model";
import { formatEuros } from "@/lib/format";
import { officialArrival } from "@/lib/race-status";
import type { PostRaceAnalysis, RaceAnalysis } from "@/lib/types";
import { Card, Eyebrow } from "@/components/course/shared";

/**
 * ARRIVÉE — en tête de page dès qu'une place est publiée : l'arrivée
 * officielle, ce qu'est devenu notre premier choix, et les rapports que le
 * PMU a réellement payés. Le détail (notre ordre complet) reste dans le
 * panneau « Après la course ».
 */
export function ArrivalRecap({ race, vm, postRace, payouts }: { race: RaceAnalysis; vm: CourseViewModel; postRace: PostRaceAnalysis; payouts: Payout[] }) {
  const arrival = officialArrival(race);
  if (arrival.length === 0) return null;
  const names = new Map(race.horses.map((h) => [h.number, h.horse]));
  const pick = pickResult(arrival, vm.rows[0]?.horse.number ?? null);
  const groups = groupPayouts(payouts);

  return (
    <Card className="mt-4 overflow-hidden border-2 border-accent/30">
      <div className="flex items-center gap-2 border-b border-border bg-accent-lo px-5 py-3 sm:px-6">
        <Trophy aria-hidden="true" className="text-accent-text" size={18} />
        <h2 className="font-display text-base font-bold text-fg">Arrivée officielle</h2>
      </div>
      <div className="grid gap-4 px-5 py-4 sm:px-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div>
          <p className="font-mono text-3xl font-bold tracking-tight text-accent-text">{arrival.join(" – ")}</p>
          <ol className="mt-2 grid gap-1 text-sm">
            {arrival.slice(0, 5).map((n, i) => (
              <li key={n} className="flex gap-2">
                <span className="w-7 shrink-0 text-muted">{i + 1}{i === 0 ? "er" : "e"}</span>
                <span className="text-fg"><span className="font-mono font-bold">{n}</span> {names.get(n) ?? ""}</span>
              </li>
            ))}
          </ol>
          <p className="mt-3 text-sm text-fg">
            {pick.sentence}
            {postRace.status === "complete" && <> Notre Top 3 en a trouvé {postRace.metrics.top3Hits} sur 3.</>}
          </p>
        </div>
        <div>
          <Eyebrow>Rapports PMU pour 1 €</Eyebrow>
          {groups.length === 0 ? (
            <p className="mt-2 text-sm text-muted">Rapports officiels non encore disponibles pour cette course.</p>
          ) : (
            <dl className="mt-2 grid gap-1.5 text-sm">
              {groups.map((g) => (
                <div key={g.betType} className="flex flex-wrap items-baseline justify-between gap-x-3 border-b border-border pb-1.5 last:border-0">
                  <dt className="font-semibold text-fg">{g.label}</dt>
                  <dd className="flex flex-wrap justify-end gap-x-3 font-mono text-xs text-fg">
                    {g.items.map((item) => (
                      <span key={item.combination}>
                        <span className="text-muted">{item.combination} :</span> {formatEuros(item.dividend)}
                      </span>
                    ))}
                  </dd>
                </div>
              ))}
            </dl>
          )}
        </div>
      </div>
    </Card>
  );
}
