#!/usr/bin/env -S npx tsx
/**
 * BACKTEST ET SUIVI — ce que chaque signal aurait rapporté, net du prélèvement.
 *
 * Règles, toutes destinées à empêcher la fuite d'information :
 *   1. Période hors échantillon : uniquement les courses postérieures à la date
 *      d'ajustement du modèle fondamental (`trainCutoff` de model.json).
 *   2. Cote de décision : pour chaque cheval, le dernier relevé de cote observé
 *      AU MOINS 15 minutes avant le départ (`odds_snapshots`). Jamais la cote
 *      finale, qui n'est connue qu'après la clôture des enjeux. L'âge réel de
 *      ces cotes est publié avec le rapport.
 *   3. Variables d'entourage calculées avec les seules courses antérieures.
 *   4. Gains : rapports officiels PMU pour 1 € (`race_payouts`). Le prélèvement
 *      du PMU y est déjà déduit : le ROI est donc net.
 *   5. Mise fixe de 1 € par pari. Intervalle à 90 % par rééchantillonnage des
 *      courses (bootstrap, 1 000 tirages).
 *   6. Série quotidienne cumulée par signal (`daily`, 90 points au plus) pour /track-record.
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
import { PROFILES_VERSION, PROFILE_LABELS, classifyField, type Profile } from "@/lib/profiles";
import { decisionOdds as loadDecisionOdds, morningOdds, officialPayouts, poolsUntil } from "./lib/backtest-data";
import { confrontationKeys, mostBacked, surpriseNumbers } from "./lib/backtest-signals";
import { loadDataset, loadLocalEnv, type DatasetRace } from "./lib/dataset";
import { dailySeries, quantile, summarize, type Bet } from "./lib/signal-stats";

type BetType = "SG" | "SP";
type SignalDef = { key: string; label: string; betType: BetType; description: string };

const SIGNALS: SignalDef[] = [
  { key: "rank1-sg", label: "N° 1 de la sélection", betType: "SG", description: "Simple gagnant sur le premier de notre classement" },
  { key: "rank1-sp", label: "N° 1 de la sélection", betType: "SP", description: "Simple placé sur le premier de notre classement" },
  { key: "base-sp", label: "Base", betType: "SP", description: "Simple placé sur chaque cheval classé Base" },
  { key: "cache-sg", label: "Caché", betType: "SG", description: "Simple gagnant sur chaque cheval classé Caché" },
  { key: "cache-sp", label: "Caché", betType: "SP", description: "Simple placé sur chaque cheval classé Caché" },
  { key: "value-sg", label: "Value", betType: "SG", description: "Simple gagnant sur chaque cheval classé Value" },
  { key: "outsider-sp", label: "Outsider", betType: "SP", description: "Simple placé sur chaque cheval classé Outsider" },
  { key: "tocard-sg", label: "Tocard", betType: "SG", description: "Simple gagnant sur chaque cheval classé Tocard" },
  { key: "eviter-sg", label: "À éviter", betType: "SG", description: "Simple gagnant sur chaque cheval classé À éviter (contrôle : doit perdre)" },
  { key: "mvt-joue-sg", label: "Plus joué (MVT)", betType: "SG", description: "Simple gagnant sur le cheval dont la cote a le plus baissé depuis le matin (au moins 10 %)" },
  { key: "mvt-joue-sp", label: "Plus joué (MVT)", betType: "SP", description: "Simple placé sur le cheval dont la cote a le plus baissé depuis le matin (au moins 10 %)" },
  { key: "conf-accord-sg", label: "Accord IA + marché", betType: "SG", description: "Simple gagnant sur chaque cheval où l'IA et le marché convergent (au moins 8 % pour l'un des deux)" },
  { key: "conf-ia-sg", label: "Favori IA", betType: "SG", description: "Simple gagnant sur chaque cheval nettement plus haut chez l'IA que sur le marché" },
  { key: "conf-accord-sp", label: "Accord IA + marché", betType: "SP", description: "Simple placé sur chaque cheval où l'IA et le marché convergent (au moins 8 % pour l'un des deux)" },
  { key: "conf-ia-sp", label: "Favori IA", betType: "SP", description: "Simple placé sur chaque cheval nettement plus haut chez l'IA que sur le marché" },
  { key: "conf-marche-sg", label: "Favori marché", betType: "SG", description: "Simple gagnant sur chaque cheval nettement plus soutenu par le marché que par l'IA" },
  { key: "argent-entrant-sg", label: "Argent entrant", betType: "SG", description: "Simple gagnant sur chaque cheval qui gagne 2 points de part des mises en 15 minutes" },
  { key: "argent-sortant-sg", label: "Argent sortant", betType: "SG", description: "Contrôle : simple gagnant sur chaque cheval qui perd 2 points de part des mises en 15 minutes" },
  { key: "smart-money-sg", label: "Smart money", betType: "SG", description: "Simple gagnant quand l'argent entre ou accélère, que la cote baisse et que l'IA est favorable ou d'accord" },
  { key: "surprise-sg", label: "Surprise IA", betType: "SG", description: "Simple gagnant sur chaque alerte forte ou possible du score de surprise (trois au plus par course)" },
  { key: "surprise-sp", label: "Surprise IA", betType: "SP", description: "Simple placé sur chaque alerte forte ou possible du score de surprise (trois au plus par course)" },
  { key: "favori-marche-sg", label: "Favori du marché", betType: "SG", description: "Référence : simple gagnant sur la plus petite cote" },
  { key: "tous-sg", label: "Tous les partants", betType: "SG", description: "Référence : 1 € gagnant sur chaque partant — le coût du prélèvement" },
];

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
 * échantillon des seuils de profils, fixés sur le backtest.
 */
async function liveTracking(sql: NeonQueryFunction<false, false>) {
  const rows = (await sql.query(
    `select s.race_id, s.captured_at::text as captured_at,
            ((s.captured_at at time zone 'Europe/Paris')::date)::text as day, s.payload
       from prediction_snapshots s
      where s.stage = 'H-2'
        and exists (select 1 from race_payouts p where p.race_id = s.race_id and p.bet_type = 'SIMPLE_GAGNANT')
      order by s.captured_at`,
  )) as Array<{
    race_id: string;
    captured_at: string;
    day: string;
    payload: { numbers: number[]; odds: Array<number | null>; profile?: Profile[]; market?: number[]; ai?: Array<number | null> };
  }>;
  if (rows.length === 0) return { since: null, races: 0, signals: [] };

  const pay = await officialPayouts(sql, rows.map((r) => r.race_id));
  // Non-partants tardifs : un cheval retiré après le dernier gel H-2 (au départ)
  // figure encore dans le pronostic gelé, mais sa ligne `entries` a été
  // supprimée par le rafraîchissement. Le PMU rembourse ces mises : ce ne sont
  // ni des paris perdus ni des paris gagnés, ils sont donc écartés.
  const runnerRows = (await sql.query(
    `select race_id, array_agg(number)::int[] as numbers from entries where race_id = any($1) group by race_id`,
    [rows.map((r) => r.race_id)],
  )) as Array<{ race_id: string; numbers: number[] }>;
  const runners = new Map(runnerRows.map((r) => [r.race_id, new Set(r.numbers.map(Number))]));

  const morning = await morningOdds(sql, rows.map((r) => r.race_id), 2);
  const livePools = await poolsUntil(
    sql,
    rows.map((r) => r.race_id),
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
      bets.get(key)!.push({ race: raceIndex, hit: dividend !== undefined, dividend: dividend ?? 0, odds: odds[i] ?? NaN, day: row.day });
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

  return {
    since: rows[0].captured_at,
    races: rows.length,
    signals: SIGNALS.map((s) => ({ ...s, ...summarize(bets.get(s.key)!, rows.length), daily: dailySeries(bets.get(s.key)!) })),
  };
}

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
  const morning = await morningOdds(sql, raceIds, leadMinutes);
  const pools = await poolsUntil(
    sql,
    raceIds,
    `((r.race_date + replace(r.start_time, 'h', ':')::time) at time zone 'Europe/Paris') - make_interval(mins => $2)`,
    [leadMinutes],
  );

  const payouts = await officialPayouts(sql, raceIds);

  const bets = new Map<string, Bet[]>(SIGNALS.map((s) => [s.key, []]));
  const weights = [0, 0.05, 0.1, 0.15, 0.2];
  const ll = new Map<string, { sum: number; top1: number }>([
    ["marche", { sum: 0, top1: 0 }],
    ["fondamental", { sum: 0, top1: 0 }],
    ...weights.map((w) => [`w${w}`, { sum: 0, top1: 0 }] as [string, { sum: number; top1: number }]),
  ]);
  const calibration = Array.from({ length: 10 }, () => ({ announced: 0, wins: 0, n: 0 }));
  const ages: number[] = [];
  let evaluated = 0;
  let withPayouts = 0;
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
      s.sum += -Math.log(Math.max(p[race.winner], 1e-12));
      if (p.indexOf(Math.max(...p)) === race.winner) s.top1++;
    };
    scoreLl("marche", market);
    scoreLl("fondamental", fundamental);
    for (const w of weights) scoreLl(`w${w}`, blendProbabilities(market, fundamental, w));

    shown.forEach((p, i) => {
      const b = calibration[Math.min(9, Math.floor(p * 10))];
      b.announced += p;
      b.n++;
      if (i === race.winner) b.wins++;
    });

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
    withPayouts++;
    const byNumber = new Map(race.field.map((h, i) => [h.number, i]));
    const place = (key: string, number: number) => {
      const def = SIGNALS.find((s) => s.key === key)!;
      const table = def.betType === "SG" ? pay.SG : pay.SP;
      const dividend = table.get(number);
      bets.get(key)!.push({ race: raceIndex, hit: dividend !== undefined, dividend: dividend ?? 0, odds: odds[byNumber.get(number)!], day: race.date });
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
  const report = {
    generatedAt: new Date().toISOString(),
    modelVersion: MODEL_VERSION,
    fundamentalVersion: FUNDAMENTAL_VERSION,
    profilesVersion: PROFILES_VERSION,
    modelWeight: MODEL_WEIGHT,
    period: { from, to: used.at(-1)?.date ?? from },
    rules: {
      decisionOddsLeadMinutes: leadMinutes,
      stake: "1 € par pari",
      payouts: "rapports officiels PMU pour 1 €, prélèvement déduit",
      outOfSample: `modèle fondamental ajusté sur les courses antérieures au ${FUNDAMENTAL_TRAIN_CUTOFF}`,
    },
    racesConsidered: races.length,
    racesEvaluated: evaluated,
    racesWithPayouts: withPayouts,
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
    // Index attribué avant le filtre : une tranche écartée décalait les suivantes.
    calibration: calibration
      .map((b, i) => ({ bucket: i, announced: b.announced / Math.max(b.n, 1), observed: b.wins / Math.max(b.n, 1), n: b.n }))
      .filter((b) => b.n >= 30),
    profileShare: Object.fromEntries([...profileCounts.entries()].map(([p, n]) => [PROFILE_LABELS[p], n])),
    signals: SIGNALS.map((s) => ({ ...s, ...summarize(bets.get(s.key)!, withPayouts), daily: dailySeries(bets.get(s.key)!) })),
    longshotDiagnostics: diagnose(longshots),
    live: await liveTracking(sql),
  };

  console.log(`\nBacktest ${report.period.from} → ${report.period.to} : ${evaluated} courses évaluées sur ${races.length}, ${withPayouts} avec rapports officiels`);
  console.log(`Âge des cotes de décision : médiane ${report.oddsAgeMinutes.median} min (25 % : ${report.oddsAgeMinutes.p25}, 75 % : ${report.oddsAgeMinutes.p75}) — ${Math.round(report.oddsAgeMinutes.within30 * 100)} % à moins de 30 min\n`);
  for (const m of report.accuracy.byModel) console.log(`  ${m.key.padEnd(12)} logLoss ${m.logLoss.toFixed(4)}  gagnant trouvé ${(m.winnerFound * 100).toFixed(1)} %`);
  console.log(`  Top 3 : ${report.accuracy.top3HitsPerRace.toFixed(2)} cheval sur 3 en moyenne\n`);
  console.log(`${"Signal".padEnd(28)}${"Paris".padStart(7)}${"Réussite".padStart(10)}${"ROI".padStart(9)}${"IC 90 %".padStart(20)}`);
  for (const s of report.signals) {
    const pct = (v: number) => `${v >= 0 ? "+" : ""}${(v * 100).toFixed(1)} %`;
    console.log(
      `${`${s.label} (${s.betType})`.padEnd(28)}${String(s.bets).padStart(7)}${`${(s.hitRate * 100).toFixed(1)} %`.padStart(10)}${pct(s.roi).padStart(9)}${`[${pct(s.roiLow)} ; ${pct(s.roiHigh)}]`.padStart(20)}`,
    );
  }
  console.log("\nProfils attribués :", report.profileShare);
  console.log("\nGrosses cotes (≥ 10/1) selon l'avis de l'IA :");
  for (const d of report.longshotDiagnostics) {
    console.log(`  ${d.label.padEnd(34)} n=${String(d.n).padStart(5)}  gagnant ${(d.winRate * 100).toFixed(1)} %  ROI SG ${(d.roiSG * 100).toFixed(1)} %  ROI SP ${(d.roiSP * 100).toFixed(1)} %`);
  }

  if (process.argv.includes("--dump")) {
    (await import("node:fs")).writeFileSync(arg("dump", "backtest-dump.json"), JSON.stringify(dump));
    console.log(`
${dump.length} partants exportés.`);
  }
  if (process.argv.includes("--dry-run")) return;
  await sql.query(`insert into track_record_reports (report) values ($1::jsonb)`, [JSON.stringify(report)]);
  console.log("\nRapport enregistré dans track_record_reports.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
