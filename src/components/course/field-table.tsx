"use client";

import { Fragment, useState, type KeyboardEvent } from "react";
import { Star } from "lucide-react";
import { useFollowedHorses } from "@/hooks/use-followed-horses";
import type { CourseViewModel } from "@/lib/course-view-model";
import { COMPARE_MAX } from "@/lib/horse-compare";
import type { SignalRecord } from "@/lib/race-repository";
import type { RaceAnalysis } from "@/lib/types";
import { CAPTIONS, COLUMNS, FOOTNOTES, TABS, TAB_LABELS, tabId, type Tab } from "@/components/course/field-columns";
import { STANCE_HINTS, StanceBadge } from "@/components/course/field-cells";
import { ConfrontScatter } from "@/components/course/confront-scatter";
import { ProfileBadge, roiLine } from "@/components/course/shared";
import { Term } from "@/components/course/term";

/**
 * LE TABLEAU — un seul, cinq lectures du même peloton.
 *
 * Les vues gardent l'ordre du classement IA, sauf deux onglets. MVT : le
 * classement du marché, du cheval le plus joué au plus délaissé, avec l'argent
 * (part des mises, variation sur 15 min, accélération sur 5 min). IA × Marché :
 * le nuage des deux avis, puis les chevaux qui comptent, groupés en accord,
 * favoris de l'IA et favoris du marché, avec les signaux d'argent (voir
 * lib/confrontation). Une ligne se sélectionne au clic ou au clavier et pilote
 * la fiche cheval et le panneau marché ; la case de gauche l'ajoute au
 * comparateur. Un non-partant reste visible, barré.
 *
 * Colonnes et notes : field-columns.tsx ; cellules : field-cells.tsx.
 */

/** Signaux du backtest rappelés sous l'onglet IA × Marché. */
const CONFRONT_SIGNALS = ["conf-accord-sg", "conf-ia-sg", "conf-marche-sg", "smart-money-sg"];

export function FieldTable({
  race,
  vm,
  selectedNumber,
  onSelect,
  signals,
  compare,
  onToggleCompare,
}: {
  race: RaceAnalysis;
  vm: CourseViewModel;
  signals?: Map<string, SignalRecord>;
  selectedNumber: number | null;
  onSelect: (number: number) => void;
  compare: number[];
  onToggleCompare: (number: number) => void;
}) {
  const [tab, setTab] = useState<Tab>("Classement IA");
  const { followed } = useFollowedHorses();

  function onTabKey(e: KeyboardEvent) {
    const i = TABS.indexOf(tab);
    const next = e.key === "ArrowRight" ? (i + 1) % TABS.length : e.key === "ArrowLeft" ? (i - 1 + TABS.length) % TABS.length : e.key === "Home" ? 0 : e.key === "End" ? TABS.length - 1 : null;
    if (next === null) return;
    e.preventDefault();
    setTab(TABS[next]);
    document.getElementById(tabId(TABS[next]))?.focus();
  }

  const columns = COLUMNS[tab](race);
  const marketView = tab === "MVT";
  const confrontView = tab === "Confrontation";
  const rows = marketView ? vm.marketRows : confrontView ? vm.confrontRows : vm.rows;
  const mvtSignal = signals?.get("mvt-joue-sg");
  const tracked = CONFRONT_SIGNALS.map((key) => signals?.get(key)).filter((s): s is SignalRecord => !!s && s.bets > 0);
  const compareFull = compare.length >= COMPARE_MAX;
  const span = columns.length + 3;

  return (
    <section className="mt-4 scroll-mt-32 overflow-hidden lg:scroll-mt-20 rounded-2xl border border-border bg-surface shadow-sm" aria-label="Partants" id="partants">
      <div className="flex overflow-x-auto border-b border-border bg-surface-sub kz-scroll" role="tablist" aria-label="Lectures du tableau" onKeyDown={onTabKey}>
        {TABS.map((t) => (
          <button
            key={t}
            id={tabId(t)}
            aria-controls="tableau-partants"
            aria-selected={tab === t}
            className={`relative h-11 shrink-0 px-4 text-sm font-semibold transition sm:flex-1 ${tab === t ? "bg-surface text-fg" : "text-muted hover:text-fg"}`}
            onClick={() => setTab(t)}
            role="tab"
            tabIndex={tab === t ? 0 : -1}
            type="button"
          >
            {TAB_LABELS[t]}
            {tab === t && <span className="absolute inset-x-4 bottom-0 h-0.5 rounded-full bg-accent" />}
          </button>
        ))}
      </div>

      <div id="tableau-partants" role="tabpanel" aria-labelledby={tabId(tab)}>
        {confrontView && <ConfrontScatter onSelect={onSelect} rows={vm.rows} selectedNumber={selectedNumber} />}
        <div className="overflow-x-auto">
          <table className={`w-full border-collapse text-left text-sm ${marketView || confrontView ? "min-w-[900px]" : "min-w-[760px]"}`}>
            <caption className="sr-only">{CAPTIONS[tab]}</caption>
            <thead>
              <tr className="border-b border-border text-[10px] font-bold uppercase tracking-widest text-muted">
                <th scope="col" className="w-9 py-3 pl-3" title={`Comparer jusqu'à ${COMPARE_MAX} chevaux`}>
                  <span className="sr-only">Comparer</span>
                </th>
                <th scope="col" className="w-10 px-3 py-3" title={marketView ? "Rang sur le marché : du plus joué au plus délaissé" : "Rang au classement IA"}>
                  Rg
                </th>
                <th scope="col" className="px-3 py-3">Cheval</th>
                {columns.map((c) => (
                  <th key={c.label} scope="col" className={`px-3 py-3 ${c.align === "right" ? "text-right" : ""}`} title={c.term ? undefined : c.title}>
                    {c.term ? <Term name={c.term}>{c.label}</Term> : c.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {confrontView && rows.length === 0 && (
                <tr>
                  <td colSpan={span} className="px-4 py-6 text-center text-sm text-muted">
                    Pas encore de confrontation : il faut les cotes du marché et l&apos;avis de l&apos;IA.
                  </td>
                </tr>
              )}
              {rows.map((row, index) => {
                const selected = selectedNumber === row.horse.number;
                const position = marketView ? index + 1 : row.rank;
                const groupStart = confrontView && row.stance !== null && row.stance !== rows[index - 1]?.stance;
                const compared = compare.includes(row.horse.number);
                return (
                  <Fragment key={row.horse.id}>
                    {groupStart && (
                      <tr className="bg-surface-sub">
                        <th colSpan={span} scope="colgroup" className="px-3 py-2 text-left">
                          <StanceBadge stance={row.stance!} />
                          <span className="ml-2 text-[11px] font-normal text-muted">{STANCE_HINTS[row.stance!]}</span>
                        </th>
                      </tr>
                    )}
                    <tr
                      className={`cursor-pointer transition hover:bg-accent-lo/60 ${row.nonRunner ? "opacity-60" : ""} ${selected ? "bg-accent-lo" : position <= 3 ? "bg-surface" : "bg-surface-sub/40"}`}
                      onClick={() => onSelect(row.horse.number)}
                    >
                      <td className="py-2.5 pl-3" onClick={(e) => e.stopPropagation()}>
                        <input
                          aria-label={`Comparer le n° ${row.horse.number}, ${row.horse.horse}`}
                          checked={compared}
                          className="size-4 cursor-pointer accent-[var(--accent)] disabled:cursor-not-allowed"
                          disabled={!compared && compareFull}
                          onChange={() => onToggleCompare(row.horse.number)}
                          type="checkbox"
                        />
                      </td>
                      <td className="px-3 py-2.5">
                        <span className={`grid size-7 place-items-center rounded-lg font-mono text-xs font-bold ${position <= 3 ? "bg-accent text-accent-fg" : "bg-surface-sub text-muted"}`}>
                          {position}
                        </span>
                      </td>
                      <th scope="row" className="px-3 py-2.5 font-normal">
                        <div className="flex min-w-[200px] items-center gap-2">
                          {/* Le bouton porte la sélection au clavier et au lecteur
                              d'écran ; la ligne entière reste cliquable à la souris.
                              Un <tr role="button"> effaçait la sémantique du tableau. */}
                          <button
                            aria-label={`Voir la fiche du n° ${row.horse.number}, ${row.horse.horse}${row.nonRunner ? ", non-partant" : ""}`}
                            aria-pressed={selected}
                            className={`flex min-w-0 items-center gap-2 rounded text-left ${row.nonRunner ? "line-through decoration-danger decoration-2" : ""}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              onSelect(row.horse.number);
                            }}
                            type="button"
                          >
                            <span className="font-mono font-bold text-fg">{row.horse.number}</span>
                            <span className="truncate font-semibold text-fg">{row.horse.horse}</span>
                          </button>
                          {row.nonRunner && <span className="shrink-0 rounded-full bg-danger/10 px-2 py-0.5 text-[10px] font-bold text-danger">NP</span>}
                          {row.horse.horseId && followed.has(row.horse.horseId) && (
                            <Star aria-label="Cheval suivi" className="shrink-0 fill-amber-500 text-amber-700 dark:fill-amber-400 dark:text-amber-400" size={13} />
                          )}
                          <ProfileBadge profile={row.profile} />
                        </div>
                      </th>
                      {columns.map((c) => (
                        <td key={c.label} className={`px-3 py-2.5 ${c.align === "right" ? "whitespace-nowrap text-right font-mono" : ""}`}>
                          {c.render(row)}
                        </td>
                      ))}
                    </tr>
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      <p className="border-t border-border px-4 py-3 text-[11px] leading-5 text-muted">
        {FOOTNOTES[tab]}
        {marketView && mvtSignal && mvtSignal.bets > 0 && (
          <>
            {" "}Historique du cheval le plus joué, en simple gagnant :{" "}
            <span className={mvtSignal.roi >= 0 ? "font-bold text-accent-text" : "font-bold text-danger"}>{roiLine(mvtSignal.roi, mvtSignal.bets)}</span>
            {mvtSignal.roi < 0 ? " — suivre l'argent ne suffit pas à battre le prélèvement du PMU." : "."}
          </>
        )}
        {confrontView && tracked.length > 0 && (
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
