import { NextResponse } from "next/server";
import { buildBetRecommendations, probableArrival, raceToContext } from "@/lib/bet-recommendations";
import { exactArrival } from "@/lib/prediction-math";
import { getRaceById, getRaces } from "@/lib/race-repository";
import { adresseAppelant, limiterDebit, reponseTropDeRequetes } from "@/lib/rate-limit";
import { lireParametreOptionnel, reponseParametreInvalide, schemaIdCourse } from "@/lib/validation";

const LIMITE_APPELS = 30;
const FENETRE_MS = 60_000;

export async function GET(request: Request) {
  const limite = limiterDebit(`bet-reco:${adresseAppelant(request)}`, LIMITE_APPELS, FENETRE_MS);
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
      : (await getRaces())[0];
  } catch (cause) {
    console.error("GET /api/bet-recommendations : lecture de la course impossible", cause instanceof Error ? cause.message : cause);
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

  const context = raceToContext(race);
  const plArrival = exactArrival(race.horses, context);

  return NextResponse.json(
    {
      generatedAt: new Date().toISOString(),
      race: {
        id: race.id,
        programCode: race.programCode,
        name: race.name,
        racecourse: race.racecourse,
        discipline: race.discipline,
        going: race.going,
        distance: race.distance,
      },
      probableArrival: probableArrival(race.horses, context).map((horse) => ({
        number: horse.number,
        horse: horse.horse,
        kzScore: horse.kzScore,
        winProbability: horse.winProbability,
        top3Probability: horse.top3Probability,
      })),
      placketLuce: plArrival.map((item) => ({
        number: item.horse.number,
        horse: item.horse.horse,
        plWinProbability: item.plWinProbability,
        plTop3Probability: item.plTop3Probability,
        plTop5Probability: item.plTop5Probability,
        score: item.score,
      })),
      availableBets: race.betTypes,
      recommendations: buildBetRecommendations(race.horses, race.betTypes, context),
    },
    { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" } },
  );
}
