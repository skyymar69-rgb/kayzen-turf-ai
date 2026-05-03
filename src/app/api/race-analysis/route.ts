import { NextResponse } from "next/server";
import { raceAnalysis } from "@/lib/mock-data";

export function GET() {
  return NextResponse.json({
    generatedAt: new Date().toISOString(),
    data: raceAnalysis,
  });
}
