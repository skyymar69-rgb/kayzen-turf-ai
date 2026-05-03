import { NextResponse } from "next/server";
import { valueBets } from "@/lib/mock-data";

export function GET() {
  return NextResponse.json({
    generatedAt: new Date().toISOString(),
    data: valueBets,
  });
}
