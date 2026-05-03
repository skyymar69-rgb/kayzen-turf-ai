"use client";

import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  BadgeEuro,
  Bell,
  Brain,
  ChartNoAxesCombined,
  ChevronDown,
  CircleDollarSign,
  Database,
  Gauge,
  Lock,
  ShieldCheck,
  Sparkles,
  Target,
} from "lucide-react";
import { useMemo, useState, useSyncExternalStore } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { modelCard, simulateBet } from "@/lib/betting-engine";
import { valueBets } from "@/lib/mock-data";
import type { HorsePrediction, RaceAnalysis } from "@/lib/types";

type DashboardProps = {
  races: RaceAnalysis[];
};

const marketTrend = [
  { time: "12:00", value: 52 },
  { time: "13:00", value: 58 },
  { time: "14:00", value: 61 },
  { time: "14:30", value: 66 },
  { time: "15:00", value: 72 },
  { time: "15:12", value: 76 },
];

const roiTrend = [
  { day: "Lun", roi: 2.4 },
  { day: "Mar", roi: 5.2 },
  { day: "Mer", roi: 4.1 },
  { day: "Jeu", roi: 8.6 },
  { day: "Ven", roi: 7.7 },
  { day: "Sam", roi: 10.4 },
  { day: "Dim", roi: 12.8 },
];

export function Dashboard({ races }: DashboardProps) {
  const [selectedRaceId, setSelectedRaceId] = useState(races[0].id);
  const race = useMemo(
    () => races.find((item) => item.id === selectedRaceId) ?? races[0],
    [races, selectedRaceId],
  );
  const [selectedHorseId, setSelectedHorseId] = useState(race.horses[0].id);
  const [stake, setStake] = useState(25);
  const [bankroll, setBankroll] = useState(500);
  const [drawdown, setDrawdown] = useState(0);
  const mounted = useClientReady();

  const selectedHorse = useMemo(
    () => race.horses.find((horse) => horse.id === selectedHorseId) ?? race.horses[0],
    [race.horses, selectedHorseId],
  );

  const simulation = useMemo(
    () => simulateBet(stake, selectedHorse.odds, selectedHorse.winProbability, bankroll, drawdown),
    [bankroll, drawdown, selectedHorse.odds, selectedHorse.winProbability, stake],
  );

  const scoreData = race.horses.map((horse) => ({
    name: `#${horse.number}`,
    score: horse.kzScore,
    value: horse.valueIndex,
  }));

  const selectedValueBets = valueBets.filter((horse) => horse.raceId === race.id);

  return (
    <main className="min-h-screen">
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-20 border-r border-white/10 bg-[#081310]/80 backdrop-blur-xl lg:flex lg:flex-col lg:items-center lg:py-6">
        <div className="grid h-11 w-11 place-items-center rounded-md bg-emerald-400 text-[#06110e]">
          <Brain size={24} />
        </div>
        <nav className="mt-10 flex flex-1 flex-col gap-4">
          {[Gauge, Target, ChartNoAxesCombined, BadgeEuro, Database, ShieldCheck].map((Icon, index) => (
            <button
              aria-label={`Navigation ${index + 1}`}
              className="grid h-11 w-11 place-items-center rounded-md text-white/60 transition hover:bg-white/10 hover:text-white"
              key={index}
              type="button"
            >
              <Icon size={20} />
            </button>
          ))}
        </nav>
        <button
          aria-label="Alertes"
          className="grid h-11 w-11 place-items-center rounded-md border border-white/10 text-white/70"
          type="button"
        >
          <Bell size={20} />
        </button>
      </aside>

      <section className="px-4 py-5 sm:px-6 lg:ml-20 lg:px-8">
        <header className="mx-auto flex max-w-7xl flex-col gap-5 pb-6 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-3 text-sm text-emerald-200/80">
              <span className="rounded-md border border-emerald-300/20 bg-emerald-300/10 px-2.5 py-1">
                SaaS MVP
              </span>
              <span>{formatRelativeDay(race.relativeDay)} · {race.raceDate}</span>
              <span>{race.racecourse}</span>
              <span>{race.startTime}</span>
              <span>{race.discipline}</span>
            </div>
            <h1 className="mt-4 max-w-3xl text-3xl font-semibold tracking-normal text-white sm:text-5xl">
              KAYZEN TURF AI
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-[#b6c5bf] sm:text-base">
              Intelligence predictive, detection value bet et pilotage de bankroll pour transformer
              l&apos;analyse hippique en decision mesurable.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:min-w-[520px]">
            <Metric icon={Target} label="Consensus IA" value={`${race.modelConsensus}%`} tone="emerald" />
            <Metric icon={Activity} label="Volatilite" value={`${race.marketVolatility}%`} tone="cyan" />
            <Metric icon={CircleDollarSign} label="Qualite course" value={`${race.raceQualityScore}`} tone="gold" />
            <Metric icon={Lock} label="Premium" value="Pret" tone="coral" />
          </div>
        </header>

        <div className="mx-auto mb-4 flex max-w-7xl gap-2 overflow-x-auto kz-scroll">
          {races.map((item) => (
            <button
              className={`shrink-0 rounded-md border px-4 py-2 text-left text-sm transition ${
                item.id === race.id
                  ? "border-emerald-300/40 bg-emerald-300/[0.12] text-white"
                  : "border-white/10 bg-white/[0.03] text-[#b6c5bf] hover:bg-white/[0.06]"
              }`}
              key={item.id}
              onClick={() => {
                setSelectedRaceId(item.id);
                setSelectedHorseId(item.horses[0].id);
              }}
              type="button"
            >
              <span className="block font-medium">{formatRelativeDay(item.relativeDay)}</span>
              <span className="mt-1 block font-mono text-xs text-[#93a39c]">
                {item.startTime} · {item.racecourse}
              </span>
            </button>
          ))}
        </div>

        <div className="mx-auto grid max-w-7xl gap-4 xl:grid-cols-[1.45fr_0.85fr]">
          <section className="rounded-lg border border-white/10 bg-[#0d1a17]/86 p-4 shadow-2xl shadow-black/20 sm:p-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-sm text-[#93a39c]">Course analyse</p>
                <h2 className="mt-1 text-xl font-semibold text-white">{race.name}</h2>
                <p className="mt-2 text-sm text-[#b6c5bf]">
                  {race.distance} · {race.going} · {race.weather}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Pill icon={Sparkles} text="IA explicable" />
                <Pill icon={Target} text={`Tier ${race.bettingTier}`} />
                <Pill icon={ShieldCheck} text="Jeu responsable" />
              </div>
            </div>

            <div className="mt-5 overflow-x-auto kz-scroll">
              <table className="w-full min-w-[820px] border-separate border-spacing-0 text-left">
                <thead>
                  <tr className="text-xs uppercase text-[#93a39c]">
                    <th className="border-b border-white/10 pb-3 font-medium">Cheval</th>
                    <th className="border-b border-white/10 pb-3 font-medium">KZ Score</th>
                    <th className="border-b border-white/10 pb-3 font-medium">Gagnant</th>
                    <th className="border-b border-white/10 pb-3 font-medium">Top 3</th>
                    <th className="border-b border-white/10 pb-3 font-medium">Cote</th>
                    <th className="border-b border-white/10 pb-3 font-medium">Juste</th>
                    <th className="border-b border-white/10 pb-3 font-medium">Value</th>
                    <th className="border-b border-white/10 pb-3 font-medium">Signal</th>
                  </tr>
                </thead>
                <tbody>
                  {race.horses.map((horse) => (
                    <HorseRow
                      horse={horse}
                      isSelected={horse.id === selectedHorseId}
                      key={horse.id}
                      onSelect={() => setSelectedHorseId(horse.id)}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="grid gap-4">
            <Panel title="Copilote betting" icon={Gauge}>
              <label className="text-sm text-[#93a39c]" htmlFor="horse">
                Selection
              </label>
              <div className="relative mt-2">
                <select
                  className="h-11 w-full appearance-none rounded-md border border-white/10 bg-[#081310] px-3 text-sm text-white outline-none"
                  id="horse"
                  onChange={(event) => setSelectedHorseId(event.target.value)}
                  value={selectedHorseId}
                >
                  {race.horses.map((horse) => (
                    <option key={horse.id} value={horse.id}>
                      #{horse.number} {horse.horse}
                    </option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-3 text-white/50" size={18} />
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <NumberInput label="Mise" min={1} setValue={setStake} suffix="EUR" value={stake} />
                <NumberInput label="Bankroll" min={50} setValue={setBankroll} suffix="EUR" value={bankroll} />
                <NumberInput label="Drawdown" min={0} setValue={setDrawdown} suffix="%" value={drawdown} />
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <Result label="Cote juste" value={`${simulation.fairOdds}`} />
                <Result label="Edge marche" value={`${simulation.marketEdge}%`} />
                <Result label="Retour potentiel" value={`${simulation.potentialReturn} EUR`} />
                <Result label="EV estimee" value={`${simulation.expectedValue} EUR`} />
                <Result label="Kelly prudent" value={`${simulation.kellyStake} EUR`} />
                <Result label="Mise ajustee" value={`${simulation.drawdownAdjustedStake} EUR`} />
                <Result label="Decision" value={simulation.recommendation} />
              </div>
            </Panel>

            <Panel title="Value bets" icon={ArrowUpRight}>
              <div className="space-y-3">
                {selectedValueBets.map((horse) => (
                  <div className="rounded-md border border-white/10 bg-white/[0.03] p-3" key={horse.id}>
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-medium text-white">#{horse.number} {horse.horse}</p>
                      <span className="font-mono text-sm text-emerald-300">+{horse.valueIndex}%</span>
                    </div>
                    <p className="mt-1 text-sm text-[#93a39c]">
                      Cote {horse.odds} · Juste {horse.fairOdds} · Proba {horse.winProbability}% · {horse.confidence}
                    </p>
                  </div>
                ))}
                {selectedValueBets.length === 0 ? (
                  <div className="rounded-md border border-white/10 bg-white/[0.03] p-3 text-sm text-[#93a39c]">
                    Aucun signal value bet ne passe les seuils de confiance pour cette course.
                  </div>
                ) : null}
              </div>
            </Panel>
          </section>
        </div>

        <div className="mx-auto mt-4 grid max-w-7xl gap-4 xl:grid-cols-3">
          <Panel title="Scores proprietaires" icon={ChartNoAxesCombined}>
            <div className="h-64">
              {mounted ? (
                <ResponsiveContainer height="100%" minHeight={0} minWidth={0} width="100%">
                  <BarChart data={scoreData}>
                    <CartesianGrid stroke="rgba(255,255,255,0.08)" vertical={false} />
                    <XAxis dataKey="name" stroke="#93a39c" />
                    <YAxis stroke="#93a39c" />
                    <Tooltip contentStyle={{ background: "#0d1a17", border: "1px solid rgba(255,255,255,.12)" }} />
                    <Bar dataKey="score" radius={[5, 5, 0, 0]}>
                      {scoreData.map((entry) => (
                        <Cell fill={entry.value > 10 ? "#38d996" : "#53c7e8"} key={entry.name} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <ChartFallback />
              )}
            </div>
          </Panel>

          <Panel title="Performance IA" icon={Activity}>
            <div className="h-64">
              {mounted ? (
                <ResponsiveContainer height="100%" minHeight={0} minWidth={0} width="100%">
                  <AreaChart data={roiTrend}>
                    <CartesianGrid stroke="rgba(255,255,255,0.08)" vertical={false} />
                    <XAxis dataKey="day" stroke="#93a39c" />
                    <YAxis stroke="#93a39c" />
                    <Tooltip contentStyle={{ background: "#0d1a17", border: "1px solid rgba(255,255,255,.12)" }} />
                    <Area dataKey="roi" fill="#38d99633" stroke="#38d996" strokeWidth={2} type="monotone" />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <ChartFallback />
              )}
            </div>
          </Panel>

          <Panel title="Transparence IA" icon={Brain}>
            <div className="space-y-3">
              <div className="rounded-md border border-white/10 bg-white/[0.03] p-3">
                <p className="text-sm font-medium text-white">Calibration prudente</p>
                <p className="mt-1 text-sm leading-5 text-[#93a39c]">{modelCard.calibration.rationale}</p>
              </div>
              {selectedHorse.factors.map((factor) => (
                <div className="flex gap-3 rounded-md border border-white/10 bg-white/[0.03] p-3" key={factor}>
                  <Sparkles className="mt-0.5 shrink-0 text-emerald-300" size={17} />
                  <p className="text-sm text-[#d7e4de]">{factor}</p>
                </div>
              ))}
              <div className="rounded-md border border-amber-300/20 bg-amber-300/10 p-3 text-sm text-amber-100">
                <AlertTriangle className="mb-2 text-amber-200" size={18} />
                Outil d&apos;aide a la decision. Aucun pronostic ne garantit un gain. Gardez une mise
                proportionnee a votre bankroll.
              </div>
            </div>
          </Panel>
        </div>

        <div className="mx-auto mt-4 grid max-w-7xl gap-4 xl:grid-cols-[0.8fr_1.2fr]">
          <Panel title="Live intelligence" icon={Bell}>
            <div className="h-56">
              {mounted ? (
                <ResponsiveContainer height="100%" minHeight={0} minWidth={0} width="100%">
                  <AreaChart data={marketTrend}>
                    <CartesianGrid stroke="rgba(255,255,255,0.08)" vertical={false} />
                    <XAxis dataKey="time" stroke="#93a39c" />
                    <YAxis stroke="#93a39c" />
                    <Tooltip contentStyle={{ background: "#0d1a17", border: "1px solid rgba(255,255,255,.12)" }} />
                    <Area dataKey="value" fill="#53c7e833" stroke="#53c7e8" strokeWidth={2} type="monotone" />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <ChartFallback />
              )}
            </div>
          </Panel>

          <Panel title="API et MCP" icon={Database}>
            <div className="grid gap-3 sm:grid-cols-2">
              {[
                "GET /api/predictions",
                "GET /api/races",
                "GET /api/race-analysis",
                "GET /api/value-bets",
                "POST /api/simulate",
                "POST /api/simulate-bet",
                "GET /api/model-card",
              ].map(
                (endpoint) => (
                  <div className="rounded-md border border-white/10 bg-[#081310] p-4" key={endpoint}>
                    <p className="font-mono text-sm text-emerald-200">{endpoint}</p>
                    <p className="mt-2 text-sm text-[#93a39c]">
                      Contrat MVP pret pour bots, partenaires et futurs quotas premium.
                    </p>
                  </div>
                ),
              )}
            </div>
          </Panel>
        </div>
      </section>
    </main>
  );
}

function HorseRow({
  horse,
  isSelected,
  onSelect,
}: {
  horse: HorsePrediction;
  isSelected: boolean;
  onSelect: () => void;
}) {
  return (
    <tr
      className={isSelected ? "bg-emerald-300/[0.08]" : "transition hover:bg-white/[0.03]"}
      onClick={onSelect}
    >
      <td className="border-b border-white/10 py-4 pr-4">
        <div className="flex items-center gap-3">
          <span className="grid h-9 w-9 place-items-center rounded-md bg-white/10 font-mono text-sm text-white">
            {horse.number}
          </span>
          <div>
            <p className="font-medium text-white">{horse.horse}</p>
            <p className="text-xs text-[#93a39c]">{horse.jockey} · {horse.trainer}</p>
          </div>
        </div>
      </td>
      <td className="border-b border-white/10 py-4 pr-4 font-mono text-emerald-300">{horse.kzScore}</td>
      <td className="border-b border-white/10 py-4 pr-4">{horse.winProbability}%</td>
      <td className="border-b border-white/10 py-4 pr-4">{horse.top3Probability}%</td>
      <td className="border-b border-white/10 py-4 pr-4 font-mono">{horse.odds}</td>
      <td className="border-b border-white/10 py-4 pr-4 font-mono">{horse.fairOdds}</td>
      <td className={`border-b border-white/10 py-4 pr-4 font-mono ${horse.valueIndex > 0 ? "text-emerald-300" : "text-[#ff8066]"}`}>
        {horse.valueIndex > 0 ? "+" : ""}{horse.valueIndex}%
      </td>
      <td className="border-b border-white/10 py-4 pr-4">
        <span className="rounded-md border border-white/10 px-2 py-1 text-xs text-[#d7e4de]">{horse.confidence}</span>
      </td>
    </tr>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Target;
  label: string;
  tone: "emerald" | "cyan" | "gold" | "coral";
  value: string;
}) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.04] p-3">
      <Icon className="text-emerald-300" size={18} />
      <p className="mt-3 text-xs text-[#93a39c]">{label}</p>
      <p className="mt-1 font-mono text-lg font-semibold text-white">{value}</p>
    </div>
  );
}

function Panel({
  children,
  icon: Icon,
  title,
}: {
  children: React.ReactNode;
  icon: typeof Target;
  title: string;
}) {
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

function NumberInput({
  label,
  min,
  setValue,
  suffix,
  value,
}: {
  label: string;
  min: number;
  setValue: (value: number) => void;
  suffix: string;
  value: number;
}) {
  return (
    <label className="text-sm text-[#93a39c]">
      {label}
      <div className="mt-2 flex h-11 items-center rounded-md border border-white/10 bg-[#081310] px-3">
        <input
          className="min-w-0 flex-1 bg-transparent text-white outline-none"
          min={min}
          onChange={(event) => setValue(Number(event.target.value))}
          type="number"
          value={value}
        />
        <span className="ml-2 text-xs text-[#93a39c]">{suffix}</span>
      </div>
    </label>
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

function ChartFallback() {
  return <div className="h-full w-full rounded-md border border-white/10 bg-white/[0.03]" />;
}

function useClientReady() {
  return useSyncExternalStore(
    () => () => undefined,
    () => true,
    () => false,
  );
}

function formatRelativeDay(day: RaceAnalysis["relativeDay"]) {
  if (day === "yesterday") return "Hier";
  if (day === "tomorrow") return "Demain";
  return "Aujourd'hui";
}
