import { NextResponse } from "next/server";
import { z } from "zod";
import { simulateBet } from "@/lib/betting-engine";
import { adresseAppelant, limiterDebit, reponseTropDeRequetes } from "@/lib/rate-limit";

const LIMITE_APPELS = 30;
const FENETRE_MS = 60_000;

/**
 * `z.coerce.number()` accepte la chaîne `"20"` — l'API l'a toujours toléré —
 * mais `.finite()` rejette NaN et Infinity.
 *
 * C'est le cœur du correctif d'origine : l'ancienne validation faisait
 * `Number(body.stake ?? 20)` puis comparait le résultat à des bornes. Or toute
 * comparaison impliquant NaN est fausse — `NaN <= 0`, `NaN > 100` et `NaN <= 1`
 * valent tous `false`. Une charge `{"stake":"abc","odds":"x"}` traversait donc
 * l'intégralité des gardes et l'API répondait 200 avec des `null` partout.
 * Le schéma le refuse maintenant en 400, avec le champ fautif nommé.
 */
const schemaSimulation = z.object({
  stake: z.coerce.number().finite().gt(0).lte(1_000_000).default(20),
  odds: z.coerce.number().finite().gt(1).lte(10_000).default(5),
  winProbability: z.coerce.number().finite().gt(0).lte(100).default(20),
  bankroll: z.coerce.number().finite().gt(0).lte(10_000_000).default(500),
  // En pourcentage (0 à 100), comme l'attend `getDrawdownMultiplier` : la
  // borne 0-1 laissait le multiplicateur à 1 quelle que soit la baisse.
  drawdown: z.coerce.number().finite().gte(0).lte(100).default(0),
  // Minutes avant le départ : la cote fournie est alors ramenée à la cote
  // finale attendue. 0 (défaut) = la cote fournie est celle qui sera payée.
  minutesToStart: z.coerce.number().finite().gte(0).lte(7 * 24 * 60).default(0),
});

export async function POST(request: Request) {
  const limite = limiterDebit(`simulate:${adresseAppelant(request)}`, LIMITE_APPELS, FENETRE_MS);
  if (!limite.autorise) return reponseTropDeRequetes(limite);

  let corps: unknown;
  try {
    corps = await request.json();
  } catch {
    // `request.json()` levait une exception non gérée sur un corps non-JSON,
    // ce qui produisait un 500 au lieu d'un 400.
    return NextResponse.json({ error: "Corps JSON invalide." }, { status: 400 });
  }

  const resultat = schemaSimulation.safeParse(corps);

  if (!resultat.success) {
    const details = resultat.error.issues.map((probleme) => ({
      champ: probleme.path.join(".") || "(racine)",
      message: probleme.message,
    }));
    return NextResponse.json(
      { error: "Paramètres invalides.", details },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  const { stake, odds, winProbability, bankroll, drawdown, minutesToStart } = resultat.data;

  return NextResponse.json(
    {
      generatedAt: new Date().toISOString(),
      data: simulateBet(stake, odds, winProbability, bankroll, drawdown, minutesToStart),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
