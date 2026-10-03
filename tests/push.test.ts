import { test } from "node:test";
import assert from "node:assert/strict";
import { isPushService } from "@/lib/push/config";
import { departNotification, scratchNotification, type Target } from "@/lib/push/send";

test("abonnement push : seuls les services des navigateurs sont acceptés", () => {
  assert.equal(isPushService("https://fcm.googleapis.com/fcm/send/abc"), true);
  assert.equal(isPushService("https://updates.push.services.mozilla.com/wpush/v2/abc"), true);
  assert.equal(isPushService("https://web.push.apple.com/QK0"), true);
  assert.equal(isPushService("https://db5p.notify.windows.com/w/?token=abc"), true);

  assert.equal(isPushService("http://fcm.googleapis.com/fcm/send/abc"), false, "http refusé");
  assert.equal(isPushService("https://fcm.googleapis.com.evil.example/x"), false, "suffixe trompeur");
  assert.equal(isPushService("https://evilfcm.googleapis.com/x"), false, "sous-chaîne sans point");
  assert.equal(isPushService("https://fcm.googleapis.com:8443/x"), false, "port explicite refusé");
  assert.equal(isPushService("https://169.254.169.254/latest/meta-data"), false);
  assert.equal(isPushService("pas une url"), false);
});

const target: Target = {
  subscription_id: "s",
  endpoint: "https://fcm.googleapis.com/fcm/send/abc",
  p256dh: "k",
  auth: "a",
  race_id: "2026-10-03-R1-C4",
  horse_id: "idao-de-tillard",
  horse_name: "IDAO DE TILLARD",
  number: 7,
  odds: 4.5,
  reunion_number: 1,
  course_number: 4,
  start_time: "15:15",
  racecourse: "VINCENNES",
  minutes_to_start: 27.6,
  payload: {
    numbers: [3, 7, 1],
    odds: [2.1, 4.5, 9],
    win: [30, 20, 10],
    top3: [60, 50, 30],
    market: [40, 20, 10],
    ai: [25, 22, null],
    profile: ["favori", "base", "outsider"],
    profilesVersion: "profils-v2",
  },
};

test("alerte de départ : cheval, délai, course, profil, rang et cote", () => {
  const n = departNotification(target);
  assert.equal(n.title, "IDAO DE TILLARD part dans 28 min");
  assert.match(n.body, /N° 7 · R1C4 VINCENNES · départ 15:15/);
  assert.match(n.body, /Base · rang IA 2 · cote 4,5/);
  assert.equal(n.url, "/races/2026-10-03-R1-C4");
  assert.equal(n.tag, "depart-2026-10-03-R1-C4-idao-de-tillard");
});

test("alerte de départ sans pronostic gelé ni cote : reste lisible", () => {
  const n = departNotification({ ...target, payload: null, odds: null });
  assert.equal(n.body, "N° 7 · R1C4 VINCENNES · départ 15:15");
});

test("alerte de non-partant", () => {
  const n = scratchNotification(target);
  assert.equal(n.title, "IDAO DE TILLARD est non-partant");
  assert.equal(n.body, "N° 7 retiré de la R1C4 VINCENNES (départ 15:15).");
});
