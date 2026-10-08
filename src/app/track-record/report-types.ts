/**
 * Forme du rapport publié par scripts/backtest.ts (`track_record_reports`).
 *
 * La page lit le DERNIER rapport, qui peut dater d'avant l'ajout d'un champ :
 * tout ce qui a été ajouté après la première version est optionnel, et la page
 * affiche « disponible au prochain calcul » quand il manque.
 */

import type { DailyPoint } from "./roi-series";

export type ClvSummary = { n: number; mean: number; median: number; positiveShare: number };

/** Résumé d'un ensemble de paris (scripts/lib/signal-stats.ts → summarize). */
export type PeriodStats = {
  bets: number;
  races?: number;
  hits?: number;
  hitRate: number;
  staked?: number;
  returned?: number;
  roi: number;
  roiLow: number;
  roiHigh: number;
  pValue?: number;
  averageOdds?: number;
  clv?: ClvSummary | null;
  maxDrawdown?: number;
  longestLosingStreak?: number;
};

export type BreakdownRow = { group: string; bets: number; hitRate: number; roi: number; roiLow: number; roiHigh: number };

export type ReportSignal = PeriodStats & {
  key: string;
  label: string;
  betType: string;
  description: string;
  daily?: DailyPoint[];
  frozenAt?: string;
  reference?: boolean;
  inSample?: PeriodStats | null;
  outOfSample?: PeriodStats | null;
  byDiscipline?: BreakdownRow[];
  bySpecialty?: BreakdownRow[];
};

export type MultipleTesting = {
  method: string;
  alpha: number;
  tested: number;
  survivors: string[];
  primary: { key: string; pValue: number; significant: boolean };
  rows: Array<{ key: string; pValue: number; holm: number; bh: number; significant: boolean }>;
};

export type TicketRow = PeriodStats & {
  key: string;
  label: string;
  source: "propose" | "x" | "strategie";
  betType: string;
  daily?: DailyPoint[];
  frozenAt?: string;
  inSample?: PeriodStats | null;
  outOfSample?: PeriodStats | null;
};

export type CalibrationRow = { bucket: number; label?: string; announced: number; observed: number; ae?: number; n: number };

export type Report = {
  generatedAt: string;
  modelVersion: string;
  fundamentalVersion: string;
  profilesVersion: string;
  profilesFrozenAt?: string;
  primarySignal?: string;
  period: { from: string; to: string };
  rules: Record<string, string | number>;
  racesConsidered: number;
  racesEvaluated: number;
  racesWithPayouts: number;
  oddsAgeMinutes: { median: number; p25: number; p75: number; within30: number };
  accuracy: { winnerFoundShown: number | null; top3HitsPerRace: number; byModel: Array<{ key: string; logLoss: number; winnerFound: number }> };
  calibration: CalibrationRow[];
  /** « log2 » depuis l'abandon des déciles linéaires ; absent dans les anciens rapports. */
  calibrationScheme?: string;
  oddsBands?: Array<{ label: string; n: number; wins: number; aeMarket: number; aeModel: number; roiSG: number }>;
  monthlyLogLoss?: Array<{ month: string; races: number; model: number; market: number; blend: number }>;
  signals: ReportSignal[];
  multipleTesting?: { outOfSample: MultipleTesting; inSample: MultipleTesting };
  tickets?: { races: number; frozenAt: string; rows: TicketRow[]; unpriceable: Array<{ label: string; reason: string }> };
  longshotDiagnostics?: Array<{ label: string; n: number; winRate: number; roiSG: number; roiSP: number }>;
  live?: {
    since: string | null;
    races: number;
    signals: ReportSignal[];
    multipleTesting?: MultipleTesting;
  };
};
