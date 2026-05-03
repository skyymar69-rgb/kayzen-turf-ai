import { NextResponse } from "next/server";
import { raceCards } from "@/lib/mock-data";

export function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const date = searchParams.get("date");
  const relativeDay = searchParams.get("day");

  const races = raceCards.filter((race) => {
    if (date && race.raceDate !== date) return false;
    if (relativeDay && race.relativeDay !== relativeDay) return false;
    return true;
  });

  return NextResponse.json({
    generatedAt: new Date().toISOString(),
    data: races,
  });
}
