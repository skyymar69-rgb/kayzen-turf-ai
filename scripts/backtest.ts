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
import { MVT_NOISE_PCT } from "@/lib/market";
import { PROFILES_VERSION, PROFILE_LABELS, classifyField, type Profile } from "@/lib/profiles";
import { loadDataset, loadLocalEnv, type DatasetRace } from "./lib/dataset";

type BetType = "SG" | "SP";
type Bet = { race: number; hit: boolean; dividend: number; odds: number };
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

function quantile(sorted: number[], q: number) {
  if (sorted.length === 0) return NaN;
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

/** ROI et intervalle à 90 % par rééchantillonnage des courses. */
function summarize(bets: Bet[], raceCount: number) {
  const n = bets.length;
  const returned = bets.reduce((s, b) => s + (b.hit ? b.dividend : 0), 0);
  const roi = n ? (returned - n) / n : NaN;

  const byRace = new Map<number, Bet[]>();
  for (const b of bets) byRace.set(b.race, [...(byRace.get(b.race) ?? []), b]);
  const groups = [...byRace.values()];
  const rois: number[] = [];
  let seed = 12345;
  const rand = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
  for (let k = 0; k < 1000 && groups.length > 0; k++) {
    let staked = 0;
    let ret = 0;
    for (let i = 0; i < groups.length; i++) {
      const g = groups[Math.floor(rand() * groups.length)];
      staked += g.length;
      ret += g.reduce((s, b) => s + (b.hit ? b.dividend : 0), 0);
    }
    rois.push((ret - staked) / staked);
  }
  rois.sort((a, b) => a - b);
  return {
    bets: n,
    races: byRace.size,
    raceCoverage: raceCount ? byRace.size / raceCount : 0,
    hits: bets.filter((b) => b.hit).length,
    hitRate: n ? bets.filter((b) => b.hit).length / n : NaN,
    staked: n,
    returned: Math.round(returned * 100) / 100,
    roi,
    roiLow: quantile(rois, 0.05),
    roiHigh: quantile(rois, 0.95),
    averageOdds: n ? bets.reduce((s, b) => s + b.odds, 0) / n : NaN,
  };
}

/**
 * Cote du matin : premier relevé du jour de la course, par numéro, pris au plus
 * tard `leadMinutes` avant le départ (même référence que la page course).
 */
async function morningOdds(sql: NeonQueryFunction<false, false>, raceIds: string[], leadMinutes: number) {
  const rows = (await sql.query(
    `select distinct on (o.race_id, o.horse_id) o.race_id, e.number, o.odds::float8 as odds
       from odds_snapshots o
       join races r on r.id = o.race_id
       join entries e on e.race_id = o.race_id and e.horse_id = o.horse_id
      where o.race_id = any($1)
        and (o.observed_at at time zone 'Europe/Paris')::date = r.race_date
        and o.observed_at <= ((r.race_date + replace(r.start_time, 'h', ':')::time) at time zone 'Europe/Paris') - make_interval(mins => $2)
      order by o.race_id, o.horse_id, o.observed_at`,
    [raceIds, leadMinutes],
  )) as Array<{ race_id: string; number: number; odds: number }>;
  return new Map(rows.map((r) => [`${r.race_id}|${r.number}`, r.odds]));
}

/** Numéro du cheval le plus joué depuis le matin, si sa cote a baissé d'au moins MVT_NOISE_PCT. */
function mostBacked(raceId: string, numbers: number[], odds: Array<number | null>, morning: Map<string, number>): number | null {
  let best: { number: number; change: number } | null = null;
  numbers.forEach((number, i) => {
    const ref = morning.get(`${raceId}|${number}`);
    const now = odds[i];
    if (!ref || !(ref > 1) || now == null || !(now > 1)) return;
    const change = ((now - ref) / ref) * 100;
    if (!best || change < best.change) best = { number, change };
  });
  const found = best as { number: number; change: number } | null;
  return found && found.change <= -MVT_NOISE_PCT ? found.number : null;
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
    `select s.race_id, s.captured_at::text as captured_at, s.payload
       from prediction_snapshots s
      where s.stage = 'H-2'
        and exists (select 1 from race_payouts p where p.race_id = s.race_id and p.bet_type = 'SIMPLE_GAGNANT')
      order by s.captured_at`,
  )) as Array<{ race_id: string; captured_at: string; payload: { numbers: number[]; odds: Array<number | null>; profile?: Profile[] } }>;
  if (rows.length === 0) return { since: null, races: 0, signals: [] };

  const payoutRows = (await sql.query(
    `select race_id, bet_type, combination, dividend::float8 as dividend
       from race_payouts where race_id = any($1) and bet_type in ('SIMPLE_GAGNANT', 'SIMPLE_PLACE')`,
    [rows.map((r) => r.race_id)],
  )) as Array<{ race_id: string; bet_type: string; combination: string; dividend: number }>;
  const pay = new Map<string, { SG: Map<number, number>; SP: Map<number, number> }>();
  for (const p of payoutRows) {
    const e = pay.get(p.race_id) ?? { SG: new Map(), SP: new Map() };
    e[p.bet_type === "SIMPLE_GAGNANT" ? "SG" : "SP"].set(Number(p.combination), p.dividend);
    pay.set(p.race_id, e);
  }

  const morning = await morningOdds(sql, rows.map((r) => r.race_id), 2);
  const bets = new Map<string, Bet[]>(SIGNALS.map((s) => [s.key, []]));
  rows.forEach((row, raceIndex) => {
    const table = pay.get(row.race_id)!;
    const { numbers, odds, profile } = row.payload;
    const place = (key: string, i: number) => {
      const def = SIGNALS.find((s) => s.key === key)!;
      const dividend = (def.betType === "SG" ? table.SG : table.SP).get(numbers[i]);
      bets.get(key)!.push({ race: raceIndex, hit: dividend !== undefined, dividend: dividend ?? 0, odds: odds[i] ?? NaN });
    };
    place("rank1-sg", 0);
    place("rank1-sp", 0);
    if (profile) profile.forEach((p, i) => (PROFILE_SIGNAL[p] ?? []).forEach((key) => place(key, i)));
    const backed = mostBacked(row.race_id, numbers, odds, morning);
    if (backed !== null) {
      place("mvt-joue-sg", numbers.indexOf(backed));
      place("mvt-joue-sp", numbers.indexOf(backed));
    }
    const fav = odds.map((o, i) => [o ?? Infinity, i] as const).sort((a, b) => a[0] - b[0])[0];
    if (fav && Number.isFinite(fav[0])) place("favori-marche-sg", fav[1]);
    odds.forEach((o, i) => o && place("tous-sg", i));
  });

  return {
    since: rows[0].captured_at,
    races: rows.length,
    signals: SIGNALS.map((s) => ({ ...s, ...summarize(bets.get(s.key)!, rows.length) })),
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

  const decision = (await sql.query(
    `select distinct on (o.race_id, o.horse_id) o.race_id, o.horse_id, o.odds::float8 as odds,
            (extract(epoch from (((r.race_date + replace(r.start_time, 'h', ':')::time) at time zone 'Europe/Paris') - o.observed_at)) / 60)::float8 as age
       from odds_snapshots o
       join races r on r.id = o.race_id
      where o.race_id = any($1)
        and o.observed_at <= ((r.race_date + replace(r.start_time, 'h', ':')::time) at time zone 'Europe/Paris') - make_interval(mins => $2)
      order by o.race_id, o.horse_id, o.observed_at desc`,
    [raceIds, leadMinutes],
  )) as Array<{ race_id: string; horse_id: string; odds: number; age: number }>;
  const decisionOdds = new Map(decision.map((d) => [`${d.race_id}|${d.horse_id}`, d]));
  const morning = await morningOdds(sql, raceIds, leadMinutes);

  const payoutRows = (await sql.query(
    `select race_id, bet_type, combination, dividend::float8 as dividend
       from race_payouts where race_id = any($1) and bet_type in ('SIMPLE_GAGNANT', 'SIMPLE_PLACE')`,
    [raceIds],
  )) as Array<{ race_id: string; bet_type: string; combination: string; dividend: number }>;
  const payouts = new Map<string, { SG: Map<number, number>; SP: Map<number, number> }>();
  for (const p of payoutRows) {
    const entry = payouts.get(p.race_id) ?? { SG: new Map(), SP: new Map() };
    entry[p.bet_type === "SIMPLE_GAGNANT" ? "SG" : "SP"].set(Number(p.combination), p.dividend);
    payouts.set(p.race_id, entry);
  }

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
      bets.get(key)!.push({ race: raceIndex, hit: dividend !== undefined, dividend: dividend ?? 0, odds: odds[byNumber.get(number)!] });
    };

    place("rank1-sg", profiled[0].number);
    place("rank1-sp", profiled[0].number);
    for (const p of profiled) for (const key of PROFILE_SIGNAL[p.profile] ?? []) place(key, p.number);
    const backed = mostBacked(race.raceId, race.field.map((h) => h.number), odds, morning);
    if (backed !== null) {
      place("mvt-joue-sg", backed);
      place("mvt-joue-sp", backed);
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
    calibration: calibration
      .filter((b) => b.n >= 30)
      .map((b, i) => ({ bucket: i, announced: b.announced / b.n, observed: b.wins / b.n, n: b.n })),
    profileShare: Object.fromEntries([...profileCounts.entries()].map(([p, n]) => [PROFILE_LABELS[p], n])),
    signals: SIGNALS.map((s) => ({ ...s, ...summarize(bets.get(s.key)!, withPayouts) })),
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
