"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { AlertTriangle, ArrowLeft, Clock3 } from "lucide-react";
import { Countdown } from "@/components/countdown";
import { FieldTable } from "@/components/course/field-table";
import { HorseSheet } from "@/components/course/horse-sheet";
import { LiveStatus } from "@/components/course/live-status";
import { MarketPanel } from "@/components/course/market-panel";
import { PostRacePanel, SimulationPanel } from "@/components/course/side-panels";
import { BetBadges, ShareButton, TicketTools, formatLongDate } from "@/components/course/tools";
import { VerdictBanner } from "@/components/course/verdict-banner";
import { RaceSelectionPanel } from "@/components/race-selection";
import { buildBetRecommendations, buildXTickets, raceToContext } from "@/lib/bet-recommendations";
import { buildCourseViewModel } from "@/lib/course-view-model";
import { formatMeters, properName } from "@/lib/format";
import type { MarketHistory } from "@/lib/market";
import { buildPostRaceAnalysis } from "@/lib/post-race-analysis";
import type { SignalRecord } from "@/lib/race-repository";
import { buildSelection } from "@/lib/selection";
import type { RaceAnalysis } from "@/lib/types";

/**
 * PAGE COURSE — le verdict d'abord, le détail à la demande.
 *
 *   1. en-tête et âge des cotes (« Analyser maintenant » dans les 10 dernières minutes) ;
 *   2. verdict en une phrase et tuiles de profils, avec le ROI historique de chaque signal ;
 *   3. notre sélection et un ticket par stratégie ;
 *   4. le tableau unique (Classement IA, MVT, Cotes & Marché, Forme) ;
 *   5. la fiche du cheval sélectionné et son marché ;
 *   6. les outils de tickets, repliés.
 *
 * L'ancien composant (1 693 lignes) est découpé sous src/components/course/.
 * Les blocs qui affichaient des valeurs fixes de l'import comme des mesures
 * — « consensus modèle » constant à 68 %, versions de modèles « en attente DB »,
 * radar et nuage tirés du PronoScore — ont été retirés.
 */

type CourseDetailProps = {
  race: RaceAnalysis;
  history?: MarketHistory;
  signals?: SignalRecord[];
};

const EMPTY_HISTORY: MarketHistory = { odds: {}, pools: [] };

export function CourseDetail({ race, history = EMPTY_HISTORY, signals = [] }: CourseDetailProps) {
  const vm = useMemo(() => buildCourseViewModel(race, history), [race, history]);
  const selection = useMemo(() => buildSelection(race.horses), [race.horses]);
  const signalMap = useMemo(() => new Map(signals.map((s) => [s.key, s])), [signals]);
  const ctx = useMemo(() => raceToContext(race), [race]);
  const recommendations = useMemo(() => buildBetRecommendations(race.horses, race.betTypes, ctx), [race.horses, race.betTypes, ctx]);
  const xTickets = useMemo(() => buildXTickets(race.horses, race.betTypes, ctx), [race.horses, race.betTypes, ctx]);
  const postRace = useMemo(() => buildPostRaceAnalysis(race), [race]);

  const [selectedNumber, setSelectedNumber] = useState<number | null>(() => vm.rows[0]?.horse.number ?? null);
  const selectedRow = vm.rows.find((r) => r.horse.number === selectedNumber) ?? vm.rows[0] ?? null;
  const finished = race.horses.some((h) => h.finishPosition != null);

  function select(number: number) {
    setSelectedNumber(number);
    document.getElementById("fiche-cheval")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <main className="min-h-screen bg-bg pb-20" id="contenu-principal">
      <div className="mx-auto max-w-[1520px] px-4 pt-6 sm:px-6 lg:px-8">
        <nav aria-label="Fil d'Ariane" className="mb-4 flex flex-wrap items-center gap-2">
          <Link
            className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-surface px-3.5 py-2 text-sm font-medium text-muted shadow-sm transition hover:border-accent hover:text-accent-text"
            href="/"
          >
            <ArrowLeft size={14} /> Accueil
          </Link>
          <span aria-hidden="true" className="text-muted/40">/</span>
          <span className="text-sm text-muted">R{race.reunionNumber} — {properName(race.racecourse)}</span>
          <span aria-hidden="true" className="text-muted/40">/</span>
          <span className="text-sm font-semibold text-fg">{race.programCode} — {properName(race.name)}</span>
        </nav>

        <header className="overflow-hidden rounded-2xl border border-border bg-surface shadow-sm">
          <div className="border-t-4 border-accent px-5 py-4 sm:px-7">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex flex-wrap items-center gap-2 text-sm text-muted">
                  <span className="font-bold text-fg">{race.discipline}</span>
                  {race.specialty && <><span>·</span><span>{race.specialty}</span></>}
                  <span>·</span><span>{formatMeters(race.distance)}</span>
                  <span>·</span><span>{race.horses.length} partants</span>
                  {race.going && <><span>·</span><span>{race.going}</span></>}
                </div>
                <h1 className="mt-1 font-display text-xl font-bold text-fg sm:text-2xl">
                  {properName(race.racecourse)} — {formatLongDate(race.raceDate)}
                </h1>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <span className="flex items-center gap-2 font-bold text-accent-text">
                  <Clock3 aria-hidden="true" size={18} />
                  Départ {race.startTime}
                  <Countdown relativeDay={race.relativeDay} startTime={race.startTime} />
                </span>
                <ShareButton name={race.name} programCode={race.programCode} />
              </div>
            </div>
            <BetBadges offers={race.betTypes} />
            <LiveStatus
              finished={finished}
              lastObservation={vm.lastObservation}
              raceDate={race.raceDate}
              raceId={race.id}
              startTime={race.startTime}
            />
          </div>
        </header>

        {race.oddsAvailable === false && (
          <div className="mt-4 flex items-start gap-3 rounded-2xl border border-warn/30 bg-warn-lo px-4 py-3 text-sm leading-6 text-warn sm:px-5" role="status">
            <AlertTriangle aria-hidden="true" className="mt-1 shrink-0" size={16} />
            <p>
              <strong className="font-bold">Cotes PMU non encore publiées pour cette course.</strong> Le classement repose
              sur l&apos;IA seule et sera recalculé dès l&apos;ouverture du marché.
            </p>
          </div>
        )}

        <VerdictBanner onSelect={select} selectedNumber={selectedRow?.horse.number ?? null} signals={signalMap} vm={vm} />

        <div className="mt-0 grid gap-x-4 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="min-w-0">
            <RaceSelectionPanel onSelect={select} selectedNumber={selectedRow?.horse.number ?? null} selection={selection} signals={signalMap} />
            <FieldTable onSelect={select} race={race} selectedNumber={selectedRow?.horse.number ?? null} signals={signalMap} vm={vm} />
            <div id="fiche-cheval" className="scroll-mt-4">
              <HorseSheet race={race} row={selectedRow} />
            </div>
            <TicketTools recommendations={recommendations} xTickets={xTickets} />
          </div>

          <aside className="mt-4 grid content-start gap-4" aria-label="Marché et simulation">
            <MarketPanel history={history} row={selectedRow} />
            <SimulationPanel row={selectedRow} />
            <PostRacePanel analysis={postRace} />
          </aside>
        </div>
      </div>
    </main>
  );
}
