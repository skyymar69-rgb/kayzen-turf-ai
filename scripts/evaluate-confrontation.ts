#!/usr/bin/env -S npx tsx
/**
 * BALAYAGE DES SEUILS DE LA CONFRONTATION IA × MARCHÉ — hors ligne, lecture seule.
 *
 * Pour chaque réglage de CONFRONT_MIN_PCT, ACCORD_MAX_GAP_PTS et des bornes du
 * rapport IA ÷ marché (ACCORD_RATIO_MIN / MAX), imprime le volume et le ROI net
 * de chaque famille (Accord, Favori IA, Favori marché), en simple gagnant et en
 * simple placé, avec l'intervalle à 90 % par rééchantillonnage des courses.
 *
 * Mêmes règles que scripts/backtest.ts, dont il réutilise les lectures :
 *   - période postérieure à l'ajustement du modèle fondamental ;
 *   - cote de décision relevée au moins `--lead` minutes avant le départ ;
 *   - gains : rapports officiels PMU pour 1 €, prélèvement déduit.
 *
 * ATTENTION — BIAIS D'ÉCHANTILLON. Choisir le « meilleur » réglage de ce
 * tableau puis publier son ROI sur la même période revient à mesurer le
 * hasard qu'on vient de sélectionner : avec des dizaines de réglages, l'un
 * d'eux paraîtra rentable par chance. Les seuils ne doivent JAMAIS être ajustés
 * sur la période d'évaluation. Procédure : choisir sur `--from … --until …`
 * (période d'ajustement), puis valider UNE fois le réglage retenu sur une
 * période postérieure jamais regardée, et enfin sur le suivi en direct (pronostics
 * gelés à H-2) avant toute modification de lib/confrontation.ts.
 *
 * Usage : npm run model:confrontation -- [--from AAAA-MM-JJ] [--until AAAA-MM-JJ] [--lead 15] [--min-bets 100]
 */

import { neon } from "@neondatabase/serverless";
import { FUNDAMENTAL_TRAIN_CUTOFF, fundamentalProbabilities } from "@/lib/fundamental/model";
import { devig } from "@/lib/probability";
import { decisionOdds, officialPayouts } from "./lib/backtest-data";
import {
  PRODUCTION_THRESHOLDS,
  betsForThresholds,
  sameThresholds,
  thresholdGrid,
  type ScanBets,
  type ScanRunner,
} from "./lib/confrontation-scan";
import { loadDataset, loadLocalEnv } from "./lib/dataset";
import { summarize } from "./lib/signal-stats";

function arg(name: string, fallback: string) {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? fallback : (process.argv[i + 1] ?? fallback);
}

const GRID = thresholdGrid({
  minPct: [5, 6, 8, 10, 12],
  maxGapPts: [2, 3, 4, 5],
  ratioBounds: [
    [0.9, 1.11],
    [0.85, 1.18],
    [0.8, 1.25],
    [0.75, 1.33],
  ],
});

const FAMILIES: Array<keyof ScanBets> = ["accord-sg", "accord-sp", "ia-sg", "ia-sp", "marche-sg", "marche-sp"];

const pct = (v: number) => (Number.isFinite(v) ? `${v >= 0 ? "+" : ""}${(v * 100).toFixed(1)} %` : "—");

async function main() {
  loadLocalEnv();
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
  const sql = neon(process.env.DATABASE_URL);
  const from = arg("from", FUNDAMENTAL_TRAIN_CUTOFF);
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris" }).format(new Date());
  const until = arg("until", today);
  const leadMinutes = Number(arg("lead", "15"));
  const minBets = Number(arg("min-bets", "100"));

  const all = await loadDataset(process.env.DATABASE_URL);
  const races = all.filter((r) => r.date >= from && r.date < until && r.date < today);
  const raceIds = races.map((r) => r.raceId);
  const odds = await decisionOdds(sql, raceIds, leadMinutes);
  const payouts = await officialPayouts(sql, raceIds);

  // Un passage sur la base, puis chaque réglage se calcule en mémoire.
  const runners: ScanRunner[] = [];
  let raceIndex = 0;
  for (const race of races) {
    const decision = race.field.map((h) => odds.get(`${race.raceId}|${h.horseId}`)?.odds ?? NaN);
    // Même garde-fou que le backtest : 70 % des partants avec une cote de décision.
    if (decision.filter((o) => o > 1).length < race.field.length * 0.7) continue;
    const fundamental = fundamentalProbabilities(race.field, race.discipline);
    const pay = payouts.get(race.raceId);
    if (!fundamental || !pay || pay.SG.size === 0) continue;
    const market = devig(decision);
    const index = raceIndex++;
    race.field.forEach((h, i) => {
      if (!(decision[i] > 1)) return;
      runners.push({
        race: index,
        day: race.date,
        odds: decision[i],
        ai: fundamental[i] * 100,
        market: market[i] * 100,
        sg: pay.SG.get(h.number) ?? 0,
        sp: pay.SP.get(h.number) ?? 0,
        hasSp: pay.SP.size > 0,
      });
    });
  }

  console.log(`\nConfrontation IA × marché — ${from} → ${until} (exclu), ${raceIndex} courses avec rapports officiels, cote de décision à H-${leadMinutes}`);
  console.log("Seuils : min = CONFRONT_MIN_PCT, écart = ACCORD_MAX_GAP_PTS, rapport = ACCORD_RATIO_MIN–MAX. * = réglage de production.");
  console.log(`Familles de moins de ${minBets} paris : ROI masqué (trop peu de paris pour conclure).\n`);
  console.log(
    `${"Réglage".padEnd(30)}${FAMILIES.map((f) => f.padStart(30)).join("")}`,
  );

  for (const t of GRID) {
    const bets = betsForThresholds(runners, t);
    const label = `${sameThresholds(t, PRODUCTION_THRESHOLDS) ? "*" : " "} min ${t.minPct} · écart ${t.maxGapPts} · ${t.ratioMin}–${t.ratioMax}`;
    const cells = FAMILIES.map((f) => {
      const s = summarize(bets[f], raceIndex);
      if (s.bets < minBets) return `n=${s.bets}`.padStart(30);
      return `n=${s.bets} ${pct(s.roi)} [${pct(s.roiLow)};${pct(s.roiHigh)}]`.padStart(30);
    });
    console.log(`${label.padEnd(30)}${cells.join("")}`);
  }

  console.log(
    "\nRappel : ce tableau est un balayage EN ÉCHANTILLON. Un réglage n'est retenu qu'après validation sur une période postérieure non regardée, puis sur le suivi en direct (H-2).",
  );
  console.log("Aucune ligne de ce tableau n'est une promesse de gain : le prélèvement du PMU rend la plupart des familles perdantes.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
