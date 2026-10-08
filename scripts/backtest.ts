#!/usr/bin/env -S npx tsx
/**
 * BACKTEST ET SUIVI — ce que chaque signal aurait rapporté, net du prélèvement.
 *
 * Règles, toutes destinées à empêcher la fuite d'information :
 *   1. Modèle hors échantillon : uniquement les courses postérieures à la date
 *      d'ajustement du modèle fondamental (`trainCutoff` de model.json).
 *   2. Règles des signaux hors échantillon : chaque signal porte la date de gel
 *      de ses règles (`frozenAt`, PROFILES_FROZEN_AT pour les profils). Les
 *      courses antérieures ont servi à choisir les seuils : elles sont publiées
 *      à part, comme « période d'ajustement », jamais comme une mesure. Seules
 *      les courses postérieures (« hors échantillon ») et le suivi en direct
 *      mesurent un signal sans biais.
 *   3. Cote de décision : pour chaque cheval, le dernier relevé de cote observé
 *      AU MOINS 15 minutes avant le départ (`odds_snapshots`). Jamais la cote
 *      finale, qui n'est connue qu'après la clôture des enjeux. L'âge réel de
 *      ces cotes est publié avec le rapport. La cote finale (dernier relevé
 *      avant le départ prévu) ne sert qu'à mesurer la CLV.
 *   4. Variables d'entourage calculées avec les seules courses antérieures.
 *   5. Gains : rapports officiels PMU pour 1 € (`race_payouts`). Le prélèvement
 *      du PMU y est déjà déduit : le ROI est donc net.
 *   6. Mise fixe de 1 € par pari (1 € par combinaison pour les tickets à X).
 *      Intervalle à 90 % par rééchantillonnage des courses (bootstrap, 1 000
 *      tirages), p-valeur unilatérale (ROI > 0) et correction de Holm pour le
 *      nombre de signaux testés. Le signal principal (PRIMARY_SIGNAL) est
 *      déclaré ici, avant toute lecture des résultats hors échantillon.
 *   7. Série quotidienne cumulée par signal (`daily`, 90 points au plus) pour /track-record.
 *
 * Le rapport est enregistré dans `track_record_reports` et publié sur
 * /track-record, y compris pour les signaux qui perdent de l'argent.
 *
 * Usage : npx tsx scripts/backtest.ts [--from AAAA-MM-JJ] [--lead 15] [--dry-run] [--dump fichier.json]
 *   --dump exporte chaque partant évalué (cotes, probabilités, profil, rapports)
 *   pour explorer de nouveaux seuils hors du code de production.
 */

import { neon, type NeonQueryFunction } from "@neondatabase/serverless";
import { FUNDAMENTAL_TRAIN_CUTOFF, FUNDAMENTAL_VERSION, fundamentalProbabilities } from "@/lib/fundamental/model";
import { MODEL_VERSION, MODEL_WEIGHT, blendProbabilities, devig, monteCarloTopK } from "@/lib/probability";
import { PROFILES_FROZEN_AT, PROFILES_VERSION, PROFILE_LABELS, classifyField, type Profile } from "@/lib/profiles";
import {
  allPayoutRows,
  closingOdds as loadClosingOdds,
  decisionOdds as loadDecisionOdds,
  morningOdds,
  officialPayouts,
  poolsUntil,
  raceMeta,
} from "./lib/backtest-data";
import {
  breakdown,
  logCalibration,
  monthlyLogLoss,
  multipleTesting,
  oddsBandAE,
  periodSummary,
  splitAtFreeze,
  winnerLogLoss,
  type CalibrationObservation,
  type RaceLogLoss,
  type RunnerObservation,
} from "./lib/backtest-metrics";
import { confrontationKeys, mostBacked, surpriseNumbers } from "./lib/backtest-signals";
import { UNPRICEABLE_FORMATS, raceTickets, type PricedRaceTicket } from "./lib/backtest-tickets";
import { loadDataset, loadLocalEnv, type DatasetRace } from "./lib/dataset";
import { dailySeries, quantile, summarize, type Bet } from "./lib/signal-stats";
import { payoutBooks } from "./lib/ticket-pricing";

type BetType = "SG" | "SP";
type SignalDef = {
  key: string;
  label: string;
  betType: BetType;
  description: string;
  /** Date de gel des règles du signal : les courses antérieures ont servi à les régler. */
  frozenAt: string;
  /** Référence (aucun réglage, sert d'étalon) : exclue du décompte des signaux testés. */
  reference?: boolean;
};

/**
 * Dates de gel des règles, famille par famille. Une règle est « gelée » le jour
 * où le code qui la fixe a été publié ; les courses de ce jour et des jours
 * suivants n'ont pas pu servir à la choisir.
 *   - profils et n° 1 de la sélection : seuils v2 et poids du modèle fixés le
 *     02/10/2026 sur le backtest juin-septembre (src/lib/profiles.ts) ;
 *   - MVT : signal ajouté le 03/10/2026 au soir → hors échantillon dès le 04/10 ;
 *   - confrontation IA × marché et signaux d'argent : 04/10/2026 au soir → 05/10 ;
 *   - score de surprise : mesuré du 24/08 au 07/10/2026 → 08/10.
 */
const FROZEN = {
  profils: PROFILES_FROZEN_AT,
  mvt: "2026-10-04",
  confrontation: "2026-10-05",
  surprise: "2026-10-08",
} as const;

/**
 * Signal principal, déclaré AVANT la lecture des résultats hors échantillon :
 * le simple placé sur le n° 1 de la sélection, le ticket « Sécurisé » du site.
 * C'est le seul jugé sans correction pour tests multiples ; tous les autres ne
 * comptent que s'ils survivent à la correction de Holm.
 */
const PRIMARY_SIGNAL = "rank1-sp";

/** Seuil unilatéral des tests (ROI > 0). */
const ALPHA = 0.05;

const SIGNALS: SignalDef[] = [
  { key: "rank1-sg", label: "N° 1 de la sélection", betType: "SG", frozenAt: FROZEN.profils, description: "Simple gagnant sur le premier de notre classement" },
  { key: "rank1-sp", label: "N° 1 de la sélection", betType: "SP", frozenAt: FROZEN.profils, description: "Simple placé sur le premier de notre classement (signal principal, déclaré à l'avance)" },
  { key: "base-sp", label: "Base", betType: "SP", frozenAt: FROZEN.profils, description: "Simple placé sur chaque cheval classé Base" },
  { key: "cache-sg", label: "Caché", betType: "SG", frozenAt: FROZEN.profils, description: "Simple gagnant sur chaque cheval classé Caché" },
  { key: "cache-sp", label: "Caché", betType: "SP", frozenAt: FROZEN.profils, description: "Simple placé sur chaque cheval classé Caché" },
  { key: "value-sg", label: "Value", betType: "SG", frozenAt: FROZEN.profils, description: "Simple gagnant sur chaque cheval classé Value" },
  { key: "outsider-sp", label: "Outsider", betType: "SP", frozenAt: FROZEN.profils, description: "Simple placé sur chaque cheval classé Outsider" },
  { key: "tocard-sg", label: "Tocard", betType: "SG", frozenAt: FROZEN.profils, description: "Simple gagnant sur chaque cheval classé Tocard" },
  { key: "eviter-sg", label: "À éviter", betType: "SG", frozenAt: FROZEN.profils, description: "Simple gagnant sur chaque cheval classé À éviter (contrôle : doit perdre)" },
  { key: "mvt-joue-sg", label: "Plus joué (MVT)", betType: "SG", frozenAt: FROZEN.mvt, description: "Simple gagnant sur le cheval dont la cote a le plus baissé depuis le matin (au moins 10 %)" },
  { key: "mvt-joue-sp", label: "Plus joué (MVT)", betType: "SP", frozenAt: FROZEN.mvt, description: "Simple placé sur le cheval dont la cote a le plus baissé depuis le matin (au moins 10 %)" },
  { key: "conf-accord-sg", label: "Accord IA + marché", betType: "SG", frozenAt: FROZEN.confrontation, description: "Simple gagnant sur chaque cheval où l'IA et le marché convergent (au moins 8 % pour l'un des deux)" },
  { key: "conf-ia-sg", label: "Favori IA", betType: "SG", frozenAt: FROZEN.confrontation, description: "Simple gagnant sur chaque cheval nettement plus haut chez l'IA que sur le marché" },
  { key: "conf-accord-sp", label: "Accord IA + marché", betType: "SP", frozenAt: FROZEN.confrontation, description: "Simple placé sur chaque cheval où l'IA et le marché convergent (au moins 8 % pour l'un des deux)" },
  { key: "conf-ia-sp", label: "Favori IA", betType: "SP", frozenAt: FROZEN.confrontation, description: "Simple placé sur chaque cheval nettement plus haut chez l'IA que sur le marché" },
  { key: "conf-marche-sg", label: "Favori marché", betType: "SG", frozenAt: FROZEN.confrontation, description: "Simple gagnant sur chaque cheval nettement plus soutenu par le marché que par l'IA" },
  { key: "argent-entrant-sg", label: "Argent entrant", betType: "SG", frozenAt: FROZEN.confrontation, description: "Simple gagnant sur chaque cheval qui gagne 2 points de part des mises en 15 minutes" },
  { key: "argent-sortant-sg", label: "Argent sortant", betType: "SG", frozenAt: FROZEN.confrontation, description: "Contrôle : simple gagnant sur chaque cheval qui perd 2 points de part des mises en 15 minutes" },
  { key: "smart-money-sg", label: "Smart money", betType: "SG", frozenAt: FROZEN.confrontation, description: "Simple gagnant quand l'argent entre ou accélère, que la cote baisse et que l'IA est favorable ou d'accord" },
  { key: "surprise-sg", label: "Surprise IA", betType: "SG", frozenAt: FROZEN.surprise, description: "Simple gagnant sur chaque alerte forte ou possible du score de surprise (trois au plus par course)" },
  { key: "surprise-sp", label: "Surprise IA", betType: "SP", frozenAt: FROZEN.surprise, description: "Simple placé sur chaque alerte forte ou possible du score de surprise (trois au plus par course)" },
  { key: "favori-marche-sg", label: "Favori du marché", betType: "SG", frozenAt: FROZEN.profils, reference: true, description: "Référence : simple gagnant sur la plus petite cote" },
  { key: "tous-sg", label: "Tous les partants", betType: "SG", frozenAt: FROZEN.profils, reference: true, description: "Référence : 1 € gagnant sur chaque partant — le coût du prélèvement" },
];

/** Signaux ventilés par discipline et spécialité. */
const BREAKDOWN_SIGNALS = ["rank1-sg", "rank1-sp", "conf-accord-sg", "conf-ia-sg", "surprise-sg", "tous-sg"];

const PROFILE_SIGNAL: Partial<Record<Profile, string[]>> = {
  base: ["base-sp"],
  cache: ["cache-sg", "cache-sp"],
  value: ["value-sg"],
  outsider: ["outsider-sp"],
  tocard: ["tocard-sg"],
  eviter: ["eviter-sg"],
};

function arg(name: string, fallback: string) {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? fallback : process.argv[i + 1];
}

/** Nombre de courses avec rapports avant / à partir d'une date de gel. */
function raceCounts(raceDays: string[], frozenAt: string) {
  const inSample = raceDays.filter((d) => d < frozenAt).length;
  return { inSample, outOfSample: raceDays.length - inSample };
}

/**
 * Résumé complet d'une famille de paris : période entière (rétrocompatible),
 * période d'ajustement et hors échantillon.
 */
function summarizeWithPeriods(bets: Bet[], raceDays: string[], frozenAt: string) {
  const counts = raceCounts(raceDays, frozenAt);
  const { inSample, outOfSample } = splitAtFreeze(bets, frozenAt);
  return {
    ...summarize(bets, raceDays.length),
    daily: dailySeries(bets),
    frozenAt,
    inSample: periodSummary(inSample, counts.inSample),
    outOfSample: periodSummary(outOfSample, counts.outOfSample),
  };
}

/** Bilan des tests multiples sur une famille de signaux (références exclues). */
function testFamily(rows: Array<{ key: string; reference?: boolean; pValue: number | undefined }>) {
  return multipleTesting(
    rows.filter((r) => !r.reference).map((r) => ({ key: r.key, pValue: r.pValue ?? NaN })),
    PRIMARY_SIGNAL,
    ALPHA,
  );
}

function diagnose(rows: Array<{ ratio: number; fundRank: number; odds: number; sg: number | null; sp: number | null }>) {
  const groups: Array<{ label: string; keep: (r: (typeof rows)[number]) => boolean }> = [
    { label: "IA/marché < 1", keep: (r) => r.ratio < 1 },
    { label: "IA/marché 1 à 1,5", keep: (r) => r.ratio >= 1 && r.ratio < 1.5 },
    { label: "IA/marché 1,5 à 2", keep: (r) => r.ratio >= 1.5 && r.ratio < 2 },
    { label: "IA/marché 2 à 3", keep: (r) => r.ratio >= 2 && r.ratio < 3 },
    { label: "IA/marché ≥ 3", keep: (r) => r.ratio >= 3 },
    { label: "IA/marché ≥ 1,5 et top 3 de l'IA", keep: (r) => r.ratio >= 1.5 && r.fundRank <= 3 },
    { label: "IA/marché ≥ 1,5 et n° 1 de l'IA", keep: (r) => r.ratio >= 1.5 && r.fundRank === 1 },
    { label: "Cote 10-20, top 3 de l'IA", keep: (r) => r.odds < 20 && r.fundRank <= 3 },
  ];
  return groups.map(({ label, keep }) => {
    const g = rows.filter(keep);
    const sp = g.filter((r) => r.sp !== null);
    return {
      label,
      n: g.length,
      winRate: g.length ? g.filter((r) => r.sg !== null).length / g.length : NaN,
      roiSG: g.length ? (g.reduce((s, r) => s + (r.sg ?? 0), 0) - g.length) / g.length : NaN,
      roiSP: sp.length ? (sp.reduce((s, r) => s + (r.sp ?? 0), 0) - sp.length) / sp.length : NaN,
    };
  });
}

/**
 * Suivi en direct : les pronostics GELÉS juste avant le départ (stage H-2),
 * confrontés aux rapports officiels. C'est la seule mesure strictement hors
 * échantillon : chaque pronostic a été figé avec les règles en vigueur ce
 * jour-là, avant la course.
 */
async function liveTracking(sql: NeonQueryFunction<false, false>) {
  const rows = (await sql.query(
    `select s.race_id, s.captured_at::text as captured_at, (extract(epoch from s.captured_at) * 1000)::float8 as captured_ms,
            ((s.captured_at at time zone 'Europe/Paris')::date)::text as day, s.payload
       from prediction_snapshots s
      where s.stage = 'H-2'
        and exists (select 1 from race_payouts p where p.race_id = s.race_id and p.bet_type = 'SIMPLE_GAGNANT')
      order by s.captured_at`,
  )) as Array<{
    race_id: string;
    captured_at: string;
    captured_ms: number;
    day: string;
    payload: { numbers: number[]; odds: Array<number | null>; profile?: Profile[]; market?: number[]; ai?: Array<number | null> };
  }>;
  if (rows.length === 0) return { since: null, races: 0, signals: [] };

  const raceIds = rows.map((r) => r.race_id);
  const pay = await officialPayouts(sql, raceIds);
  const closing = await loadClosingOdds(sql, raceIds);
  // Non-partants tardifs : un cheval retiré après le dernier gel H-2 (au départ)
  // figure encore dans le pronostic gelé, mais sa ligne `entries` a été
  // supprimée par le rafraîchissement. Le PMU rembourse ces mises : ce ne sont
  // ni des paris perdus ni des paris gagnés, ils sont donc écartés.
  const runnerRows = (await sql.query(
    `select race_id, array_agg(number)::int[] as numbers from entries where race_id = any($1) group by race_id`,
    [raceIds],
  )) as Array<{ race_id: string; numbers: number[] }>;
  const runners = new Map(runnerRows.map((r) => [r.race_id, new Set(r.numbers.map(Number))]));

  const morning = await morningOdds(sql, raceIds, 2);
  const livePools = await poolsUntil(
    sql,
    raceIds,
    `(select s.captured_at from prediction_snapshots s where s.race_id = p.race_id and s.stage = 'H-2')`,
    [],
  );
  const bets = new Map<string, Bet[]>(SIGNALS.map((s) => [s.key, []]));
  rows.forEach((row, raceIndex) => {
    const table = pay.get(row.race_id)!;
    const { numbers, odds, profile, market, ai } = row.payload;
    const ran = runners.get(row.race_id);
    const place = (key: string, i: number) => {
      if (ran && !ran.has(numbers[i])) return;
      const def = SIGNALS.find((s) => s.key === key)!;
      const dividend = (def.betType === "SG" ? table.SG : table.SP).get(numbers[i]);
      const last = closing.get(`${row.race_id}|${numbers[i]}`);
      bets.get(key)!.push({
        race: raceIndex,
        hit: dividend !== undefined,
        dividend: dividend ?? 0,
        odds: odds[i] ?? NaN,
        day: row.day,
        closingOdds: last && last.t > Number(row.captured_ms) ? last.odds : undefined,
      });
    };
    place("rank1-sg", 0);
    place("rank1-sp", 0);
    if (profile) profile.forEach((p, i) => (PROFILE_SIGNAL[p] ?? []).forEach((key) => place(key, i)));
    const backed = mostBacked(row.race_id, numbers, odds, morning);
    if (backed !== null) {
      place("mvt-joue-sg", numbers.indexOf(backed));
      place("mvt-joue-sp", numbers.indexOf(backed));
    }
    // Les pronostics gelés avant l'ajout de `market` et `ai` ne portent pas la confrontation.
    if (market && ai) {
      numbers.forEach((number, i) => {
        const keys = confrontationKeys({
          number,
          odds: odds[i],
          market: market[i],
          ai: ai[i],
          morning: morning.get(`${row.race_id}|${number}`),
          pools: livePools.get(row.race_id) ?? [],
        });
        keys.forEach((key) => place(key, i));
      });
    }
    const fav = odds
      .map((o, i) => [ran && !ran.has(numbers[i]) ? Infinity : (o ?? Infinity), i] as const)
      .sort((a, b) => a[0] - b[0])[0];
    if (fav && Number.isFinite(fav[0])) place("favori-marche-sg", fav[1]);
    odds.forEach((o, i) => o && place("tous-sg", i));
  });

  const signals = SIGNALS.map((s) => ({ ...s, ...summarize(bets.get(s.key)!, rows.length), daily: dailySeries(bets.get(s.key)!) }));
  return {
    since: rows[0].captured_at,
    races: rows.length,
    signals,
    multipleTesting: testFamily(signals),
  };
}

type TicketMeta = Pick<PricedRaceTicket, "key" | "label" | "source" | "betType">;

async function main() {
  loadLocalEnv();
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
  const sql = neon(process.env.DATABASE_URL);
  const from = arg("from", FUNDAMENTAL_TRAIN_CUTOFF);
  const leadMinutes = Number(arg("lead", "15"));

  const all = await loadDataset(process.env.DATABASE_URL);
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris" }).format(new Date());
  const races = all.filter((r) => r.date >= from && r.date < today);
  const raceIds = races.map((r) => r.raceId);

  const decisionOdds = await loadDecisionOdds(sql, raceIds, leadMinutes);
  const closing = await loadClosingOdds(sql, raceIds);
  const morning = await morningOdds(sql, raceIds, leadMinutes);
  const pools = await poolsUntil(
    sql,
    raceIds,
    `((r.race_date + replace(r.start_time, 'h', ':')::time) at time zone 'Europe/Paris') - make_interval(mins => $2)`,
    [leadMinutes],
  );
  const meta = await raceMeta(sql, raceIds);
  const payouts = await officialPayouts(sql, raceIds);
  const books = payoutBooks(await allPayoutRows(sql, raceIds));

  const bets = new Map<string, Bet[]>(SIGNALS.map((s) => [s.key, []]));
  const ticketBets = new Map<string, { meta: TicketMeta; bets: Bet[] }>();
  const ticketRaceDays: string[] = [];
  const weights = [0, 0.05, 0.1, 0.15, 0.2];
  const ll = new Map<string, { sum: number; top1: number }>([
    ["marche", { sum: 0, top1: 0 }],
    ["fondamental", { sum: 0, top1: 0 }],
    ...weights.map((w) => [`w${w}`, { sum: 0, top1: 0 }] as [string, { sum: number; top1: number }]),
  ]);
  const calibrationObs: CalibrationObservation[] = [];
  const runnerObs: RunnerObservation[] = [];
  const raceLogLoss: RaceLogLoss[] = [];
  const payoutRaceDays: string[] = [];
  const ages: number[] = [];
  let evaluated = 0;
  let top3Hits = 0;
  const profileCounts = new Map<Profile, number>();
  const longshots: Array<{ ratio: number; fundRank: number; odds: number; sg: number | null; sp: number | null }> = [];
  const dump: unknown[] = [];

  const used: DatasetRace[] = [];
  for (const race of races) {
    const odds = race.field.map((h) => decisionOdds.get(`${race.raceId}|${h.horseId}`)?.odds ?? NaN);
    if (odds.filter((o) => o > 1).length < race.field.length * 0.7) continue;
    const fundamental = fundamentalProbabilities(race.field, race.discipline);
    if (!fundamental) continue;
    used.push(race);
    const raceIndex = evaluated++;
    for (const h of race.field) {
      const age = decisionOdds.get(`${race.raceId}|${h.horseId}`)?.age;
      if (age != null) ages.push(age);
    }

    const market = devig(odds);
    const shown = blendProbabilities(market, fundamental, MODEL_WEIGHT);
    const scoreLl = (key: string, p: number[]) => {
      const s = ll.get(key)!;
      s.sum += winnerLogLoss(p, race.winner);
      if (p.indexOf(Math.max(...p)) === race.winner) s.top1++;
    };
    scoreLl("marche", market);
    scoreLl("fondamental", fundamental);
    for (const w of weights) scoreLl(`w${w}`, blendProbabilities(market, fundamental, w));
    raceLogLoss.push({
      day: race.date,
      model: winnerLogLoss(fundamental, race.winner),
      market: winnerLogLoss(market, race.winner),
      blend: winnerLogLoss(shown, race.winner),
    });
    shown.forEach((p, i) => calibrationObs.push({ p, won: i === race.winner }));

    const top3 = monteCarloTopK(shown, [3], 4000).get(3)!;
    const profiled = classifyField(
      race.field.map((h, i) => ({
        number: h.number,
        odds: odds[i],
        winProbability: shown[i] * 100,
        top3Probability: Math.max(top3[i], shown[i] * 100),
        marketProbability: market[i] * 100,
        fundamentalProbability: fundamental[i] * 100,
      })),
    );
    for (const p of profiled) profileCounts.set(p.profile, (profileCounts.get(p.profile) ?? 0) + 1);

    const actualTop3 = new Set(race.field.filter((h) => h.position != null && h.position <= 3).map((h) => h.number));
    top3Hits += profiled.slice(0, 3).filter((p) => actualTop3.has(p.number)).length;

    const pay = payouts.get(race.raceId);
    if (!pay || pay.SG.size === 0) continue;
    payoutRaceDays.push(race.date);
    const info = meta.get(race.raceId);
    const byNumber = new Map(race.field.map((h, i) => [h.number, i]));
    race.field.forEach((h, i) => runnerObs.push({ odds: odds[i], market: market[i], model: shown[i], won: i === race.winner, sg: pay.SG.get(h.number) ?? 0 }));

    const place = (key: string, number: number) => {
      const def = SIGNALS.find((s) => s.key === key)!;
      const table = def.betType === "SG" ? pay.SG : pay.SP;
      const dividend = table.get(number);
      const i = byNumber.get(number)!;
      const decision = decisionOdds.get(`${race.raceId}|${race.field[i].horseId}`);
      const last = closing.get(`${race.raceId}|${number}`);
      bets.get(key)!.push({
        race: raceIndex,
        hit: dividend !== undefined,
        dividend: dividend ?? 0,
        odds: odds[i],
        day: race.date,
        // CLV seulement si un relevé postérieur à la décision existe : sinon la
        // « cote finale » serait la cote de décision elle-même.
        closingOdds: decision && last && last.t > decision.t ? last.odds : undefined,
        discipline: race.discipline,
        specialty: info?.specialty || undefined,
      });
    };

    place("rank1-sg", profiled[0].number);
    place("rank1-sp", profiled[0].number);
    for (const p of profiled) for (const key of PROFILE_SIGNAL[p.profile] ?? []) place(key, p.number);
    const backed = mostBacked(race.raceId, race.field.map((h) => h.number), odds, morning);
    if (backed !== null) {
      place("mvt-joue-sg", backed);
      place("mvt-joue-sp", backed);
    }
    race.field.forEach((h, i) => {
      const keys = confrontationKeys({
        number: h.number,
        odds: odds[i],
        market: market[i] * 100,
        ai: fundamental[i] * 100,
        morning: morning.get(`${race.raceId}|${h.number}`),
        pools: pools.get(race.raceId) ?? [],
      });
      keys.forEach((key) => place(key, h.number));
    });
    const surprises = surpriseNumbers(
      race.field.map((h, i) => ({
        ...h,
        odds: odds[i],
        market: market[i] * 100,
        ai: fundamental[i] * 100,
        morning: morning.get(`${race.raceId}|${h.number}`),
        pools: pools.get(race.raceId) ?? [],
      })),
    );
    for (const n of surprises) {
      place("surprise-sg", n);
      place("surprise-sp", n);
    }
    const favorite = race.field.map((h, i) => ({ n: h.number, o: odds[i] })).filter((x) => x.o > 1).sort((a, b) => a.o - b.o)[0];
    if (favorite) place("favori-marche-sg", favorite.n);
    for (const h of race.field) if (odds[byNumber.get(h.number)!] > 1) place("tous-sg", h.number);

    // Tickets du site (propositions, tickets à X, stratégies), chiffrés sur les rapports officiels.
    const tickets = raceTickets(
      race.field.map((h, i) => ({ ...h, odds: odds[i], fundamental: fundamental[i] })),
      books.get(race.raceId),
      { discipline: race.discipline, specialty: info?.specialty, distance: info?.distance, going: info?.going, raceDate: race.date },
    );
    if (tickets.length > 0) ticketRaceDays.push(race.date);
    for (const t of tickets) {
      const entry = ticketBets.get(t.key) ?? { meta: { key: t.key, label: t.label, source: t.source, betType: t.betType }, bets: [] };
      entry.bets.push({ race: raceIndex, hit: t.hit, dividend: t.returned, stake: t.stake, odds: NaN, day: race.date, discipline: race.discipline });
      ticketBets.set(t.key, entry);
    }

    if (process.argv.includes("--dump")) {
      race.field.forEach((h, i) => {
        const p = profiled.find((x) => x.number === h.number)!;
        dump.push({ r: raceIndex, d: race.discipline, n: race.field.length, odds: odds[i], m: market[i], f: fundamental[i], s: shown[i], t3: top3[i], rank: p.rank, prof: p.profile, sg: pay.SG.get(h.number) ?? 0, sp: pay.SP.get(h.number) ?? 0, pos: h.position });
      });
    }

    // Diagnostic des grosses cotes : où se situe, s'il existe, un désaccord IA/marché rentable ?
    const fundOrder = fundamental.map((p, i) => [p, i] as const).sort((a, b) => b[0] - a[0]).map(([, i]) => i);
    race.field.forEach((h, i) => {
      if (!(odds[i] >= 10)) return;
      longshots.push({
        ratio: fundamental[i] / market[i],
        fundRank: fundOrder.indexOf(i) + 1,
        odds: odds[i],
        sg: pay.SG.get(h.number) ?? null,
        sp: pay.SP.size > 0 ? (pay.SP.get(h.number) ?? 0) : null,
      });
    });
  }

  ages.sort((a, b) => a - b);
  const signals = SIGNALS.map((s) => {
    const signalBets = bets.get(s.key)!;
    return {
      ...s,
      ...summarizeWithPeriods(signalBets, payoutRaceDays, s.frozenAt),
      ...(BREAKDOWN_SIGNALS.includes(s.key) ? { byDiscipline: breakdown(signalBets, "discipline"), bySpecialty: breakdown(signalBets, "specialty") } : {}),
    };
  });
  const ticketRows = [...ticketBets.values()]
    .sort((a, b) => a.meta.source.localeCompare(b.meta.source) || a.meta.key.localeCompare(b.meta.key))
    .map(({ meta: m, bets: b }) => ({ ...m, ...summarizeWithPeriods(b, ticketRaceDays, PROFILES_FROZEN_AT) }));

  const report = {
    generatedAt: new Date().toISOString(),
    modelVersion: MODEL_VERSION,
    fundamentalVersion: FUNDAMENTAL_VERSION,
    profilesVersion: PROFILES_VERSION,
    profilesFrozenAt: PROFILES_FROZEN_AT,
    primarySignal: PRIMARY_SIGNAL,
    modelWeight: MODEL_WEIGHT,
    period: { from, to: used.at(-1)?.date ?? from },
    rules: {
      decisionOddsLeadMinutes: leadMinutes,
      stake: "1 € par pari (1 € par combinaison pour un ticket à X)",
      payouts: "rapports officiels PMU pour 1 €, prélèvement déduit",
      outOfSample: `modèle fondamental ajusté sur les courses antérieures au ${FUNDAMENTAL_TRAIN_CUTOFF} ; seuils des profils figés le ${PROFILES_FROZEN_AT}, chaque signal étant mesuré hors échantillon à partir de la date de gel de ses propres règles`,
      closingOdds: "cote finale approchée par le dernier relevé avant l'heure de départ prévue, comptée seulement s'il est postérieur à la cote de décision",
      multipleTesting: `p-valeur unilatérale (ROI > 0) par rééchantillonnage, corrigée par la méthode de Holm ; signal principal déclaré à l'avance : ${PRIMARY_SIGNAL}`,
    },
    racesConsidered: races.length,
    racesEvaluated: evaluated,
    racesWithPayouts: payoutRaceDays.length,
    oddsAgeMinutes: {
      median: Math.round(quantile(ages, 0.5)),
      p25: Math.round(quantile(ages, 0.25)),
      p75: Math.round(quantile(ages, 0.75)),
      within30: ages.filter((a) => a <= 30).length / Math.max(ages.length, 1),
    },
    accuracy: {
      winnerFoundShown: ll.get(`w${MODEL_WEIGHT}`)?.top1 ?? null,
      top3HitsPerRace: top3Hits / Math.max(evaluated, 1),
      byModel: [...ll.entries()].map(([key, s]) => ({
        key,
        logLoss: s.sum / Math.max(evaluated, 1),
        winnerFound: s.top1 / Math.max(evaluated, 1),
      })),
    },
    /** Calibration de la probabilité affichée, en tranches logarithmiques (< 1 %, 1-2 %, 2-4 %… 32 % et plus). */
    calibration: logCalibration(calibrationObs),
    calibrationScheme: "log2",
    oddsBands: oddsBandAE(runnerObs),
    monthlyLogLoss: monthlyLogLoss(raceLogLoss),
    profileShare: Object.fromEntries([...profileCounts.entries()].map(([p, n]) => [PROFILE_LABELS[p], n])),
    signals,
    multipleTesting: {
      outOfSample: testFamily(signals.map((s) => ({ ...s, pValue: s.outOfSample?.pValue }))),
      inSample: testFamily(signals.map((s) => ({ ...s, pValue: s.inSample?.pValue }))),
    },
    tickets: {
      races: ticketRaceDays.length,
      frozenAt: PROFILES_FROZEN_AT,
      rows: ticketRows,
      unpriceable: UNPRICEABLE_FORMATS,
    },
    longshotDiagnostics: diagnose(longshots),
    live: await liveTracking(sql),
  };

  const pct = (v: number) => (Number.isFinite(v) ? `${v >= 0 ? "+" : ""}${(v * 100).toFixed(1)} %` : "—");
  console.log(`\nBacktest ${report.period.from} → ${report.period.to} : ${evaluated} courses évaluées sur ${races.length}, ${payoutRaceDays.length} avec rapports officiels`);
  console.log(`Âge des cotes de décision : médiane ${report.oddsAgeMinutes.median} min (25 % : ${report.oddsAgeMinutes.p25}, 75 % : ${report.oddsAgeMinutes.p75}) — ${Math.round(report.oddsAgeMinutes.within30 * 100)} % à moins de 30 min\n`);
  for (const m of report.accuracy.byModel) console.log(`  ${m.key.padEnd(12)} logLoss ${m.logLoss.toFixed(4)}  gagnant trouvé ${(m.winnerFound * 100).toFixed(1)} %`);
  console.log(`  Top 3 : ${report.accuracy.top3HitsPerRace.toFixed(2)} cheval sur 3 en moyenne\n`);
  console.log("Log loss par mois (modèle / marché / affiché) :");
  for (const m of report.monthlyLogLoss) console.log(`  ${m.month}  n=${String(m.races).padStart(5)}  ${m.model.toFixed(4)}  ${m.market.toFixed(4)}  ${m.blend.toFixed(4)}`);
  console.log(`\n${"Signal".padEnd(28)}${"Gel".padStart(12)}${"Ajust. n".padStart(10)}${"ROI".padStart(9)}${"Hors éch. n".padStart(13)}${"ROI".padStart(9)}${"IC 90 %".padStart(20)}${"p Holm".padStart(9)}`);
  const holm = new Map(report.multipleTesting.outOfSample.rows.map((r) => [r.key, r.holm]));
  for (const s of report.signals) {
    const oos = s.outOfSample;
    console.log(
      `${`${s.label} (${s.betType})`.padEnd(28)}${s.frozenAt.padStart(12)}${String(s.inSample?.bets ?? 0).padStart(10)}${pct(s.inSample?.roi ?? NaN).padStart(9)}${String(oos?.bets ?? 0).padStart(13)}${pct(oos?.roi ?? NaN).padStart(9)}${(oos ? `[${pct(oos.roiLow)} ; ${pct(oos.roiHigh)}]` : "—").padStart(20)}${(holm.get(s.key)?.toFixed(3) ?? "—").padStart(9)}`,
    );
  }
  const mt = report.multipleTesting.outOfSample;
  console.log(`\nTests multiples hors échantillon : ${mt.tested} signaux testés, ${mt.survivors.length} survivent à Holm (α = ${mt.alpha}). Signal principal ${mt.primary.key} : p = ${Number.isFinite(mt.primary.pValue) ? mt.primary.pValue.toFixed(3) : "—"}.`);
  console.log(`\nTickets du site (${ticketRaceDays.length} courses chiffrables) :`);
  for (const t of ticketRows) console.log(`  ${t.label.padEnd(48)} n=${String(t.bets).padStart(5)}  mises ${String(t.staked).padStart(8)} €  ROI ${pct(t.roi).padStart(8)}  [${pct(t.roiLow)} ; ${pct(t.roiHigh)}]`);
  console.log("  Non chiffrables :", UNPRICEABLE_FORMATS.map((f) => f.label).join(" ; "));
  console.log("\nProfils attribués :", report.profileShare);
  console.log("\nGrosses cotes (≥ 10/1) selon l'avis de l'IA :");
  for (const d of report.longshotDiagnostics) {
    console.log(`  ${d.label.padEnd(34)} n=${String(d.n).padStart(5)}  gagnant ${(d.winRate * 100).toFixed(1)} %  ROI SG ${(d.roiSG * 100).toFixed(1)} %  ROI SP ${(d.roiSP * 100).toFixed(1)} %`);
  }

  if (process.argv.includes("--dump")) {
    (await import("node:fs")).writeFileSync(arg("dump", "backtest-dump.json"), JSON.stringify(dump));
    console.log(`\n${dump.length} partants exportés.`);
  }
  if (process.argv.includes("--dry-run")) return;
  await sql.query(`insert into track_record_reports (report) values ($1::jsonb)`, [JSON.stringify(report)]);
  console.log("\nRapport enregistré dans track_record_reports.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
