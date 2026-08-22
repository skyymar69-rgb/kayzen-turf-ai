import { NextResponse } from "next/server";
import { z } from "zod";
import { getSql, hasDatabase } from "@/lib/db";
import { adresseAppelant, limiterDebit, reponseTropDeRequetes } from "@/lib/rate-limit";
import { COMPANY } from "@/lib/site-config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Enregistrement des demandes d'exercice des droits RGPD.
 *
 * Le formulaire de /confidentialite se contentait d'afficher « branchement
 * email/API à finaliser » : la saisie était perdue. Or l'article 12.3 du RGPD
 * impose une réponse sous un mois, et l'article 5.2 impose de pouvoir le
 * démontrer. Sans registre, ni délai ni preuve.
 *
 * La demande est consignée en base avec une référence rendue au demandeur. Si
 * la base est indisponible, la route le dit franchement et renvoie l'adresse du
 * responsable de traitement : elle ne prétend jamais avoir enregistré ce
 * qu'elle a perdu.
 */

const LIMITE_APPELS = 3;
const FENETRE_MS = 10 * 60_000;

const schemaDemande = z.object({
  email: z.email("Adresse email invalide").max(254),
  requestType: z.enum([
    "access",
    "rectification",
    "erasure",
    "opposition",
    "limitation",
    "portability",
  ]),
  message: z
    .string()
    .trim()
    .min(10, "Décrivez votre demande en quelques mots (10 caractères minimum)")
    .max(4_000, "Message trop long (4 000 caractères maximum)"),
  // Consentement explicite, non pré-coché côté formulaire : le traitement de la
  // demande suppose de conserver l'email le temps de l'instruction.
  consent: z.literal(true, "Le consentement au traitement de la demande est obligatoire"),
  // Piège à robots : un champ masqué que seul un script remplit.
  website: z.string().max(0).optional().or(z.literal("")),
});

/**
 * Référence lisible communiquée au demandeur : `PT-<date>-<aléa>`.
 * `crypto.randomUUID` est disponible nativement sur le runtime Node de Next.
 */
function nouvelleReference(): string {
  const jour = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const alea = crypto.randomUUID().split("-")[0]!.toUpperCase();
  return `PT-${jour}-${alea}`;
}

export async function POST(request: Request) {
  const limite = limiterDebit(`privacy:${adresseAppelant(request)}`, LIMITE_APPELS, FENETRE_MS);
  if (!limite.autorise) return reponseTropDeRequetes(limite);

  let corps: unknown;
  try {
    corps = await request.json();
  } catch {
    return NextResponse.json({ error: "Corps JSON invalide." }, { status: 400 });
  }

  const resultat = schemaDemande.safeParse(corps);

  if (!resultat.success) {
    return NextResponse.json(
      {
        error: "Demande incomplète.",
        details: resultat.error.issues.map((probleme) => ({
          champ: probleme.path.join(".") || "(racine)",
          message: probleme.message,
        })),
      },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  const { email, requestType, message, website } = resultat.data;

  // Robot détecté : on répond comme un succès pour ne pas lui apprendre qu'il
  // est repéré, mais rien n'est écrit en base.
  if (website) {
    return NextResponse.json(
      { reference: nouvelleReference(), delaiJours: 30 },
      { status: 202, headers: { "Cache-Control": "no-store" } },
    );
  }

  if (!hasDatabase()) {
    return NextResponse.json(
      {
        error:
          "Le registre des demandes est momentanément indisponible. Adressez votre demande par email pour qu'elle soit prise en compte.",
        contact: COMPANY.email,
      },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }

  const reference = nouvelleReference();

  try {
    const sql = getSql();
    await sql`
      insert into privacy_requests (reference, email, request_type, message)
      values (${reference}, ${email}, ${requestType}, ${message})
    `;
  } catch (cause) {
    console.error("Enregistrement de la demande RGPD impossible", cause);
    return NextResponse.json(
      {
        error:
          "Votre demande n'a pas pu être enregistrée. Adressez-la par email pour qu'elle soit prise en compte.",
        contact: COMPANY.email,
      },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }

  return NextResponse.json(
    { reference, delaiJours: 30 },
    { status: 201, headers: { "Cache-Control": "no-store" } },
  );
}
