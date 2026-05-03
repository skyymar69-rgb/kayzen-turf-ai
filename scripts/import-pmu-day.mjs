import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { neon } from "@neondatabase/serverless";

const PMU_BASE = "https://offline.turfinfo.api.pmu.fr/rest/client/7/programme";
const USER_AGENT = "KayzenTurfAI/0.1 contact:github.com/skyymar69-rgb/kayzen-turf-ai";
const DEFAULT_ALLOWED_COUNTRY_CODES = ["FRA"];

async function loadLocalEnv() {
  try {
    const content = await readFile(resolve(process.cwd(), ".env.local"), "utf8");
    for (const line of content.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const separator = trimmed.indexOf("=");
      if (separator === -1) continue;
      const key = trimmed.slice(0, separator);
      const value = trimmed.slice(separator + 1).replace(/^"|"$/g, "");
      process.env[key] ||= value;
    }
  } catch {
    // Vercel/CI can provide DATABASE_URL directly.
  }
}

function parseArgs() {
  const args = process.argv.slice(2);
  const dates = [];
  let maxRaces = Number.POSITIVE_INFINITY;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--date") dates.push(args[index + 1]);
    if (arg === "--max-races") maxRaces = Number(args[index + 1]);
  }

  return {
    dates: dates.length > 0 ? dates : defaultDates(),
    maxRaces,
  };
}

function defaultDates() {
  const now = new Date();
  return [-1, 0, 1].map((offset) => {
    const date = new Date(now);
    date.setDate(date.getDate() + offset);
    return formatPmuDate(date);
  });
}

function formatPmuDate(date) {
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = String(date.getFullYear());
  return `${day}${month}${year}`;
}

function isoDateFromPmu(pmuDate) {
  return `${pmuDate.slice(4, 8)}-${pmuDate.slice(2, 4)}-${pmuDate.slice(0, 2)}`;
}

function relativeDayFromPmu(pmuDate) {
  const today = formatPmuDate(new Date());
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);

  if (pmuDate === today) return "today";
  if (pmuDate === formatPmuDate(yesterday)) return "yesterday";
  if (pmuDate === formatPmuDate(tomorrow)) return "tomorrow";
  return null;
}

async function fetchJson(url) {
  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      "User-Agent": USER_AGENT,
    },
  });

  if (!response.ok) {
    throw new Error(`PMU request failed ${response.status} for ${url}`);
  }

  return response.json();
}

function delay(ms) {
  return new Promise((resolveDelay) => setTimeout(resolveDelay, ms));
}

function disciplineFromPmu(value) {
  if (String(value).includes("TROT")) return "Trot";
  if (String(value).includes("OBSTACLE")) return "Obstacle";
  return "Plat";
}

function riskFromVolatility(volatility) {
  if (volatility >= 24) return "Speculatif";
  if (volatility >= 15) return "Equilibre";
  return "Prudent";
}

function bettingTier(score) {
  if (score >= 70) return "Focus";
  if (score >= 50) return "Value";
  return "Avoid";
}

function getOdds(participant) {
  return Number(
    participant?.dernierRapportDirect?.rapport ??
      participant?.dernierRapportReference?.rapport ??
      participant?.rapportProbable ??
      0,
  );
}

function buildPrediction(participant, fieldSize) {
  const odds = getOdds(participant);
  const marketProbability = odds > 1 ? 1 / odds : 1 / Math.max(fieldSize, 1);
  const careerRuns = Number(participant.nombreCourses ?? 0);
  const wins = Number(participant.nombreVictoires ?? 0);
  const places = Number(participant.nombrePlaces ?? 0);
  const careerWinRate = careerRuns > 0 ? wins / careerRuns : 1 / Math.max(fieldSize, 1);
  const careerPlaceRate = careerRuns > 0 ? places / careerRuns : Math.min(0.45, 3 / Math.max(fieldSize, 1));
  const formSignal = parseMusicSignal(participant.musique);

  const adjustedProbability =
    marketProbability * 0.72 +
    careerWinRate * 0.13 +
    formSignal * 0.1 +
    1 / Math.max(fieldSize, 1) * 0.05;
  const winProbability = clamp(adjustedProbability * 100, 2, 45);
  const top3Probability = clamp((winProbability / 100 + careerPlaceRate * 0.35 + 2 / Math.max(fieldSize, 1)) * 100, winProbability, 85);
  const top5Probability = clamp(top3Probability + 16 + Math.max(0, 18 - fieldSize), top3Probability, 96);
  const fairOdds = Number((100 / winProbability).toFixed(2));
  const rawMarketEdge = odds > 1 ? odds * (winProbability / 100) * 100 - 100 : 0;
  const marketEdge = Number(clamp(rawMarketEdge, -40, 95).toFixed(1));
  const kzScore = clamp(Math.round(winProbability * 1.35 + top3Probability * 0.35 + Math.max(0, marketEdge) * 0.25), 1, 99);

  return {
    odds: odds > 1 ? odds : fairOdds,
    fairOdds,
    marketEdge,
    winProbability: Number(winProbability.toFixed(1)),
    top3Probability: Number(top3Probability.toFixed(1)),
    top5Probability: Number(top5Probability.toFixed(1)),
    kzScore,
    valueIndex: marketEdge,
    confidence: careerRuns >= 12 && odds > 1 ? "Forte" : careerRuns >= 5 ? "Moyenne" : "Faible",
    factors: [
      odds > 1 ? `Cote PMU observee: ${odds}` : "Cote absente, estimation prudente",
      careerRuns > 0 ? `Historique: ${wins}/${careerRuns} victoires` : "Historique limite",
      participant.musique ? `Musique: ${participant.musique}` : "Forme recente non renseignee",
    ],
  };
}

function parseMusicSignal(music) {
  if (!music) return 0.08;
  const digits = String(music).match(/[1-9]/g)?.slice(0, 5) ?? [];
  if (digits.length === 0) return 0.05;
  const average = digits.reduce((sum, digit) => sum + Number(digit), 0) / digits.length;
  return clamp((10 - average) / 20, 0.02, 0.35);
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

async function upsertName(sql, table, name) {
  const safeName = name || "Non renseigne";
  const rows = await sql.query(
    `insert into ${table} (name) values ($1) on conflict (name) do update set name = excluded.name returning id`,
    [safeName],
  );
  return rows[0].id;
}

function horseId(participant) {
  return String(participant.idCheval || participant.nom || crypto.randomUUID())
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 120);
}

function allowedCountryCodes() {
  const configured = process.env.KAYZEN_ALLOWED_COUNTRIES;
  if (!configured) return DEFAULT_ALLOWED_COUNTRY_CODES;

  return configured
    .split(",")
    .map((code) => code.trim().toUpperCase())
    .filter(Boolean);
}

function isRelevantReunion(reunion, allowlist) {
  const countryCode = String(reunion?.pays?.code ?? "").toUpperCase();
  return allowlist.includes(countryCode);
}

function normalizeBetTypes(paris = []) {
  const unique = new Map();

  for (const pari of paris) {
    const rawType = String(pari?.codePari ?? pari?.typePari ?? "");
    if (!rawType || rawType === "REPORT_PLUS" || rawType === "E_REPORT_PLUS") continue;

    const type = rawType.replace(/^E_/, "");
    const existing = unique.get(type);
    const offer = {
      type,
      label: labelBetType(type),
      audience: pari.audience ?? null,
      baseStake: Number(pari.miseBase ?? 0) / 100,
      ordered: Boolean(pari.ordre),
      combined: Boolean(pari.combine),
      requiredHorses: Number(pari.nbChevauxReglementaire ?? 0),
      flexi: pari.valeursFlexiAutorisees ?? [],
      riskOptions: pari.valeursRisqueAutorisees ?? [],
      online: rawType.startsWith("E_"),
      spotAllowed: Boolean(pari.spotAutorise),
    };

    if (!existing || offer.online) unique.set(type, offer);
  }

  return Array.from(unique.values()).sort((a, b) => betTypeRank(a.type) - betTypeRank(b.type));
}

function labelBetType(type) {
  return type
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/(^|\s)\S/g, (letter) => letter.toUpperCase());
}

function betTypeRank(type) {
  const order = [
    "SIMPLE_GAGNANT",
    "SIMPLE_PLACE",
    "COUPLE_GAGNANT",
    "COUPLE_PLACE",
    "COUPLE_ORDRE",
    "DEUX_SUR_QUATRE",
    "TRIO",
    "TRIO_ORDRE",
    "MULTI",
    "SUPER_QUATRE",
    "QUARTE_PLUS",
    "QUINTE_PLUS",
  ];
  const index = order.indexOf(type);
  return index === -1 ? 999 : index;
}

async function importDate(sql, pmuDate, maxRaces) {
  const programmeUrl = `${PMU_BASE}/${pmuDate}`;
  const payload = await fetchJson(programmeUrl);
  const reunions = payload?.programme?.reunions ?? [];
  const isoDate = isoDateFromPmu(pmuDate);
  const relativeDay = relativeDayFromPmu(pmuDate);
  const predictionRunRows = await sql`
    insert into prediction_runs (model_version, data_cutoff_at, model_card)
    values (
      ${"kayzen-baseline-v0.1"},
      now(),
      ${JSON.stringify({
        source: "PMU programme",
        pmuDate,
        objective: ["win_probability", "top3_probability", "top5_probability", "kz_score"],
        note: "Baseline deterministic model used until trained ML models are promoted.",
      })}
    )
    returning id
  `;
  const predictionRunId = predictionRunRows[0].id;
  const allowlist = allowedCountryCodes();
  let importedRaces = 0;
  let skippedRaces = 0;

  for (const reunion of reunions) {
    if (!isRelevantReunion(reunion, allowlist)) {
      const skippedCourses = reunion.courses?.length ?? 0;
      skippedRaces += skippedCourses;
      console.log(
        `[pmu] skipped R${reunion.numOfficiel} ${reunion?.hippodrome?.libelleCourt ?? ""} (${reunion?.pays?.code ?? "N/A"}) - outside French race scope`,
      );
      continue;
    }

    const racecourseName = reunion?.hippodrome?.libelleCourt ?? reunion?.hippodrome?.libelleLong ?? `R${reunion.numOfficiel}`;
    const racecourseRows = await sql`
      insert into racecourses (name, country, surface)
      values (${racecourseName}, ${reunion?.pays?.code ?? "N/A"}, ${reunion?.disciplinesMere ?? null})
      on conflict (name) do update set country = excluded.country
      returning id
    `;
    const racecourseId = racecourseRows[0].id;
    const courses = reunion.courses ?? [];

    for (const course of courses) {
      if (importedRaces >= maxRaces) return importedRaces;
      if (!course?.numOrdre) continue;

      const raceId = `${isoDate}-R${reunion.numOfficiel}-C${course.numOrdre}`;
      const startTime = new Date(course.heureDepart).toLocaleTimeString("fr-FR", {
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Europe/Paris",
      });
      const fieldSize = Number(course.nombreDeclaresPartants ?? 0);
      const volatility = fieldSize >= 16 ? 24 : fieldSize >= 12 ? 18 : 11;
      const qualityScore = clamp(82 - Math.abs(fieldSize - 12) * 2 + (course.montantPrix ?? 0) / 10000, 35, 92);
      const betTypes = normalizeBetTypes(course.paris);
      const weather = reunion?.meteo
        ? `${reunion.meteo.nebulositeLibelleCourt ?? "Meteo inconnue"}, ${reunion.meteo.temperature ?? "?"}C, vent ${reunion.meteo.forceVent ?? "?"}km/h`
        : "Meteo non renseignee";

      await sql`
        insert into races (
          id, race_date, relative_day, reunion_number, course_number, source_country,
          name, racecourse_id, start_time, discipline,
          distance, going, weather, market_volatility, model_consensus, race_quality_score,
          betting_tier, risk_level, bet_types, data_cutoff_at
        )
        values (
          ${raceId}, ${isoDate}, ${relativeDay}, ${Number(reunion.numOfficiel)}, ${Number(course.numOrdre)},
          ${reunion?.pays?.code ?? null}, ${course.libelle ?? `Course ${course.numOrdre}`},
          ${racecourseId}, ${startTime}, ${disciplineFromPmu(course.discipline)},
          ${String(course.distance ?? course.parcours ?? "")}, ${course?.penetrometre?.intitule ?? course.typePiste ?? null},
          ${weather}, ${volatility}, ${68}, ${qualityScore}, ${bettingTier(qualityScore)},
          ${riskFromVolatility(volatility)}, ${JSON.stringify(betTypes)}, now()
        )
        on conflict (id) do update set
          race_date = excluded.race_date,
          relative_day = excluded.relative_day,
          reunion_number = excluded.reunion_number,
          course_number = excluded.course_number,
          source_country = excluded.source_country,
          name = excluded.name,
          racecourse_id = excluded.racecourse_id,
          start_time = excluded.start_time,
          discipline = excluded.discipline,
          distance = excluded.distance,
          going = excluded.going,
          weather = excluded.weather,
          market_volatility = excluded.market_volatility,
          model_consensus = excluded.model_consensus,
          race_quality_score = excluded.race_quality_score,
          betting_tier = excluded.betting_tier,
          risk_level = excluded.risk_level,
          bet_types = excluded.bet_types,
          data_cutoff_at = excluded.data_cutoff_at,
          updated_at = now()
      `;

      const participantsPayload = await fetchJson(`${PMU_BASE}/${pmuDate}/R${reunion.numOfficiel}/C${course.numOrdre}/participants`);
      const participants = participantsPayload?.participants ?? [];

      for (const participant of participants) {
        if (participant.statut && participant.statut !== "PARTANT") continue;

        const id = horseId(participant);
        const jockeyId = await upsertName(sql, "jockeys", participant.driver);
        const trainerId = await upsertName(sql, "trainers", participant.entraineur);
        const prediction = buildPrediction(participant, participants.length || fieldSize || 12);
        const entryId = `${raceId}-P${participant.numPmu}`;

        await sql`
          insert into horses (id, name, age)
          values (${id}, ${participant.nom ?? id}, ${participant.age ?? null})
          on conflict (id) do update set name = excluded.name, age = excluded.age
        `;

        await sql`
          insert into entries (
            id, race_id, horse_id, number, jockey_id, trainer_id, odds, fair_odds,
            market_edge, win_probability, top3_probability, top5_probability,
            kz_score, value_index, confidence, factors
          )
          values (
            ${entryId}, ${raceId}, ${id}, ${participant.numPmu}, ${jockeyId}, ${trainerId},
            ${prediction.odds}, ${prediction.fairOdds}, ${prediction.marketEdge},
            ${prediction.winProbability}, ${prediction.top3Probability}, ${prediction.top5Probability},
            ${prediction.kzScore}, ${prediction.valueIndex}, ${prediction.confidence},
            ${JSON.stringify(prediction.factors)}
          )
          on conflict (id) do update set
            odds = excluded.odds,
            fair_odds = excluded.fair_odds,
            market_edge = excluded.market_edge,
            win_probability = excluded.win_probability,
            top3_probability = excluded.top3_probability,
            top5_probability = excluded.top5_probability,
            kz_score = excluded.kz_score,
            value_index = excluded.value_index,
            confidence = excluded.confidence,
            factors = excluded.factors
        `;

        if (prediction.odds > 1) {
          await sql`
            insert into odds_snapshots (race_id, horse_id, odds, source, observed_at)
            values (${raceId}, ${id}, ${prediction.odds}, ${"PMU"}, now())
          `;
        }

        await sql`
          insert into predictions (
            prediction_run_id, race_id, horse_id, win_probability, top3_probability,
            top5_probability, kz_score, confidence, explanation
          )
          values (
            ${predictionRunId}, ${raceId}, ${id}, ${prediction.winProbability},
            ${prediction.top3Probability}, ${prediction.top5Probability}, ${prediction.kzScore},
            ${prediction.confidence}, ${JSON.stringify(prediction.factors)}
          )
        `;

        if (prediction.valueIndex > 10) {
          await sql`
            insert into value_bets (race_id, horse_id, market_odds, fair_odds, edge, confidence)
            values (${raceId}, ${id}, ${prediction.odds}, ${prediction.fairOdds}, ${prediction.valueIndex}, ${prediction.confidence})
            on conflict (race_id, horse_id) do update set
              market_odds = excluded.market_odds,
              fair_odds = excluded.fair_odds,
              edge = excluded.edge,
              confidence = excluded.confidence
          `;
        }
      }

      const arrival = course.ordreArrivee?.flat?.() ?? [];
      for (let index = 0; index < arrival.length; index += 1) {
        const number = Number(arrival[index]);
        const participant = participants.find((item) => Number(item.numPmu) === number);
        if (!participant) continue;
        const id = horseId(participant);
        await sql`
          insert into results (race_id, horse_id, finish_position, won)
          values (${raceId}, ${id}, ${index + 1}, ${index === 0})
          on conflict (race_id, horse_id) do update set
            finish_position = excluded.finish_position,
            won = excluded.won
        `;
      }

      importedRaces += 1;
      await delay(300);
    }
  }

  if (skippedRaces > 0) {
    console.log(`[pmu] skipped ${skippedRaces} races outside French race scope`);
  }

  return importedRaces;
}

async function main() {
  await loadLocalEnv();
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");

  const { dates, maxRaces } = parseArgs();
  const sql = neon(process.env.DATABASE_URL);
  let total = 0;

  for (const date of dates) {
    console.log(`[pmu] importing ${date}`);
    total += await importDate(sql, date, maxRaces - total);
    if (total >= maxRaces) break;
  }

  console.log(`[pmu] imported ${total} races`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
