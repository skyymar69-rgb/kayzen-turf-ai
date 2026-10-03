import { NextResponse } from "next/server";
import { z } from "zod";
import { getSql, hasDatabase } from "@/lib/db";
import { isPushService, MAX_FOLLOWED_HORSES } from "@/lib/push/config";
import { adresseAppelant, limiterDebit, reponseTropDeRequetes } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Abonnement aux alertes push, sans compte.
 *
 * POST   enregistre l'abonnement du navigateur et remplace sa liste de chevaux
 *        suivis (appelé à l'activation, puis à chaque changement de la liste et
 *        à chaque visite, ce qui tient `seen_at` à jour).
 * DELETE supprime l'abonnement : le visiteur a coupé les alertes.
 *
 * L'adresse de livraison est appelée plus tard par la boucle d'envoi : seuls
 * les services de push des navigateurs sont acceptés, jamais une URL
 * arbitraire qu'un script nous ferait contacter.
 */

const endpointSchema = z.string().max(1_000).refine(isPushService, "Service de push non reconnu");

const subscribeSchema = z.object({
  subscription: z.object({
    endpoint: endpointSchema,
    keys: z.object({
      p256dh: z.string().min(16).max(200),
      auth: z.string().min(8).max(100),
    }),
  }),
  horseIds: z.array(z.string().min(1).max(120)).max(MAX_FOLLOWED_HORSES),
});

const unsubscribeSchema = z.object({ endpoint: endpointSchema });

const NO_STORE = { "Cache-Control": "no-store" };

async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return undefined;
  }
}

function guard(request: Request) {
  const limite = limiterDebit(`push:${adresseAppelant(request)}`, 30, 10 * 60_000);
  if (!limite.autorise) return reponseTropDeRequetes(limite);
  if (!hasDatabase()) {
    return NextResponse.json({ error: "Alertes momentanément indisponibles." }, { status: 503, headers: NO_STORE });
  }
  return null;
}

export async function POST(request: Request) {
  const blocked = guard(request);
  if (blocked) return blocked;

  const parsed = subscribeSchema.safeParse(await readJson(request));
  if (!parsed.success) {
    return NextResponse.json({ error: "Abonnement invalide." }, { status: 400, headers: NO_STORE });
  }
  const { subscription, horseIds } = parsed.data;

  await getSql().query(
    `insert into push_subscriptions (endpoint, p256dh, auth, horse_ids)
     values ($1, $2, $3, $4::text[])
     on conflict (endpoint) do update
       set p256dh = excluded.p256dh, auth = excluded.auth,
           horse_ids = excluded.horse_ids, seen_at = now()`,
    [subscription.endpoint, subscription.keys.p256dh, subscription.keys.auth, [...new Set(horseIds)]],
  );

  return NextResponse.json({ ok: true }, { status: 200, headers: NO_STORE });
}

export async function DELETE(request: Request) {
  const blocked = guard(request);
  if (blocked) return blocked;

  const parsed = unsubscribeSchema.safeParse(await readJson(request));
  if (!parsed.success) {
    return NextResponse.json({ error: "Requête invalide." }, { status: 400, headers: NO_STORE });
  }

  await getSql().query(`delete from push_subscriptions where endpoint = $1`, [parsed.data.endpoint]);
  return NextResponse.json({ ok: true }, { status: 200, headers: NO_STORE });
}
