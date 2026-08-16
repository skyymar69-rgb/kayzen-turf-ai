import { NextResponse } from "next/server";
import { z } from "zod";
import { adresseAppelant, limiterDebit, reponseTropDeRequetes } from "@/lib/rate-limit";
import { schemaIdCourse } from "@/lib/validation";

const MARKET_AGENT_URL = process.env.MARKET_AGENT_URL ?? "http://localhost:8002";

const LIMITE_APPELS = 60;
const FENETRE_MS = 60_000;

const schemaRequete = z.object({
  raceId: schemaIdCourse,
  // Le nombre de partants d'une course est borné : 30 identifiants suffisent
  // largement, et empêchent de faire relayer une charge arbitraire par notre
  // serveur vers le service interne.
  horseIds: z
    .string()
    .max(2_000)
    .transform((brut) => brut.split(",").map((id) => id.trim()).filter(Boolean))
    .pipe(z.array(z.string().min(1).max(120)).max(30)),
  decisionTime: z.iso.datetime({ offset: true }),
});

/**
 * GET /api/drift?raceId=…&horseIds=h1,h2,h3&decisionTime=2026-05-07T13:30:00Z
 *
 * Relais vers market_agent /signals — signaux steam/drift temps réel.
 */
export async function GET(request: Request) {
  const limite = limiterDebit(`drift:${adresseAppelant(request)}`, LIMITE_APPELS, FENETRE_MS);
  if (!limite.autorise) return reponseTropDeRequetes(limite);

  const { searchParams } = new URL(request.url);

  const resultat = schemaRequete.safeParse({
    raceId: searchParams.get("raceId") ?? undefined,
    horseIds: searchParams.get("horseIds") ?? "",
    decisionTime: searchParams.get("decisionTime") ?? new Date().toISOString(),
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

  const { raceId, horseIds, decisionTime } = resultat.data;

  try {
    const res = await fetch(`${MARKET_AGENT_URL}/signals`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ race_id: raceId, horse_ids: horseIds, decision_time: decisionTime }),
      next: { revalidate: 60 },
    });

    if (!res.ok) {
      // Le corps de la réponse amont était recopié tel quel au client : une
      // trace Python ou un chemin de fichier du service interne fuitait vers
      // l'extérieur (OWASP A05, mauvaise configuration de sécurité). Le détail
      // reste dans les journaux serveur, le client reçoit un statut.
      console.error("market_agent a répondu %d pour la course %s", res.status, raceId);
      return NextResponse.json(
        { error: "Service de signaux marché indisponible." },
        { status: 502, headers: { "Cache-Control": "no-store" } },
      );
    }

    const data = await res.json();
    return NextResponse.json(data, {
      headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120" },
    });
  } catch {
    // Repli : signaux neutres si l'agent est injoignable.
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
    return NextResponse.json(
      {
        race_id: raceId,
        decision_time: decisionTime,
        signals: neutral,
        source: "fallback_neutral",
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  }
}
