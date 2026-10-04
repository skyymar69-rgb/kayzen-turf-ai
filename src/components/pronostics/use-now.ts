"use client";

import { useMemo, useSyncExternalStore } from "react";

/**
 * Horloge partagée de la page, rafraîchie toutes les 20 s.
 *
 * Les états (à venir, imminente, partie) et le bandeau « Prochaine course »
 * en dépendent. Une seule minuterie pour toute la page, quel que soit le
 * nombre de composants abonnés ; elle s'arrête quand plus personne n'écoute.
 * Le serveur fournit son instant : l'hydratation part du même état que le
 * HTML, puis l'horloge du navigateur prend le relais.
 */
const TICK_MS = 20_000;

let current = 0;
let timer: ReturnType<typeof setInterval> | undefined;
const listeners = new Set<() => void>();

function tick() {
  current = Date.now();
  listeners.forEach((listener) => listener());
}

function onVisibility() {
  if (document.visibilityState === "visible") tick();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (listeners.size === 1) {
    timer = setInterval(tick, TICK_MS);
    document.addEventListener("visibilitychange", onVisibility);
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibility);
    }
  };
}

function getSnapshot() {
  if (current === 0) current = Date.now();
  return current;
}

export function useNow(serverNow: number): Date {
  const ms = useSyncExternalStore(subscribe, getSnapshot, () => serverNow);
  return useMemo(() => new Date(ms), [ms]);
}
