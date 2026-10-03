import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { getSql, hasDatabase } from "@/lib/db";
import { refreshRace } from "@/lib/live/refresh-race";
import { instantDepart } from "@/lib/paris-time";
import { adresseAppelant, limiterDebit, reponseTropDeRequetes } from "@/lib/rate-limit";
import { schemaIdCourse } from "@/lib/validation";

/**
 * « Analyser maintenant » — rafraîchit une course dans ses dix dernières
 * minutes : cotes, parts des mises, non-partants, pronostic gelé.
 *
 * Le PMU n'est interrogé qu'une fois toutes les 30 secondes par course, quel
 * que soit le nombre de visiteurs : le verrou vit en base
 * (`races.odds_refreshed_at`), pas dans l'instance.
 */

export const dynamic = "force-dynamic";

/** Fenêtre d'ouverture du bouton, en minutes avant le départ. */
const WINDOW_MINUTES = 10;

const NO_STORE = { "Cache-Control": "no-store" };

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const limite = limiterDebit(`race-refresh:${adresseAppelant(request)}`, 6, 60_000);
  if (!limite.autorise) return reponseTropDeRequetes(limite);

  let id: string;
  try {
    id = decodeURIComponent((await params).id);
  } catch {
    return NextResponse.json({ error: "Identifiant de course invalide" }, { status: 400, headers: NO_STORE });
  }
  const parsed = schemaIdCourse.safeParse(id);
  if (!parsed.success) return NextResponse.json({ error: "Identifiant de course invalide" }, { status: 400, headers: NO_STORE });
  if (!hasDatabase()) return NextResponse.json({ error: "Données indisponibles" }, { status: 503, headers: NO_STORE });

  const raceId = parsed.data;
  const [race] = (await getSql()`
    select race_date::text as race_date, start_time from races where id = ${raceId}
  `) as Array<{ race_date: string; start_time: string }>;
  if (!race) return NextResponse.json({ error: "Course introuvable" }, { status: 404, headers: NO_STORE });

  const depart = instantDepart(race.race_date, race.start_time);
  const minutesToStart = depart ? (depart.getTime() - Date.now()) / 60_000 : NaN;
  if (!(minutesToStart <= WINDOW_MINUTES && minutesToStart >= -2)) {
    return NextResponse.json(
      { error: `Actualisation à la demande ouverte dans les ${WINDOW_MINUTES} dernières minutes avant le départ.` },
      { status: 409, headers: NO_STORE },
    );
  }

  try {
    const outcome = await refreshRace(raceId, { minutesToStart, minIntervalSeconds: 30 });
    // Ne régénérer la page que si le PMU a réellement été relu : sinon chaque
    // visiteur ouvert dans les dix dernières minutes forçait un rendu complet
    // par minute, au moment même de l'affluence.
    if (outcome.status === "refreshed") revalidatePath(`/races/${raceId}`);
    return NextResponse.json({ ...outcome, refreshedAt: new Date().toISOString() }, { headers: NO_STORE });
  } catch (cause) {
    console.error("POST /api/races/%s/refresh", raceId, cause instanceof Error ? cause.message : cause);
    return NextResponse.json({ error: "Le PMU ne répond pas, réessayez dans un instant." }, { status: 502, headers: NO_STORE });
  }
}
