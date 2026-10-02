"use client";

import { useState, type KeyboardEvent, type ReactNode } from "react";
import { ArrowDownRight, ArrowRight, ArrowUpRight } from "lucide-react";
import type { CourseViewModel, HorseRow } from "@/lib/course-view-model";
import { formatOdds } from "@/lib/format";
import { MVT_NOISE_PCT } from "@/lib/market";
import type { RaceAnalysis } from "@/lib/types";
import { MusicSparkline } from "@/components/course/music-sparkline";
import { ProfileBadge, pct, signedPct, signedPts } from "@/components/course/shared";

/**
 * LE TABLEAU — un seul, cinq lectures du même peloton.
 *
 * Toutes les vues gardent l'ordre du classement : changer d'onglet change les
 * colonnes, jamais le rang. Une ligne se sélectionne au clic ou au clavier et
 * pilote la fiche cheval et le panneau marché.
 */

const TABS = ["Classement IA", "MVT", "Cotes & Marché", "Forme"] as const;
type Tab = (typeof TABS)[number];

function tabId(tab: Tab) {
  return `onglet-${tab.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
}

export function FieldTable({
  race,
  vm,
  selectedNumber,
  onSelect,
}: {
  race: RaceAnalysis;
  vm: CourseViewModel;
  selectedNumber: number | null;
  onSelect: (number: number) => void;
}) {
  const [tab, setTab] = useState<Tab>("Classement IA");

  function onTabKey(e: KeyboardEvent) {
    const i = TABS.indexOf(tab);
    const next = e.key === "ArrowRight" ? (i + 1) % TABS.length : e.key === "ArrowLeft" ? (i - 1 + TABS.length) % TABS.length : e.key === "Home" ? 0 : e.key === "End" ? TABS.length - 1 : null;
    if (next === null) return;
    e.preventDefault();
    setTab(TABS[next]);
    document.getElementById(tabId(TABS[next]))?.focus();
  }

  const columns = COLUMNS[tab](race);

  return (
    <section className="mt-4 overflow-hidden rounded-2xl border border-border bg-surface shadow-sm" aria-label="Partants">
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
            {t}
            {tab === t && <span className="absolute inset-x-4 bottom-0 h-0.5 rounded-full bg-accent" />}
          </button>
        ))}
      </div>

      <div id="tableau-partants" role="tabpanel" aria-labelledby={tabId(tab)} className="overflow-x-auto">
        <table className="w-full min-w-[720px] border-collapse text-left text-sm">
          <caption className="sr-only">{CAPTIONS[tab]}</caption>
          <thead>
            <tr className="border-b border-border text-[10px] font-bold uppercase tracking-widest text-muted">
              <th scope="col" className="w-10 px-3 py-3">Rg</th>
              <th scope="col" className="px-3 py-3">Cheval</th>
              {columns.map((c) => (
                <th key={c.label} scope="col" className={`px-3 py-3 ${c.align === "right" ? "text-right" : ""}`} title={c.title}>
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {vm.rows.map((row) => {
              const selected = selectedNumber === row.horse.number;
              return (
                <tr
                  key={row.horse.id}
                  aria-label={`${row.horse.horse}, numéro ${row.horse.number}`}
                  aria-pressed={selected}
                  className={`cursor-pointer transition hover:bg-accent-lo/60 ${selected ? "bg-accent-lo" : row.rank <= 3 ? "bg-surface" : "bg-surface-sub/40"}`}
                  onClick={() => onSelect(row.horse.number)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onSelect(row.horse.number);
                    }
                  }}
                  role="button"
                  tabIndex={0}
                >
                  <td className="px-3 py-2.5">
                    <span className={`grid size-7 place-items-center rounded-lg font-mono text-xs font-bold ${row.rank <= 3 ? "bg-accent text-white" : "bg-surface-sub text-muted"}`}>
                      {row.rank}
                    </span>
                  </td>
                  <th scope="row" className="px-3 py-2.5 font-normal">
                    <div className="flex min-w-[200px] items-center gap-2">
                      <span className="font-mono font-bold text-fg">{row.horse.number}</span>
                      <span className="truncate font-semibold text-fg">{row.horse.horse}</span>
                      <ProfileBadge profile={row.profile} />
                    </div>
                  </th>
                  {columns.map((c) => (
                    <td key={c.label} className={`px-3 py-2.5 ${c.align === "right" ? "text-right font-mono" : ""}`}>
                      {c.render(row)}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="border-t border-border px-4 py-3 text-[11px] leading-5 text-muted">{FOOTNOTES[tab]}</p>
    </section>
  );
}

type Column = { label: string; title?: string; align?: "right"; render: (row: HorseRow) => ReactNode };

const CAPTIONS: Record<Tab, string> = {
  "Classement IA": "Classement : probabilité de l'IA sans cote, probabilité du marché, écart et probabilité retenue",
  MVT: "Mouvement des cotes depuis la cote du matin",
  "Cotes & Marché": "Cotes, cote juste, espérance et parts des enjeux PMU",
  Forme: "Forme récente, gains et entourage",
};

const FOOTNOTES: Record<Tab, string> = {
  "Classement IA":
    "IA : probabilité de victoire estimée sans jamais voir la cote (forme, gains, entourage). Marché : cote PMU, marge du PMU retirée. Retenue : marché corrigé à 10 % par l'IA — c'est elle qui fait le classement.",
  MVT: `Référence : premier relevé du jour de la course. Une variation sous ±${MVT_NOISE_PCT} % est tenue pour du bruit. Une cote qui baisse signifie que le cheval est joué.`,
  "Cotes & Marché":
    "Espérance : gain moyen d'un pari gagnant de 1 € à la cote affichée, selon la probabilité retenue — le prélèvement du PMU la rend presque toujours négative. Part des mises : part du cheval dans le pool simple gagnant du PMU, et sa variation sur 15 min.",
  Forme: "Courbe : huit dernières courses, la plus récente à droite (dans le texte de la musique, elle est à gauche). Réussite : part des victoires du jockey/driver et de l'entraîneur sur notre historique.",
};

function gapClass(gap: number | null) {
  if (gap === null) return "text-muted";
  if (gap >= 2) return "font-bold text-accent-text";
  if (gap <= -2) return "font-bold text-danger";
  return "text-muted";
}

function MoveCell({ row }: { row: HorseRow }) {
  const m = row.movement;
  if (m.direction === "inconnu") return <span className="text-muted">—</span>;
  const Icon = m.direction === "joue" ? ArrowDownRight : m.direction === "delaisse" ? ArrowUpRight : ArrowRight;
  const cls = m.direction === "joue" ? "text-accent-text" : m.direction === "delaisse" ? "text-danger" : "text-muted";
  const label = m.direction === "joue" ? "Joué" : m.direction === "delaisse" ? "Délaissé" : "Stable";
  return (
    <span className={`inline-flex items-center gap-1 font-sans text-xs font-bold ${cls}`}>
      <Icon aria-hidden="true" size={14} />
      {label}
    </span>
  );
}

function rate(wins?: number | null, runs?: number | null) {
  if (!runs) return "—";
  return `${Math.round((100 * (wins ?? 0)) / runs)} % (${runs})`;
}

const COLUMNS: Record<Tab, (race: RaceAnalysis) => Column[]> = {
  "Classement IA": () => [
    { label: "IA", title: "Probabilité de victoire selon l'IA, sans cote", align: "right", render: (r) => pct(r.ai, 1) },
    { label: "Marché", title: "Probabilité implicite de la cote, marge retirée", align: "right", render: (r) => pct(r.market, 1) },
    { label: "Écart", title: "IA moins marché, en points", align: "right", render: (r) => <span className={gapClass(r.gap)}>{signedPts(r.gap)}</span> },
    { label: "Retenue", title: "Probabilité de victoire retenue pour le classement", align: "right", render: (r) => <span className="font-bold text-fg">{pct(r.horse.winProbability, 1)}</span> },
    { label: "Top 3", align: "right", render: (r) => pct(r.horse.top3Probability) },
    { label: "Cote", align: "right", render: (r) => formatOdds(r.horse.odds, 1) },
  ],
  MVT: () => [
    { label: "Cote du matin", align: "right", render: (r) => formatOdds(r.movement.reference ?? NaN, 1) },
    { label: "Cote actuelle", align: "right", render: (r) => formatOdds(r.movement.current ?? NaN, 1) },
    {
      label: "Variation",
      align: "right",
      render: (r) => (
        <span className={r.movement.direction === "joue" ? "font-bold text-accent-text" : r.movement.direction === "delaisse" ? "font-bold text-danger" : "text-muted"}>
          {signedPct(r.movement.changePct)}
        </span>
      ),
    },
    { label: "Tendance", render: (r) => <MoveCell row={r} /> },
  ],
  "Cotes & Marché": () => [
    { label: "Cote", align: "right", render: (r) => formatOdds(r.horse.odds, 1) },
    { label: "Cote juste", title: "Inverse de la probabilité retenue", align: "right", render: (r) => formatOdds(r.horse.fairOdds, 1) },
    {
      label: "Espérance",
      align: "right",
      render: (r) => <span className={r.expectedValue !== null && r.expectedValue > 0 ? "font-bold text-accent-text" : "text-danger"}>{signedPct(r.expectedValue)}</span>,
    },
    { label: "Part des mises", align: "right", render: (r) => pct(r.flow.share, 1) },
    {
      label: "Sur 15 min",
      align: "right",
      render: (r) => <span className={r.flow.strong ? "font-bold text-accent-text" : "text-muted"}>{signedPts(r.flow.delta15)}</span>,
    },
  ],
  Forme: (race) => [
    { label: "Musique", render: (r) => <MusicSparkline music={r.horse.music} /> },
    { label: "Âge", align: "right", render: (r) => `${r.horse.sex?.slice(0, 1) ?? ""}${r.horse.age ?? "—"}` },
    { label: "Gains", align: "right", render: (r) => (r.horse.earnings ? `${new Intl.NumberFormat("fr-FR").format(Math.round(r.horse.earnings))} €` : "—") },
    { label: race.discipline === "Trot" ? "Driver" : "Jockey", render: (r) => <span className="text-xs text-muted">{r.horse.jockey} · {rate(r.horse.jockeyWins, r.horse.jockeyRuns)}</span> },
    { label: "Entraîneur", render: (r) => <span className="text-xs text-muted">{r.horse.trainer} · {rate(r.horse.trainerWins, r.horse.trainerRuns)}</span> },
  ],
};
