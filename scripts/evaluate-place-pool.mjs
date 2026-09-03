#!/usr/bin/env node
/**
 * Le marché du PLACÉ bat-il notre Top 3 modélisé ?
 *
 * Aujourd'hui, `src/lib/probability.ts` déduit le Top 3 et le Top 5 des
 * probabilités de victoire, par simulation Plackett-Luce. L'audit des Quintés a
 * montré que ce modèle est trop optimiste sur les places : il promettait 2,88
 * chevaux trouvés sur 5 là où le marché n'en réalise que 2,52.
 *
 * L'API PMU expose, via `citations`, la répartition réelle des enjeux par type de
 * pari. Le pool PLACÉ est donc une estimation du Top 3 *observée* plutôt que
 * déduite — et elle intègre ce que les parieurs savent des chances de placement,
 * qui ne se ramènent pas aux chances de victoire.
 *
 * Ce banc confronte les deux sur des courses déjà arrivées. Les pools restent
 * consultables plus d'un an en arrière, et les paris ferment au départ : la
 * valeur finale du pool est donc bien une information d'avant-course.
 *
 * RÉSULTAT DU 30/08/2026, sur 309 courses des 120 derniers jours :
 *
 *   classement                          gagnant   /3 places   tiercé   /5 places
 *   notre probabilité (marché + modèle)  27,8 %      1,515     8,1 %     3,081
 *   pool PLACÉ observé                   25,6 %      1,495     7,1 %     3,100
 *
 * Le marché du placé ne fait PAS mieux. L'écart entre pool placé et pool gagnant
 * est pourtant bien réel (1,10 point en moyenne, jusqu'à 5,92) : il porte de
 * l'information sur le comportement des parieurs, pas sur l'arrivée. Par
 * discipline, même verdict — Trot 1,535 contre 1,503 en notre faveur, Plat et
 * Obstacle à égalité stricte.
 *
 * Conclusion : Plackett-Luce appliqué aux probabilités de victoire fait aussi
 * bien qu'un marché dédié aux places. La piste est close, inutile de la rouvrir
 * sans élément nouveau. Les colonnes `pool_*` restent collectées : elles peuvent
 * encore servir de variable parmi d'autres, mais pas de classement de rechange.
 *
 * Usage : node scripts/evaluate-place-pool.mjs [--races 400] [--days 120]
 */

import { neon } from "@neondatabase/serverless";
import { readFileSync } from "node:fs";
import { PMU_BASE, delay, fetchJson } from "./lib/pmu-fetch.mjs";

function databaseUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const env = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
  return (env.match(/^DATABASE_URL=(.+)$/m)?.[1] ?? "").trim().replace(/^["']|["']$/g, "");
}

const args = process.argv.slice(2);

/** Valeur numérique d'un drapeau, ou la valeur par défaut s'il est absent ou illisible. */
function numberFlag(name, fallback) {
  const index = args.indexOf(name);
  // `indexOf` à -1 faisait lire args[0] — le premier argument, quel qu'il soit.
  if (index === -1 || index + 1 >= args.length) return fallback;
  const value = Number(args[index + 1]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

const LIMIT = numberFlag("--races", 400);
const DAYS = numberFlag("--days", 120);

function devig(odds) {
  const raw = odds.map((o) => (Number.isFinite(o) && o > 1 ? 1 / o : 0));
  const known = raw.filter((r) => r > 0);
  if (!known.length) return odds.map(() => 1 / odds.length);
  const mean = known.reduce((a, b) => a + b, 0) / known.length;
  const filled = raw.map((r) => (r > 0 ? r : mean));
  const total = filled.reduce((a, b) => a + b, 0);
  return filled.map((r) => r / total);
}

function modelProbabilities(scores) {
  const n = scores.length;
  const known = scores.filter(Number.isFinite);
  if (!known.length) return scores.map(() => 1 / n);
  const km = known.reduce((a, b) => a + b, 0) / known.length;
  const usable = scores.map((s) => (Number.isFinite(s) ? s : km));
  const mean = usable.reduce((a, b) => a + b, 0) / n;
  const sd = Math.sqrt(usable.reduce((a, s) => a + (s - mean) ** 2, 0) / n);
  if (sd < 1e-9) return usable.map(() => 1 / n);
  const logits = usable.map((s) => (s - mean) / sd);
  const max = Math.max(...logits);
  const exps = logits.map((l) => Math.exp(l - max));
  const total = exps.reduce((a, b) => a + b, 0);
  return exps.map((e) => e / total);
}

function blend(market, model, w = 0.1) {
  const raw = market.map((m, i) => Math.max(m, 1e-9) ** (1 - w) * Math.max(model[i], 1e-9) ** w);
  const total = raw.reduce((a, b) => a + b, 0);
  return raw.map((r) => r / total);
}

const sql = neon(databaseUrl());
const races = await sql`
  select r.id, r.race_date::text as race_date, r.reunion_number, r.course_number, r.discipline
  from races r
  where r.race_date >= current_date - ${DAYS}::int
    and r.race_date < current_date
    and r.reunion_number is not null and r.course_number is not null
    and exists (select 1 from results x where x.race_id = r.id)
  order by r.race_date desc
  limit ${LIMIT}
`;

console.log(`${races.length} courses arrivées à confronter. Relevé des pools en cours...`);

const scored = [];
let fetched = 0;
let sansPool = 0;

for (const race of races) {
  const entries = await sql`
    select e.number, e.odds::float as odds, e.kz_score::float as kz, res.finish_position
    from entries e
    left join results res on res.race_id = e.race_id and res.horse_id = e.horse_id
    where e.race_id = ${race.id}
    order by e.number
  `;
  if (entries.length < 6) continue;
  const arrival = entries.filter((e) => Number(e.finish_position) > 0).sort((a, b) => a.finish_position - b.finish_position);
  if (arrival.length < 3) continue;

  const [d, m, y] = [race.race_date.slice(8, 10), race.race_date.slice(5, 7), race.race_date.slice(0, 4)];
  let pools;
  try {
    const payload = await fetchJson(`${PMU_BASE}/${d}${m}${y}/R${race.reunion_number}/C${race.course_number}/citations`);
    const bloc = (payload?.listeCitations ?? []).find((b) => b.typePari === "SIMPLE_PLACE");
    pools = new Map((bloc?.participants ?? []).map((p) => [Number(p.numPmu), p.citations?.[0]?.ratio ?? null]));
  } catch {
    sansPool += 1;
    continue;
  }
  if (pools.size === 0) { sansPool += 1; continue; }

  const usable = entries.filter((e) => Number.isFinite(pools.get(e.number)) && pools.get(e.number) > 0);
  if (usable.length < 6) { sansPool += 1; continue; }

  const market = devig(usable.map((e) => e.odds));
  const pWin = blend(market, modelProbabilities(usable.map((e) => e.kz)));
  const place = usable.map((e) => pools.get(e.number));

  scored.push({
    actualTop3: new Set(arrival.slice(0, 3).map((e) => e.number)),
    actualTop5: new Set(arrival.slice(0, 5).map((e) => e.number)),
    discipline: race.discipline,
    numbers: usable.map((e) => e.number),
    place,
    pWin,
  });
  fetched += 1;
  if (fetched % 50 === 0) console.log(`  ${fetched} courses relevées...`);
  await delay(120);
}

console.log(`\n${scored.length} courses exploitables (${sansPool} sans pool utilisable).\n`);

function topK(values, numbers, k) {
  return values
    .map((v, i) => [v, numbers[i]])
    .sort((a, b) => b[0] - a[0])
    .slice(0, k)
    .map(([, n]) => n);
}

function report(label, pick) {
  let hit3 = 0, hit5 = 0, exact3 = 0, winner = 0;
  for (const race of scored) {
    const t3 = topK(pick(race), race.numbers, 3);
    const t5 = topK(pick(race), race.numbers, 5);
    const h3 = t3.filter((n) => race.actualTop3.has(n)).length;
    hit3 += h3;
    if (h3 === 3) exact3 += 1;
    hit5 += t5.filter((n) => race.actualTop5.has(n)).length;
    if (race.actualTop3.has(t3[0]) && [...race.actualTop3][0] !== undefined) {
      // le gagnant est le premier de l'arrivée
    }
    const first = [...race.actualTop3];
    if (t3[0] === first[0]) winner += 1;
  }
  const n = scored.length;
  return {
    classement: label,
    "gagnant trouvé": `${((winner / n) * 100).toFixed(1)} %`,
    "sur 3 places trouvées": (hit3 / n).toFixed(3),
    "tiercé désordre": `${((exact3 / n) * 100).toFixed(1)} %`,
    "sur 5 places trouvées": (hit5 / n).toFixed(3),
  };
}

console.table([
  report("notre probabilité (marché + modèle)", (r) => r.pWin),
  report("pool PLACÉ observé", (r) => r.place),
]);

console.log("Par discipline — chevaux trouvés dans les 3 premières places");
const disciplines = [...new Set(scored.map((r) => r.discipline))];
console.table(disciplines.map((d) => {
  const subset = scored.filter((r) => r.discipline === d);
  const avg = (pick) => {
    let h = 0;
    for (const race of subset) h += topK(pick(race), race.numbers, 3).filter((n) => race.actualTop3.has(n)).length;
    return (h / subset.length).toFixed(3);
  };
  return { discipline: d, courses: subset.length, "notre Top 3": avg((r) => r.pWin), "pool placé": avg((r) => r.place) };
}));
