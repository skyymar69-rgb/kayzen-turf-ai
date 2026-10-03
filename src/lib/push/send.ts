import webpush, { WebPushError } from "web-push";
import { getSql } from "@/lib/db";
import type { FrozenPayload } from "@/lib/live/freeze";
import { PROFILE_LABELS } from "@/lib/profiles";
import { DEPART_ALERT_MINUTES, VAPID_PUBLIC_KEY } from "@/lib/push/config";
import { SITE_URL } from "@/lib/site";

/**
 * ENVOI DES ALERTES PUSH — appelé par la boucle live (scripts/live-refresh.ts)
 * après chaque passage. Deux motifs :
 *   - « depart »      : un cheval suivi court dans moins de 30 minutes ;
 *   - « non-partant » : un cheval suivi vient d'être retiré de sa course.
 *
 * Chaque notification envoyée est consignée dans `push_deliveries` : la boucle
 * repasse toutes les 30 s, le journal garantit une seule alerte par motif.
 * Un abonnement que le service de push déclare expiré (404/410) est supprimé.
 */

export type Target = {
  subscription_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  race_id: string;
  horse_id: string;
  horse_name: string;
  number: number;
  odds: number | null;
  reunion_number: number | null;
  course_number: number | null;
  start_time: string;
  racecourse: string | null;
  minutes_to_start: number;
  payload: FrozenPayload | null;
};

type Notification = { title: string; body: string; url: string; tag: string };

let configured: boolean | null = null;

/** Faux sans clé privée (poste local, fork) : la boucle tourne alors sans envoyer. */
export function pushConfigured(): boolean {
  if (configured === null) {
    const privateKey = process.env.VAPID_PRIVATE_KEY;
    configured = Boolean(privateKey);
    if (privateKey) webpush.setVapidDetails(`${SITE_URL}/mentions-legales`, VAPID_PUBLIC_KEY, privateKey);
  }
  return configured;
}

function programCode(t: Target): string {
  return t.reunion_number && t.course_number ? `R${t.reunion_number}C${t.course_number}` : "";
}

function raceLabel(t: Target): string {
  return [programCode(t), t.racecourse].filter(Boolean).join(" ");
}

export function departNotification(t: Target): Notification {
  const minutes = Math.max(0, Math.round(t.minutes_to_start));
  const details: string[] = [];
  const index = t.payload?.numbers.indexOf(t.number) ?? -1;
  if (index >= 0 && t.payload) {
    details.push(`${PROFILE_LABELS[t.payload.profile[index]!] ?? ""} · rang IA ${index + 1}`);
  }
  if (t.odds && t.odds > 1) details.push(`cote ${String(Number(t.odds).toFixed(1)).replace(".", ",")}`);
  return {
    title: `${t.horse_name} part dans ${minutes} min`,
    body: [`N° ${t.number} · ${raceLabel(t)} · départ ${t.start_time}`, details.join(" · ")].filter(Boolean).join("\n"),
    url: `/races/${encodeURIComponent(t.race_id)}`,
    tag: `depart-${t.race_id}-${t.horse_id}`,
  };
}

export function scratchNotification(t: Target): Notification {
  return {
    title: `${t.horse_name} est non-partant`,
    body: `N° ${t.number} retiré de la ${raceLabel(t)} (départ ${t.start_time}).`,
    url: `/races/${encodeURIComponent(t.race_id)}`,
    tag: `non-partant-${t.race_id}-${t.horse_id}`,
  };
}

async function deliver(t: Target, kind: "depart" | "non-partant", notification: Notification): Promise<boolean> {
  const sql = getSql();
  try {
    await webpush.sendNotification(
      { endpoint: t.endpoint, keys: { p256dh: t.p256dh, auth: t.auth } },
      JSON.stringify(notification),
      // Une alerte de départ n'a plus de sens une fois le départ donné.
      { TTL: Math.max(60, Math.round(t.minutes_to_start * 60)), urgency: "high" },
    );
  } catch (error) {
    if (error instanceof WebPushError && (error.statusCode === 404 || error.statusCode === 410)) {
      await sql.query(`delete from push_subscriptions where id = $1`, [t.subscription_id]);
      return false;
    }
    // Panne passagère du service de push : le passage suivant réessaiera.
    console.warn(`[push] envoi impossible (${(error as Error).message})`);
    return false;
  }
  await sql.query(
    `insert into push_deliveries (subscription_id, race_id, horse_id, kind) values ($1, $2, $3, $4)
     on conflict do nothing`,
    [t.subscription_id, t.race_id, t.horse_id, kind],
  );
  return true;
}

const TARGET_COLUMNS = `
  s.id as subscription_id, s.endpoint, s.p256dh, s.auth,
  r.id as race_id, h.id as horse_id, h.name as horse_name, e.number, e.odds::float8 as odds,
  r.reunion_number, r.course_number, r.start_time, rc.name as racecourse,
  (extract(epoch from (((r.race_date + replace(r.start_time, 'h', ':')::time) at time zone 'Europe/Paris') - now())) / 60)::float8 as minutes_to_start`;

/** Alertes de départ : chevaux suivis qui courent dans moins de 30 min. */
async function departTargets(): Promise<Target[]> {
  return (await getSql().query(
    `select ${TARGET_COLUMNS}, ps.payload
       from races r
       join entries e on e.race_id = r.id
       join horses h on h.id = e.horse_id
       join push_subscriptions s on e.horse_id = any(s.horse_ids)
       left join racecourses rc on rc.id = r.racecourse_id
       left join lateral (
         select p.payload from prediction_snapshots p where p.race_id = r.id order by p.captured_at desc limit 1
       ) ps on true
      where r.race_date between (now() at time zone 'Europe/Paris')::date - 1 and (now() at time zone 'Europe/Paris')::date
        and r.start_time ~ '^\\d{1,2}[:h]\\d{2}$'
        and ((r.race_date + replace(r.start_time, 'h', ':')::time) at time zone 'Europe/Paris')
            between now() and now() + make_interval(mins => $1)
        and not exists (
          select 1 from push_deliveries d
           where d.subscription_id = s.id and d.race_id = r.id and d.horse_id = e.horse_id and d.kind = 'depart')`,
    [DEPART_ALERT_MINUTES],
  )) as Target[];
}

/**
 * Alertes de non-partant. L'engagement vient d'être supprimé de `entries` : le
 * numéro est fourni par l'appelant, qui l'a lu au moment du retrait.
 */
async function scratchTargets(raceId: string, horseIds: string[]): Promise<Target[]> {
  return (await getSql().query(
    `select s.id as subscription_id, s.endpoint, s.p256dh, s.auth,
            r.id as race_id, h.id as horse_id, h.name as horse_name,
            0 as number,
            null::float8 as odds, r.reunion_number, r.course_number, r.start_time, rc.name as racecourse,
            (extract(epoch from (((r.race_date + replace(r.start_time, 'h', ':')::time) at time zone 'Europe/Paris') - now())) / 60)::float8 as minutes_to_start,
            null::jsonb as payload
       from races r
       join horses h on h.id = any($2::text[])
       join push_subscriptions s on h.id = any(s.horse_ids)
       left join racecourses rc on rc.id = r.racecourse_id
      where r.id = $1
        and not exists (
          select 1 from push_deliveries d
           where d.subscription_id = s.id and d.race_id = r.id and d.horse_id = h.id and d.kind = 'non-partant')`,
    [raceId, horseIds],
  )) as Target[];
}

/**
 * Envoie les alertes dues. `scratched` : chevaux retirés pendant ce passage,
 * par course, avec leur numéro (l'engagement n'existe plus en base).
 */
export async function sendPushAlerts(scratched: Array<{ raceId: string; horses: Array<{ horseId: string; number: number }> }> = []) {
  if (!pushConfigured()) return { sent: 0 };
  let sent = 0;

  for (const race of scratched) {
    const numbers = new Map(race.horses.map((h) => [h.horseId, h.number]));
    for (const target of await scratchTargets(race.raceId, [...numbers.keys()])) {
      target.number = numbers.get(target.horse_id) ?? target.number;
      if (await deliver(target, "non-partant", scratchNotification(target))) sent += 1;
    }
  }

  for (const target of await departTargets()) {
    if (await deliver(target, "depart", departNotification(target))) sent += 1;
  }

  return { sent };
}

/** Abonnements sans visite depuis 13 mois : supprimés (minimisation, RGPD art. 5.1.e). */
export async function purgeStaleSubscriptions() {
  const removed = await getSql().query(
    `delete from push_subscriptions where seen_at < now() - interval '13 months' returning 1`,
  );
  return removed.length;
}
