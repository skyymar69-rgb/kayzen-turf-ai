import { NextResponse } from "next/server";
import { modelCard } from "@/lib/betting-engine";

export function GET() {
  return NextResponse.json({
    generatedAt: new Date().toISOString(),
    data: modelCard,
  });
}
