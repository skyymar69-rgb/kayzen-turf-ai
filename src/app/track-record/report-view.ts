/**
 * Lecture du rapport de suivi pour la page /track-record — fonctions pures,
 * testées (tests/track-record-view.test.ts). Toutes tolèrent un rapport
 * ancien, sans les champs ajoutés depuis.
 */

import type { MultipleTesting, PeriodStats, Report, ReportSignal, TicketRow } from "./report-types";

/** Texte affiché à la place d'un indicateur que le dernier rapport ne porte pas encore. */
export const NEXT_RUN = "disponible au prochain calcul";

/** En dessous, un ROI n'est pas lisible : la marge d'erreur couvre tout. */
export const MIN_BETS_FOR_READING = 100;

export const dateFr = (iso: string) => new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
export const pct = (v: number | null | undefined, d = 1) => (typeof v === "number" && Number.isFinite(v) ? `${(v * 100).toFixed(d).replace(".", ",")} %` : "—");
export const signed = (v: number | null | undefined) =>
  typeof v === "number" && Number.isFinite(v) ? `${v > 0 ? "+" : v < 0 ? "−" : ""}${Math.abs(v * 100).toFixed(1).replace(".", ",")} %` : "—";
export const nf = new Intl.NumberFormat("fr-FR");
export const decimal = (v: number | null | undefined, d = 3) => (typeof v === "number" && Number.isFinite(v) ? v.toFixed(d).replace(".", ",") : "—");

const BET_TYPES: Record<string, string> = {
  SG: "Simple gagnant",
  SP: "Simple placé",
  SIMPLE_GAGNANT: "Simple gagnant",
  SIMPLE_PLACE: "Simple placé",
  COUPLE_GAGNANT: "Couplé gagnant",
  COUPLE_PLACE: "Couplé placé",
  TRIO: "Trio",
};

export function betTypeLabel(betType: string): string {
  return BET_TYPES[betType] ?? betType;
}

/** P-valeurs corrigées (Holm) par signal ; vide pour un rapport sans tests multiples. */
export function holmByKey(mt: MultipleTesting | undefined | null): Map<string, number> {
  return new Map((mt?.rows ?? []).map((r) => [r.key, r.holm]));
}

export type Reading = { label: string; tone: "good" | "bad" | "neutral" };

/**
 * Lecture honnête d'un résultat : rien n'est « rentable » sans un échantillon
 * suffisant, une marge d'erreur entièrement positive ET la correction des
 * tests multiples (quand elle est connue).
 */
export function readingOf(stats: PeriodStats | null | undefined, holm?: number, alpha = 0.05): Reading {
  if (!stats || !(stats.bets > 0)) return { label: "Aucun pari", tone: "neutral" };
  if (stats.bets < MIN_BETS_FOR_READING) return { label: "Trop peu de paris", tone: "neutral" };
  if (stats.roiHigh < 0) return { label: "Perdant", tone: "bad" };
  if (stats.roiLow > 0 && holm !== undefined && holm <= alpha) return { label: "Rentable, après correction", tone: "good" };
  if (stats.roiLow > 0 && holm !== undefined) return { label: "Positif, non confirmé après correction", tone: "neutral" };
  if (stats.roiLow > 0) return { label: "Positif, sans correction des tests multiples", tone: "neutral" };
  return { label: "Non concluant", tone: "neutral" };
}

export type PeriodRow = { key: string; label: string; betType: string; description: string; reference: boolean; stats: PeriodStats | null; holm?: number };

/**
 * Lignes d'un tableau par période. `null` quand le rapport ne porte pas encore
 * le découpage (rapport antérieur au découpage ajustement / hors échantillon).
 */
export function periodRows(signals: ReportSignal[], period: "inSample" | "outOfSample", mt?: MultipleTesting | null): PeriodRow[] | null {
  if (!signals.some((s) => period in s)) return null;
  const holm = holmByKey(mt);
  return signals.map((s) => ({
    key: s.key,
    label: s.label,
    betType: s.betType,
    description: s.description,
    reference: s.reference === true || s.description.startsWith("Référence"),
    stats: s[period] ?? null,
    holm: holm.get(s.key),
  }));
}

/** Lignes « période complète » d'un signal (le seul découpage des anciens rapports et du suivi en direct). */
export function fullRows(signals: ReportSignal[], mt?: MultipleTesting | null): PeriodRow[] {
  const holm = holmByKey(mt);
  return signals.map((s) => ({
    key: s.key,
    label: s.label,
    betType: s.betType,
    description: s.description,
    reference: s.reference === true || s.description.startsWith("Référence"),
    stats: s,
    holm: holm.get(s.key),
  }));
}

/** Première date hors échantillon parmi les signaux (la plus ancienne date de gel). */
export function earliestFreeze(report: Pick<Report, "profilesFrozenAt" | "signals">): string | null {
  const dates = report.signals.map((s) => s.frozenAt).filter((d): d is string => typeof d === "string");
  if (report.profilesFrozenAt) dates.push(report.profilesFrozenAt);
  return dates.length ? [...dates].sort()[0] : null;
}

export const TICKET_SOURCES: Array<{ source: TicketRow["source"]; title: string }> = [
  { source: "propose", title: "Tickets proposés (un par type de pari)" },
  { source: "x", title: "Tickets à X" },
  { source: "strategie", title: "Un ticket par stratégie" },
];

/** Tickets regroupés par origine, groupes vides omis. */
export function ticketGroups(rows: TicketRow[] | undefined): Array<{ title: string; rows: TicketRow[] }> {
  const list = Array.isArray(rows) ? rows : [];
  return TICKET_SOURCES.map(({ source, title }) => ({ title, rows: list.filter((r) => r.source === source) })).filter((g) => g.rows.length > 0);
}

/** Écart relatif de log loss (négatif : meilleur que le marché). */
export function relativeGap(value: number, reference: number): number {
  return reference > 0 && Number.isFinite(value) ? value / reference - 1 : NaN;
}
