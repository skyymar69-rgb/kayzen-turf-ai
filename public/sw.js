/*
 * Service worker PronoTurf : affiche les alertes push sur les chevaux suivis
 * et ouvre la course au clic. Il ne met rien en cache et n'intercepte aucune
 * requête : le site reste servi exactement comme sans lui.
 */

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: "PronoTurf", body: event.data ? event.data.text() : "" };
  }
  event.waitUntil(
    self.registration.showNotification(data.title || "PronoTurf", {
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
