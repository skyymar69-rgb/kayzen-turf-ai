import { NextResponse } from "next/server";
import { predictions } from "@/lib/mock-data";

export function GET() {
  return NextResponse.json({
    generatedAt: new Date().toISOString(),
    data: predictions,
  });
}
