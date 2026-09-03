import { NextResponse } from "next/server";
import { modelCard } from "@/lib/betting-engine";
import { adresseAppelant, limiterDebit, reponseTropDeRequetes } from "@/lib/rate-limit";

/** Réponse statique et légère, mais aucune route ne reste sans plafond. */
const LIMITE_APPELS = 120;
const FENETRE_MS = 60_000;

/**
 * Fiche modèle statique (transparence AI Act, art. 13) : elle ne change qu'au
 * déploiement. Un cache long évite de refaire le trajet réseau pour rien.
 */
export function GET(request: Request) {
  const limite = limiterDebit(`model-card:${adresseAppelant(request)}`, LIMITE_APPELS, FENETRE_MS);
  if (!limite.autorise) return reponseTropDeRequetes(limite);

  return NextResponse.json(
    { generatedAt: new Date().toISOString(), data: modelCard },
    { headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400" } },
  );
}
