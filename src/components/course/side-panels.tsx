"use client";

import { useEffect, useState } from "react";
import { Gauge, Sparkles } from "lucide-react";
import { fractionalKellyStake, simulateBet } from "@/lib/betting-engine";
import { formatEuros, formatOdds, formatPct, hasOdds } from "@/lib/format";
import { minutesToStart } from "@/lib/race-status";
import type { PostRaceAnalysis, RaceAnalysis } from "@/lib/types";
import type { HorseRow } from "@/lib/course-view-model";
import { expectedFinalOdds } from "@/lib/value-signal";
import { Card, Stat } from "@/components/course/shared";

/** Minutes avant le départ, relues toutes les 30 s ; `null` au premier rendu (serveur) et si l'heure est illisible. */
function useMinutesToStart(race: Pick<RaceAnalysis, "raceDate" | "startTime">): number | null {
  const [minutes, setMinutes] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => setMinutes(minutesToStart(race));
    tick();
    const id = window.setInterval(tick, 30_000);
    return () => window.clearInterval(id);
  }, [race]);
  return minutes;
}

/**
 * Simulation THÉORIQUE d'une mise sur le cheval sélectionné.
 *
 * Pas de cote publiée → pas de simulation : l'ancienne version inventait une
 * cote (la cote juste, ou 5 par défaut), ce qui fabriquait une espérance. Le
 * calcul se fait à la cote FINALE attendue, et la mise de Kelly n'apparaît
 * que si l'espérance y est positive. Pas de bankroll ni de drawdown inventés.
 */
export function SimulationPanel({ row, race }: { row: HorseRow | null; race: Pick<RaceAnalysis, "raceDate" | "startTime"> }) {
  // Saisie gardée en texte : forcer un nombre à chaque frappe empêchait de
  // vider le champ (effacer « 10 » puis taper « 25 » donnait « 125 »).
  const [stakeInput, setStakeInput] = useState("10");
  const minutes = useMinutesToStart(race);
  if (!row) return null;
  const horse = row.horse;

  if (!hasOdds(horse.odds)) {
    return (
      <Card className="p-5">
        <div className="mb-3 flex items-center gap-2">
          <Gauge aria-hidden="true" className="text-accent-text" size={16} />
          <h2 className="font-display text-base font-bold text-fg">Simuler une mise · n° {horse.number}</h2>
        </div>
        <p className="text-sm leading-6 text-muted">
          Cote PMU non publiée : pas de simulation. Une espérance de gain se calcule sur le prix réellement payé, et ce prix n&apos;existe pas encore.
        </p>
      </Card>
    );
  }

  const stake = Math.max(1, Math.min(10_000, Number(stakeInput.replace(",", ".")) || 1));
  const simulation = simulateBet(stake, horse.odds, horse.winProbability, 1, 0, minutes);
  const finalOdds = expectedFinalOdds(horse.odds, minutes, horse.winProbability);
  const positive = simulation.expectedValue > 0;
  // Bankroll de 1 : la mise de Kelly est directement la part du capital.
  const kellyShare = fractionalKellyStake({ bankroll: 1, decimalOdds: finalOdds, winProbability: horse.winProbability }).fraction;

  return (
    <Card className="p-5">
      <div className="mb-4 flex items-center gap-2">
        <Gauge aria-hidden="true" className="text-accent-text" size={16} />
        <h2 className="font-display text-base font-bold text-fg">Simuler une mise · n° {horse.number}</h2>
      </div>
      <label className="flex flex-col gap-1.5 text-xs font-bold text-muted">
        Mise (€)
        <input
          className="h-10 w-full rounded-xl border border-border bg-surface px-3 text-sm text-fg outline-none"
          inputMode="decimal"
          min={1}
          onChange={(e) => setStakeInput(e.target.value)}
          type="number"
          value={stakeInput}
        />
      </label>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <Stat label="Espérance théorique" value={formatEuros(simulation.expectedValue)} />
        <Stat label="Cote finale attendue" value={formatOdds(finalOdds)} />
        <Stat label="Espérance (%)" value={formatPct(simulation.marketEdge, 1, true)} />
        <Stat label="Lecture" value={simulation.recommendation} accent={positive} />
      </div>
      {positive && (
        <p className="mt-2 rounded-lg bg-accent-lo px-3 py-2 text-[11px] leading-5 text-accent-text">
          Théorique : un quart de Kelly placerait {formatPct(kellyShare * 100, 1)} de votre capital de jeu — à condition que nos probabilités soient justes, ce que rien ne garantit.
        </p>
      )}
      <p className="mt-3 text-[11px] leading-5 text-muted">
        Calcul sur la cote finale attendue ({formatOdds(finalOdds)}), pas sur la cote affichée ({formatOdds(horse.odds)}) : loin du départ, le marché rattrape l&apos;essentiel des écarts.{" "}
        Une espérance négative est la norme : le PMU prélève environ 15 % des enjeux du simple gagnant, et aucune rentabilité de nos probabilités n&apos;est établie.
      </p>
    </Card>
  );
}

/** Prédiction contre arrivée officielle. */
export function PostRacePanel({ analysis }: { analysis: PostRaceAnalysis }) {
  const partial = analysis.actualArrival.length > 0 && analysis.actualArrival.length < 5;
  return (
    <Card className="p-5">
      <div className="mb-4 flex items-center gap-2">
        <Sparkles aria-hidden="true" className="text-accent-text" size={16} />
        <h2 className="font-display text-base font-bold text-fg">Après la course</h2>
      </div>
      <div className="rounded-xl border border-border bg-surface-sub p-4">
        <div className="flex items-center justify-between gap-3">
          <p className="font-semibold text-fg">{analysis.verdict}</p>
          <span className="font-mono text-sm text-accent-text">{analysis.status === "complete" ? `${analysis.metrics.top3Hits}/3 au Top 3` : "En attente"}</span>
        </div>
        <p className="mt-2 text-sm leading-5 text-muted">{analysis.summary}</p>
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <Stat label="Notre ordre" value={analysis.predictedArrival.join("–") || "—"} />
        <Stat label={partial ? `Arrivée (${analysis.actualArrival.length} places)` : "Arrivée"} value={analysis.actualArrival.join("–") || "—"} />
      </div>
      {partial && (
        <p className="mt-2 text-xs leading-5 text-muted">
          Le PMU n&apos;a publié que {analysis.actualArrival.length} places : elles seront complétées au prochain import.
        </p>
      )}
    </Card>
  );
}
