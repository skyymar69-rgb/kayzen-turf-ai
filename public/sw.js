/*
 * Service worker Kayzen Turf.
 *
 * 1. Alertes push sur les chevaux suivis ; le clic ouvre la course.
 * 2. Consultation hors ligne : pour les seules navigations (pages HTML) du
 *    site, le réseau passe TOUJOURS en premier. La dernière copie reçue des
 *    pages de pronostics est gardée et resservie si le réseau manque, avec la
 *    page /hors-ligne en dernier recours. Aucune API, aucune image, aucun
 *    script n'est mis en cache : une cote périmée ne peut pas se faire passer
 *    pour une cote fraîche, et le bandeau « hors ligne » le signale.
 */

const PAGES_CACHE = "kayzen-pages-v1";
const OFFLINE_URL = "/hors-ligne";
const MAX_PAGES = 30;
/** Pages gardées pour la consultation hors ligne. */
const CACHEABLE = [/^\/$/, /^\/pronostics$/, /^\/direct$/, /^\/races\/[^/]+$/, /^\/methode$/, /^\/lexique$/];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(PAGES_CACHE)
      .then((cache) => cache.add(new Request(OFFLINE_URL, { cache: "reload" })))
      .catch(() => undefined)
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith("kayzen-pages-") && k !== PAGES_CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

async function trimCache(cache) {
  const keys = await cache.keys();
  const pages = keys.filter((r) => new URL(r.url).pathname !== OFFLINE_URL);
  for (const old of pages.slice(0, Math.max(0, pages.length - MAX_PAGES))) await cache.delete(old);
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.mode !== "navigate" || request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  const cacheable = CACHEABLE.some((re) => re.test(url.pathname));

  event.respondWith(
    (async () => {
      let response;
      try {
        response = await fetch(request);
      } catch {
        response = null;
      }
      if (response) {
        // La copie s'écrit à côté, sans retenir la réponse : le flux HTML
        // arrive au navigateur sans attendre, et un échec d'écriture (quota)
        // ne fait jamais servir une copie quand le réseau a répondu.
        if (cacheable && response.ok && response.type === "basic") {
          const copy = response.clone();
          event.waitUntil(
            caches
              .open(PAGES_CACHE)
              .then((cache) => cache.put(url.pathname + url.search, copy).then(() => trimCache(cache)))
              .catch(() => undefined),
          );
        }
        return response;
      }
      // Réseau absent : dernière copie de la page, sinon la page hors ligne.
      const cache = await caches.open(PAGES_CACHE);
      return (cacheable && (await cache.match(url.pathname + url.search))) || (await cache.match(OFFLINE_URL)) || Response.error();
    })(),
  );
});

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: "Kayzen Turf", body: event.data ? event.data.text() : "" };
  }
  event.waitUntil(
    self.registration.showNotification(data.title || "Kayzen Turf", {
      body: data.body || "",
      tag: data.tag,
      icon: "/icon-192.png",
      badge: "/favicon-48x48.png",
      lang: "fr",
      data: { url: data.url || "/" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = new URL(event.notification.data?.url || "/", self.location.origin);
  // Seules les pages du site s'ouvrent depuis une notification.
  const url = target.origin === self.location.origin ? target.href : self.location.origin;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((windows) => {
      for (const client of windows) {
        if (client.url === url && "focus" in client) return client.focus();
      }
      return self.clients.openWindow(url);
    }),
  );
});
