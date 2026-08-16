/**
 * Heures de course exprimées à Paris, quel que soit le fuseau du visiteur.
 *
 * Tout le calcul d'horaire du site reposait sur `new Date().getHours()` et sur
 * `date.setHours(h, m)` — donc sur le fuseau du navigateur. Les heures de départ
 * stockées en base sont pourtant des heures de Paris. Un visiteur à La Réunion
 * (UTC+4), à Fort-de-France (UTC−4) ou simplement en déplacement voyait un
 * compte à rebours faux de plusieurs heures, un « Départ imminent » sur une
 * course déjà courue, et la mauvaise course mise en avant sur la ligne du temps.
 *
 * Ces fonctions ramènent tout à l'horloge de Paris.
 */

const formateurHeureParis = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/Paris",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

const formateurJourParis = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/Paris",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** Minutes écoulées depuis minuit, à Paris. */
export function minutesActuellesParis(maintenant: Date = new Date()): number {
  const [heures, minutes] = formateurHeureParis.format(maintenant).split(":").map(Number);
  return heures * 60 + minutes;
}

/** Date du jour à Paris, au format AAAA-MM-JJ. */
export function jourParis(maintenant: Date = new Date()): string {
  return formateurJourParis.format(maintenant);
}

/**
 * Minutes depuis minuit d'une heure de départ « HH:MM ».
 * Renvoie `null` sur une valeur non exploitable, plutôt que NaN : une
 * comparaison avec NaN est toujours fausse et masquait silencieusement le
 * problème.
 */
export function minutesDepuisHeure(heure: string): number | null {
  const correspondance = /^(\d{1,2})[:h](\d{2})$/.exec(heure.trim());
  if (!correspondance) return null;

  const heures = Number(correspondance[1]);
  const minutes = Number(correspondance[2]);
  if (heures > 23 || minutes > 59) return null;

  return heures * 60 + minutes;
}

/**
 * Secondes restant avant le départ, à Paris, ou `null` si l'heure est
 * inexploitable ou déjà passée.
 */
export function secondesAvantDepart(heureDepart: string, maintenant: Date = new Date()): number | null {
  const cible = minutesDepuisHeure(heureDepart);
  if (cible === null) return null;

  const [heures, minutes] = formateurHeureParis.format(maintenant).split(":").map(Number);
  const secondes = maintenant.getSeconds();
  const ecoulees = heures * 3600 + minutes * 60 + secondes;
  const restantes = cible * 60 - ecoulees;

  return restantes > 0 ? restantes : null;
}

/** « 1h05 » au-delà d'une heure, « 12m30s » en deçà. */
export function formaterCompteARebours(secondes: number): string {
  const heures = Math.floor(secondes / 3600);
  const minutes = Math.floor((secondes % 3600) / 60);
  const reste = secondes % 60;

  return heures > 0
    ? `${heures}h${String(minutes).padStart(2, "0")}`
    : `${minutes}m${String(reste).padStart(2, "0")}s`;
}
