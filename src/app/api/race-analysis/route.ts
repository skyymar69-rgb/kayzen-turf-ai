import { NextResponse } from "next/server";
import { getRaceById } from "@/lib/race-repository";
import { adresseAppelant, limiterDebit, reponseTropDeRequetes } from "@/lib/rate-limit";
import { lireParametreOptionnel, reponseParametreInvalide, schemaIdCourse } from "@/lib/validation";

const LIMITE_APPELS = 60;
const FENETRE_MS = 60_000;

export async function GET(request: Request) {
  const limite = limiterDebit(`race-analysis:${adresseAppelant(request)}`, LIMITE_APPELS, FENETRE_MS);
  if (!limite.autorise) return reponseTropDeRequetes(limite);

  const { searchParams } = new URL(request.url);

  const raceId = lireParametreOptionnel(schemaIdCourse, searchParams.get("raceId"));
  if (!raceId.ok) return reponseParametreInvalide("raceId", raceId.message);

  // Un identifiant inconnu répond 404 : `getRaceById` ne substitue plus la
  // course de démonstration comme s'il s'agissait d'une vraie. Une panne de la
  // source (`ErreurSourceDonnees`) est autre chose qu'une absence : 503, sans
  // cache.
  let race;
  try {
    race = raceId.valeur ? await getRaceById(raceId.valeur) : null;
  } catch (cause) {
    console.error("GET /api/race-analysis : lecture de la course impossible", cause instanceof Error ? cause.message : cause);
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
    { generatedAt: new Date().toISOString(), data: race },
    { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" } },
  );
}
