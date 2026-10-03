"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { VAPID_PUBLIC_KEY } from "@/lib/push/config";

/**
 * Alertes push sur les chevaux suivis, sans compte.
 *
 * Le navigateur s'abonne auprès de son service de push ; l'abonnement et la
 * liste des chevaux suivis partent sur /api/push. La liste est renvoyée à
 * chaque changement et une fois par visite (le serveur oublie un abonnement
 * resté 13 mois sans visite).
 *
 * États :
 *   unsupported  navigateur sans push ;
 *   ios-install  iPhone/iPad : le push n'existe que pour le site ajouté à
 *                l'écran d'accueil ;
 *   denied       le visiteur a refusé les notifications dans son navigateur ;
 *   off / on     alertes coupées / actives ;
 *   pending      opération en cours.
 */

export type PushStatus = "unsupported" | "ios-install" | "denied" | "off" | "on" | "pending";

function base64UrlToUint8Array(value: string): Uint8Array<ArrayBuffer> {
  const padded = (value + "=".repeat((4 - (value.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(padded);
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i += 1) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

function isIosOutsideHomeScreen(): boolean {
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const standalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
  return ios && !standalone;
}

async function currentSubscription(): Promise<PushSubscription | null> {
  const registration = await navigator.serviceWorker.getRegistration("/");
  return (await registration?.pushManager.getSubscription()) ?? null;
}

async function sync(subscription: PushSubscription, horseIds: string[]): Promise<boolean> {
  const response = await fetch("/api/push", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ subscription: subscription.toJSON(), horseIds }),
  });
  return response.ok;
}

export function usePushAlerts(horseIds: string[]) {
  const [status, setStatus] = useState<PushStatus>("pending");
  const [error, setError] = useState<string | null>(null);
  const idsKey = horseIds.join("|");
  const idsRef = useRef(horseIds);
  useEffect(() => {
    idsRef.current = horseIds;
  });

  // État initial, une fois monté (aucune API navigateur côté serveur).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      let next: PushStatus;
      if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
        next = isIosOutsideHomeScreen() ? "ios-install" : "unsupported";
      } else if (Notification.permission === "denied") {
        next = "denied";
      } else {
        next = (await currentSubscription().catch(() => null)) ? "on" : "off";
      }
      if (!cancelled) setStatus(next);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Liste à jour côté serveur : à l'activation, à chaque changement, à chaque visite.
  useEffect(() => {
    if (status !== "on") return;
    const timer = setTimeout(async () => {
      const subscription = await currentSubscription().catch(() => null);
      if (subscription) await sync(subscription, idsRef.current).catch(() => undefined);
      else setStatus("off");
    }, 800);
    return () => clearTimeout(timer);
  }, [status, idsKey]);

  const enable = useCallback(async () => {
    setError(null);
    setStatus("pending");
    try {
      const registration = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setStatus(permission === "denied" ? "denied" : "off");
        return;
      }
      await navigator.serviceWorker.ready;
      const subscription =
        (await registration.pushManager.getSubscription()) ??
        (await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: base64UrlToUint8Array(VAPID_PUBLIC_KEY),
        }));
      if (!(await sync(subscription, idsRef.current))) throw new Error("server");
      setStatus("on");
    } catch {
      setError("Activation impossible pour le moment. Réessayez dans quelques minutes.");
      setStatus("off");
    }
  }, []);

  const disable = useCallback(async () => {
    setError(null);
    setStatus("pending");
    try {
      const subscription = await currentSubscription();
      if (subscription) {
        await fetch("/api/push", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: subscription.endpoint }),
        });
        await subscription.unsubscribe();
      }
    } finally {
      setStatus("off");
    }
  }, []);

  return { status, error, enable, disable };
}
