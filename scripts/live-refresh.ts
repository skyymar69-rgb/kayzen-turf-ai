#!/usr/bin/env -S npx tsx
/**
 * Boucle de rafraîchissement des cotes, des pools et des pronostics gelés.
 *
 * POURQUOI UNE BOUCLE
 *
 * Le workflow précédent demandait un passage toutes les 30 minutes. GitHub ne
 * garantit pas l'heure des déclenchements planifiés : du 30/09 au 02/10/2026,
 * 8 passages ont réellement tourné sur 60 prévus, avec jusqu'à deux heures de
 * retard. Les courses partaient donc avec des cotes de la veille au soir.
 *
 * Une boucle longue ne dépend plus de l'heure de déclenchement : chaque passage
 * planifié démarre une boucle de près de trois heures, et le suivant prend le
 * relais (concurrency `cancel-in-progress`). Un déclenchement en retard d'une
 * heure ne laisse plus de trou.
 *
 * Cadence (voir src/lib/live/refresh-race.ts) : une course est interrogée au
 * plus toutes les 15 min au-delà d'une heure du départ, toutes les 4 min entre
 * H-60 et H-15, toutes les 45 s dans le dernier quart d'heure.
 *
 * Usage : npx tsx scripts/live-refresh.ts [--minutes 170] [--once]
 */

import { readFileSync } from "node:fs";
import { imminentRaces, refreshRace } from "@/lib/live/refresh-race";
import { delay } from "@/lib/pmu/client";

function loadLocalEnv() {
  try {
    for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
      const trimmed = line.trim();
      const separator = trimmed.indexOf("=");
      if (!trimmed || trimmed.startsWith("#") || separator === -1) continue;
      process.env[trimmed.slice(0, separator)] ||= trimmed.slice(separator + 1).replace(/^"|"$/g, "");
    }
  } catch {
    // En CI, DATABASE_URL vient des secrets.
  }
}

function arg(name: string): string | null {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? null : (process.argv[index + 1] ?? null);
}

async function pass() {
  const races = await imminentRaces();
  let closest = Infinity;
  for (const race of races) {
    const minutes = Number(race.minutes_to_start);
    closest = Math.min(closest, Math.max(minutes, 0));
    try {
      const outcome = await refreshRace(race.id, { minutesToStart: minutes });
      if (outcome.status === "refreshed") {
        const parts = [
          `${outcome.oddsChanged}/${outcome.runners} cotes modifiées`,
          outcome.snapshotRecorded ? "relevé historisé" : null,
          outcome.scratched.length ? `non-partants retirés : ${outcome.scratched.join(", ")}` : null,
          outcome.frozen.length ? `pronostic gelé ${outcome.frozen.join(", ")}` : null,
        ].filter(Boolean);
        console.log(`[live] ${race.id} (départ ${minutes >= 0 ? `dans ${Math.round(minutes)} min` : "passé"}) — ${parts.join(" · ")}`);
      }
    } catch (error) {
      console.warn(`[live] ${race.id} ignorée : ${(error as Error).message}`);
    }
    await delay(250);
  }
  return closest;
}

async function main() {
  loadLocalEnv();
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");

  const once = process.argv.includes("--once");
  const deadline = Date.now() + Number(arg("minutes") ?? 170) * 60_000;
  let passes = 0;

  do {
    const closest = await pass();
    passes += 1;
    if (once) break;
    // Plus le prochain départ est proche, plus on repasse vite.
    await delay(closest <= 15 ? 30_000 : 60_000);
  } while (Date.now() < deadline);

  console.log(`[live] terminé après ${passes} passages`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
