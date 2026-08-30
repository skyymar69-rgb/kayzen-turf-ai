#!/usr/bin/env node
/**
 * Rafraîchissement des cotes des courses imminentes.
 *
 * POURQUOI CE SCRIPT EXISTE
 *
 * Le banc `evaluate-model.mjs` établit que le modèle ne bat pas les cotes : le
 * marché est notre prédicteur. Or le marché n'est bon qu'à l'approche du départ.
 * Mesuré sur 4 027 courses (`evaluate-freshness.mjs`) :
 *
 *     cote de départ      37,6 % de gagnants trouvés
 *     3 h à 6 h avant     32,8 %
 *     6 h à 12 h avant    31,0 %
 *     plus de 12 h        21,5 %
 *
 * L'import complet ne tourne que trois fois par jour : deux tiers des courses
 * étaient publiées avec des cotes de plus de deux heures, ce qui coûtait environ
 * cinq points de précision — davantage que tout ce que le modèle pourrait
 * apporter. Ce script comble l'écart sans toucher au modèle.
 *
 * CE QU'IL FAIT, ET CE QU'IL NE FAIT PAS
 *
 * Il ne met à jour qu'une colonne : `entries.odds`. C'est suffisant, parce que
 * `src/lib/probability.ts` recalcule tout à la lecture à partir des cotes —
 * probabilités, Top 3, Top 5, value et cote juste. Rien d'autre en base n'est
 * consommé par la page.
 *
 * Il ne crée aucune course et ne touche qu'aux courses déjà présentes : le
 * périmètre France/Equidia reste défini par l'import complet.
 *
 * Usage : node scripts/refresh-odds.mjs [--window 90] [--dry-run]
 */

import { neon } from "@neondatabase/serverless";
import { PMU_BASE, delay, fetchJson, formatParisPmuDateOffset, getOdds, isoDateFromPmu, loadLocalEnv } from "./lib/pmu-fetch.mjs";

/** Fenêtre par défaut, en minutes avant le départ. Le cron passe toutes les heures. */
const DEFAULT_WINDOW_MINUTES = 90;

function parseArgs() {
  const args = process.argv.slice(2);
  const windowIndex = args.indexOf("--window");
  return {
    dryRun: args.includes("--dry-run"),
    windowMinutes: windowIndex === -1 ? DEFAULT_WINDOW_MINUTES : Number(args[windowIndex + 1]) || DEFAULT_WINDOW_MINUTES,
  };
}

function log(message) {
  console.log(`[cotes] ${message}`);
}

async function main() {
  await loadLocalEnv();
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");

  const { dryRun, windowMinutes } = parseArgs();
  const sql = neon(process.env.DATABASE_URL);

  const now = Date.now();
  const horizon = now + windowMinutes * 60 * 1000;

  // La veille est incluse : une réunion nocturne peut déborder après minuit à
  // Paris alors que l'API la range encore sur la date de la veille.
  const pmuDates = [formatParisPmuDateOffset(-1), formatParisPmuDateOffset(0)];
  const targets = [];

  for (const pmuDate of pmuDates) {
    let payload;
    try {
      payload = await fetchJson(`${PMU_BASE}/${pmuDate}`);
    } catch (error) {
      console.warn(`[cotes] programme ${pmuDate} indisponible : ${error.message}`);
      continue;
    }

    const isoDate = isoDateFromPmu(pmuDate);
    for (const reunion of payload?.programme?.reunions ?? []) {
      for (const course of reunion?.courses ?? []) {
        if (!course?.numOrdre || !course?.heureDepart) continue;
        const start = Number(course.heureDepart);
        if (!Number.isFinite(start) || start < now || start > horizon) continue;
        targets.push({
          courseNumber: course.numOrdre,
          minutesToStart: Math.round((start - now) / 60000),
          pmuDate,
          raceId: `${isoDate}-R${reunion.numOfficiel}-C${course.numOrdre}`,
          reunionNumber: reunion.numOfficiel,
        });
      }
    }
  }

  if (targets.length === 0) {
    log(`aucune course au départ dans les ${windowMinutes} prochaines minutes`);
    return;
  }

  // On ne rafraîchit que ce que l'import complet a déjà retenu : cela reprend
  // sans le dupliquer le filtrage France/Equidia.
  const known = await sql`
    select id from races where id = any(${targets.map((t) => t.raceId)})
  `;
  const knownIds = new Set(known.map((row) => row.id));
  const scoped = targets.filter((t) => knownIds.has(t.raceId));

  log(`${targets.length} courses dans la fenêtre, ${scoped.length} dans notre périmètre`);

  let updatedEntries = 0;
  let refreshedRaces = 0;

  for (const target of scoped.sort((a, b) => a.minutesToStart - b.minutesToStart)) {
    let participants;
    try {
      const payload = await fetchJson(
        `${PMU_BASE}/${target.pmuDate}/R${target.reunionNumber}/C${target.courseNumber}/participants`,
      );
      participants = payload?.participants ?? [];
    } catch (error) {
      console.warn(`[cotes] ${target.raceId} ignorée : ${error.message}`);
      continue;
    }

    // Les non-partants déclarés après l'import restaient en base et continuaient
    // d'être affichés. Le dégât n'est pas cosmétique : `devig` normalise sur
    // l'ensemble du peloton, donc un cheval fantôme retire de la probabilité à
    // tous les vrais partants — et pouvait figurer dans le Top 3 annoncé.
    const running = new Set(
      participants.filter((p) => !p.statut || p.statut === "PARTANT").map((p) => Number(p.numPmu)),
    );
    // Un peloton vide signale une réponse dégradée de l'API, pas une course sans
    // partants : on ne supprime jamais sur cette base.
    if (running.size > 0 && !dryRun) {
      const scratched = await sql`
        delete from entries
        where race_id = ${target.raceId}
          and not (number = any(${[...running]}::int[]))
        returning number
      `;
      if (scratched.length > 0) {
        log(`${target.raceId} — ${scratched.length} non-partant(s) retiré(s) : n° ${scratched.map((r) => r.number).join(", ")}`);
      }
    }

    const rows = [];
    const figures = [];
    for (const participant of participants) {
      if (participant.statut && participant.statut !== "PARTANT") continue;
      const entryId = `${target.raceId}-P${participant.numPmu}`;

      // La réduction kilométrique n'est publiée que tardivement, souvent après
      // le dernier import complet. Ce passage tourne à moins de 45 minutes du
      // départ : c'est le meilleur moment pour la relever, et la course n'ayant
      // pas encore eu lieu, la valeur ne peut pas être le chrono de l'épreuve.
      const figure = Number(participant.reductionKilometrique);
      if (Number.isFinite(figure) && figure > 40000 && figure < 200000) {
        figures.push([entryId, figure]);
      }

      const odds = getOdds(participant);
      if (!(odds > 1)) continue;
      rows.push([entryId, odds]);
    }

    if (figures.length > 0 && !dryRun) {
      const fp = [];
      const ft = figures.map((row) => {
        const base = fp.length;
        fp.push(row[0], row[1]);
        return `($${base + 1}, $${base + 2}::numeric)`;
      });
      // `is null` : une fois relevée, la valeur d'avant-course ne bouge plus.
      const written = await sql.query(
        `update entries e
           set speed_figure = v.figure
           from (values ${ft.join(", ")}) as v(entry_id, figure)
          where e.id = v.entry_id
            and e.speed_figure is null
          returning e.id`,
        fp,
      );
      if (written.length > 0) log(`${target.raceId} — ${written.length} réductions kilométriques relevées`);
    }

    if (rows.length === 0) {
      log(`${target.raceId} — aucune cote exploitable (départ dans ${target.minutesToStart} min)`);
      continue;
    }

    if (dryRun) {
      log(`${target.raceId} — ${rows.length} cotes prêtes (départ dans ${target.minutesToStart} min) [simulation]`);
      continue;
    }

    const params = [];
    const tuples = rows.map((row) => {
      const base = params.length;
      params.push(row[0], row[1]);
      return `($${base + 1}, $${base + 2}::numeric)`;
    });
    const values = `(values ${tuples.join(", ")}) as v(entry_id, odds)`;

    // `is distinct from` évite de réécrire une ligne dont la cote n'a pas bougé :
    // sans ce filtre, un passage horaire produirait des milliers de tuples morts
    // par jour pour aucune information.
    const changed = await sql.query(
      `update entries e
         set odds = v.odds
         from ${values}
        where e.id = v.entry_id
          and e.odds is distinct from v.odds
        returning e.id`,
      params,
    );

    // Un relevé n'est enregistré que si la cote diffère du dernier connu —
    // même règle que l'import, c'est ce qui garde `odds_snapshots` exploitable.
    await sql.query(
      `insert into odds_snapshots (race_id, horse_id, odds, source, observed_at)
       select e.race_id, e.horse_id, v.odds, 'PMU', now()
         from ${values}
         join entries e on e.id = v.entry_id
        where v.odds is distinct from (
          select previous.odds
            from odds_snapshots previous
           where previous.race_id = e.race_id
             and previous.horse_id = e.horse_id
             and previous.source = 'PMU'
           order by previous.observed_at desc
           limit 1
        )`,
      params,
    );

    if (changed.length > 0) refreshedRaces += 1;
    updatedEntries += changed.length;
    log(`${target.raceId} — ${changed.length}/${rows.length} cotes modifiées (départ dans ${target.minutesToStart} min)`);
    await delay(300);
  }

  log(`terminé : ${updatedEntries} cotes mises à jour sur ${refreshedRaces} courses`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
