"use client";

import type { ReactNode } from "react";
import { GitCompare, X } from "lucide-react";
import type { HorseRow } from "@/lib/course-view-model";
import { formatOdds } from "@/lib/format";
import { COMPARE_MAX } from "@/lib/horse-compare";
import type { RaceAnalysis } from "@/lib/types";
import { FlowCell, MoveCell, gapClass, rate } from "@/components/course/field-cells";
import { MusicSparkline } from "@/components/course/music-sparkline";
import { Card, Eyebrow, ProfileBadge, pct, signedPts } from "@/components/course/shared";
import { Term } from "@/components/course/term";

/**
 * COMPARATEUR — deux ou trois chevaux côte à côte, sur les mêmes lignes que
 * le tableau. Rien n'est recalculé : chaque cellule lit la ligne du modèle de
 * vue. La meilleure valeur d'une ligne chiffrée est mise en gras.
 */

type Metric = { label: ReactNode; key: string; value?: (r: HorseRow) => number | null; render: (r: HorseRow) => ReactNode };

function metrics(race: RaceAnalysis): Metric[] {
  return [
    { key: "ai", label: "IA (sans cote)", value: (r) => r.ai, render: (r) => pct(r.ai, 1) },
    { key: "market", label: "Marché", value: (r) => r.market, render: (r) => pct(r.market, 1) },
    { key: "gap", label: "Écart IA − marché", render: (r) => <span className={gapClass(r.gap)}>{signedPts(r.gap)}</span> },
    { key: "win", label: "Retenue", value: (r) => r.horse.winProbability, render: (r) => pct(r.horse.winProbability, 1) },
    { key: "top3", label: <Term name="Top 3">Top 3</Term>, value: (r) => r.horse.top3Probability, render: (r) => pct(r.horse.top3Probability) },
    { key: "odds", label: "Cote", render: (r) => formatOdds(r.horse.odds, 1) },
    { key: "mvt", label: <Term name="MVT">MVT</Term>, render: (r) => <MoveCell row={r} /> },
    { key: "flow", label: "Argent 15 min", render: (r) => <FlowCell row={r} /> },
    { key: "music", label: "Musique", render: (r) => <MusicSparkline music={r.horse.music} /> },
    { key: "jockey", label: race.discipline === "Trot" ? "Driver" : "Jockey", render: (r) => <span className="text-xs">{r.horse.jockey} · {rate(r.horse.jockeyWins, r.horse.jockeyRuns)}</span> },
    { key: "trainer", label: "Entraîneur", render: (r) => <span className="text-xs">{r.horse.trainer} · {rate(r.horse.trainerWins, r.horse.trainerRuns)}</span> },
  ];
}

export function HorseCompare({
  race,
  rows,
  compare,
  onRemove,
  onClear,
}: {
  race: RaceAnalysis;
  rows: HorseRow[];
  compare: number[];
  onRemove: (number: number) => void;
  onClear: () => void;
}) {
  const picked = compare.map((n) => rows.find((r) => r.horse.number === n)).filter((r): r is HorseRow => r !== undefined);
  if (picked.length === 0) return null;

  return (
    <Card className="mt-4 scroll-mt-32 p-5 lg:scroll-mt-20" >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <GitCompare aria-hidden="true" className="text-accent-text" size={16} />
          <Eyebrow>Comparateur · {picked.length}/{COMPARE_MAX}</Eyebrow>
        </div>
        <button className="min-h-8 rounded-lg px-2 text-xs font-semibold text-muted transition hover:text-fg" onClick={onClear} type="button">
          Tout retirer
        </button>
      </div>

      {picked.length < 2 ? (
        <p className="mt-3 text-sm text-muted">
          Cochez un deuxième cheval dans le tableau, ou depuis sa fiche, pour les comparer côte à côte.
        </p>
      ) : (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[440px] border-collapse text-left text-sm">
            <caption className="sr-only">Comparaison de {picked.length} chevaux</caption>
            <thead>
              <tr className="border-b border-border">
                <th className="w-32 py-2 pr-3 text-[10px] font-bold uppercase tracking-widest text-muted" scope="col">
                  <span className="sr-only">Mesure</span>
                </th>
                {picked.map((r) => (
                  <th key={r.horse.id} className="px-2 py-2 align-top" scope="col">
                    <div className="flex items-start justify-between gap-1">
                      <span className="min-w-0">
                        <span className="font-mono font-bold text-fg">{r.horse.number}</span>{" "}
                        <span className="font-semibold text-fg">{r.horse.horse}</span>
                      </span>
                      <button
                        aria-label={`Retirer le n° ${r.horse.number} du comparateur`}
                        className="grid size-6 shrink-0 place-items-center rounded text-muted hover:text-fg"
                        onClick={() => onRemove(r.horse.number)}
                        type="button"
                      >
                        <X aria-hidden="true" size={13} />
                      </button>
                    </div>
                    <ProfileBadge className="mt-1" profile={r.profile} />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {metrics(race).map((m) => {
                const values = m.value ? picked.map((r) => m.value!(r)) : [];
                const finite = values.filter((v): v is number => v !== null && Number.isFinite(v));
                const best = finite.length > 1 ? Math.max(...finite) : null;
                return (
                  <tr key={m.key}>
                    <th className="py-2 pr-3 text-xs font-semibold text-muted" scope="row">{m.label}</th>
                    {picked.map((r, i) => (
                      <td key={r.horse.id} className={`px-2 py-2 font-mono text-fg ${best !== null && values[i] === best ? "font-bold text-accent-text" : ""}`}>
                        {m.render(r)}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
