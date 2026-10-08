import { jourParis } from "@/lib/paris-time";
import { minutesToStart } from "@/lib/race-status";

/**
 * DONNÉES « À L'INSTANT T » — ce que le modèle avait le droit de savoir.
 *
 * `connection_stats` est recalculée après chaque import sur tout l'historique.
 * Pour une course à venir, c'est exactement l'état connu avant le départ. Pour
 * une course passée, non : les totaux contiennent les courses suivantes — et
 * celle-ci. Le taux de réussite du driver gagnant y était donc gonflé de sa
 * propre victoire, et le suivi de performance relisait le résultat.
 *
 * Depuis octobre 2026, l'import fige ces totaux sur chaque partant tant que la
 * course n'est pas partie (`entries.jockey_runs_pre`, etc.). La règle de
 * lecture est ici, en un seul endroit :
 *   1. valeur figée présente  → elle fait foi, course passée ou non ;
 *   2. course pas encore partie → totaux courants (identiques à ce qu'on
 *      figerait à l'instant) ;
 *   3. course partie sans valeur figée (historique antérieur) → `null`. Le
 *      modèle fondamental retombe alors sur sa valeur a priori (taux rétréci
 *      vers la moyenne), plutôt que de lire l'avenir.
 */

export type ConnectionStatsRow = {
  jockey_runs: number | null;
  jockey_wins: number | null;
  trainer_runs: number | null;
  trainer_wins: number | null;
  jockey_runs_pre: number | null;
  jockey_wins_pre: number | null;
  trainer_runs_pre: number | null;
  trainer_wins_pre: number | null;
};

export type ConnectionStats = {
  jockeyRuns: number | null;
  jockeyWins: number | null;
  trainerRuns: number | null;
  trainerWins: number | null;
};

function pick(
  pre: { runs: number | null; wins: number | null },
  current: { runs: number | null; wins: number | null },
  raceStarted: boolean,
): { runs: number | null; wins: number | null } {
  if (pre.runs != null) return { runs: pre.runs, wins: pre.wins ?? 0 };
  if (!raceStarted) return current;
  return { runs: null, wins: null };
}

export function connectionStatsAt(row: ConnectionStatsRow, raceStarted: boolean): ConnectionStats {
  const jockey = pick({ runs: row.jockey_runs_pre, wins: row.jockey_wins_pre }, { runs: row.jockey_runs, wins: row.jockey_wins }, raceStarted);
  const trainer = pick(
    { runs: row.trainer_runs_pre, wins: row.trainer_wins_pre },
    { runs: row.trainer_runs, wins: row.trainer_wins },
    raceStarted,
  );
  return { jockeyRuns: jockey.runs, jockeyWins: jockey.wins, trainerRuns: trainer.runs, trainerWins: trainer.wins };
}

/**
 * La course est-elle partie ? Arrivée publiée, ou heure de départ (Paris)
 * passée. Heure illisible : on se fie à la date — une course d'un jour passé
 * est partie, une course du jour ou à venir est réputée ne pas l'être.
 */
export function raceHasStarted(
  race: { raceDate: string; startTime: string },
  hasArrival: boolean,
  now: Date = new Date(),
): boolean {
  if (hasArrival) return true;
  const minutes = minutesToStart(race, now);
  if (minutes !== null) return minutes <= 0;
  return race.raceDate < jourParis(now);
}
