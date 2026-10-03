/**
 * Alertes push — réglages partagés par le navigateur, la route d'abonnement et
 * la boucle d'envoi.
 *
 * La clé publique VAPID identifie le serveur auprès des services de push
 * (Google, Mozilla, Apple). Elle est publique par nature : le navigateur la
 * reçoit en clair. La clé privée, elle, ne vit que dans le secret GitHub
 * VAPID_PRIVATE_KEY, lu par la boucle live qui envoie les notifications.
 */
export const VAPID_PUBLIC_KEY =
  "BLt_Y5fxJvQoau-hbWvUGe2yXlfBk6sg6R4ctpyEiE4LYz5RUMFNSgZ-66BkLB1v5pL8qbk8PIMwSsGgKq0tSqw";

/** L'alerte de départ part quand le cheval court dans moins de 30 min. */
export const DEPART_ALERT_MINUTES = 30;

/** Chevaux suivis au plus par navigateur : borne la ligne et la requête d'envoi. */
export const MAX_FOLLOWED_HORSES = 100;

/**
 * Services de push des navigateurs. La boucle d'envoi contacte l'adresse
 * d'abonnement : n'accepter que ces hôtes évite qu'un script nous fasse
 * appeler une URL arbitraire.
 */
const PUSH_HOSTS = [
  "fcm.googleapis.com",
  "updates.push.services.mozilla.com",
  "web.push.apple.com",
  "notify.windows.com",
];

export function isPushService(endpoint: string): boolean {
  try {
    const url = new URL(endpoint);
    return (
      url.protocol === "https:" &&
      url.port === "" &&
      PUSH_HOSTS.some((host) => url.hostname === host || url.hostname.endsWith(`.${host}`))
    );
  } catch {
    return false;
  }
}
