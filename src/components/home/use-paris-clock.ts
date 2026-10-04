"use client";

import { useSyncExternalStore } from "react";

/**
 * Minute courante (horodatage arrondi à la minute), `null` au rendu serveur.
 *
 * `new Date().getHours()` donnait l'heure du navigateur, alors que les heures
 * de départ sont des heures de Paris : les calculs d'horaire passent donc par
 * src/lib/paris-time.ts et src/lib/race-status.ts à partir de cet instant,
 * jamais par l'horloge locale. L'instantané ne change qu'une fois par minute :
 * la vérification toutes les 15 s ne provoque pas de rendu supplémentaire.
 */
const MINUTE = 60_000;

function subscribe(notify: () => void) {
  const id = window.setInterval(notify, 15_000);
  return () => window.clearInterval(id);
}

const currentMinute = () => Math.floor(Date.now() / MINUTE) * MINUTE;
const serverMinute = () => null;

export function useParisNow(): number | null {
  return useSyncExternalStore(subscribe, currentMinute, serverMinute);
}
