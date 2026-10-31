"use client";

import { useState } from "react";
import { Newspaper } from "lucide-react";
import type { CourseViewModel, HorseRow } from "@/lib/course-view-model";
import { formatOdds } from "@/lib/format";
import {
  PRESS_CATEGORY_HINTS,
  PRESS_CATEGORY_LABELS,
  PRESS_SOURCE_ORDER,
  agreementLabel,
  sourceLabel,
  type PressCategory,
} from "@/lib/press-consensus";
import type { SignalRecord } from "@/lib/race-repository";
import { roiLine } from "@/components/course/shared";
import { Term } from "@/components/course/term";

/**
 * PRONOSTIQUEURS × MARCHÉ — les sélections des sites de pronostics comparées
 * à ce que joue le public (lib/press-consensus). Trois catégories en tête,
 * puis le détail de tous les partants. Seuls les numéros et leur ordre sont
 * repris des sites, avec leur nom et un lien : jamais leurs textes.
 */

const CATEGORIES: PressCategory[] = ["consensus", "sites-sans-marche", "marche-sans-sites"];

const CATEGORY_STYLES: Record<PressCategory, string> = {
  consensus: "border-emerald-500/40 bg-emerald-50 dark:bg-emerald-950/40",
  "sites-sans-marche": "border-amber-500/40 bg-amber-50 dark:bg-amber-950/40",
  "marche-sans-sites": "border-sky-500/40 bg-sky-50 dark:bg-sky-950/40",
};

const CATEGORY_BADGES: Record<PressCategory, string> = {
  consensus: "bg-emerald-600 text-white dark:bg-emerald-500 dark:text-emerald-950",
  "sites-sans-marche": "bg-amber-500 text-amber-950",
  "marche-sans-sites": "bg-sky-600 text-white dark:bg-sky-500 dark:text-sky-950",
};

const CATEGORY_SHORT: Record<PressCategory, string> = {
  consensus: "Consensus",
  "sites-sans-marche": "Alerte : sites sans marché",
  "marche-sans-sites": "Alerte : marché sans sites",
};

/** Signaux du backtest rappelés sous le panneau. */
export const PRESS_SIGNALS = ["presse-consensus-sg", "presse-sites-sans-marche-sg", "presse-marche-sans-sites-sg"];

export function PressPanel({
  vm,
  signals,
  onSelect,
}: {
  vm: CourseViewModel;
  signals: Map<string, SignalRecord>;
  onSelect: (number: number) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const { selections, agreement } = vm.press;
  const sources = [...selections].sort((a, b) => PRESS_SOURCE_ORDER.indexOf(a.source) - PRESS_SOURCE_ORDER.indexOf(b.source));
  const rows = vm.rows.filter((r) => r.press && !r.nonRunner);
  const tracked = PRESS_SIGNALS.map((key) => signals.get(key)).filter((s): s is SignalRecord => !!s && s.bets > 0);
  const fetched = sources.map((s) => s.fetchedAt).filter((t): t is string => !!t).sort().at(-1);

  return (
    <section aria-labelledby="titre-presse" className="mt-4 overflow-hidden rounded-2xl border border-border bg-surface shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-surface-sub px-4 py-3 sm:px-5">
        <div className="flex items-center gap-2">
          <Newspaper aria-hidden="true" className="text-accent-text" size={16} />
          <h2 className="text-sm font-bold text-fg" id="titre-presse">
            Pronostiqueurs × Marché
          </h2>
        </div>
        {sources.length > 0 && (
          <p className="text-[11px] text-muted">
            {sources.length} source{sources.length > 1 ? "s" : ""} · accord entre sites : <strong className="text-fg">{agreementLabel(agreement)}</strong>
          </p>
        )}
      </div>

      {sources.length === 0 ? (
        <p className="px-4 py-5 text-sm text-muted sm:px-5">
          Les sélections des sites de pronostics ne sont pas encore disponibles pour cette course. Elles sont relevées le matin et
          avant le départ.
        </p>
      ) : (
        <>
          <div className="grid gap-3 p-3 sm:grid-cols-2 sm:p-4 2xl:grid-cols-3">
            {CATEGORIES.map((category) => (
              <CategoryCard key={category} category={category} onSelect={onSelect} rows={rows.filter((r) => r.press!.category === category)} />
            ))}
          </div>

          <div className="border-t border-border px-4 py-3 sm:px-5">
            <button
              aria-controls="presse-detail"
              aria-expanded={expanded}
              className="text-sm font-semibold text-accent-text hover:underline"
              onClick={() => setExpanded((v) => !v)}
              type="button"
            >
              {expanded ? "Masquer le détail par cheval" : "Voir le détail par cheval"}
            </button>
          </div>
          {expanded && <PressTable id="presse-detail" onSelect={onSelect} rows={rows} sources={sources.map((s) => s.source)} />}
        </>
      )}

      <p className="border-t border-border px-4 py-3 text-[11px] leading-5 text-muted sm:px-5">
        {sources.length > 0 && (
          <>
            Sources :{" "}
            {sources.map((s, i) => (
              <span key={s.source}>
                {i > 0 && ", "}
                {s.url ? (
                  <a className="underline-offset-2 hover:underline" href={s.url} rel="noopener noreferrer" target="_blank">
                    {sourceLabel(s.source)}
                  </a>
                ) : (
                  sourceLabel(s.source)
                )}
              </span>
            ))}
            {fetched && <> — sélections relevées à {new Date(fetched).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Paris" })}</>}
            . Seuls l&apos;ordre et les numéros sont repris, avec l&apos;accord des sites.{" "}
          </>
        )}
        <Term name="Pronostiqueurs × Marché">Règles</Term> : consensus si au moins 60 % des sites citent le cheval et que le marché le
        place dans ses 3 premiers ; alerte si les sites le citent mais que le marché le place au-delà du 5e rang, ou si le marché le place
        dans ses 3 premiers alors qu&apos;au plus 20 % des sites le citent.
        {tracked.length > 0 && (
          <>
            {" "}Historique en simple gagnant :{" "}
            {tracked.map((s, i) => (
              <span key={s.key}>
                {i > 0 && " · "}
                {s.label} <span className={s.roi >= 0 ? "font-bold text-accent-text" : "font-bold text-danger"}>{roiLine(s.roi, s.bets)}</span>
              </span>
            ))}
            .
          </>
        )}
      </p>
    </section>
  );
}

function CategoryCard({ category, rows, onSelect }: { category: PressCategory; rows: HorseRow[]; onSelect: (n: number) => void }) {
  return (
    <div className={`rounded-xl border p-3 ${CATEGORY_STYLES[category]}`}>
      <h3 className="text-xs font-bold text-fg">{PRESS_CATEGORY_LABELS[category]}</h3>
      <p className="mt-0.5 text-[11px] text-muted">{PRESS_CATEGORY_HINTS[category]}</p>
      {rows.length === 0 ? (
        <p className="mt-2 text-xs text-muted">Aucun cheval.</p>
      ) : (
        <ul className="mt-2 grid gap-1.5">
          {rows.map((r) => (
            <li key={r.horse.id}>
              <button className="flex w-full flex-wrap items-baseline justify-between gap-x-2 text-left text-sm hover:underline" onClick={() => onSelect(r.horse.number)} type="button">
                <span className="min-w-0 font-semibold text-fg">
                  <span className="font-mono">{r.horse.number}</span> {r.horse.horse}
                </span>
                <span className="shrink-0 font-mono text-[11px] text-muted">
                  {r.press!.citations.length}/{r.press!.sources} sites · marché {r.press!.marketRank ?? "—"}e
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function PressTable({ id, rows, sources, onSelect }: { id: string; rows: HorseRow[]; sources: string[]; onSelect: (n: number) => void }) {
  const sorted = [...rows].sort((a, b) => b.press!.sitesScore - a.press!.sitesScore || (a.press!.marketRank ?? 99) - (b.press!.marketRank ?? 99));
  return (
    <div className="overflow-x-auto border-t border-border" id={id}>
      <table className="w-full min-w-[720px] border-collapse text-left text-sm">
        <caption className="sr-only">Sélections des sites de pronostics et soutien du marché, par cheval</caption>
        <thead>
          <tr className="border-b border-border text-[10px] font-bold uppercase tracking-widest text-muted">
            <th className="px-3 py-2.5" scope="col">Cheval</th>
            <th className="px-3 py-2.5 text-right" scope="col">Sites</th>
            {sources.map((s) => (
              <th key={s} className="px-2 py-2.5 text-center" scope="col">
                {sourceLabel(s)}
              </th>
            ))}
            <th className="px-3 py-2.5 text-right" scope="col">Marché</th>
            <th className="px-3 py-2.5" scope="col">Lecture</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {sorted.map((r) => {
            const p = r.press!;
            return (
              <tr key={r.horse.id} className="hover:bg-accent-lo/60">
                <th className="px-3 py-2 font-normal" scope="row">
                  <button className="text-left hover:underline" onClick={() => onSelect(r.horse.number)} type="button">
                    <span className="font-mono font-bold text-fg">{r.horse.number}</span> <span className="font-semibold text-fg">{r.horse.horse}</span>
                  </button>
                </th>
                <td className="whitespace-nowrap px-3 py-2 text-right font-mono">
                  {p.citations.length}/{p.sources}
                  <span className="ml-1 text-[10px] text-muted">({Math.round(p.share * 100)} %)</span>
                </td>
                {sources.map((s) => {
                  const c = p.citations.find((x) => x.source === s);
                  return (
                    <td key={s} className="px-2 py-2 text-center font-mono text-xs">
                      {c ? <span className={c.rank <= 3 ? "font-bold text-fg" : "text-muted"}>{c.rank}</span> : <span className="text-muted">—</span>}
                    </td>
                  );
                })}
                <td className="whitespace-nowrap px-3 py-2 text-right font-mono text-xs">
                  {p.marketRank ? `${p.marketRank}e` : "—"} <span className="text-muted">· {formatOdds(r.horse.odds, 1)}</span>
                </td>
                <td className="px-3 py-2">
                  {p.category ? (
                    <span className={`inline-flex whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${CATEGORY_BADGES[p.category]}`}>
                      {CATEGORY_SHORT[p.category]}
                    </span>
                  ) : (
                    <span className="text-muted">—</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
