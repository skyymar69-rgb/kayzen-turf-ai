import { NextResponse } from "next/server";
import { marketHistoryCsv } from "@/lib/csv";
import { getRaceMarketHistory } from "@/lib/race-repository";
import { adresseAppelant, limiterDebit, reponseTropDeRequetes } from "@/lib/rate-limit";
import { reponseParametreInvalide, schemaIdCourse } from "@/lib/validation";

/**
 * Historique des cotes et des parts de mises d'une course, en CSV :
 * GET /api/races/{id}/historique.csv
 *
 * Colonnes : horodatage_utc (ISO 8601), serie, numero, valeur (point décimal).
 * Source unique : les relevés PMU enregistrés par le rafraîchissement en direct.
 */

const LIMITE_APPELS = 20;
const FENETRE_MS = 60_000;
const NO_STORE = { "Cache-Control": "no-store" };

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const limite = limiterDebit(`historique-csv:${adresseAppelant(request)}`, LIMITE_APPELS, FENETRE_MS);
  if (!limite.autorise) return reponseTropDeRequetes(limite);

  let brut: string;
  try {
    brut = decodeURIComponent((await params).id);
  } catch {
    return reponseParametreInvalide("id", "Identifiant de course invalide");
  }
  const id = schemaIdCourse.safeParse(brut);
  if (!id.success) return reponseParametreInvalide("id", id.error.issues[0]?.message ?? "Identifiant de course invalide");

  // `getRaceMarketHistory` renvoie un historique vide sans base (démonstration),
  // pour une course inconnue ou si la lecture échoue : rien à exporter.
  const history = await getRaceMarketHistory(id.data);
  if (Object.keys(history.odds).length === 0 && history.pools.length === 0) {
    return NextResponse.json({ error: "Aucun historique de marché pour cette course." }, { status: 404, headers: NO_STORE });
  }

  // L'identifiant est restreint à [A-Za-z0-9_-] par le schéma : il peut entrer
  // tel quel dans le nom de fichier sans risque de sortir des guillemets.
  return new Response(marketHistoryCsv(history), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="historique-marche-${id.data}.csv"`,
      "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
