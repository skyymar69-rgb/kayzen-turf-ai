import { NextResponse } from "next/server";
import { getValueBets } from "@/lib/race-repository";

export async function GET() {
  const valueBets = await getValueBets();

  return NextResponse.json({
    generatedAt: new Date().toISOString(),
    data: valueBets,
  });
}
