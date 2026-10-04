"use client";

import type { KeyboardEvent } from "react";
import { ACCORD_MAX_GAP_PTS, STANCE_LABELS, STANCE_ORDER } from "@/lib/confrontation";
import type { HorseRow } from "@/lib/course-view-model";
import { STANCE_DOT_STYLES } from "@/components/course/field-cells";
import { pct } from "@/components/course/shared";

/**
 * NUAGE IA × MARCHÉ — chaque cheval placé selon l'avis de l'IA (horizontal)
 * et celui du marché (vertical). Sur la diagonale, les deux avis sont égaux ;
 * sous elle, l'IA l'estime plus que le marché. La bande claire couvre l'écart
 * de ±ACCORD_MAX_GAP_PTS points de l'accord. Un point se sélectionne au clic
 * ou au clavier, comme une ligne du tableau.
 */

const W = 320;
const H = 260;
const PAD = { l: 34, r: 12, t: 12, b: 32 };

export function ConfrontScatter({ rows, selectedNumber, onSelect }: { rows: HorseRow[]; selectedNumber: number | null; onSelect: (n: number) => void }) {
  const points = rows.filter((r) => r.ai !== null && r.market !== null && !r.nonRunner);
  if (points.length < 2) return null;

  const max = Math.max(10, Math.ceil(Math.max(...points.flatMap((r) => [r.ai!, r.market!])) / 5) * 5);
  const x = (v: number) => PAD.l + (v / max) * (W - PAD.l - PAD.r);
  const y = (v: number) => H - PAD.b - (v / max) * (H - PAD.t - PAD.b);
  const g = ACCORD_MAX_GAP_PTS;
  const band = `${x(0)},${y(g)} ${x(max - g)},${y(max)} ${x(max)},${y(max)} ${x(max)},${y(max - g)} ${x(g)},${y(0)} ${x(0)},${y(0)}`;
  const ticks = [0, max / 2, max];

  function onKey(e: KeyboardEvent, n: number) {
    if (e.key !== "Enter" && e.key !== " ") return;
    e.preventDefault();
    onSelect(n);
  }

  return (
    <figure className="border-b border-border px-4 py-4">
      <svg aria-label="Nuage IA contre marché : un point par cheval" className="mx-auto w-full max-w-md" role="group" viewBox={`0 0 ${W} ${H}`}>
        <polygon fill="var(--surface-sub)" points={band} />
        {ticks.map((t) => (
          <g key={t}>
            <line stroke="var(--border)" x1={x(0)} x2={x(max)} y1={y(t)} y2={y(t)} />
            <text fill="var(--muted)" fontSize="9" textAnchor="end" x={PAD.l - 4} y={y(t) + 3}>{Math.round(t)}</text>
            <text fill="var(--muted)" fontSize="9" textAnchor="middle" x={x(t)} y={H - PAD.b + 12}>{Math.round(t)}</text>
          </g>
        ))}
        <line stroke="var(--border-strong)" strokeDasharray="4 3" x1={x(0)} x2={x(max)} y1={y(0)} y2={y(max)} />
        <text fill="var(--muted)" fontSize="10" textAnchor="middle" x={(x(0) + x(max)) / 2} y={H - 4}>IA, sans cote (%)</text>
        <text fill="var(--muted)" fontSize="10" textAnchor="middle" transform={`translate(10 ${(y(0) + y(max)) / 2}) rotate(-90)`}>Marché (%)</text>
        {points.map((r) => {
          const selected = r.horse.number === selectedNumber;
          const cls = r.stance ? STANCE_DOT_STYLES[r.stance] : "fill-border-strong";
          return (
            <g
              key={r.horse.id}
              aria-label={`N° ${r.horse.number} ${r.horse.horse} : IA ${pct(r.ai, 1)}, marché ${pct(r.market, 1)}${r.stance ? `, ${STANCE_LABELS[r.stance]}` : ""}`}
              aria-pressed={selected}
              className="cursor-pointer outline-none [&:focus-visible>circle]:stroke-[var(--focus)]"
              onClick={() => onSelect(r.horse.number)}
              onKeyDown={(e) => onKey(e, r.horse.number)}
              role="button"
              tabIndex={0}
            >
              <circle className={cls} cx={x(r.ai!)} cy={y(r.market!)} r={selected ? 11 : 9} stroke={selected ? "var(--fg)" : "var(--surface)"} strokeWidth={selected ? 2.5 : 1.5} />
              <text className="pointer-events-none fill-white font-mono dark:fill-bg" fontSize="9" fontWeight="700" textAnchor="middle" x={x(r.ai!)} y={y(r.market!) + 3}>
                {r.horse.number}
              </text>
            </g>
          );
        })}
      </svg>
      <figcaption className="mt-2 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-[11px] text-muted">
        {STANCE_ORDER.map((s) => (
          <span key={s} className="inline-flex items-center gap-1.5">
            <svg aria-hidden="true" height="10" width="10"><circle className={STANCE_DOT_STYLES[s]} cx="5" cy="5" r="5" /></svg>
            {STANCE_LABELS[s]}
          </span>
        ))}
        <span className="inline-flex items-center gap-1.5">
          <svg aria-hidden="true" height="10" width="10"><circle className="fill-border-strong" cx="5" cy="5" r="5" /></svg>
          Non classé
        </span>
        <span>Diagonale : avis égaux · sous elle, l&apos;IA l&apos;estime plus que le marché.</span>
      </figcaption>
    </figure>
  );
}
