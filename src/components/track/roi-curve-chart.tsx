"use client";

import { useId, useMemo, useState } from "react";
import {
  DEFAULT_SERIES,
  REFERENCE_SERIES,
  chartScale,
  linePath,
  roiPoints,
  seriesTable,
  type SeriesSignal,
} from "@/app/track-record/roi-series";

/**
 * COURBE DE ROI CUMULÉ PAR SIGNAL — SVG en ligne, sans bibliothèque.
 * Sélecteur de signaux (cases à cocher), ligne du zéro, et table de repli
 * accessible (« Voir les données du graphique »).
 */

/** Jetons du thème uniquement ; les pointillés distinguent aussi les références. */
const STROKES = ["var(--accent)", "var(--warn)", "var(--danger)", "var(--cta)", "var(--fg)", "var(--muted)", "var(--border-strong)"];

const BOX = { width: 640, height: 260, left: 48, right: 12, top: 12, bottom: 28 };

const dayFr = (day: string) => new Date(`${day}T12:00:00Z`).toLocaleDateString("fr-FR", { day: "numeric", month: "short", timeZone: "UTC" });
const signed = (v: number) => (Number.isFinite(v) ? `${v > 0 ? "+" : v < 0 ? "−" : ""}${Math.abs(v * 100).toFixed(1).replace(".", ",")} %` : "—");
const nf = new Intl.NumberFormat("fr-FR");
const betLabel = (betType: string) => (betType === "SP" ? "placé" : "gagnant");

export function RoiCurveChart({ signals, period, title }: { signals: SeriesSignal[]; period: { from: string; to: string }; title: string }) {
  const id = useId();
  const usable = useMemo(() => signals.filter((s) => roiPoints(s.daily).length >= 2), [signals]);
  const [selected, setSelected] = useState<string[]>(() => {
    const defaults = usable.filter((s) => DEFAULT_SERIES.includes(s.key)).map((s) => s.key);
    return defaults.length > 0 ? defaults : usable.slice(0, 3).map((s) => s.key);
  });

  const colorOf = useMemo(() => new Map(usable.map((s, i) => [s.key, STROKES[i % STROKES.length]])), [usable]);
  const shown = usable.filter((s) => selected.includes(s.key)).map((s) => ({ signal: s, points: roiPoints(s.daily) }));
  const scale = chartScale(shown.map((s) => s.points), BOX);
  const table = seriesTable(shown.map((s) => ({ key: s.signal.key, points: s.points })));
  const toggle = (key: string) => setSelected((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));

  if (usable.length === 0) return null;
  const titleId = `${id}-titre`;
  const descId = `${id}-desc`;

  return (
    <div>
      <fieldset className="mb-4">
        <legend className="mb-2 text-[10px] font-bold uppercase tracking-widest text-muted">Signaux affichés</legend>
        <div className="flex flex-wrap gap-2">
          {usable.map((s) => {
            const on = selected.includes(s.key);
            return (
              <label
                key={s.key}
                className={`inline-flex cursor-pointer items-center gap-2 rounded-full border px-3 py-1 text-xs transition has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-focus ${on ? "border-accent bg-accent-lo text-fg" : "border-border bg-surface text-muted hover:border-border-strong"}`}
              >
                <input checked={on} className="sr-only" onChange={() => toggle(s.key)} type="checkbox" />
                <svg aria-hidden="true" height="8" width="18">
                  <line stroke={colorOf.get(s.key)} strokeDasharray={REFERENCE_SERIES.has(s.key) ? "4 3" : undefined} strokeWidth="2.5" x1="0" x2="18" y1="4" y2="4" />
                </svg>
                {s.label} ({betLabel(s.betType)})
              </label>
            );
          })}
        </div>
      </fieldset>

      {scale && shown.length > 0 ? (
        <svg aria-describedby={descId} aria-labelledby={titleId} className="w-full" role="img" viewBox={`0 0 ${BOX.width} ${BOX.height}`}>
          <title id={titleId}>{title}</title>
          <desc id={descId}>
            ROI cumulé, net du prélèvement, du {dayFr(period.from)} au {dayFr(period.to)}.{" "}
            {shown.map((s) => `${s.signal.label} (${betLabel(s.signal.betType)}) : ${signed(s.signal.roi)} sur ${nf.format(s.signal.bets)} paris`).join(" ; ")}.
          </desc>
          {scale.ticks.map((v) => (
            <g key={v}>
              <line stroke={v === 0 ? "var(--fg)" : "var(--border)"} strokeDasharray={v === 0 ? undefined : "2 3"} strokeWidth={v === 0 ? 1.2 : 1} x1={BOX.left} x2={BOX.width - BOX.right} y1={scale.y(v)} y2={scale.y(v)} />
              <text fill="var(--muted)" fontSize="10" textAnchor="end" x={BOX.left - 6} y={scale.y(v) + 3}>{signed(v)}</text>
            </g>
          ))}
          {shown.map((s) => (
            <path
              key={s.signal.key}
              d={linePath(s.points, scale)}
              fill="none"
              stroke={colorOf.get(s.signal.key)}
              strokeDasharray={REFERENCE_SERIES.has(s.signal.key) ? "5 4" : undefined}
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
            />
          ))}
          <text fill="var(--muted)" fontSize="10" x={BOX.left} y={BOX.height - 8}>{dayFr(new Date(scale.t0).toISOString().slice(0, 10))}</text>
          <text fill="var(--muted)" fontSize="10" textAnchor="end" x={BOX.width - BOX.right} y={BOX.height - 8}>{dayFr(new Date(scale.t1).toISOString().slice(0, 10))}</text>
        </svg>
      ) : (
        <p className="rounded-xl border border-border bg-surface-sub p-4 text-sm text-muted">Cochez au moins un signal pour afficher sa courbe.</p>
      )}

      <ul className="mt-3 grid gap-1 text-xs text-muted sm:grid-cols-2">
        {shown.map((s) => (
          <li key={s.signal.key}>
            <span className="font-semibold text-fg">{s.signal.label} ({betLabel(s.signal.betType)})</span> : {signed(s.signal.roi)} sur{" "}
            {nf.format(s.signal.bets)} paris, marge d&apos;erreur à 90 % de {signed(s.signal.roiLow)} à {signed(s.signal.roiHigh)}.
          </li>
        ))}
      </ul>

      {shown.length > 0 && (
        <details className="mt-3 text-xs">
          <summary className="cursor-pointer font-semibold text-accent-text">Voir les données du graphique</summary>
          <div className="mt-2 max-h-80 overflow-auto">
            <table className="w-full min-w-[480px] text-left">
              <caption className="sr-only">{title} : ROI cumulé et mises cumulées par jour</caption>
              <thead className="sticky top-0 bg-surface">
                <tr className="border-b border-border text-[10px] font-bold uppercase tracking-widest text-muted">
                  <th className="py-1.5 pr-3" scope="col">Jour</th>
                  {shown.map((s) => (
                    <th key={s.signal.key} className="py-1.5 pr-3 text-right" scope="col">{s.signal.label} ({betLabel(s.signal.betType)})</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border font-mono">
                {table.map((row) => (
                  <tr key={row.day}>
                    <th className="py-1 pr-3 font-normal text-muted" scope="row">{dayFr(row.day)}</th>
                    {row.values.map((p, i) => (
                      <td key={shown[i].signal.key} className="py-1 pr-3 text-right">
                        {p ? `${signed(p.roi)} (${nf.format(p.staked)} paris)` : "—"}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}
    </div>
  );
}
