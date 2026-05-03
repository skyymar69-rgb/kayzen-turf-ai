import { NextResponse } from "next/server";
import { buildPostRaceAnalysis } from "@/lib/post-race-analysis";
import { getRaceById, getRaces } from "@/lib/race-repository";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const raceId = searchParams.get("raceId");
  const race = raceId ? await getRaceById(raceId) : (await getRaces({ day: "yesterday" }))[0] ?? (await getRaces())[0];

  return NextResponse.json({
    generatedAt: new Date().toISOString(),
    race: {
      id: race.id,
      programCode: race.programCode,
      name: race.name,
      racecourse: race.racecourse,
      raceDate: race.raceDate,
    },
    analysis: buildPostRaceAnalysis(race),
  });
}
