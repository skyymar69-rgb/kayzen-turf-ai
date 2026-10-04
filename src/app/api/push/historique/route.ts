import { NextResponse } from "next/server";
import { z } from "zod";
import { getSql, hasDatabase } from "@/lib/db";
import { isPushService } from "@/lib/push/config";
import { adresseAppelant, limiterDebit, reponseTropDeRequetes } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Historique des alertes reçues par CE navigateur, sans compte.
 *
 * L'adresse d'abonnement push est la seule clé : connue du seul navigateur
 * abonné, elle voyage dans le corps d'un POST (jamais dans l'URL ni les
 * journaux). On ne renvoie que ce que le journal d'envoi contient déjà :
 * motif, date, cheval et course.
 */

const bodySchema = z.object({ endpoint: z.string().max(1_000).refine(isPushService) });
const NO_STORE = { "Cache-Control": "no-store" };
const MAX_ITEMS = 50;

type Row = {
  kind: string;
  sent_at: string;
  race_id: string;
  horse_name: string | null;
  reunion_number: number | null;
  course_number: number | null;
  start_time: string;
  race_date: string;
};

export async function POST(request: Request) {
  const limite = limiterDebit(`push-historique:${adresseAppelant(request)}`, 20, 10 * 60_000);
  if (!limite.autorise) return reponseTropDeRequetes(limite);
  if (!hasDatabase()) return NextResponse.json({ items: [], demo: true }, { headers: NO_STORE });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    body = undefined;
  }
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Requête invalide." }, { status: 400, headers: NO_STORE });

  try {
    const rows = (await getSql().query(
      `select d.kind, to_char(d.sent_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as sent_at,
              r.id as race_id, h.name as horse_name, r.reunion_number, r.course_number, r.start_time, r.race_date::text as race_date
         from push_deliveries d
         join push_subscriptions s on s.id = d.subscription_id
         join races r on r.id = d.race_id
         left join horses h on h.id = d.horse_id
        where s.endpoint = $1
        order by d.sent_at desc
        limit ${MAX_ITEMS}`,
      [parsed.data.endpoint],
    )) as Row[];
    return NextResponse.json(
      {
        items: rows.map((r) => ({
          kind: r.kind,
          sentAt: r.sent_at,
          raceId: r.race_id,
          horse: r.horse_name,
          code: r.reunion_number && r.course_number ? `R${r.reunion_number}C${r.course_number}` : null,
          startTime: r.start_time,
          raceDate: r.race_date,
        })),
      },
      { headers: NO_STORE },
    );
  } catch (cause) {
    console.error("POST /api/push/historique", cause instanceof Error ? cause.message : "erreur");
    return NextResponse.json({ error: "Historique momentanément indisponible." }, { status: 503, headers: NO_STORE });
  }
}
