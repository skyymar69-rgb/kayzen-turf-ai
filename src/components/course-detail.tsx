"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowUpRight,
  Brain,
  Gauge,
  ShieldCheck,
  Sparkles,
  Target,
  Trophy,
} from "lucide-react";
import { useMemo, useState } from "react";
import { buildBetRecommendations, probableArrival } from "@/lib/bet-recommendations";
import { simulateBet } from "@/lib/betting-engine";
import { buildPostRaceAnalysis } from "@/lib/post-race-analysis";
import type { RaceAnalysis } from "@/lib/types";

type CourseDetailProps = {
  race: RaceAnalysis;
};

export function CourseDetail({ race }: CourseDetailProps) {
  const [selectedHorseId, setSelectedHorseId] = useState(race.horses[0]?.id ?? "");
  const [stake, setStake] = useState(25);
  const selectedHorse = race.horses.find((horse) => horse.id === selectedHorseId) ?? race.horses[0];
  const arrival = useMemo(() => probableArrival(race.horses), [race.horses]);
  const betRecommendations = useMemo(() => buildBetRecommendations(race.horses, race.betTypes), [race.betTypes, race.horses]);
  const postRaceAnalysis = useMemo(() => buildPostRaceAnalysis(race), [race]);
  const simulation = selectedHorse ? simulateBet(stake, selectedHorse.odds, selectedHorse.winProbability, 500, 0) : null;

  return (
    <main className="min-h-screen px-4 py-5 sm:px-6 lg:px-8">
      <section className="mx-auto max-w-7xl">
        <Link className="inline-flex items-center gap-2 rounded-md border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-[#d7e4de]" href="/">
          <ArrowLeft size={16} />
          Programme
        </Link>

        <header className="mt-5 rounded-lg border border-white/10 bg-[#0d1a17]/86 p-5">
          <div className="flex flex-wrap items-center gap-3 text-sm text-emerald-200/80">
            <span className="rounded-md bg-emerald-300 px-2.5 py-1 font-mono font-semibold text-[#06110e]">{race.programCode}</span>
            <span>{race.raceDate}</span>
            <span>{race.startTime}</span>
            <span>{race.racecourse}</span>
            <span>{race.discipline}</span>
          </div>
          <h1 className="mt-4 text-3xl font-semibold text-white sm:text-5xl">{race.name}</h1>
          <p className="mt-3 text-sm leading-6 text-[#b6c5bf]">
            Reunion {race.reunionNumber} - Course {race.courseNumber} - {race.distance} - {race.going ?? "Terrain non renseigne"} - {race.weather}
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Pill icon={Target} text={`Tier ${race.bettingTier}`} />
            <Pill icon={Gauge} text={`Risque ${race.riskLevel}`} />
            <Pill icon={Brain} text="Analyse IA dediee" />
            <Pill icon={ShieldCheck} text="Jeu responsable" />
          </div>
        </header>

        <div className="mt-4 grid gap-4 xl:grid-cols-[1.35fr_0.85fr]">
          <Panel title="Classement IA des chevaux" icon={Target}>
            <div className="overflow-x-auto kz-scroll">
              <table className="w-full min-w-[860px] border-separate border-spacing-0 text-left">
                <thead>
                  <tr className="text-xs uppercase text-[#93a39c]">
                    <th className="border-b border-white/10 pb-3 font-medium">Cheval</th>
                    <th className="border-b border-white/10 pb-3 font-medium">KZ</th>
                    <th className="border-b border-white/10 pb-3 font-medium">Gagnant</th>
                    <th className="border-b border-white/10 pb-3 font-medium">Top 3</th>
                    <th className="border-b border-white/10 pb-3 font-medium">Cote</th>
                    <th className="border-b border-white/10 pb-3 font-medium">Value</th>
                    <th className="border-b border-white/10 pb-3 font-medium">Arrivee</th>
                  </tr>
                </thead>
                <tbody>
                  {arrival.map((horse) => (
                    <tr
                      className={horse.id === selectedHorse?.id ? "bg-emerald-300/[0.08]" : "transition hover:bg-white/[0.03]"}
                      key={horse.id}
                      onClick={() => setSelectedHorseId(horse.id)}
                    >
                      <td className="border-b border-white/10 py-4 pr-4">
                        <div className="flex items-center gap-3">
                          <span className="grid h-9 w-9 place-items-center rounded-md bg-white/10 font-mono text-sm text-white">{horse.number}</span>
                          <div>
                            <p className="font-medium text-white">{horse.horse}</p>
                            <p className="text-xs text-[#93a39c]">{horse.jockey} - {horse.trainer}</p>
                          </div>
                        </div>
                      </td>
                      <td className="border-b border-white/10 py-4 pr-4 font-mono text-emerald-300">{horse.kzScore}</td>
                      <td className="border-b border-white/10 py-4 pr-4">{horse.winProbability}%</td>
                      <td className="border-b border-white/10 py-4 pr-4">{horse.top3Probability}%</td>
                      <td className="border-b border-white/10 py-4 pr-4 font-mono">{horse.odds}</td>
                      <td className={`border-b border-white/10 py-4 pr-4 font-mono ${horse.valueIndex > 0 ? "text-emerald-300" : "text-[#ff8066]"}`}>
                        {horse.valueIndex > 0 ? "+" : ""}{horse.valueIndex}%
                      </td>
                      <td className="border-b border-white/10 py-4 pr-4 font-mono">{horse.finishPosition ? `${horse.finishPosition}e` : "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>

          <section className="grid gap-4">
            <Panel title="Tickets proposes" icon={Trophy}>
              <p className="mb-3 rounded-md border border-white/10 bg-white/[0.03] p-3 font-mono text-sm text-white">
                {arrival.slice(0, 6).map((horse) => horse.number).join(" - ")}
              </p>
              <div className="space-y-3">
                {betRecommendations.slice(0, 8).map((recommendation) => (
                  <div className="rounded-md border border-white/10 bg-white/[0.03] p-3" key={recommendation.type}>
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-medium text-white">{recommendation.label}</p>
                      <span className="font-mono text-sm text-emerald-300">{recommendation.ticket}</span>
                    </div>
                    <p className="mt-2 text-xs text-[#93a39c]">{recommendation.strategy} - confiance {recommendation.confidence}/99</p>
                  </div>
                ))}
              </div>
            </Panel>

            <Panel title="Simulation cheval" icon={Gauge}>
              {selectedHorse && simulation ? (
                <div className="space-y-3">
                  <p className="font-medium text-white">#{selectedHorse.number} {selectedHorse.horse}</p>
                  <label className="block text-sm text-[#93a39c]">
                    Mise
                    <input
                      className="mt-2 h-11 w-full rounded-md border border-white/10 bg-[#081310] px-3 text-white outline-none"
                      min={1}
                      onChange={(event) => setStake(Number(event.target.value))}
                      type="number"
                      value={stake}
                    />
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <Result label="EV" value={`${simulation.expectedValue} EUR`} />
                    <Result label="Kelly" value={`${simulation.kellyStake} EUR`} />
                    <Result label="Edge" value={`${simulation.marketEdge}%`} />
                    <Result label="Decision" value={simulation.recommendation} />
                  </div>
                </div>
              ) : null}
            </Panel>
          </section>
        </div>

        <div className="mt-4 grid gap-4 xl:grid-cols-3">
          <Panel title="Analyse apres course" icon={Sparkles}>
            <div className="space-y-3">
              <div className="rounded-md border border-white/10 bg-white/[0.03] p-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-medium text-white">{postRaceAnalysis.verdict}</p>
                  <span className="font-mono text-sm text-emerald-300">
                    {postRaceAnalysis.status === "complete" ? `${postRaceAnalysis.metrics.confidenceScore}/99` : "En attente"}
                  </span>
                </div>
                <p className="mt-2 text-sm leading-5 text-[#b6c5bf]">{postRaceAnalysis.summary}</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Result label="Prediction" value={postRaceAnalysis.predictedArrival.join("-") || "-"} />
                <Result label="Arrivee" value={postRaceAnalysis.actualArrival.join("-") || "-"} />
                <Result label="Top 3" value={`${postRaceAnalysis.metrics.top3Hits}/3`} />
                <Result label="Top 5" value={`${postRaceAnalysis.metrics.top5Hits}/5`} />
              </div>
              {postRaceAnalysis.lessons.map((lesson) => (
                <p className="rounded-md border border-white/10 bg-white/[0.03] p-3 text-sm text-[#d7e4de]" key={lesson}>{lesson}</p>
              ))}
            </div>
          </Panel>

          <Panel title="Facteurs IA" icon={Brain}>
            <div className="space-y-3">
              {(selectedHorse?.factors ?? []).map((factor) => (
                <div className="flex gap-3 rounded-md border border-white/10 bg-white/[0.03] p-3" key={factor}>
                  <Sparkles className="mt-0.5 shrink-0 text-emerald-300" size={17} />
                  <p className="text-sm text-[#d7e4de]">{factor}</p>
                </div>
              ))}
            </div>
          </Panel>

          <Panel title="Actions modele" icon={ArrowUpRight}>
            <div className="space-y-3">
              {postRaceAnalysis.nextModelActions.map((action) => (
                <p className="rounded-md border border-cyan-300/20 bg-cyan-300/10 p-3 text-sm text-cyan-50" key={action}>{action}</p>
              ))}
              <div className="rounded-md border border-amber-300/20 bg-amber-300/10 p-3 text-sm text-amber-100">
                <AlertTriangle className="mb-2 text-amber-200" size={18} />
                Aucun pronostic ne garantit un gain. Les tickets restent une aide a la decision.
              </div>
            </div>
          </Panel>
        </div>
      </section>
    </main>
  );
}

function Panel({ children, icon: Icon, title }: { children: ReactNode; icon: typeof Target; title: string }) {
  return (
    <section className="rounded-lg border border-white/10 bg-[#0d1a17]/86 p-4 shadow-2xl shadow-black/20 sm:p-5">
      <div className="mb-4 flex items-center gap-3">
        <div className="grid h-9 w-9 place-items-center rounded-md bg-white/10 text-emerald-300">
          <Icon size={18} />
        </div>
        <h2 className="font-semibold text-white">{title}</h2>
      </div>
      {children}
    </section>
  );
}

function Pill({ icon: Icon, text }: { icon: typeof Target; text: string }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-md border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-[#d7e4de]">
      <Icon size={16} />
      {text}
    </span>
  );
}

function Result({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-white/10 bg-white/[0.03] p-3">
      <p className="text-xs text-[#93a39c]">{label}</p>
      <p className="mt-1 text-sm font-semibold text-white">{value}</p>
    </div>
  );
}
