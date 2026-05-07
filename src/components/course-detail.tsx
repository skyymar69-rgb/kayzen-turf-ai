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
  Sparkles,
  Target,
  Trophy,
} from "lucide-react";
import { useMemo, useState } from "react";
import { buildBetRecommendations, probableArrival, raceToContext } from "@/lib/bet-recommendations";
import { simulateBet } from "@/lib/betting-engine";
import { buildPostRaceAnalysis } from "@/lib/post-race-analysis";
import { explainPredictionScore, watchedLongshot } from "@/lib/prediction-math";
import type { RaceContext } from "@/lib/prediction-math";
import type { BetOffer, HorsePrediction, RaceAnalysis } from "@/lib/types";

type CourseDetailProps = { race: RaceAnalysis };
type TicketMode = "agressif" | "equilibre" | "securise";

const TABS = ["Partants", "Cotes", "Pronostics IA", "Statistiques", "Les Plus Joués", "Arrivées et Rapports"] as const;

const BET_COLORS: Record<string, string> = {
  SIMPLE_GAGNANT:  "bg-cyan-500",
  SIMPLE_PLACE:    "bg-cyan-500",
  COUPLE_GAGNANT:  "bg-orange-500",
  COUPLE_PLACE:    "bg-orange-500",
  COUPLE_ORDRE:    "bg-orange-500",
  DEUX_SUR_QUATRE: "bg-purple-600",
  TRIO:            "bg-amber-500",
  TRIO_ORDRE:      "bg-amber-500",
  MULTI:           "bg-pink-600",
  SUPER_QUATRE:    "bg-slate-600",
  QUARTE_PLUS:     "bg-sky-600",
  QUINTE_PLUS:     "bg-red-500",
  PICK5:           "bg-lime-600",
};

export function CourseDetail({ race }: CourseDetailProps) {
  const [selectedHorseId, setSelectedHorseId] = useState(race.horses[0]?.id ?? "");
  const [stake, setStake]           = useState(25);
  const [ticketBudget, setTicketBudget] = useState(30);
  const [ticketMode, setTicketMode] = useState<TicketMode>("equilibre");
  const [activeTab, setActiveTab]   = useState<(typeof TABS)[number]>("Partants");

  const selectedHorse       = race.horses.find((h) => h.id === selectedHorseId) ?? race.horses[0];
  const ctx                 = useMemo(() => raceToContext(race), [race]);
  const arrival             = useMemo(() => probableArrival(race.horses, ctx), [race.horses, ctx]);
  const horseRoles          = useMemo(() => buildHorseRoles(arrival, ctx), [arrival, ctx]);
  const betRecommendations  = useMemo(() => buildBetRecommendations(race.horses, race.betTypes, ctx), [race.betTypes, race.horses, ctx]);
  const ticketPlan          = useMemo(() => buildTicketPlan(betRecommendations, ticketMode, ticketBudget), [betRecommendations, ticketBudget, ticketMode]);
  const postRaceAnalysis    = useMemo(() => buildPostRaceAnalysis(race), [race]);
  const simulation          = selectedHorse ? simulateBet(stake, selectedHorse.odds, selectedHorse.winProbability, 500, 0) : null;
  const partantsCount       = race.horses.length;

  return (
    <main className="min-h-screen bg-bg pb-20" id="contenu-principal">
      <div className="mx-auto max-w-[1520px] px-4 pt-6 sm:px-6 lg:px-8">

        {/* Breadcrumb */}
        <Link
          href="/"
          className="mb-4 inline-flex items-center gap-2 rounded-xl border border-border bg-surface px-3.5 py-2 text-sm font-medium text-muted shadow-sm transition hover:border-accent hover:text-accent-text"
        >
          <ArrowLeft size={14} />
          Programme
        </Link>

        {/* ── RACE HEADER ────────────────────────────────────────── */}
        <header className="overflow-hidden rounded-2xl border border-border bg-surface shadow-sm">
          <div className="border-t-4 border-accent px-5 py-5 sm:px-7 sm:py-6">
            <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-3">
                  <h1 className="font-display text-xl font-bold text-fg sm:text-2xl">
                    Partants — {formatLongDate(race.raceDate)}
                  </h1>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-muted sm:gap-3 sm:text-base">
                  <span className="font-semibold text-fg">{race.discipline}</span>
                  <span>·</span>
                  <span>{race.specialty}</span>
                  <span>·</span>
                  <span>{formatPrize(race.raceQualityScore)}</span>
                  <span>·</span>
                  <span>{formatMeters(race.distance)} m</span>
                  <span>·</span>
                  <span>{partantsCount} partants</span>
                </div>
              </div>

              <div className="flex flex-col items-start gap-4 xl:items-end">
                <div className="flex items-center gap-2.5 font-semibold text-accent-text sm:text-xl">
                  <Clock3 size={22} />
                  Départ {race.startTime}
                </div>
                <span className="inline-flex items-center gap-2 rounded-xl border border-border bg-surface px-4 py-2 text-sm text-muted">
                  {race.going ? `Terrain : ${race.going}` : "État de piste non publié par le PMU"}
                </span>
              </div>
            </div>

            {/* Bet type badges */}
            <div className="mt-5 flex flex-wrap gap-2">
              {visibleBetBadges(race.betTypes).map((bet) => (
                <span
                  key={`${bet.type}-${bet.audience ?? "N"}`}
                  className={`rounded-full px-3 py-1 text-xs font-bold text-white ${BET_COLORS[bet.type] ?? "bg-accent"}`}
                >
                  {shortBetLabel(bet)}
                </span>
              ))}
            </div>
          </div>

          {/* Tab navigation */}
          <nav
            aria-label="Sections de la course"
            className="flex overflow-x-auto border-t border-border bg-surface-sub kz-scroll"
            role="tablist"
          >
            {TABS.map((tab) => (
              <button
                key={tab}
                aria-controls="course-tab-panel"
                aria-selected={activeTab === tab}
                className={`relative h-12 min-w-[140px] shrink-0 border-r border-border px-4 text-sm font-medium transition xl:min-w-0 xl:flex-1 ${
                  activeTab === tab
                    ? "bg-surface-inv text-white"
                    : "text-muted hover:bg-surface hover:text-fg"
                }`}
                onClick={() => setActiveTab(tab)}
                role="tab"
                type="button"
              >
                {tab}
                {activeTab === tab && (
                  <span className="absolute bottom-0 left-1/4 right-1/4 h-0.5 rounded-full bg-accent" />
                )}
              </button>
            ))}
          </nav>
        </header>

        {/* Tab panel */}
        <section
          className="mt-4 overflow-hidden rounded-2xl border border-border bg-surface shadow-sm"
          id="course-tab-panel"
          role="tabpanel"
        >
          {activeTab === "Partants" ? (
            <PartantsTable horses={arrival} onSelect={setSelectedHorseId} selectedHorseId={selectedHorse?.id} discipline={race.discipline} />
          ) : (
            <TabPlaceholder activeTab={activeTab} arrival={arrival} race={race} recommendations={betRecommendations} />
          )}
        </section>

        {/* ── PRONOSTIC + SIMULATION ─────────────────────────────── */}
        <div className="mt-4 grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">

          {/* Pronostic KAYZEN */}
          <Panel title="Pronostic KAYZEN" icon={Trophy}>
            {/* Ordre probable + tickets principaux */}
            <div className="grid gap-3 lg:grid-cols-[0.9fr_1.1fr]">
              <div className="rounded-2xl border border-accent/20 bg-accent-lo p-5">
                <p className="text-xs font-bold uppercase tracking-widest text-accent-text">Ordre probable</p>
                <p className="mt-2 font-mono text-3xl font-bold text-accent-text">
                  {arrival.slice(0, 6).map((h) => h.number).join(" – ")}
                </p>
                <p className="mt-3 text-sm leading-5 text-muted">
                  Base calculée avec KZ Score, probabilités gagnant/top 3 et forme récente.
                </p>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                {betRecommendations.slice(0, 6).map((r) => (
                  <div key={r.type} className="rounded-xl border border-border bg-surface-sub p-3">
                    <p className="text-xs font-semibold text-fg">{r.label}</p>
                    <p className="mt-1 font-mono text-base font-bold text-accent-text">{r.ticket}</p>
                    <p className="mt-1 flex items-center text-[10px] text-muted">
                      <span>Conf. {r.confidence}/99</span>
                      <InfoTip text="Indice de convergence des signaux 0-99 : mesure l'alignement entre probabilité gagnant, edge marché, forme et stabilité des rangs. 99 = tous les signaux pointent dans le même sens. Ne garantit pas le gain." />
                      <span className="ml-1">· {formatStrategyLabel(r.strategy)}</span>
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Typologie + Heatmap */}
            <div className="mt-4 grid gap-3 lg:grid-cols-[0.95fr_1.05fr]">
              <section className="rounded-2xl border border-border bg-surface-sub p-4" aria-label="Typologie IA">
                <div className="flex items-center">
                  <p className="text-xs font-bold uppercase tracking-widest text-muted">Typologie IA</p>
                  <InfoTip text="Base : meilleur score global KZ. Outsider : edge marché positif avec cote ≥ 6 (valeur sous-estimée). Tocard surveillé : signal surprise Top 3 élevé malgré une cote haute. Le KZ Score (0-99) combine probabilités, cote, musique, gains et contexte terrain." />
                </div>
                <div className="mt-3 grid gap-2">
                  {horseRoles.map((role) => (
                    <article key={role.label} className="rounded-xl border border-border bg-surface p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-widest text-accent-text">{role.label}</p>
                          <h3 className="mt-0.5 font-bold text-fg">#{role.horse.number} {role.horse.horse}</h3>
                        </div>
                        <span className="font-mono text-sm font-bold text-fg">{fmtScore(role.horse.kzScore)}</span>
                      </div>
                      <p className="mt-2 text-xs leading-5 text-muted">{role.reason}</p>
                    </article>
                  ))}
                </div>
              </section>

              <section className="rounded-2xl border border-border bg-surface-sub p-4" aria-label="Heatmap Top 3">
                <div className="flex items-center">
                  <p className="text-xs font-bold uppercase tracking-widest text-muted">Heatmap Top 3</p>
                  <InfoTip text="Probabilité que le cheval finisse dans les 3 premiers (modèle Plackett-Luce). Triés du plus élevé au plus bas. L'ordre d'arrivée prédit peut différer car il intègre aussi la probabilité gagnant stricte, la cote et la forme — un cheval peut être 1er même avec une prob. Top 3 plus faible si sa prob. gagnant est dominante." />
                </div>
                <p className="mt-0.5 text-[10px] text-muted">Triés par prob. Top 3 ↓</p>
                <div className="mt-3 grid gap-3">
                  {arrival.slice(0, 8).slice().sort((a, b) => (b.top3Probability ?? 0) - (a.top3Probability ?? 0)).map((horse) => (
                    <div key={horse.id} className="grid grid-cols-[36px_1fr_48px] items-center gap-3">
                      <span className="font-mono text-sm font-bold text-fg">#{horse.number}</span>
                      <div className="h-2.5 overflow-hidden rounded-full bg-border">
                        <div
                          className="h-full rounded-full bg-accent transition-all"
                          style={{ width: `${safeWidth(horse.top3Probability)}%` }}
                        />
                      </div>
                      <span className="text-right font-mono text-xs font-bold text-accent-text">{fmtProb(horse.top3Probability)}</span>
                    </div>
                  ))}
                </div>
              </section>
            </div>

            <PredictionMethodology race={race} arrival={arrival} />

            {/* Générateur de tickets */}
            <section className="mt-4 rounded-2xl border border-border bg-surface-sub p-5">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-muted">Générateur intelligent</p>
                  <h3 className="mt-1 font-display text-lg font-bold text-fg">
                    Mode {ticketModeLabel(ticketMode)} · {ticketBudget} €
                  </h3>
                </div>
                <div className="flex flex-wrap gap-2">
                  <div aria-label="Mode de stratégie" className="flex overflow-hidden rounded-xl border border-border bg-surface text-xs font-bold" role="group">
                    {(["securise", "equilibre", "agressif"] as TicketMode[]).map((mode) => (
                      <button
                        key={mode}
                        aria-pressed={ticketMode === mode}
                        className={`min-h-10 px-4 transition ${ticketMode === mode ? "bg-accent text-white" : "text-muted hover:bg-surface-sub"}`}
                        onClick={() => setTicketMode(mode)}
                        type="button"
                      >
                        {ticketModeLabel(mode)}
                      </button>
                    ))}
                  </div>
                  <label className="flex flex-col gap-1 text-xs font-bold uppercase tracking-widest text-muted">
                    Budget (€)
                    <input
                      className="h-10 w-28 rounded-xl border border-border bg-surface px-3 text-fg outline-none"
                      min={5}
                      onChange={(e) => setTicketBudget(Number(e.target.value))}
                      step={5}
                      type="number"
                      value={ticketBudget}
                    />
                  </label>
                </div>
              </div>
              <div className="mt-4 grid gap-2 md:grid-cols-3">
                {ticketPlan.map((ticket) => (
                  <div key={ticket.type} className="rounded-xl border border-border bg-surface p-3">
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-semibold text-fg">{ticket.label}</p>
                      <span className="rounded-full bg-accent-lo px-2 py-0.5 text-xs font-bold text-accent-text">{ticket.stake} €</span>
                    </div>
                    <p className="mt-2 font-mono text-lg font-bold text-accent-text">{ticket.ticket}</p>
                    <p className="mt-1 text-xs leading-5 text-muted">{ticket.rationale}</p>
                  </div>
                ))}
                {ticketPlan.length === 0 && (
                  <p className="col-span-3 rounded-xl border border-border bg-surface p-4 text-sm text-muted">
                    Aucun ticket disponible pour ce mode avec les paris ouverts connus.
                  </p>
                )}
              </div>
            </section>

            <TicketCombinationsPanel recommendations={betRecommendations} />

            {/* FAQ Comprendre les indices */}
            <details className="mt-4 rounded-2xl border border-border bg-surface-sub p-5">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-2">
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-muted">Comprendre ces chiffres</p>
                  <p className="mt-0.5 text-sm font-medium text-fg">Pourquoi ces chevaux ? Que signifient les indices ?</p>
                </div>
                <span className="shrink-0 rounded-full border border-border bg-surface px-3 py-1 text-xs font-bold text-muted">Ouvrir →</span>
              </summary>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {[
                  {
                    q: "Que signifie Conf. X/99 sur un ticket ?",
                    a: "Indice de convergence algorithmique 0-99. Il mesure l'alignement entre la probabilité gagnant, l'edge marché (cote PMU vs cote juste), la forme récente et la stabilité des rangs entre modèles. Conf. 99 = tous les signaux convergent. Ce n'est pas une promesse de gain.",
                  },
                  {
                    q: "Pourquoi le KZ Score d'un cheval #1 peut être plus bas que celui du #2 ?",
                    a: "Le classement d'arrivée utilise un score ordre strict (exactOrderScore) qui pénalise les favoris fragiles et valorise la stabilité. Un cheval classé #1 peut avoir un KZ brut plus faible mais une meilleure probabilité gagnant et moins de risques — il gagne plus souvent, pas forcément avec le meilleur score composite.",
                  },
                  {
                    q: "Heatmap Top 3 : pourquoi le #2 est parfois en tête ?",
                    a: "La heatmap trie par probabilité Top 3 décroissante. Un cheval peut avoir 68% de chances de finir dans le top 3 sans pour autant être le favori gagnant — il est régulier, souvent placé, mais rarement vainqueur. L'ordre des tickets prend en compte la probabilité gagnant stricte, ce qui peut inverser le classement.",
                  },
                  {
                    q: "Stratégie Confiance vs Value vs Spéculatif ?",
                    a: "Confiance : tickets sur les chevaux les mieux classés, risque faible. Value : chevaux sous-évalués par le marché (edge positif), potentiel de gain plus élevé. Spéculatif : outsiders avec un signal surprise Top 3 — risque élevé, gain potentiellement fort. Le mode Équilibré mixe les trois.",
                  },
                ].map(({ q, a }) => (
                  <article key={q} className="rounded-xl border border-border bg-surface p-4">
                    <p className="text-sm font-semibold text-fg">{q}</p>
                    <p className="mt-2 text-xs leading-5 text-muted">{a}</p>
                  </article>
                ))}
              </div>
            </details>
          </Panel>

          {/* Simulation */}
          <Panel title="Simulation & responsabilité" icon={Gauge}>
            {selectedHorse && simulation ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="col-span-2 flex flex-col gap-1.5 text-sm font-medium text-muted">
                  Cheval sélectionné
                  <select
                    className="h-11 w-full rounded-xl border border-border bg-surface px-3 text-fg outline-none"
                    onChange={(e) => setSelectedHorseId(e.target.value)}
                    value={selectedHorse.id}
                  >
                    {arrival.map((horse) => (
                      <option key={horse.id} value={horse.id}>
                        #{horse.number} {horse.horse}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="col-span-2 flex flex-col gap-1.5 text-sm font-medium text-muted sm:col-span-1">
                  Mise (€)
                  <input
                    className="h-11 w-full rounded-xl border border-border bg-surface px-3 text-fg outline-none"
                    min={1}
                    onChange={(e) => setStake(Number(e.target.value))}
                    type="number"
                    value={stake}
                  />
                </label>
                <div className="grid grid-cols-2 gap-2 sm:col-span-2">
                  <Result label="EV estimée"    value={`${simulation.expectedValue} €`} />
                  <Result label="Kelly prudent" value={`${simulation.kellyStake} €`} />
                  <Result label="Edge marché"   value={`${simulation.marketEdge}%`} />
                  <Result label="Décision"      value={simulation.recommendation} accent={simulation.marketEdge > 0} />
                </div>
              </div>
            ) : null}
          </Panel>
        </div>

        {/* ── POST-RACE / FACTEURS / MODÈLE ─────────────────────── */}
        <div className="mt-4 grid gap-4 xl:grid-cols-3">
          <Panel title="Analyse après course" icon={Sparkles}>
            <div className="space-y-3">
              <div className="rounded-xl border border-border bg-surface-sub p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-semibold text-fg">{postRaceAnalysis.verdict}</p>
                  <span className="font-mono text-sm text-accent-text">
                    {postRaceAnalysis.status === "complete" ? `${postRaceAnalysis.metrics.confidenceScore}/99` : "En attente"}
                  </span>
                </div>
                <p className="mt-2 text-sm leading-5 text-muted">{postRaceAnalysis.summary}</p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Result label="Prédiction" value={postRaceAnalysis.predictedArrival.join("–") || "—"} />
                <Result label="Arrivée"    value={postRaceAnalysis.actualArrival.join("–") || "—"} />
                <Result label="Top 3"      value={`${postRaceAnalysis.metrics.top3Hits}/3`} />
                <Result label="Top 5"      value={`${postRaceAnalysis.metrics.top5Hits}/5`} />
              </div>
            </div>
          </Panel>

          <Panel title="Facteurs IA" icon={Brain}>
            <div className="space-y-2">
              {(selectedHorse?.factors ?? []).map((factor) => (
                <div key={factor} className="flex gap-3 rounded-xl border border-border bg-surface-sub p-3">
                  <Sparkles className="mt-0.5 shrink-0 text-accent-text" size={15} />
                  <p className="text-sm text-muted">{factor}</p>
                </div>
              ))}
              {(selectedHorse?.factors ?? []).length === 0 && (
                <p className="text-sm text-muted">Aucun facteur disponible.</p>
              )}
            </div>
          </Panel>

          <Panel title="Actions modèle" icon={ArrowUpRight}>
            <div className="space-y-2">
              {postRaceAnalysis.nextModelActions.map((action) => (
                <p key={action} className="rounded-xl border border-accent/20 bg-accent-lo p-3 text-sm text-fg">
                  {action}
                </p>
              ))}
              <div className="rounded-xl border border-warn/30 bg-warn-lo p-3 text-sm">
                <AlertTriangle className="mb-2 text-warn" size={16} />
                <p className="text-warn">
                  Aucun pronostic ne garantit un gain. Les tickets restent une aide à la décision.
                </p>
              </div>
            </div>
          </Panel>
        </div>

      </div>
    </main>
  );
}

/* ─── PartantsTable ──────────────────────────────────────────────── */

function PartantsTable({
  horses, onSelect, selectedHorseId, discipline,
}: {
  horses: HorsePrediction[];
  onSelect: (id: string) => void;
  selectedHorseId?: string;
  discipline?: string;
}) {
  return (
    <>
      {/* Mobile cards */}
      <div className="grid gap-3 p-4 md:hidden">
        {horses.map((horse) => (
          <button
            key={horse.id}
            aria-pressed={selectedHorseId === horse.id}
            className={`rounded-2xl border p-4 text-left transition ${
              selectedHorseId === horse.id ? "border-accent/30 bg-accent-lo" : "border-border bg-surface"
            }`}
            onClick={() => onSelect(horse.id)}
            type="button"
          >
            <div className="grid grid-cols-[44px_1fr_auto] items-start gap-3">
              {horse.silksUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img alt={`Casaque ${horse.horse}`} className="premium-silk h-10 w-10 rounded-lg object-contain" decoding="async" loading="lazy" src={horse.silksUrl} />
              ) : (
                <span className="grid h-10 w-10 place-items-center rounded-lg bg-accent-lo font-mono font-bold text-accent-text">
                  {horse.number}
                </span>
              )}
              <div className="min-w-0">
                <p className="truncate font-bold text-fg">#{horse.number} {horse.horse}</p>
                <p className="mt-0.5 truncate text-sm text-muted">{horse.jockey}</p>
                <p className="truncate text-xs text-muted">{horse.trainer}</p>
              </div>
              <div className="text-right">
                <p className="font-mono text-sm font-bold text-accent-text">{fmtScore(horse.kzScore)}</p>
                <p className="text-[10px] text-muted">KZ</p>
              </div>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
              <Result label="Cote"  value={horse.odds > 1 ? `${horse.odds}` : "—"} />
              <Result label="Top 3" value={fmtProb(horse.top3Probability)} />
              <Result label="Gains" value={formatEuros(horse.earnings)} />
            </div>
            <p className="mt-2 line-clamp-2 text-xs text-muted">{horse.music ?? "Performances non disponibles"}</p>
          </button>
        ))}
      </div>

      {/* Desktop table */}
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[1280px] border-collapse text-left">
          <caption className="sr-only">Partants avec numéro, cheval, jockey, gains, cotes et score KZ</caption>
          <thead>
            <tr className="border-b border-border bg-surface-inv text-xs font-bold uppercase tracking-widest text-white">
              {[
                "N°", "Cheval",
                ...(discipline === "Trot" ? ["Dist."] : []),
                "Déf.", "S/A",
                discipline === "Trot" ? "Driver" : "Jockey",
                "Entraîneur",
                ...(discipline === "Trot" ? ["R/K"] : []),
                "Gains", "Dernières performances", "Cote", "KZ",
              ].map((h) => (
                <th key={h} className="border-r border-white/10 px-3 py-4 font-semibold last:border-r-0" scope="col">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {horses.map((horse, idx) => (
              <tr
                key={horse.id}
                aria-label={`Sélectionner ${horse.horse}, numéro ${horse.number}`}
                className={`cursor-pointer text-sm transition hover:bg-accent-lo ${
                  selectedHorseId === horse.id ? "bg-accent-lo" : idx % 2 === 0 ? "bg-surface" : "bg-surface-sub"
                }`}
                onClick={() => onSelect(horse.id)}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onSelect(horse.id); } }}
                tabIndex={0}
              >
                <th className={`px-3 py-3.5 font-mono font-bold ${selectedHorseId === horse.id ? "text-accent-text" : "text-muted"}`} scope="row">
                  {horse.number}
                </th>
                <td className="px-3 py-3.5">
                  <div className="flex min-w-[220px] items-center gap-3">
                    {horse.silksUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img alt={`Casaque ${horse.horse}`} className="premium-silk h-8 w-8 rounded-lg object-contain" decoding="async" loading="lazy" src={horse.silksUrl} />
                    ) : (
                      <span className="grid h-8 w-8 place-items-center rounded-lg bg-accent-lo font-mono text-xs font-bold text-accent-text">
                        {horse.number}
                      </span>
                    )}
                    <span className="font-bold text-fg">{horse.horse}</span>
                  </div>
                </td>
                {discipline === "Trot" && <td className="px-3 py-3.5 font-mono text-muted">{horse.handicapDistance ?? "—"}</td>}
                <td className="px-3 py-3.5 text-muted">{formatEquipment(horse.equipment)}</td>
                <td className="px-3 py-3.5 font-mono text-muted">{formatSexAge(horse)}</td>
                <td className="px-3 py-3.5 text-muted">{horse.jockey}</td>
                <td className="px-3 py-3.5 text-muted">{horse.trainer}</td>
                {discipline === "Trot" && <td className="px-3 py-3.5 font-mono text-muted">{horse.reductionKm ?? "—"}</td>}
                <td className="px-3 py-3.5 font-mono text-muted">{formatEuros(horse.earnings)}</td>
                <td className="max-w-[340px] truncate px-3 py-3.5 text-muted" title={horse.music ?? ""}>{horse.music ?? "—"}</td>
                <td className="px-3 py-3.5 font-mono text-fg">{horse.odds > 1 ? horse.odds : "—"}</td>
                <td className={`px-3 py-3.5 font-mono font-bold ${selectedHorseId === horse.id ? "text-accent-text" : "text-accent-text/70"}`}>
                  {fmtScore(horse.kzScore)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

/* ─── TabPlaceholder ─────────────────────────────────────────────── */

function TabPlaceholder({
  activeTab, arrival, race, recommendations,
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
          <Result key={horse.id} label={`#${horse.number} ${horse.horse}`} value={`PMU ${Number.isFinite(horse.odds) ? horse.odds : "—"} / juste ${Number.isFinite(horse.fairOdds) ? horse.fairOdds : "—"}`} />
        ))}
      </SimpleGrid>
    );
  }

  if (activeTab === "Pronostics IA") {
    return (
      <div className="p-5">
        <h2 className="mb-4 font-display text-lg font-bold text-fg">Tickets proposés</h2>
        <div className="space-y-3">
          {recommendations.map((item) => (
            <div key={item.type} className="rounded-2xl border border-border bg-surface-sub p-4">
              <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                <p className="font-semibold text-fg">{item.label}</p>
                <p className="font-mono text-sm font-bold text-accent-text">{item.ticket}</p>
              </div>
              <TicketVariantCloud recommendation={item} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (activeTab === "Statistiques") {
    return (
      <SimpleGrid title="Statistiques course">
        <Result label="Consensus IA"       value={`${race.modelConsensus}%`} />
        <Result label="Volatilité marché"  value={`${race.marketVolatility}%`} />
        <Result label="Qualité course"     value={`${race.raceQualityScore}`} />
        <Result label="Risque"             value={formatRiskLabel(race.riskLevel)} />
      </SimpleGrid>
    );
  }

  return (
    <SimpleGrid title={activeTab}>
      {arrival.slice(0, 8).map((horse) => (
        <Result key={horse.id} label={`#${horse.number} ${horse.horse}`} value={`${fmtProb(horse.winProbability)} gagnant`} />
      ))}
    </SimpleGrid>
  );
}

/* ─── Sub-components ─────────────────────────────────────────────── */

function SimpleGrid({ children, title }: { children: ReactNode; title: string }) {
  return (
    <div className="p-5">
      <h2 className="mb-4 font-display text-lg font-bold text-fg">{title}</h2>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">{children}</div>
    </div>
  );
}

function TicketCombinationsPanel({ recommendations }: { recommendations: ReturnType<typeof buildBetRecommendations> }) {
  if (!recommendations.length) return null;
  return (
    <details className="mt-4 rounded-2xl border border-border bg-surface">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-5">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-muted">Jeux disponibles</p>
          <p className="mt-0.5 text-sm font-medium text-fg">Top 5 tickets par pari — priorisés par confiance IA</p>
        </div>
        <span className="shrink-0 rounded-full border border-border bg-surface-sub px-3 py-1 text-xs font-bold text-muted">Voir →</span>
      </summary>
      <div className="grid gap-3 p-5 pt-0 xl:grid-cols-2">
        {recommendations.map((r) => (
          <article key={`variants-${r.type}`} className="rounded-xl border border-border bg-surface-sub p-3">
            <div className="flex items-center justify-between gap-3">
              <p className="font-semibold text-fg">{r.label}</p>
              <span className="rounded-full bg-accent-lo px-2 py-0.5 text-xs font-bold text-accent-text">{r.confidence}/99</span>
            </div>
            <TicketVariantCloud recommendation={r} />
          </article>
        ))}
      </div>
    </details>
  );
}

const MAX_VARIANTS_SHOWN = 5;

function TicketVariantCloud({ recommendation }: { recommendation: ReturnType<typeof buildBetRecommendations>[number] }) {
  const shown = recommendation.variants.slice(0, MAX_VARIANTS_SHOWN);
  const hidden = recommendation.variantCount - shown.length;
  return (
    <div className="mt-3 flex flex-wrap gap-1.5">
      {shown.map((v) => (
        <span
          key={`${recommendation.type}-${v.ticket}`}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-2 py-1 font-mono text-xs font-bold text-fg"
          title={`${v.confidence}/99 — ${v.rationale}`}
        >
          {v.ticket}
          <span className="font-sans text-[10px] font-semibold text-accent-text">{v.confidence}</span>
        </span>
      ))}
      {hidden > 0 && (
        <span className="inline-flex items-center rounded-lg border border-border bg-surface-sub px-2 py-1 text-xs text-muted">
          +{hidden} autres
        </span>
      )}
    </div>
  );
}

function Panel({ children, icon: Icon, title }: { children: ReactNode; icon: typeof Target; title: string }) {
  return (
    <section className="rounded-2xl border border-border bg-surface p-5 shadow-sm sm:p-6">
      <div className="mb-5 flex items-center gap-3">
        <div className="grid h-9 w-9 place-items-center rounded-xl bg-accent-lo text-accent-text">
          <Icon size={17} />
        </div>
        <h2 className="font-display text-lg font-bold text-fg">{title}</h2>
      </div>
      {children}
    </section>
  );
}

function PredictionMethodology({ arrival, race }: { arrival: HorsePrediction[]; race: RaceAnalysis }) {
  const ctx = raceToContext(race);
  const reviewedHorses = arrival.map((horse, index) => ({
    analysis: explainPredictionScore(horse, arrival, ctx),
    horse, rank: index + 1,
  }));

  return (
    <details className="mt-4 rounded-2xl border border-border bg-surface-sub p-5">
      <summary className="cursor-pointer list-none">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-muted">Pourquoi ce pronostic ?</p>
            <h3 className="mt-1 font-display text-lg font-bold text-fg">Méthode probabiliste et avis cheval par cheval</h3>
          </div>
          <span className="rounded-full border border-border bg-surface px-3 py-1 text-xs font-bold text-muted">Ouvrir l'analyse</span>
        </div>
      </summary>

      <div className="mt-5 grid gap-4">
        <section className="rounded-xl border border-border bg-surface p-4">
          <p className="text-xs font-bold uppercase tracking-widest text-muted">Contexte utilisé</p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            <Result label="Hippodrome"           value={race.racecourse} />
            <Result label="Terrain"              value={race.going || "Non publié par le PMU"} />
            <Result label="Météo"                value={race.weather || "Non renseignée"} />
            <Result label="Distance / discipline" value={`${formatMeters(race.distance)} m — ${race.specialty}`} />
          </div>
        </section>

        <section className="rounded-xl border border-border bg-surface p-4">
          <p className="text-xs font-bold uppercase tracking-widest text-muted">Versions des modèles</p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3 text-xs text-muted font-mono">
            {[
              ["Modèle scoring", "form_scorer v2.0"],
              ["Plackett-Luce", "pl_gumbel v1.0"],
              ["Drift / Steam", "drift_lgbm — en attente DB"],
              ["Connections", "connections_v1 — en attente DB"],
              ["Risque DNF", "risk_v1 — Obstacle uniquement"],
              ["Data cutoff", new Date().toISOString().slice(0, 10)],
            ].map(([k, v]) => (
              <div key={k} className="rounded-lg border border-border bg-surface-sub px-3 py-2">
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted/60">{k}</p>
                <p className="mt-0.5 text-fg/80">{v}</p>
              </div>
            ))}
          </div>
          <p className="mt-2 text-[10px] text-muted/50">Chaque prédiction est reproductible : discipline, cote, musique et contexte sont tracés. Calibration Brier et ECE publiées sur la page Performance.</p>
        </section>

        <section className="rounded-xl border border-border bg-surface p-4">
          <p className="text-xs font-bold uppercase tracking-widest text-muted">Techniques de probabilité</p>
          <div className="mt-3 grid gap-3 lg:grid-cols-2">
            {probabilityTechniques().map((item) => (
              <article key={item.title} className="rounded-xl border border-border bg-surface-sub p-3">
                <p className="font-semibold text-fg">{item.title}</p>
                <p className="mt-1 text-sm leading-5 text-muted">{item.body}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="rounded-xl border border-border bg-surface p-4">
          <p className="text-xs font-bold uppercase tracking-widest text-muted">Avis cheval par cheval</p>
          <div className="mt-3 grid gap-3">
            {reviewedHorses.map(({ analysis, horse, rank }) => (
              <article key={horse.id} className="rounded-xl border border-border bg-surface-sub p-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-accent-text">Rang #{rank}</p>
                    <h4 className="mt-0.5 font-bold text-fg">#{horse.number} {horse.horse}</h4>
                    <p className="mt-0.5 text-xs text-muted">{horse.jockey} / {horse.trainer}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-2 sm:min-w-56">
                    <Result label="Score ordre" value={fmtScore(analysis.exactOrderScore)} />
                    <Result label="Top 3"        value={fmtProb(horse.top3Probability)} />
                  </div>
                </div>
                <p className="mt-3 text-sm leading-6 text-muted">{horseOpinion(horse, analysis, rank, race)}</p>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {[
                    `Musique: ${horse.music || "non renseignée"}`,
                    `Cote: ${horse.odds || "—"}`,
                    `Risque favori: ${analysis.favoriteFailureRisk}/60`,
                    `Signal tocard: ${analysis.top3UpsetScore}/60`,
                  ].map((tag) => (
                    <span key={tag} className="rounded-lg border border-border bg-surface px-2 py-0.5 text-xs text-muted">{tag}</span>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </section>
      </div>
    </details>
  );
}

function InfoTip({ text }: { text: string }) {
  return (
    <span className="group/tip relative ml-1.5 inline-flex shrink-0">
      <span className="inline-flex h-4 w-4 cursor-help select-none items-center justify-center rounded-full border border-muted/40 bg-surface text-[9px] font-bold text-muted">?</span>
      <span className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 w-64 -translate-x-1/2 rounded-xl border border-border bg-surface p-3 text-left text-[11px] leading-5 text-muted shadow-xl opacity-0 transition-opacity duration-150 group-hover/tip:opacity-100">
        {text}
      </span>
    </span>
  );
}

function Result({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className={`rounded-xl border p-3 ${accent ? "border-accent/20 bg-accent-lo" : "border-border bg-surface-sub"}`}>
      <p className="text-[10px] font-bold uppercase tracking-widest text-muted">{label}</p>
      <p className={`mt-1 text-sm font-semibold ${accent ? "text-accent-text" : "text-fg"}`}>{value}</p>
    </div>
  );
}

/* ─── Pure helpers (business logic unchanged) ────────────────────── */

function probabilityTechniques() {
  return [
    { title: "1. Classement ordre strict",    body: "L'ordre probable privilégie la probabilité gagnant, la stabilité des rangs, la cote, la forme récente et pénalise les favoris fragiles." },
    { title: "2. Classement couverture",      body: "Les tickets couplé, trio, quarté et quinté utilisent aussi les probabilités Top 3 et Top 5 pour couvrir les chevaux capables de finir placés." },
    { title: "3. Favori fragile",             body: "Un favori est abaissé si sa cote est courte mais que son Top 3 est inférieur au peloton, que son edge est faible, ou que la volatilité augmente." },
    { title: "4. Tocard surveillé",           body: "Un outsider est marqué comme surveillé quand sa cote reste haute mais que son Top 3, Top 5, musique ou signal value indiquent une vraie possibilité de place." },
    { title: "5. Musique et forme",           body: "La musique est lue comme une séquence récente : victoires, places, échecs et éventuel rebond. Elle corrige le niveau de confiance." },
    { title: "6. Rétro-analyse (auto-apprentissage)", body: "Après l'arrivée officielle, le modèle compare prédiction et réel : gagnant, Top 3, Top 5, erreur moyenne de position. Ces écarts ajustent les prochains poids." },
  ];
}

function horseOpinion(
  horse: HorsePrediction,
  analysis: ReturnType<typeof explainPredictionScore>,
  rank: number,
  race: RaceAnalysis,
) {
  const isTrot = race.discipline === "Trot";
  const conducteur = isTrot ? `driver ${horse.jockey}` : `jockey ${horse.jockey}`;

  // Pool de raisons positives — chacune distincte et conditionnelle
  const positives = [
    horse.winProbability >= 20      ? `probabilité gagnant élevée (${horse.winProbability}%)` : null,
    horse.winProbability >= 12 && horse.winProbability < 20
                                    ? `bonne probabilité gagnant (${horse.winProbability}%)` : null,
    horse.top3Probability >= 45     ? `profil Top 3 solide (${horse.top3Probability}%)` : null,
    horse.top3Probability >= 35 && horse.top3Probability < 45
                                    ? `bonne capacité à se placer (${horse.top3Probability}%)` : null,
    analysis.exactOrderScore >= 70  ? `score ordre strict élevé (${analysis.exactOrderScore}/99)` : null,
    analysis.top3UpsetScore >= 30   ? `signal outsider significatif (${analysis.top3UpsetScore}/60)` : null,
    horse.valueIndex >= 15          ? `edge marché positif (+${horse.valueIndex}% vs cote juste)` : null,
    horse.odds >= 8 && horse.winProbability >= 10
                                    ? `bonne value sur outsider (cote ${horse.odds})` : null,
    horse.confidence === "Forte"    ? `historique récent robuste` : null,
    horse.earnings && horse.earnings > 50000
                                    ? `gains significatifs (${new Intl.NumberFormat("fr-FR").format(horse.earnings)} €)` : null,
    race.going && horse.top3Probability >= 40
                                    ? `profil adapté au terrain ${race.going}` : null,
    analysis.favoriteFailureRisk <= 10
                                    ? `risque défaillance très faible` : null,
  ].filter((x): x is string => x !== null);

  // Pool de mises en garde
  const cautions = [
    analysis.favoriteFailureRisk >= 30 ? `risque de défaillance élevé (${analysis.favoriteFailureRisk}/60)` : null,
    horse.odds < 2.5 && horse.winProbability < 35
                                    ? `favori court mais probabilité modérée` : null,
    horse.winProbability < 7        ? `probabilité gagnant faible (${horse.winProbability}%)` : null,
    horse.odds >= 20                ? `cote spéculative (${horse.odds})` : null,
    horse.confidence === "Faible"   ? `historique récent insuffisant` : null,
    isTrot && horse.reductionKm     ? `réduction kilométrique à surveiller (${horse.reductionKm})` : null,
  ].filter((x): x is string => x !== null);

  const terrain = race.going ? `terrain ${race.going}` : "état de piste non publié";
  const meteo   = race.weather ? `, météo ${race.weather}` : "";
  const ctx     = `${race.racecourse} · ${formatMeters(race.distance)} m · ${terrain}${meteo}`;

  // Sélectionner max 3 raisons positives les plus pertinentes
  const top3Reasons = positives.slice(0, 3);
  const positive = top3Reasons.length ? top3Reasons.join(", ") : "profil dans la moyenne du champ sans signal dominant";
  const warning  = cautions.length ? ` Point de vigilance : ${cautions.slice(0, 2).join(", ")}.` : "";

  const musicNote = horse.music
    ? `Musique récente : ${horse.music.slice(0, 30)}${horse.music.length > 30 ? "…" : ""}.`
    : "";

  return `#${horse.number} classé ${rank}e — ${positive}. ${musicNote} ${conducteur}, entraîneur ${horse.trainer}, contexte ${ctx}.${warning}`.replace(/\s+/g, " ").trim();
}

function buildTicketPlan(recommendations: ReturnType<typeof buildBetRecommendations>, mode: TicketMode, budget: number) {
  const filtered = recommendations.filter((r) => {
    if (mode === "securise") return r.strategy === "Confiance" || r.strategy === "Couverture";
    if (mode === "agressif") return r.strategy === "Speculatif" || r.strategy === "Value";
    return true;
  });
  const limited = filtered.slice().sort((a, b) => b.confidence - a.confidence).slice(0, mode === "agressif" ? 4 : 3);
  const total   = limited.reduce((s, i) => s + ticketWeight(i.strategy, mode), 0) || 1;
  return limited.map((item) => ({ ...item, stake: Math.max(1, Math.round((budget * ticketWeight(item.strategy, mode)) / total)) }));
}

function ticketWeight(strategy: string, mode: TicketMode) {
  if (mode === "securise") return strategy === "Couverture" ? 1.2 : 1;
  if (mode === "agressif") return strategy === "Speculatif" ? 1.4 : 1;
  return strategy === "Value" ? 1.25 : 1;
}

function ticketModeLabel(mode: TicketMode) {
  if (mode === "securise") return "Sécurisé";
  if (mode === "agressif") return "Agressif";
  return "Équilibré";
}

function visibleBetBadges(offers: BetOffer[]) {
  const priority = ["SIMPLE_GAGNANT","COUPLE_GAGNANT","DEUX_SUR_QUATRE","TRIO","MULTI","TIERCE","QUARTE_PLUS","QUINTE_PLUS","PICK5"];
  const byType   = new Map(offers.map((o) => [o.type, o]));
  return priority.flatMap((type) => byType.get(type) ?? []);
}

function shortBetLabel(offer: BetOffer) {
  const labels: Record<string, string> = {
    SIMPLE_GAGNANT: "Simple", SIMPLE_PLACE: "Simple", COUPLE_GAGNANT: "Couple", COUPLE_PLACE: "Couple",
    DEUX_SUR_QUATRE: "2 sur 4", TRIO: "Trio", MULTI: "Multi", TIERCE: "Tiercé",
    QUARTE_PLUS: "Quarté+", QUINTE_PLUS: "Quinté+", PICK5: "Pick5",
  };
  return labels[offer.type] ?? offer.label;
}

function buildHorseRoles(arrival: HorsePrediction[], context: RaceContext = {}) {
  const base     = arrival[0];
  const outsider = arrival.find((h) => h.valueIndex >= 10 && h.odds >= 6) ?? arrival[3] ?? arrival[1];
  const longshot = watchedLongshot(arrival, context) ?? arrival.slice().reverse().find((h) => h.valueIndex >= 5 && h.top3Probability >= 18) ?? arrival[6] ?? arrival.at(-1);
  const roles    = [
    base     ? { horse: base,     label: "Base",            reason: `Score enrichi ${explainPredictionScore(base, arrival, context).score}/99 : probabilité gagnant, top 3, cote juste et stabilité des rangs.` } : null,
    outsider ? { horse: outsider, label: "Outsider",        reason: `Signal value ${outsider.valueIndex}% avec cote ${outsider.odds} : intéressant si la probabilité estimée reste supérieure au marché.` } : null,
    longshot ? { horse: longshot, label: "Tocard surveillé",reason: `Signal Top 3 surprise ${explainPredictionScore(longshot, arrival, context).top3UpsetScore}/60 : à intégrer dans les tickets larges ou flexi.` } : null,
  ].filter((r): r is { horse: HorsePrediction; label: string; reason: string } => Boolean(r));
  const seen = new Set<string>();
  return roles.filter((r) => { if (seen.has(r.horse.id)) return false; seen.add(r.horse.id); return true; });
}

function formatLongDate(date: string) {
  return new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "2-digit", month: "long", year: "numeric" }).format(new Date(`${date}T12:00:00`));
}
function formatMeters(distance: string) { return String(distance).replace(/\D/g, "") || distance; }
function formatPrize(score: number)     { return `${Math.round(score * 500)} €`; }
function formatEuros(value?: number | null) { return value ? `${new Intl.NumberFormat("fr-FR").format(Math.round(value))} €` : "—"; }
function formatSexAge(horse: HorsePrediction) { const s = horse.sex?.slice(0, 1) ?? ""; return `${s}${horse.age ?? ""}` || "—"; }
function formatEquipment(value?: string | null) { if (!value || value === "SANS_OEILLERES") return "—"; return value.replaceAll("_", " ").toLowerCase(); }
function formatRiskLabel(r: RaceAnalysis["riskLevel"]) { if (r === "Equilibre") return "Équilibré"; if (r === "Speculatif") return "Spéculatif"; return r; }
function formatStrategyLabel(s: string) { if (s === "Speculatif") return "Spéculatif"; return s; }
function fmtScore(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return "—";
  return Math.round(v).toString();
}
function fmtProb(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return "—";
  return `${Math.round(v)}%`;
}
function safeWidth(v: number | null | undefined, min = 4, max = 100): number {
  return Math.max(min, Math.min(max, Number.isFinite(v as number) ? (v as number) : 0));
}
