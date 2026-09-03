import { NextResponse } from "next/server";
import { z } from "zod";
import { adresseAppelant, limiterDebit, reponseTropDeRequetes } from "@/lib/rate-limit";
import { schemaDate } from "@/lib/validation";

const LIMITE_APPELS = 30;
const FENETRE_MS = 60_000;

/** Délai maximal accordé au service amont avant de répondre 503. */
const DELAI_AMONT_MS = 8_000;

/**
 * `parseFloat` renvoyait NaN sur une entrée non numérique, NaN partait dans
 * l'URL du service Python sous forme de chaîne « NaN », et l'erreur remontait
 * en 500. Chaque paramètre est désormais borné à un intervalle exploitable.
 */
const schemaRequete = z.object({
  date: schemaDate,
  bankroll: z.coerce.number().finite().gt(0).lte(10_000_000).default(1000),
  drawdown: z.coerce.number().finite().gte(0).lte(1).default(0),
  budgetFrac: z.coerce.number().finite().gt(0).lte(1).default(0.2),
  minEdge: z.coerce.number().finite().gte(0).lte(1).default(0.05),
  minClv: z.coerce.number().finite().gte(0).lte(1).default(0.02),
});

function aujourdhuiParis(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Paris",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

/**
 * GET /api/portfolio?date=2026-05-07&bankroll=1000&drawdown=0
 *
 * Appelle le service Python `portfolio/daily_runner.py` exposé via FastAPI
 * et retourne le portefeuille optimisé du jour.
 *
 * Plus de repli `http://localhost:…` : une variable absente répond 503 avant
 * toute validation, l'URL doit être en HTTPS, et le jeton
 * `PORTFOLIO_SERVICE_TOKEN`, s'il est défini, part en `Authorization`.
 */
export async function GET(request: Request) {
  const limite = limiterDebit(`portfolio:${adresseAppelant(request)}`, LIMITE_APPELS, FENETRE_MS);
  if (!limite.autorise) return reponseTropDeRequetes(limite);

  const urlService = process.env.PORTFOLIO_SERVICE_URL;
  if (!urlService) {
    return NextResponse.json(
      { error: "Service portefeuille non configuré." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
  if (!urlService.startsWith("https://")) {
    console.error("PORTFOLIO_SERVICE_URL doit commencer par https://");
    return NextResponse.json(
      { error: "Service portefeuille mal configuré." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }

  const { searchParams } = new URL(request.url);

  const resultat = schemaRequete.safeParse({
    date: searchParams.get("date") ?? aujourdhuiParis(),
    bankroll: searchParams.get("bankroll") ?? undefined,
    drawdown: searchParams.get("drawdown") ?? undefined,
    budgetFrac: searchParams.get("budgetFrac") ?? undefined,
    minEdge: searchParams.get("minEdge") ?? undefined,
    minClv: searchParams.get("minClv") ?? undefined,
  });

  if (!resultat.success) {
    return NextResponse.json(
      {
        error: "Paramètres invalides.",
        details: resultat.error.issues.map((probleme) => ({
          champ: probleme.path.join(".") || "(racine)",
          message: probleme.message,
        })),
      },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  const { date, bankroll, drawdown, budgetFrac, minEdge, minClv } = resultat.data;

  const jeton = process.env.PORTFOLIO_SERVICE_TOKEN;
  const entetes: Record<string, string> = { "Content-Type": "application/json" };
  if (jeton) entetes.Authorization = `Bearer ${jeton}`;

  try {
    const url = new URL("/portfolio", urlService);
    url.searchParams.set("date", date);
    url.searchParams.set("bankroll", bankroll.toString());
    url.searchParams.set("drawdown", drawdown.toString());
    url.searchParams.set("budget_frac", budgetFrac.toString());
    url.searchParams.set("min_edge", minEdge.toString());
    url.searchParams.set("min_clv", minClv.toString());

    const res = await fetch(url.toString(), {
      method: "GET",
      headers: entetes,
      signal: AbortSignal.timeout(DELAI_AMONT_MS),
      next: { revalidate: 300 },
    });

    if (!res.ok) {
      // Le corps amont n'est plus relayé au client : il exposait les traces du
      // service Python interne.
      console.error("portfolio_service a répondu %d pour le %s", res.status, date);
      return NextResponse.json(
        { error: "Service portefeuille indisponible.", bets: [], summary: { reason: "upstream_error" } },
        { status: 502, headers: { "Cache-Control": "no-store" } },
      );
    }

    const data = await res.json();
    return NextResponse.json(data, {
      headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" },
    });
  } catch {
    return NextResponse.json(
      { error: "Service portefeuille indisponible.", bets: [], summary: { reason: "service_unavailable" } },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
