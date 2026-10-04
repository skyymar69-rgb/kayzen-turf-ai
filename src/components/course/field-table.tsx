"use client";

import { Fragment, useState, type KeyboardEvent, type ReactNode } from "react";
import { ArrowDownRight, ArrowRight, ArrowUpRight, Banknote, Brain, Flame, Star, Zap, type LucideIcon } from "lucide-react";
import { useFollowedHorses } from "@/hooks/use-followed-horses";
import { ACCORD_MAX_GAP_PTS, CONFRONT_MIN_PCT, SIGNAL_LABELS, STANCE_LABELS, type MarketSignal, type Stance } from "@/lib/confrontation";
import type { CourseViewModel, HorseRow } from "@/lib/course-view-model";
import { formatOdds } from "@/lib/format";
import { FLOW_ACCEL_PTS, FLOW_TREND_PTS, MVT_NOISE_PCT, STRONG_MONEY_PTS } from "@/lib/market";
import type { SignalRecord } from "@/lib/race-repository";
import type { RaceAnalysis } from "@/lib/types";
import { MusicSparkline } from "@/components/course/music-sparkline";
import { ProfileBadge, pct, roiLine, signedPct, signedPts } from "@/components/course/shared";

/**
 * LE TABLEAU — un seul, cinq lectures du même peloton.
 *
 * Les vues gardent l'ordre du classement IA, sauf deux onglets. MVT : le
 * classement du marché, du cheval le plus joué au plus délaissé, avec l'argent
 * (part des mises, variation sur 15 min, accélération sur 5 min). IA × Marché :
 * les chevaux qui comptent, groupés en accord, favoris de l'IA et favoris du
 * marché, avec les signaux d'argent (voir lib/confrontation). Une ligne se
 * sélectionne au clic ou au clavier et pilote la fiche cheval et le panneau
 * marché.
 */

const TABS = ["Classement IA", "Confrontation", "MVT", "Cotes & Marché", "Forme"] as const;
const TAB_LABELS: Record<(typeof TABS)[number], string> = {
  "Classement IA": "Classement IA",
  Confrontation: "IA × Marché",
  MVT: "MVT & argent",
  "Cotes & Marché": "Cotes & Marché",
  Forme: "Forme",
};
type Tab = (typeof TABS)[number];

function tabId(tab: Tab) {
  return `onglet-${tab.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
}

export function FieldTable({
  race,
  vm,
  selectedNumber,
  onSelect,
  signals,
}: {
  race: RaceAnalysis;
  vm: CourseViewModel;
  signals?: Map<string, SignalRecord>;
  selectedNumber: number | null;
  onSelect: (number: number) => void;
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
            {TAB_LABELS[t]}
            {tab === t && <span className="absolute inset-x-4 bottom-0 h-0.5 rounded-full bg-accent" />}
          </button>
        ))}
      </div>

      <div id="tableau-partants" role="tabpanel" aria-labelledby={tabId(tab)} className="overflow-x-auto">
        <table className={`w-full border-collapse text-left text-sm ${marketView || confrontView ? "min-w-[880px]" : "min-w-[720px]"}`}>
          <caption className="sr-only">{CAPTIONS[tab]}</caption>
          <thead>
            <tr className="border-b border-border text-[10px] font-bold uppercase tracking-widest text-muted">
              <th scope="col" className="w-10 px-3 py-3" title={marketView ? "Rang sur le marché : du plus joué au plus délaissé" : "Rang au classement IA"}>
                Rg
              </th>
              <th scope="col" className="px-3 py-3">Cheval</th>
              {columns.map((c) => (
                <th key={c.label} scope="col" className={`px-3 py-3 ${c.align === "right" ? "text-right" : ""}`} title={c.title}>
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {confrontView && rows.length === 0 && (
              <tr>
                <td colSpan={columns.length + 2} className="px-4 py-6 text-center text-sm text-muted">
                  Pas encore de confrontation : il faut les cotes du marché et l&apos;avis de l&apos;IA.
                </td>
              </tr>
            )}
            {rows.map((row, index) => {
              const selected = selectedNumber === row.horse.number;
              const position = marketView ? index + 1 : row.rank;
              const groupStart = confrontView && row.stance !== null && row.stance !== rows[index - 1]?.stance;
              return (
                <Fragment key={row.horse.id}>
                {groupStart && (
                  <tr className="bg-surface-sub">
                    <th colSpan={columns.length + 2} scope="colgroup" className="px-3 py-2 text-left">
                      <StanceBadge stance={row.stance!} />
                      <span className="ml-2 text-[11px] font-normal text-muted">{STANCE_HINTS[row.stance!]}</span>
                    </th>
                  </tr>
                )}
                <tr
                  className={`cursor-pointer transition hover:bg-accent-lo/60 ${selected ? "bg-accent-lo" : position <= 3 ? "bg-surface" : "bg-surface-sub/40"}`}
                  onClick={() => onSelect(row.horse.number)}
                >
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
                        aria-label={`Voir la fiche du n° ${row.horse.number}, ${row.horse.horse}`}
                        aria-pressed={selected}
                        className="flex min-w-0 items-center gap-2 rounded text-left"
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelect(row.horse.number);
                        }}
                        type="button"
                      >
                        <span className="font-mono font-bold text-fg">{row.horse.number}</span>
                        <span className="truncate font-semibold text-fg">{row.horse.horse}</span>
                      </button>
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

/** Signaux du backtest rappelés sous l'onglet IA × Marché. */
const CONFRONT_SIGNALS = ["conf-accord-sg", "conf-ia-sg", "conf-marche-sg", "smart-money-sg"];

const STANCE_STYLES: Record<Stance, string> = {
  accord: "bg-purple-100 text-purple-900 dark:bg-purple-950 dark:text-purple-200",
  ia: "bg-sky-100 text-sky-900 dark:bg-sky-950 dark:text-sky-200",
  marche: "bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200",
};

const STANCE_HINTS: Record<Stance, string> = {
  accord: "L'IA et le marché convergent.",
  ia: "Plus haut chez l'IA que sur le marché.",
  marche: "Plus soutenu par le marché que par l'IA.",
};

function StanceBadge({ stance }: { stance: Stance }) {
  return (
    <span className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${STANCE_STYLES[stance]}`}>
      {STANCE_LABELS[stance]}
    </span>
  );
}

const SIGNAL_ICONS: Record<MarketSignal, LucideIcon> = { argent: Banknote, acceleration: Flame, smart: Brain };
const SIGNAL_STYLES: Record<MarketSignal, string> = {
  argent: "bg-accent-lo text-accent-text",
  acceleration: "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200",
  smart: "bg-surface-inv text-white",
};

function SignalBadges({ row }: { row: HorseRow }) {
  if (row.signals.length === 0) return <span className="text-muted">—</span>;
  return (
    <span className="flex flex-wrap gap-1">
      {row.signals.map((s) => {
        const Icon = SIGNAL_ICONS[s];
        return (
          <span key={s} className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-bold ${SIGNAL_STYLES[s]}`}>
            <Icon aria-hidden="true" size={11} />
            {SIGNAL_LABELS[s]}
          </span>
        );
      })}
    </span>
  );
}

type Column = { label: string; title?: string; align?: "right"; render: (row: HorseRow) => ReactNode };

const CAPTIONS: Record<Tab, string> = {
  "Classement IA": "Classement : probabilité de l'IA sans cote, probabilité du marché, écart et probabilité retenue",
  Confrontation: "Confrontation IA × marché : accord, favoris de l'IA, favoris du marché, et signaux d'argent",
  MVT: "Classement du marché, du cheval le plus joué au plus délaissé : mouvement de cote depuis le matin et part des mises",
  "Cotes & Marché": "Cotes, cote juste, espérance et parts des enjeux PMU",
  Forme: "Forme récente, gains et entourage",
};

const FOOTNOTES: Record<Tab, string> = {
  "Classement IA":
    "IA : probabilité de victoire estimée sans jamais voir la cote (forme, gains, entourage). Marché : cote PMU, marge du PMU retirée. Retenue : marché corrigé à 10 % par l'IA — c'est elle qui fait le classement.",
  Confrontation: `Seuls les chevaux à au moins ${CONFRONT_MIN_PCT} % pour l'IA ou pour le marché sont classés. Accord : écart de ${ACCORD_MAX_GAP_PTS} points au plus, ou rapport IA ÷ marché entre 0,8 et 1,25. Argent entrant : +${STRONG_MONEY_PTS} points de part des mises en 15 min. Accélération : +${FLOW_ACCEL_PTS} point en 5 min, plus vite que sur les 10 minutes d'avant. Smart money : argent qui entre, cote qui baisse et IA favorable ou d'accord — le PMU ne publie pas qui mise : c'est un argent que notre modèle indépendant confirme, pas « l'argent des initiés ».`,
  MVT: `Classement du marché, du plus joué au plus délaissé. Cote du matin : premier relevé du jour ; une variation sous ±${MVT_NOISE_PCT} % est tenue pour du bruit, une cote qui baisse signifie que le cheval est joué. Argent : part du cheval dans le pool simple gagnant du PMU, sa variation sur 15 min (flèche au-delà de ±${String(FLOW_TREND_PTS).replace(".", ",")} pt) et l'accélération sur 5 min (éclair à +${FLOW_ACCEL_PTS} pt). Le PMU ne publie pas les mises individuelles : une part qui monte dit que le cheval est joué, pas par qui.`,
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

function FlowCell({ row }: { row: HorseRow }) {
  const d = row.flow.delta15;
  if (d === null) return <span className="text-muted">—</span>;
  const up = d >= FLOW_TREND_PTS;
  const down = d <= -FLOW_TREND_PTS;
  const Icon = up ? ArrowUpRight : down ? ArrowDownRight : ArrowRight;
  return (
    <span className={`inline-flex items-center justify-end gap-1 ${row.flow.strong ? "font-bold text-accent-text" : up ? "text-accent-text" : down ? "text-danger" : "text-muted"}`}>
      <Icon aria-hidden="true" size={13} />
      {signedPts(d)}
    </span>
  );
}

function AccelCell({ row }: { row: HorseRow }) {
  const d = row.flow.delta5;
  if (d === null) return <span className="text-muted">—</span>;
  const accelerating = d >= FLOW_ACCEL_PTS;
  return (
    <span className={`inline-flex items-center justify-end gap-1 ${accelerating ? "font-bold text-accent-text" : "text-muted"}`}>
      {accelerating && <Zap aria-label="Accélération" className="fill-current" size={12} />}
      {signedPts(d)}
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
  Confrontation: () => [
    { label: "IA", title: "Probabilité de victoire selon l'IA, sans cote", align: "right", render: (r) => pct(r.ai, 1) },
    { label: "Marché", title: "Probabilité implicite de la cote, marge retirée", align: "right", render: (r) => pct(r.market, 1) },
    { label: "Écart", title: "IA moins marché, en points", align: "right", render: (r) => <span className={gapClass(r.gap)}>{signedPts(r.gap)}</span> },
    { label: "Cote", align: "right", render: (r) => formatOdds(r.horse.odds, 1) },
    { label: "MVT", title: "Mouvement de la cote depuis le matin", render: (r) => <MoveCell row={r} /> },
    { label: "Argent 15 min", title: "Variation de la part des mises sur 15 min", align: "right", render: (r) => <FlowCell row={r} /> },
    { label: "Signaux", title: "Argent entrant, accélération des mises, smart money", render: (r) => <SignalBadges row={r} /> },
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
    { label: "Part des mises", title: "Part du cheval dans le pool simple gagnant du PMU", align: "right", render: (r) => pct(r.flow.share, 1) },
    { label: "Argent 15 min", title: "Variation de la part des mises sur 15 min", align: "right", render: (r) => <FlowCell row={r} /> },
    { label: "5 min", title: "Accélération : variation sur les 5 dernières minutes", align: "right", render: (r) => <AccelCell row={r} /> },
    { label: "Rg IA", title: "Rang au classement IA", align: "right", render: (r) => r.rank },
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
