import { NextResponse } from "next/server";
import { getPredictions } from "@/lib/race-repository";

export async function GET() {
  const predictions = await getPredictions();

  return NextResponse.json({
    generatedAt: new Date().toISOString(),
    data: predictions,
  });
}
