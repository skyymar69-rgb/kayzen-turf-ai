import { properName } from "@/lib/format";
import { READING_MIN_TOP } from "@/lib/profiles";
import { buildSelection } from "@/lib/selection";
import type { RaceAnalysis } from "@/lib/types";
import { bestAiMarketGap, formatGap } from "@/lib/value-signal";

/**
 * RÉSUMÉ DU JOUR — trois phrases au plus, construites uniquement à partir des
 * champs présents dans `RaceAnalysis` : lecture des profils, nombre de
 * partants, indice de value. Aucune donnée n'est inventée : une phrase dont la
 * donnée manque est simplement omise.
 *
 * Pas de « plus gros mouvement de cote » : le programme ne transporte pas
 * l'historique des cotes, on ne peut donc rien en dire honnêtement ici.
 */

export type DaySummary = { sentences: string[] };

const plural = (n: number, singular: string, pluralForm = `${singular}s`) => (n > 1 ? pluralForm : singular);

function readableSentence(total: number, readable: number): string {
  if (readable === 0) {
    return total === 1
      ? "La seule course du programme ne se lit pas avec une base nette."
      : `Aucune des ${total} courses ne se lit avec une base nette : le programme est dispersé.`;
  }
  if (readable === total) return `${total === 1 ? "La seule course" : `Les ${total} courses`} du programme se ${plural(total, "lit", "lisent")} avec une base nette.`;
  return `${readable} ${plural(readable, "course")} sur ${total} se ${plural(readable, "lit", "lisent")} avec une base nette.`;
}

/** Course piège retenue : la plus fournie en partants, puis la plus tôt dans le programme. */
function trapSentence(traps: RaceAnalysis[]): string {
  if (traps.length === 0) return "Aucune course n'est classée piège.";
  const trap = [...traps].sort((a, b) => b.horses.length - a.horses.length || a.startTime.localeCompare(b.startTime))[0];
  const others = traps.length - 1;
  const tail = others > 0 ? ` (et ${others} autre${others > 1 ? "s" : ""} piège${others > 1 ? "s" : ""})` : "";
  return `Course piège à surveiller : ${trap.programCode} ${properName(trap.name)}, ${trap.horses.length} partants, aucun à ${READING_MIN_TOP.ouverte} % de chances${tail}.`;
}

/**
 * Plus fort écart IA / marché du jour, seulement sur une course dont les cotes
 * sont publiées. Un écart, pas une espérance de gain : aucune n'est établie.
 */
function valueSentence(races: RaceAnalysis[]): string | null {
  let best: { race: RaceAnalysis; number: number; name: string; points: number } | null = null;
  for (const race of races) {
    if (race.oddsAvailable === false) continue;
    const gap = bestAiMarketGap(race.horses);
    if (gap && (!best || gap.points > best.points)) best = { race, number: gap.horse.number, name: gap.horse.horse, points: gap.points };
  }
  if (!best) return null;
  return `Plus fort écart entre l'IA et le marché : n° ${best.number} ${properName(best.name)} en ${best.race.programCode}, ${formatGap(best.points)} de probabilité.`;
}

export function buildDaySummary(races: RaceAnalysis[]): DaySummary {
  if (races.length === 0) return { sentences: [] };
  const readings = races.map((race) => ({ race, reading: buildSelection(race.horses).verdict.reading }));
  const readable = readings.filter((r) => r.reading === "lisible").length;
  const traps = readings.filter((r) => r.reading === "piege").map((r) => r.race);
  const value = valueSentence(races);
  return { sentences: [readableSentence(races.length, readable), trapSentence(traps), ...(value ? [value] : [])] };
}
