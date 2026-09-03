import { NextResponse } from "next/server";
import { getPredictions } from "@/lib/race-repository";
import { adresseAppelant, limiterDebit, reponseTropDeRequetes } from "@/lib/rate-limit";

const LIMITE_APPELS = 30;
const FENETRE_MS = 60_000;

export async function GET(request: Request) {
  const limite = limiterDebit(`predictions:${adresseAppelant(request)}`, LIMITE_APPELS, FENETRE_MS);
  if (!limite.autorise) return reponseTropDeRequetes(limite);

  // Une panne de la source (`ErreurSourceDonnees`) répond 503 sans cache
  // plutôt qu'un 500 générique.
  let predictions;
  try {
    predictions = await getPredictions();
  } catch (cause) {
    console.error("GET /api/predictions : lecture des pronostics impossible", cause instanceof Error ? cause.message : cause);
    return NextResponse.json(
      { error: "Données momentanément indisponibles." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }

  return NextResponse.json(
    { generatedAt: new Date().toISOString(), data: predictions },
    { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" } },
  );
}
