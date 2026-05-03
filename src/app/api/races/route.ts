import { NextResponse } from "next/server";
import { getRaces } from "@/lib/race-repository";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const date = searchParams.get("date");
  const relativeDay = searchParams.get("day");
  const races = await getRaces({ date, day: relativeDay });

  return NextResponse.json({
    generatedAt: new Date().toISOString(),
    data: races,
  });
}
