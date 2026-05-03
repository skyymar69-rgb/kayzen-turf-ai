import { NextResponse } from "next/server";
import { raceAnalysis, raceCards } from "@/lib/mock-data";

export function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const raceId = searchParams.get("raceId");
  const race = raceId ? raceCards.find((item) => item.id === raceId) : raceAnalysis;

  return NextResponse.json({
    generatedAt: new Date().toISOString(),
    data: race,
  });
}
