import { NextResponse } from "next/server";
import { simulateBet } from "@/lib/betting-engine";

/**
 * `Number.isFinite` rejette NaN ET Infinity, ce qui est indispensable ici.
 *
 * L'ancienne validation faisait `Number(body.stake ?? 20)` puis comparait le
 * résultat à des bornes. Or toute comparaison impliquant NaN est fausse :
 * `NaN <= 0`, `NaN > 100` et `NaN <= 1` valent tous `false`. Une charge du type
 * `{"stake":"abc","odds":"x"}` traversait donc l'intégralité des gardes, et
 * l'API répondait 200 avec des `null` partout au lieu de refuser la requête.
 */
function finiteOr(value: unknown, fallback: number): number | null {
  if (value === undefined || value === null) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    // `request.json()` levait une exception non gérée sur un corps non-JSON,
    // ce qui produisait un 500 au lieu d'un 400.
    return NextResponse.json({ error: "Corps JSON invalide." }, { status: 400 });
  }

  if (body === null || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "Corps JSON invalide." }, { status: 400 });
  }

  const stake = finiteOr(body.stake, 20);
  const odds = finiteOr(body.odds, 5);
  const winProbability = finiteOr(body.winProbability, 20);
  const bankroll = finiteOr(body.bankroll, 500);
  const drawdown = finiteOr(body.drawdown, 0);

  if (
    stake === null || odds === null || winProbability === null ||
    bankroll === null || drawdown === null ||
    stake <= 0 || stake > 1_000_000 ||
    odds <= 1 || odds > 10_000 ||
    winProbability <= 0 || winProbability > 100 ||
    bankroll <= 0 || bankroll > 10_000_000 ||
    drawdown < 0 || drawdown > 1
  ) {
    return NextResponse.json(
      { error: "Parametres invalides : stake, odds, winProbability et bankroll doivent etre des nombres finis dans les bornes autorisees." },
      { status: 400 },
    );
  }

  return NextResponse.json({
    generatedAt: new Date().toISOString(),
    data: simulateBet(stake, odds, winProbability, bankroll, drawdown),
  });
}
