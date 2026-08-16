import { NextResponse } from "next/server";
import { modelCard } from "@/lib/betting-engine";

/**
 * Fiche modèle statique (transparence AI Act, art. 13) : elle ne change qu'au
 * déploiement. Un cache long évite de refaire le trajet réseau pour rien.
 */
export function GET() {
  return NextResponse.json(
    { generatedAt: new Date().toISOString(), data: modelCard },
    { headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400" } },
  );
}
