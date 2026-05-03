import { NextResponse } from "next/server";
import { simulateBet } from "@/lib/mock-data";

export async function POST(request: Request) {
  const body = (await request.json()) as {
    stake?: number;
    odds?: number;
    winProbability?: number;
    bankroll?: number;
  };

  const stake = Number(body.stake ?? 20);
  const odds = Number(body.odds ?? 5);
  const winProbability = Number(body.winProbability ?? 20);
  const bankroll = Number(body.bankroll ?? 500);

  if (stake <= 0 || odds <= 1 || winProbability <= 0 || winProbability > 100 || bankroll <= 0) {
    return NextResponse.json(
      { error: "Parametres invalides: stake, odds, winProbability et bankroll sont requis." },
      { status: 400 },
    );
  }

  return NextResponse.json({
    generatedAt: new Date().toISOString(),
    data: simulateBet(stake, odds, winProbability, bankroll),
  });
}
