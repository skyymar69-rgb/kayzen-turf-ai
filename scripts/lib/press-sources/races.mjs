/**
 * Courses de référence pour la collecte presse, et filtre « avant le départ ».
 * Fonctions pures (hormis l'horloge passée en paramètre).
 */

/** Décalage (ms) de l'heure de Paris par rapport à UTC à l'instant `epoch`. */
function parisOffsetMs(epoch) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Paris",
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(new Date(epoch));
  const value = (type) => Number(parts.find((part) => part.type === type)?.value);
  const asUtc = Date.UTC(value("year"), value("month") - 1, value("day"), value("hour"), value("minute"), value("second"));
  return asUtc - Math.floor(epoch / 1000) * 1000;
}

/**
 * Instant (epoch ms) d'une heure de Paris « HH:MM » le jour `date` (AAAA-MM-JJ),
 * changements d'heure compris. `null` si l'entrée est invalide.
 */
export function parisStartEpoch(date, time) {
  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(date ?? ""));
  const timeMatch = /^(\d{1,2})[:h](\d{2})/.exec(String(time ?? ""));
  if (!dateMatch || !timeMatch) return null;
  const naive = Date.UTC(Number(dateMatch[1]), Number(dateMatch[2]) - 1, Number(dateMatch[3]), Number(timeMatch[1]), Number(timeMatch[2]));
  let epoch = naive - parisOffsetMs(naive);
  epoch = naive - parisOffsetMs(epoch);
  return epoch;
}

/**
 * Course pas encore partie ? Une heure illisible compte comme partie : on
 * préfère ne rien écrire plutôt que risquer une sélection d'après-course.
 */
export function isUpcoming(race, now = Date.now()) {
  const start = parisStartEpoch(race.date, race.startTime);
  return start !== null && start > now;
}

/** Date du jour à Paris décalée de `offset` jours, AAAA-MM-JJ. */
export function parisIsoDate(offset = 0, now = Date.now()) {
  const today = new Intl.DateTimeFormat("fr-CA", { timeZone: "Europe/Paris" }).format(new Date(now));
  const [year, month, day] = today.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + offset, 12)).toISOString().slice(0, 10);
}

/**
 * Programme PMU (API `programme/{JJMMAAAA}`) → courses au format attendu par les
 * collecteurs, avec le même identifiant que `races.id` (`AAAA-MM-JJ-R1-C3`).
 * Sert au mode `--from-pmu` (essai local sans base).
 * @param {any} json
 * @param {string} date AAAA-MM-JJ
 */
export function racesFromPmuProgramme(json, date) {
  const reunions = json?.programme?.reunions ?? [];
  const races = [];
  for (const reunion of reunions) {
    const racecourse = reunion?.hippodrome?.libelleCourt ?? reunion?.hippodrome?.libelleLong ?? null;
    for (const course of reunion?.courses ?? []) {
      if (!reunion?.numOfficiel || !course?.numOrdre) continue;
      const start = new Date(Number(course.heureDepart));
      if (Number.isNaN(start.getTime())) continue;
      races.push({
        id: `${date}-R${reunion.numOfficiel}-C${course.numOrdre}`,
        date,
        reunion: Number(reunion.numOfficiel),
        course: Number(course.numOrdre),
        racecourse,
        startTime: start.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Paris" }),
        name: course.libelle ?? null,
      });
    }
  }
  return races;
}
