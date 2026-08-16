import { NextResponse } from "next/server";
import { getRaces } from "@/lib/race-repository";
import { adresseAppelant, limiterDebit, reponseTropDeRequetes } from "@/lib/rate-limit";
import {
  lireParametreOptionnel,
  reponseParametreInvalide,
  schemaDate,
  schemaJourRelatif,
} from "@/lib/validation";

const LIMITE_APPELS = 60;
const FENETRE_MS = 60_000;

export async function GET(request: Request) {
  const limite = limiterDebit(`races:${adresseAppelant(request)}`, LIMITE_APPELS, FENETRE_MS);
  if (!limite.autorise) return reponseTropDeRequetes(limite);

  const { searchParams } = new URL(request.url);

  const date = lireParametreOptionnel(schemaDate, searchParams.get("date"));
  if (!date.ok) return reponseParametreInvalide("date", date.message);

  const jour = lireParametreOptionnel(schemaJourRelatif, searchParams.get("day"));
  if (!jour.ok) return reponseParametreInvalide("day", jour.message);

  const races = await getRaces({ date: date.valeur, day: jour.valeur });

  return NextResponse.json(
    { generatedAt: new Date().toISOString(), data: races },
    // Les cotes PMU ne bougent pas à la seconde : 60 s de fraîcheur, et une
    // réponse périmée reste servie pendant la revalidation en arrière-plan.
    { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" } },
  );
}
