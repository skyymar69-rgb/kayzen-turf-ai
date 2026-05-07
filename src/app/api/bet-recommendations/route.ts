import { NextResponse } from "next/server";
import { buildBetRecommendations, probableArrival, raceToContext } from "@/lib/bet-recommendations";
import { exactArrival } from "@/lib/prediction-math";
import { getRaceById, getRaces } from "@/lib/race-repository";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const raceId = searchParams.get("raceId");
  const race = raceId ? await getRaceById(raceId) : (await getRaces())[0];

  if (!race) {
    return NextResponse.json({ error: "Race not found" }, { status: 404 });
  }

  const context = raceToContext(race);
  const plArrival = exactArrival(race.horses, context);

  return NextResponse.json({
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
  });
}
