"use client";

import { useMemo, useState } from "react";
import { Activity } from "lucide-react";
import type { HorseRow } from "@/lib/course-view-model";
import { formatOdds } from "@/lib/format";
import type { MarketHistory } from "@/lib/market";
import { buildOddsChart, oddsTicks, oddsY } from "@/lib/odds-chart";
import { Card, Eyebrow } from "@/components/course/shared";

/**
 * COTES DE TOUS LES PARTANTS — une courbe par cheval sur le même axe
 * (logarithmique, voir lib/odds-chart). Par défaut, les cinq premiers du
 * classement et le cheval sélectionné ; la légende ajoute ou retire chaque
 * courbe. Le cheval sélectionné est tracé plus épais, par-dessus les autres.
 */

const W = 320;
const H = 210;
const PAD = { l: 32, r: 10, t: 10, b: 20 };
const DEFAULT_SHOWN = 5;

/** Teintes du thème, clair et sombre ; au-delà de huit courbes, elles se répètent. */
const PALETTE = ["var(--accent)", "var(--bet-quarte)", "var(--danger)", "var(--warn)", "var(--disc-plat-fg)", "var(--disc-obst-fg)", "var(--disc-trot-fg)", "var(--cta)"];

const timeFmt = new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Paris" });

export function AllOddsChart({ rows, history, selectedNumber }: { rows: HorseRow[]; history: MarketHistory; selectedNumber: number | null }) {
  const runners = useMemo(() => rows.filter((r) => !r.nonRunner), [rows]);
  const data = useMemo(() => buildOddsChart(history.odds, runners.map((r) => r.horse.number)), [history.odds, runners]);
  const [toggled, setToggled] = useState<Record<number, boolean>>({});

  const colors = new Map(runners.map((r, i) => [r.horse.number, PALETTE[i % PALETTE.length]]));
  const drawable = new Set(data?.series.map((s) => s.number) ?? []);
  const isShown = (n: number) => toggled[n] ?? (n === selectedNumber || runners.findIndex((r) => r.horse.number === n) < DEFAULT_SHOWN);

  return (
    <Card className="p-5">
      <div className="flex items-center gap-2">
        <Activity aria-hidden="true" className="text-accent-text" size={16} />
        <Eyebrow>Cotes de tous les partants</Eyebrow>
      </div>
      {!data ? (
        <p className="mt-2 text-xs text-muted">Pas encore assez de relevés de cote pour tracer le marché de la course.</p>
      ) : (
        <>
          <Chart data={data} colors={colors} isShown={isShown} selectedNumber={selectedNumber} />
          <div aria-label="Courbes affichées" className="mt-2 flex flex-wrap gap-1.5" role="group">
            {runners.filter((r) => drawable.has(r.horse.number)).map((r) => {
              const n = r.horse.number;
              const shown = isShown(n);
              return (
                <button
                  key={r.horse.id}
                  aria-label={`${shown ? "Masquer" : "Afficher"} la cote du n° ${n}, ${r.horse.horse}`}
                  aria-pressed={shown}
                  className={`inline-flex min-h-8 items-center gap-1.5 rounded-lg border px-2 font-mono text-xs font-bold transition ${
                    shown ? "border-border-strong bg-surface text-fg" : "border-border bg-surface-sub text-muted"
                  } ${n === selectedNumber ? "ring-2 ring-accent" : ""}`}
                  onClick={() => setToggled((prev) => ({ ...prev, [n]: !shown }))}
                  type="button"
                >
                  <span aria-hidden="true" className="h-0.5 w-3 rounded-full" style={{ background: shown ? colors.get(n) : "var(--border-strong)" }} />
                  {n}
                </button>
              );
            })}
          </div>
          <p className="mt-2 text-[11px] leading-5 text-muted">
            Échelle logarithmique : passer de 2/1 à 4/1 pèse autant que de 10/1 à 20/1. Une courbe qui descend = cheval joué. Toucher un numéro
            l&apos;ajoute ou le retire ; le cheval sélectionné dans le tableau est tracé en épais.
          </p>
        </>
      )}
    </Card>
  );
}

function Chart({
  data,
  colors,
  isShown,
  selectedNumber,
}: {
  data: NonNullable<ReturnType<typeof buildOddsChart>>;
  colors: Map<number, string>;
  isShown: (n: number) => boolean;
  selectedNumber: number | null;
}) {
  const x = (t: number) => PAD.l + ((t - data.t0) / (data.t1 - data.t0 || 1)) * (W - PAD.l - PAD.r);
  const y = (v: number) => oddsY(v, data.lo, data.hi, PAD.t, H - PAD.b);
  // Le cheval sélectionné en dernier : il passe au-dessus des autres courbes.
  const series = data.series.filter((s) => isShown(s.number)).sort((a, b) => Number(a.number === selectedNumber) - Number(b.number === selectedNumber));
  const label = series.length
    ? `Cotes de ${series.length} chevaux de ${timeFmt.format(new Date(data.t0))} à ${timeFmt.format(new Date(data.t1))}`
    : "Aucune courbe affichée";

  return (
    <svg aria-label={label} className="mt-3 w-full" role="img" viewBox={`0 0 ${W} ${H}`}>
      {oddsTicks(data.lo, data.hi).map((t) => (
        <g key={t}>
          <line stroke="var(--border)" x1={PAD.l} x2={W - PAD.r} y1={y(t)} y2={y(t)} />
          <text fill="var(--muted)" fontSize="9" textAnchor="end" x={PAD.l - 4} y={y(t) + 3}>{formatOdds(t)}</text>
        </g>
      ))}
      {series.map((s) => {
        const selected = s.number === selectedNumber;
        const d = s.points.map((p, i) => `${i === 0 ? "M" : "L"}${x(p.t).toFixed(1)},${y(p.odds).toFixed(1)}`).join(" ");
        const last = s.points.at(-1)!;
        return (
          <g key={s.number} opacity={selectedNumber === null || selected ? 1 : 0.7}>
            <path d={d} fill="none" stroke={colors.get(s.number)} strokeLinecap="round" strokeLinejoin="round" strokeWidth={selected ? 3 : 1.5} />
            <text fill="var(--fg)" fontSize="9" fontWeight={selected ? 700 : 400} x={Math.min(x(last.t) + 2, W - PAD.r - 8)} y={y(last.odds) - 3}>
              {s.number}
            </text>
          </g>
        );
      })}
      <text fill="var(--muted)" fontSize="9" x={PAD.l} y={H - 5}>{timeFmt.format(new Date(data.t0))}</text>
      <text fill="var(--muted)" fontSize="9" textAnchor="end" x={W - PAD.r} y={H - 5}>{timeFmt.format(new Date(data.t1))}</text>
    </svg>
  );
}
