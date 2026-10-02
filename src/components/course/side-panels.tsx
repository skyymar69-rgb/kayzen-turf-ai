"use client";

import { useState } from "react";
import { Gauge, Sparkles } from "lucide-react";
import { simulateBet } from "@/lib/betting-engine";
import { formatOdds, hasOdds } from "@/lib/format";
import type { PostRaceAnalysis } from "@/lib/types";
import type { HorseRow } from "@/lib/course-view-model";
import { Card, Stat } from "@/components/course/shared";

/** Simulation d'une mise sur le cheval sélectionné. */
export function SimulationPanel({ row }: { row: HorseRow | null }) {
  const [stake, setStake] = useState(10);
  if (!row) return null;
  const horse = row.horse;
  const odds = hasOdds(horse.odds) ? horse.odds : hasOdds(horse.fairOdds) ? horse.fairOdds : 5;
  const simulation = simulateBet(stake, odds, horse.winProbability, 500, 0);

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
          min={1}
          onChange={(e) => setStake(Math.max(1, Number(e.target.value) || 1))}
          type="number"
          value={stake}
        />
      </label>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <Stat label="Espérance" value={`${simulation.expectedValue} €`} />
        <Stat label="Mise de Kelly" value={`${simulation.kellyStake} €`} />
        <Stat label="Edge" value={`${simulation.marketEdge} %`} />
        <Stat label="Lecture" value={simulation.recommendation} accent={simulation.marketEdge > 0} />
      </div>
      <p className="mt-3 text-[11px] leading-5 text-muted">
        {hasOdds(horse.odds) ? `Calcul à la cote actuelle (${formatOdds(horse.odds)}), qui bougera jusqu'au départ.` : "Cote PMU non publiée : calcul sur la cote juste du modèle."}{" "}
        Une espérance négative est la norme : le PMU prélève environ 15 % des enjeux du simple gagnant.
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
