import Link from "next/link";
import { ArrowRight, Clock3, Flag, TrendingUp } from "lucide-react";
import { buildBetRecommendations, probableArrival } from "@/lib/bet-recommendations";
import { getRaces } from "@/lib/race-repository";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Pronostics PMU du jour",
  description: "Toutes les courses françaises du jour avec ordre probable, base IA, value bet prioritaire et tickets proposés.",
};

export default async function PronosticsPage() {
  const races = (await getRaces({ day: "today" })).sort(
    (a, b) => a.startTime.localeCompare(b.startTime) || a.reunionNumber - b.reunionNumber || a.courseNumber - b.courseNumber,
  );

  const totalHorses   = races.reduce((t, r) => t + r.horses.length, 0);
  const valueRaces    = races.filter((r) => r.horses.some((h) => h.valueIndex > 10)).length;
  const quinteRaces   = races.filter((r) => r.betTypes.some((b) => b.type === "QUINTE_PLUS")).length;

  return (
    <main className="min-h-screen bg-bg pb-20" id="contenu-principal">
      <div className="mx-auto max-w-[1480px] px-4 pt-8 sm:px-6 lg:px-8">

        {/* Header page */}
        <section className="mb-6 rounded-2xl border border-border bg-surface p-6 shadow-sm sm:p-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full border border-accent/30 bg-accent-lo px-3 py-1 text-xs font-bold uppercase tracking-widest text-accent-text">
                <Flag size={11} />
                Toutes les courses du jour
              </span>
              <h1 className="mt-4 font-display text-4xl font-bold text-fg sm:text-5xl">
                Pronostics PMU du jour
              </h1>
              <p className="mt-3 max-w-2xl text-base leading-7 text-muted">
                Récapitulatif de toutes les courses françaises avec ordre probable, base IA, value bet
                et tickets proposés. Mis à jour en temps réel.
              </p>
            </div>

            {/* Quick stats */}
            <div className="grid grid-cols-3 gap-3 lg:shrink-0 lg:grid-cols-1 lg:min-w-[180px]">
              <QuickStat label="Courses" value={races.length} />
              <QuickStat label="Partants" value={totalHorses} />
              <QuickStat label="Value bets" value={valueRaces} accent />
            </div>
          </div>

          {/* Légende badges */}
          {quinteRaces > 0 && (
            <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-border pt-4 text-xs text-muted">
              <span className="font-semibold text-fg">Paris phares :</span>
              <span className="rounded-full bg-red-500 px-2 py-0.5 text-white font-bold">Quinte+</span>
              <span className="rounded-full bg-sky-500 px-2 py-0.5 text-white font-bold">Quarté+</span>
              <span className="rounded-full bg-yellow-300 px-2 py-0.5 text-red-700 font-bold">Pick 5</span>
            </div>
          )}
        </section>

        {/* Liste des courses */}
        <div className="space-y-3">
          {races.length === 0 ? (
            <div className="rounded-2xl border border-border bg-surface p-12 text-center">
              <Flag className="mx-auto text-muted" size={36} />
              <p className="mt-4 text-lg font-semibold text-fg">Aucune course disponible aujourd'hui.</p>
              <Link href="/" className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-accent-text hover:text-accent">
                Voir le programme complet <ArrowRight size={14} />
              </Link>
            </div>
          ) : (
            races.map((race) => {
              const arrival = probableArrival(race.horses);
              const recommendations = buildBetRecommendations(race.horses, race.betTypes);
              const valueBet = arrival.find((h) => h.valueIndex > 10) ?? null;
              const hasQuinte = race.betTypes.some((b) => b.type === "QUINTE_PLUS");
              const hasQuarte = race.betTypes.some((b) => b.type === "QUARTE_PLUS" && b.audience === "REGIONAL");
              const hasPick5  = race.betTypes.some((b) => b.type === "PICK5");
              const isImminent = false; // would need client time

              return (
                <article
                  key={race.id}
                  className="overflow-hidden rounded-2xl border border-border bg-surface shadow-sm transition hover:shadow-md"
                >
                  {/* Top bar */}
                  <div className="flex items-center gap-3 border-b border-border bg-surface-sub px-5 py-3">
                    <span className="font-mono text-sm font-bold text-fg">{race.programCode}</span>
                    <span className="h-3.5 w-px bg-border-strong" />
                    <Clock3 size={13} className="text-muted" />
                    <span className="font-mono text-sm font-semibold text-fg">{race.startTime}</span>
                    <span className="h-3.5 w-px bg-border-strong" />
                    <span className="text-sm text-muted">{titleCase(race.racecourse)}</span>
                    <div className="ml-auto flex gap-1.5">
                      {hasQuinte && <span className="rounded-full bg-red-500 px-2 py-0.5 text-[10px] font-bold text-white">Quinte+</span>}
                      {hasQuarte && <span className="rounded-full bg-sky-500 px-2 py-0.5 text-[10px] font-bold text-white">Quarté</span>}
                      {hasPick5  && <span className="rounded-full bg-yellow-300 px-2 py-0.5 text-[10px] font-bold text-red-700">Pick 5</span>}
                      <DisciplinePill discipline={race.discipline} />
                    </div>
                  </div>

                  {/* Body */}
                  <div className="grid gap-4 p-5 xl:grid-cols-[1.5fr_1.5fr_auto] xl:items-center">
                    {/* Race info */}
                    <div>
                      <h2 className="font-display text-xl font-bold text-fg">{titleCase(race.name)}</h2>
                      <p className="mt-1 text-sm text-muted">{race.specialty} · {race.distance ? `${race.distance} m` : ""} · {race.horses.length} partants</p>

                      <div className="mt-3 flex flex-wrap gap-2">
                        <TierBadge tier={race.bettingTier} />
                        <RiskBadge risk={race.riskLevel} />
                        <span className="rounded-full border border-border px-2.5 py-0.5 text-xs font-medium text-muted">
                          Consensus {race.modelConsensus}%
                        </span>
                      </div>
                    </div>

                    {/* IA boxes */}
                    <div className="grid grid-cols-3 gap-2">
                      <RecapBox
                        label="Ordre probable"
                        value={arrival.slice(0, 5).map((h) => h.number).join(" – ")}
                        mono
                      />
                      <RecapBox
                        label="Base IA"
                        value={arrival[0] ? `#${arrival[0].number} ${titleCase(arrival[0].horse)}` : "—"}
                      />
                      <RecapBox
                        label="Value bet"
                        value={valueBet ? `#${valueBet.number} +${valueBet.valueIndex}` : "—"}
                        accent={!!valueBet}
                      />
                    </div>

                    {/* CTA */}
                    <Link
                      href={`/races/${encodeURIComponent(race.id)}`}
                      className="inline-flex items-center justify-center gap-2 rounded-xl bg-accent px-5 py-3 text-sm font-bold text-white transition hover:bg-accent-hi"
                    >
                      Analyse <ArrowRight size={14} />
                    </Link>
                  </div>

                  {/* Tickets row */}
                  {recommendations.length > 0 && (
                    <div className="flex flex-wrap items-center gap-2 border-t border-border bg-surface-sub px-5 py-3">
                      <span className="mr-1 flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-muted">
                        <TrendingUp size={11} /> Tickets IA :
                      </span>
                      {recommendations.slice(0, 6).map((item) => (
                        <span
                          key={item.type}
                          className="rounded-full border border-accent/20 bg-accent-lo px-2.5 py-1 text-xs font-bold text-accent-text"
                        >
                          {item.label}: {item.ticket}
                        </span>
                      ))}
                      {recommendations.length > 6 && (
                        <span className="text-xs text-muted">+{recommendations.length - 6} autres</span>
                      )}
                    </div>
                  )}
                </article>
              );
            })
          )}
        </div>

        {/* Bottom CTA */}
        {races.length > 0 && (
          <div className="mt-8 text-center">
            <Link href="/" className="inline-flex items-center gap-2 text-sm font-semibold text-accent-text hover:text-accent">
              ← Retour au programme complet
            </Link>
          </div>
        )}
      </div>
    </main>
  );
}

/* ─── Sub-components ─────────────────────────────────────────────── */

function QuickStat({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <div className={`rounded-xl border p-3 ${accent ? "border-accent/30 bg-accent-lo" : "border-border bg-surface-sub"}`}>
      <p className="text-xs font-bold uppercase tracking-widest text-muted">{label}</p>
      <p className={`mt-1 font-display text-2xl font-bold ${accent ? "text-accent-text" : "text-fg"}`}>{value}</p>
    </div>
  );
}

function RecapBox({ label, value, mono, accent }: { label: string; value: string; mono?: boolean; accent?: boolean }) {
  return (
    <div className={`rounded-xl border p-3 ${accent ? "border-accent/30 bg-accent-lo" : "border-border bg-surface-sub"}`}>
      <p className="text-[10px] font-bold uppercase tracking-widest text-muted">{label}</p>
      <p className={`mt-1 truncate text-sm font-bold ${mono ? "font-mono" : ""} ${accent ? "text-accent-text" : "text-fg"}`}>
        {value}
      </p>
    </div>
  );
}

function DisciplinePill({ discipline }: { discipline: string }) {
  const cls =
    discipline === "Trot"     ? "bg-sky-100 text-sky-800" :
    discipline === "Obstacle" ? "bg-orange-100 text-orange-800" :
                                "bg-emerald-100 text-emerald-800";
  return <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${cls}`}>{discipline}</span>;
}

function TierBadge({ tier }: { tier: string }) {
  if (tier === "Focus") return <span className="rounded-full bg-accent px-2.5 py-0.5 text-[10px] font-bold text-white">Focus</span>;
  if (tier === "Value") return <span className="rounded-full bg-amber-400 px-2.5 py-0.5 text-[10px] font-bold text-amber-950">Value</span>;
  return <span className="rounded-full bg-surface-inv px-2.5 py-0.5 text-[10px] font-bold text-white">Prudence</span>;
}

function RiskBadge({ risk }: { risk: string }) {
  if (risk === "Speculatif") return <span className="rounded-full border border-red-200 bg-red-50 px-2.5 py-0.5 text-[10px] font-bold text-red-700">Spéculatif</span>;
  if (risk === "Prudent")    return <span className="rounded-full border border-green-200 bg-green-50 px-2.5 py-0.5 text-[10px] font-bold text-green-700">Prudent</span>;
  return <span className="rounded-full border border-border bg-surface-sub px-2.5 py-0.5 text-[10px] font-bold text-muted">Équilibré</span>;
}

function titleCase(v: string) {
  return v.toLowerCase().split(/(\s|-|')/)
    .map((p) => (p.length > 1 ? p.charAt(0).toUpperCase() + p.slice(1) : p)).join("");
}
