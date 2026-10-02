"use client";

import { useCallback, useSyncExternalStore } from "react";

const STORAGE_KEY = "pt-chevaux-suivis";
const CHANGE_EVENT = "pt-chevaux-suivis-change";

/**
 * Chevaux suivis par le visiteur, gardés dans son navigateur (aucun compte,
 * aucune donnée envoyée). Même mécanique que `useFavorites` :
 * `useSyncExternalStore` sépare l'instantané serveur (vide) de l'instantané
 * client, ce qui évite tout décalage d'hydratation.
 */

export type FollowedHorse = { id: string; name: string };

const EMPTY: ReadonlyMap<string, string> = new Map();
let cacheRaw: string | null = null;
let cacheMap: ReadonlyMap<string, string> = EMPTY;

function read(): ReadonlyMap<string, string> {
  let raw: string | null;
  try {
    raw = window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return EMPTY;
  }
  if (raw === cacheRaw) return cacheMap;
  cacheRaw = raw;
  try {
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    cacheMap = new Map(
      (Array.isArray(parsed) ? parsed : [])
        .filter((h): h is FollowedHorse => typeof h?.id === "string" && typeof h?.name === "string")
        .map((h) => [h.id, h.name]),
    );
  } catch {
    cacheMap = EMPTY;
  }
  return cacheMap;
}

function serverSnapshot(): ReadonlyMap<string, string> {
  return EMPTY;
}

function subscribe(onChange: () => void) {
  window.addEventListener(CHANGE_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

export function useFollowedHorses() {
  const followed = useSyncExternalStore(subscribe, read, serverSnapshot);

  const toggle = useCallback((horse: FollowedHorse) => {
    const next = new Map(read());
    if (next.has(horse.id)) next.delete(horse.id);
    else next.set(horse.id, horse.name);
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify([...next].map(([id, name]) => ({ id, name }))));
    } catch {
      // Stockage indisponible : le suivi ne sera pas mémorisé, rien ne casse.
    }
    window.dispatchEvent(new Event(CHANGE_EVENT));
  }, []);

  return { followed, toggle };
}
