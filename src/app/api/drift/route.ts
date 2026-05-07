import { NextResponse } from "next/server";

const MARKET_AGENT_URL = process.env.MARKET_AGENT_URL ?? "http://localhost:8002";

/**
 * GET /api/drift?raceId=R1&horseIds=h1,h2,h3&decisionTime=2026-05-07T13:30:00Z
 *
 * Proxy vers market_agent /signals — signaux steam/drift temps réel.
 * Cache court (60s) pour limiter les appels répétés pendant la même minute.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const raceId = searchParams.get("raceId");
  const horseIdsParam = searchParams.get("horseIds") ?? "";
  const decisionTime =
    searchParams.get("decisionTime") ?? new Date().toISOString();

  if (!raceId) {
    return NextResponse.json({ error: "raceId is required" }, { status: 400 });
  }

  const horseIds = horseIdsParam
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);

  try {
    const res = await fetch(`${MARKET_AGENT_URL}/signals`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ race_id: raceId, horse_ids: horseIds, decision_time: decisionTime }),
      next: { revalidate: 60 },
    });

    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json(
        { error: "Market agent error", detail: text },
        { status: res.status }
      );
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch {
    // Fallback : signaux neutres si agent indisponible
    const neutral = horseIds.map((id) => ({
      horse_id: id,
      steam_score: 0,
      drift_score: 0,
      smart_money_signal: 0,
      late_acceleration: 0,
      market_signal: "neutral",
      velocity_30m: 0,
      predicted_odds_close: null,
    }));
    return NextResponse.json({
      race_id: raceId,
      decision_time: decisionTime,
      signals: neutral,
      source: "fallback_neutral",
    });
  }
}
