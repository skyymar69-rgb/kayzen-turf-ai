import Link from "next/link";
import { buildBetRecommendations, probableArrival } from "@/lib/bet-recommendations";
import { getRaces } from "@/lib/race-repository";

export const dynamic = "force-dynamic";

export default async function PronosticsPage() {
  const races = (await getRaces({ day: "today" })).sort(
    (a, b) => a.startTime.localeCompare(b.startTime) || a.reunionNumber - b.reunionNumber || a.courseNumber - b.courseNumber,
  );

  return (
    <main className="min-h-screen bg-[#f3f5f4] px-3 py-12 text-[#26312e] sm:px-5 lg:px-8" id="contenu-principal">
      <section className="mx-auto max-w-[1480px]">
        <div className="rounded-md border border-[#d9e1de] bg-white p-5 shadow-sm sm:p-7">
          <p className="text-sm font-bold uppercase text-emerald-700">Toutes les courses du jour</p>
          <h1 className="mt-2 text-3xl font-bold tracking-normal sm:text-5xl">Pronostics Turf - PMU du jour</h1>
          <p className="mt-4 max-w-4xl text-base leading-7 text-[#52615d]">
            Récapitulatif horaire de toutes les courses françaises disponibles aujourd’hui, avec ordre probable, base IA,
            value bet prioritaire et tickets proposés lorsque les paris sont ouverts.
          </p>
        </div>

        <div className="mt-5 grid gap-4">
          {races.map((race) => {
            const arrival = probableArrival(race.horses);
            const recommendations = buildBetRecommendations(race.horses, race.betTypes);
            const value = arrival.find((horse) => horse.valueIndex > 10) ?? arrival[0];
            return (
              <article className="rounded-md border border-[#d9e1de] bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-xl" key={race.id}>
                <div className="grid gap-4 xl:grid-cols-[1fr_1.1fr_auto] xl:items-center">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-sm bg-[#3f403f] px-2 py-1 font-mono text-sm font-bold text-white">{race.programCode}</span>
                      <span className="font-mono text-sm font-bold text-emerald-700">{race.startTime}</span>
                      <span className="text-sm font-semibold text-[#52615d]">{race.racecourse}</span>
                    </div>
                    <h2 className="mt-2 text-xl font-bold">{race.name}</h2>
                    <p className="mt-1 text-sm text-[#52615d]">{race.discipline} - {race.specialty} - {race.distance}</p>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-3">
                    <RecapBox label="Ordre probable" value={arrival.slice(0, 5).map((horse) => horse.number).join(" - ")} />
                    <RecapBox label="Base IA" value={`#${arrival[0]?.number ?? "-"} ${arrival[0]?.horse ?? "-"}`} />
                    <RecapBox label="Value" value={`#${value?.number ?? "-"} ${value?.valueIndex ?? 0}`} />
                  </div>

                  <Link className="inline-flex min-h-11 items-center justify-center rounded-sm bg-emerald-700 px-4 text-sm font-bold uppercase text-white" href={`/races/${encodeURIComponent(race.id)}`}>
                    Analyse complete
                  </Link>
                </div>
                <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
                  {recommendations.slice(0, 8).map((item) => (
                    <span className="shrink-0 rounded-full border border-emerald-700/20 bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-900" key={item.type}>
                      {item.label}: {item.ticket}
                    </span>
                  ))}
                  {recommendations.length === 0 ? (
                    <span className="text-sm text-[#65746f]">Aucun ticket propose pour les paris ouverts connus.</span>
                  ) : null}
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </main>
  );
}

function RecapBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-[#d9e1de] bg-[#fbfcfc] p-3">
      <p className="text-xs uppercase text-[#65746f]">{label}</p>
      <p className="mt-1 truncate font-mono text-sm font-bold text-[#26312e]">{value}</p>
    </div>
  );
}

