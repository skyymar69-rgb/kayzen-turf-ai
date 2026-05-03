import { NextResponse } from "next/server";
import { buildBetRecommendations, probableArrival } from "@/lib/bet-recommendations";
import { getRaceById, getRaces } from "@/lib/race-repository";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const raceId = searchParams.get("raceId");
  const race = raceId ? await getRaceById(raceId) : (await getRaces())[0];

  if (!race) {
    return NextResponse.json({ error: "Race not found" }, { status: 404 });
  }

  return NextResponse.json({
    generatedAt: new Date().toISOString(),
    race: {
      id: race.id,
      programCode: race.programCode,
      name: race.name,
      racecourse: race.racecourse,
    },
    probableArrival: probableArrival(race.horses).map((horse) => ({
      number: horse.number,
      horse: horse.horse,
      kzScore: horse.kzScore,
      winProbability: horse.winProbability,
      top3Probability: horse.top3Probability,
    })),
    availableBets: race.betTypes,
    recommendations: buildBetRecommendations(race.horses, race.betTypes),
  });
}
