import { NextResponse } from "next/server";
import { buildPostRaceAnalysis } from "@/lib/post-race-analysis";
import { getRaceById, getRaces } from "@/lib/race-repository";
import { adresseAppelant, limiterDebit, reponseTropDeRequetes } from "@/lib/rate-limit";
import { lireParametreOptionnel, reponseParametreInvalide, schemaIdCourse } from "@/lib/validation";

const LIMITE_APPELS = 30;
const FENETRE_MS = 60_000;

export async function GET(request: Request) {
  const limite = limiterDebit(`post-race:${adresseAppelant(request)}`, LIMITE_APPELS, FENETRE_MS);
  if (!limite.autorise) return reponseTropDeRequetes(limite);

  const { searchParams } = new URL(request.url);

  const raceId = lireParametreOptionnel(schemaIdCourse, searchParams.get("raceId"));
  if (!raceId.ok) return reponseParametreInvalide("raceId", raceId.message);

  // Une panne de la source (`ErreurSourceDonnees`) répond 503 sans cache,
  // distinct du 404 « aucune course ».
  let race;
  try {
    race = raceId.valeur
      ? await getRaceById(raceId.valeur)
      : (await getRaces({ day: "yesterday" }))[0] ?? (await getRaces())[0];
  } catch (cause) {
    console.error("GET /api/post-race-analysis : lecture de la course impossible", cause instanceof Error ? cause.message : cause);
    return NextResponse.json(
      { error: "Données momentanément indisponibles." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }

  if (!race) {
    return NextResponse.json(
      { error: "Course introuvable" },
      { status: 404, headers: { "Cache-Control": "no-store" } },
    );
  }

  return NextResponse.json(
    {
      generatedAt: new Date().toISOString(),
      race: {
        id: race.id,
        programCode: race.programCode,
        name: race.name,
        racecourse: race.racecourse,
        raceDate: race.raceDate,
      },
      analysis: buildPostRaceAnalysis(race),
    },
    { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=900" } },
  );
}
