import { NextResponse } from "next/server";
import { getRaceById } from "@/lib/race-repository";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const raceId = searchParams.get("raceId");
  const race = await getRaceById(raceId);

  return NextResponse.json({
    generatedAt: new Date().toISOString(),
    data: race,
  });
}
