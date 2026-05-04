"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowUpRight,
  Brain,
  Clock3,
  Gauge,
  MessageSquareText,
  Sparkles,
  Target,
  Trophy,
} from "lucide-react";
import { useMemo, useState } from "react";
import { buildBetRecommendations, probableArrival } from "@/lib/bet-recommendations";
import { simulateBet } from "@/lib/betting-engine";
import { buildPostRaceAnalysis } from "@/lib/post-race-analysis";
import type { BetOffer, HorsePrediction, RaceAnalysis } from "@/lib/types";

type CourseDetailProps = {
  race: RaceAnalysis;
};

const TABS = ["Partants", "Cotes", "Pronostics IA", "Statistiques", "Les Plus Joues", "Arrivees et Rapports"] as const;

const BET_COLORS: Record<string, string> = {
  SIMPLE_GAGNANT: "bg-cyan-500",
  SIMPLE_PLACE: "bg-cyan-500",
  COUPLE_GAGNANT: "bg-orange-500",
  COUPLE_PLACE: "bg-orange-500",
  COUPLE_ORDRE: "bg-orange-500",
  DEUX_SUR_QUATRE: "bg-purple-600",
  TRIO: "bg-amber-500",
  TRIO_ORDRE: "bg-amber-500",
  MULTI: "bg-pink-600",
  SUPER_QUATRE: "bg-slate-600",
  QUARTE_PLUS: "bg-sky-600",
  QUINTE_PLUS: "bg-red-500",
  PICK5: "bg-lime-600",
};

export function CourseDetail({ race }: CourseDetailProps) {
  const [selectedHorseId, setSelectedHorseId] = useState(race.horses[0]?.id ?? "");
  const [stake, setStake] = useState(25);
  const [activeTab, setActiveTab] = useState<(typeof TABS)[number]>("Partants");
  const selectedHorse = race.horses.find((horse) => horse.id === selectedHorseId) ?? race.horses[0];
  const arrival = useMemo(() => probableArrival(race.horses), [race.horses]);
  const betRecommendations = useMemo(() => buildBetRecommendations(race.horses, race.betTypes), [race.betTypes, race.horses]);
  const postRaceAnalysis = useMemo(() => buildPostRaceAnalysis(race), [race]);
  const simulation = selectedHorse ? simulateBet(stake, selectedHorse.odds, selectedHorse.winProbability, 500, 0) : null;
  const partantsCount = race.horses.length;

  return (
    <main className="min-h-screen bg-[#f3f5f4] px-3 py-20 text-[#303b38] sm:px-5 lg:px-8" id="contenu-principal">
      <section className="mx-auto max-w-[1520px]">
        <Link className="mb-4 inline-flex items-center gap-2 rounded-md border border-emerald-700/20 bg-white px-3 py-2 text-sm font-medium text-emerald-800 shadow-sm" href="/">
          <ArrowLeft size={16} />
          Programme
        </Link>

        <header className="overflow-hidden rounded-md border border-emerald-800/20 bg-white shadow-sm">
          <div className="border-t-4 border-emerald-700 p-4 sm:p-6">
            <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-3">
                  <h1 className="text-2xl font-semibold tracking-normal text-[#26312e]">
                    Partants - {formatLongDate(race.raceDate)}
                  </h1>
                  <button className="inline-flex items-center gap-1 text-base font-medium text-[#26312e] underline" type="button">
                    <span className="grid h-5 w-5 place-items-center rounded-full border border-[#26312e] text-xs">i</span>
                    Details des conditions
                  </button>
                </div>
                <div className="mt-4 flex flex-wrap items-center gap-3 text-lg text-[#52615d]">
                  <span className="text-base font-semibold">{race.discipline}</span>
                  <span>{race.specialty}</span>
                  <span>-</span>
                  <span>{formatPrize(race.raceQualityScore)}</span>
                  <span>-</span>
                  <span>{formatMeters(race.distance)} metres</span>
                  <span>-</span>
                  <span>{partantsCount} Partants</span>
                </div>
              </div>

              <div className="flex flex-col items-start gap-4 xl:items-end">
                <div className="inline-flex items-center gap-3 text-2xl font-semibold italic text-emerald-700">
                  <Clock3 size={30} />
                  Depart {race.startTime}
                </div>
                <button className="inline-flex h-12 items-center gap-3 rounded-md bg-emerald-700 px-5 text-sm font-semibold uppercase text-white shadow-md shadow-emerald-900/20" type="button">
                  <MessageSquareText size={22} />
                  Commenter cette course
                </button>
              </div>
            </div>

            <div className="mt-6 flex flex-wrap gap-5">
              {visibleBetBadges(race.betTypes).map((bet) => (
                <span className={`inline-flex min-w-20 justify-center rounded-tl-2xl rounded-br-2xl px-4 py-1 text-sm font-bold italic text-white shadow-sm ${BET_COLORS[bet.type] ?? "bg-emerald-700"}`} key={`${bet.type}-${bet.audience ?? "N"}`}>
                  {shortBetLabel(bet)}
                </span>
              ))}
            </div>
          </div>

          <nav className="grid border-t border-[#dfe5e3] bg-[#f7f8f8] md:grid-cols-3 xl:grid-cols-6">
            {TABS.map((tab) => (
              <button
                className={`h-16 border-r border-[#dfe5e3] text-base font-medium transition ${
                  activeTab === tab ? "bg-[#454545] text-white" : "bg-[#f7f8f8] text-[#52615d] hover:bg-white"
                }`}
                key={tab}
                onClick={() => setActiveTab(tab)}
                type="button"
              >
                {tab}
              </button>
            ))}
          </nav>
        </header>

        <section className="mt-5 overflow-hidden rounded-md border border-[#d9e1de] bg-white shadow-sm">
          {activeTab === "Partants" ? (
            <PartantsTable horses={arrival} onSelect={setSelectedHorseId} selectedHorseId={selectedHorse?.id} />
          ) : (
            <TabPlaceholder activeTab={activeTab} arrival={arrival} race={race} recommendations={betRecommendations} />
          )}
        </section>

        <div className="mt-5 grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
          <LightPanel title="Pronostic KAYZEN" icon={Trophy}>
            <div className="grid gap-3 lg:grid-cols-[0.9fr_1.1fr]">
              <div className="rounded-md border border-emerald-700/20 bg-emerald-50 p-4">
                <p className="text-sm font-medium text-emerald-900">Ordre d&apos;arrivee le plus probable</p>
                <p className="mt-2 font-mono text-2xl font-semibold text-emerald-800">
                  {arrival.slice(0, 6).map((horse) => horse.number).join(" - ")}
                </p>
                <p className="mt-3 text-sm text-emerald-900/70">
                  Base IA calculee avec KZ Score, probabilites gagnant/top 3 et forme recente PMU.
                </p>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                {betRecommendations.slice(0, 6).map((recommendation) => (
                  <div className="rounded-md border border-[#d9e1de] bg-[#fbfcfc] p-3" key={recommendation.type}>
                    <p className="text-sm font-semibold text-[#26312e]">{recommendation.label}</p>
                    <p className="mt-1 font-mono text-base font-semibold text-emerald-700">{recommendation.ticket}</p>
                    <p className="mt-1 text-xs text-[#65746f]">Confiance {recommendation.confidence}/99 - {recommendation.strategy}</p>
                  </div>
                ))}
              </div>
            </div>
          </LightPanel>

          <LightPanel title="Simulation et responsabilite" icon={Gauge}>
            {selectedHorse && simulation ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block text-sm font-medium text-[#52615d]">
                  Cheval selectionne
                  <select
                    className="mt-2 h-11 w-full rounded-md border border-[#cdd7d3] bg-white px-3 text-[#26312e] outline-none"
                    onChange={(event) => setSelectedHorseId(event.target.value)}
                    value={selectedHorse.id}
                  >
                    {arrival.map((horse) => (
                      <option key={horse.id} value={horse.id}>
                        #{horse.number} {horse.horse}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block text-sm font-medium text-[#52615d]">
                  Mise
                  <input
                    className="mt-2 h-11 w-full rounded-md border border-[#cdd7d3] bg-white px-3 text-[#26312e] outline-none"
                    min={1}
                    onChange={(event) => setStake(Number(event.target.value))}
                    type="number"
                    value={stake}
                  />
                </label>
                <Result label="EV estimee" value={`${simulation.expectedValue} EUR`} />
                <Result label="Kelly prudent" value={`${simulation.kellyStake} EUR`} />
                <Result label="Edge marche" value={`${simulation.marketEdge}%`} />
                <Result label="Decision" value={simulation.recommendation} />
              </div>
            ) : null}
          </LightPanel>
        </div>

        <div className="mt-5 grid gap-4 xl:grid-cols-3">
          <LightPanel title="Analyse apres course" icon={Sparkles}>
            <div className="space-y-3">
              <div className="rounded-md border border-[#d9e1de] bg-[#fbfcfc] p-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-semibold text-[#26312e]">{postRaceAnalysis.verdict}</p>
                  <span className="font-mono text-sm text-emerald-700">
                    {postRaceAnalysis.status === "complete" ? `${postRaceAnalysis.metrics.confidenceScore}/99` : "En attente"}
                  </span>
                </div>
                <p className="mt-2 text-sm leading-5 text-[#52615d]">{postRaceAnalysis.summary}</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Result label="Prediction" value={postRaceAnalysis.predictedArrival.join("-") || "-"} />
                <Result label="Arrivee" value={postRaceAnalysis.actualArrival.join("-") || "-"} />
                <Result label="Top 3" value={`${postRaceAnalysis.metrics.top3Hits}/3`} />
                <Result label="Top 5" value={`${postRaceAnalysis.metrics.top5Hits}/5`} />
              </div>
            </div>
          </LightPanel>

          <LightPanel title="Facteurs IA" icon={Brain}>
            <div className="space-y-3">
              {(selectedHorse?.factors ?? []).map((factor) => (
                <div className="flex gap-3 rounded-md border border-[#d9e1de] bg-[#fbfcfc] p-3" key={factor}>
                  <Sparkles className="mt-0.5 shrink-0 text-emerald-700" size={17} />
                  <p className="text-sm text-[#52615d]">{factor}</p>
                </div>
              ))}
            </div>
          </LightPanel>

          <LightPanel title="Actions modele" icon={ArrowUpRight}>
            <div className="space-y-3">
              {postRaceAnalysis.nextModelActions.map((action) => (
                <p className="rounded-md border border-cyan-700/20 bg-cyan-50 p-3 text-sm text-cyan-950" key={action}>{action}</p>
              ))}
              <div className="rounded-md border border-amber-500/30 bg-amber-50 p-3 text-sm text-amber-950">
                <AlertTriangle className="mb-2 text-amber-700" size={18} />
                Aucun pronostic ne garantit un gain. Les tickets restent une aide a la decision.
              </div>
            </div>
          </LightPanel>
        </div>
      </section>
    </main>
  );
}

function PartantsTable({
  horses,
  onSelect,
  selectedHorseId,
}: {
  horses: HorsePrediction[];
  onSelect: (horseId: string) => void;
  selectedHorseId?: string;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[1280px] border-collapse text-left">
        <thead>
          <tr className="bg-[#424342] text-xs uppercase text-white">
            {["No", "Chevaux", "Dist.", "Def.", "S/A", "Drivers", "Entraineurs", "R/K", "Gains", "Dernieres performances", "Cotes", "KZ"].map((heading) => (
              <th className="border-r border-white/20 px-3 py-4 font-semibold" key={heading}>{heading}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {horses.map((horse, index) => (
            <tr
              className={`cursor-pointer border-b border-[#dfe5e3] text-sm transition hover:bg-emerald-50 ${
                selectedHorseId === horse.id ? "bg-emerald-50" : index % 2 === 0 ? "bg-white" : "bg-[#f5f6f6]"
              }`}
              key={horse.id}
              onClick={() => onSelect(horse.id)}
            >
              <td className="px-3 py-3 font-mono text-[#52615d]">{horse.number}</td>
              <td className="px-3 py-3">
                <div className="flex min-w-[230px] items-center gap-3">
                  {horse.silksUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img alt="" className="h-9 w-9 rounded-sm object-contain" src={horse.silksUrl} />
                  ) : (
                    <span className="grid h-9 w-9 place-items-center rounded-sm bg-emerald-100 font-mono text-emerald-800">{horse.number}</span>
                  )}
                  <span className="font-bold uppercase text-[#111] underline decoration-[#111]/40 underline-offset-2">{horse.horse}</span>
                </div>
              </td>
              <td className="px-3 py-3 font-mono">{horse.handicapDistance ?? "-"}</td>
              <td className="px-3 py-3">{formatEquipment(horse.equipment)}</td>
              <td className="px-3 py-3 font-mono">{formatSexAge(horse)}</td>
              <td className="px-3 py-3 uppercase text-[#52615d]">{horse.jockey}</td>
              <td className="px-3 py-3 uppercase text-[#52615d]">{horse.trainer}</td>
              <td className="px-3 py-3 font-mono">{horse.reductionKm ?? "-"}</td>
              <td className="px-3 py-3 font-mono">{formatEuros(horse.earnings)}</td>
              <td className="max-w-[360px] truncate px-3 py-3 text-[#52615d]" title={horse.music ?? ""}>{horse.music ?? "-"}</td>
              <td className="px-3 py-3 font-mono">{horse.odds > 1 ? horse.odds : "-"}</td>
              <td className="px-3 py-3 font-mono font-semibold text-emerald-700">{horse.kzScore}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TabPlaceholder({
  activeTab,
  arrival,
  race,
  recommendations,
}: {
  activeTab: string;
  arrival: HorsePrediction[];
  race: RaceAnalysis;
  recommendations: ReturnType<typeof buildBetRecommendations>;
}) {
  if (activeTab === "Cotes") {
    return (
      <SimpleGrid title="Cotes IA / PMU">
        {arrival.slice(0, 12).map((horse) => (
          <Result key={horse.id} label={`#${horse.number} ${horse.horse}`} value={`PMU ${horse.odds} / juste ${horse.fairOdds}`} />
        ))}
      </SimpleGrid>
    );
  }

  if (activeTab === "Pronostics IA") {
    return (
      <SimpleGrid title="Tickets proposes">
        {recommendations.map((item) => (
          <Result key={item.type} label={item.label} value={item.ticket} />
        ))}
      </SimpleGrid>
    );
  }

  if (activeTab === "Statistiques") {
    return (
      <SimpleGrid title="Statistiques course">
        <Result label="Consensus IA" value={`${race.modelConsensus}%`} />
        <Result label="Volatilite marche" value={`${race.marketVolatility}%`} />
        <Result label="Qualite course" value={`${race.raceQualityScore}`} />
        <Result label="Risque" value={race.riskLevel} />
      </SimpleGrid>
    );
  }

  return (
    <SimpleGrid title={activeTab}>
      {arrival.slice(0, 8).map((horse) => (
        <Result key={horse.id} label={`#${horse.number} ${horse.horse}`} value={`${horse.winProbability}% gagnant`} />
      ))}
    </SimpleGrid>
  );
}

function SimpleGrid({ children, title }: { children: ReactNode; title: string }) {
  return (
    <div className="p-5">
      <h2 className="mb-4 text-lg font-semibold text-[#26312e]">{title}</h2>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">{children}</div>
    </div>
  );
}

function LightPanel({ children, icon: Icon, title }: { children: ReactNode; icon: typeof Target; title: string }) {
  return (
    <section className="rounded-md border border-[#d9e1de] bg-white p-4 shadow-sm sm:p-5">
      <div className="mb-4 flex items-center gap-3">
        <div className="grid h-9 w-9 place-items-center rounded-md bg-emerald-50 text-emerald-700">
          <Icon size={18} />
        </div>
        <h2 className="font-semibold text-[#26312e]">{title}</h2>
      </div>
      {children}
    </section>
  );
}

function Result({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-[#d9e1de] bg-[#fbfcfc] p-3">
      <p className="text-xs text-[#65746f]">{label}</p>
      <p className="mt-1 text-sm font-semibold text-[#26312e]">{value}</p>
    </div>
  );
}

function visibleBetBadges(offers: BetOffer[]) {
  const priority = [
    "SIMPLE_GAGNANT",
    "COUPLE_GAGNANT",
    "DEUX_SUR_QUATRE",
    "TRIO",
    "MULTI",
    "TIERCE",
    "QUARTE_PLUS",
    "QUINTE_PLUS",
    "PICK5",
  ];
  const byType = new Map(offers.map((offer) => [offer.type, offer]));
  return priority.flatMap((type) => byType.get(type) ?? []);
}

function shortBetLabel(offer: BetOffer) {
  const labels: Record<string, string> = {
    SIMPLE_GAGNANT: "Simple",
    SIMPLE_PLACE: "Simple",
    COUPLE_GAGNANT: "Couple",
    COUPLE_PLACE: "Couple",
    DEUX_SUR_QUATRE: "2 sur 4",
    TRIO: "Trio",
    MULTI: "Multi",
    TIERCE: "Tierce",
    QUARTE_PLUS: "Quarte+",
    QUINTE_PLUS: "Quinte+",
    PICK5: "Pick5",
  };
  return labels[offer.type] ?? offer.label;
}

function formatLongDate(date: string) {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "long",
    weekday: "long",
    year: "numeric",
  }).format(new Date(`${date}T12:00:00`));
}

function formatMeters(distance: string) {
  return String(distance).replace(/\D/g, "") || distance;
}

function formatPrize(score: number) {
  return `${Math.round(score * 500)}EUR`;
}

function formatEuros(value?: number | null) {
  if (!value) return "-";
  return `${new Intl.NumberFormat("fr-FR").format(Math.round(value))} EUR`;
}

function formatSexAge(horse: HorsePrediction) {
  const sex = horse.sex?.slice(0, 1) ?? "";
  return `${sex}${horse.age ?? ""}` || "-";
}

function formatEquipment(value?: string | null) {
  if (!value || value === "SANS_OEILLERES") return "-";
  return value.replaceAll("_", " ").toLowerCase();
}
