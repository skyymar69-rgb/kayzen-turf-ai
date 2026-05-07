import { NextResponse } from "next/server";

const PORTFOLIO_SERVICE_URL = process.env.PORTFOLIO_SERVICE_URL ?? "http://localhost:8004";

/**
 * GET /api/portfolio?date=2026-05-07&bankroll=1000&drawdown=0
 *
 * Appelle le service Python `portfolio/daily_runner.py` exposé via FastAPI
 * et retourne le portefeuille optimisé du jour.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const date = searchParams.get("date") ?? new Date().toISOString().slice(0, 10);
  const bankroll = parseFloat(searchParams.get("bankroll") ?? "1000");
  const drawdown = parseFloat(searchParams.get("drawdown") ?? "0");
  const budgetFrac = parseFloat(searchParams.get("budgetFrac") ?? "0.20");
  const minEdge = parseFloat(searchParams.get("minEdge") ?? "0.05");
  const minClv = parseFloat(searchParams.get("minClv") ?? "0.02");

  try {
    const url = new URL("/portfolio", PORTFOLIO_SERVICE_URL);
    url.searchParams.set("date", date);
    url.searchParams.set("bankroll", bankroll.toString());
    url.searchParams.set("drawdown", drawdown.toString());
    url.searchParams.set("budget_frac", budgetFrac.toString());
    url.searchParams.set("min_edge", minEdge.toString());
    url.searchParams.set("min_clv", minClv.toString());

    const res = await fetch(url.toString(), {
      method: "GET",
      headers: { "Content-Type": "application/json" },
      next: { revalidate: 300 },  // cache 5 min
    });

    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json(
        { error: "Portfolio service error", detail: text },
        { status: res.status }
      );
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json(
      { error: "Portfolio service unavailable", bets: [], summary: { reason: "service_unavailable" } },
      { status: 503 }
    );
  }
}
