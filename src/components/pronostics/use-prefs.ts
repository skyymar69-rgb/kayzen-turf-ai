"use client";

import { useCallback, useSyncExternalStore } from "react";
import { DEFAULT_PREFS, sanitizePrefs, type PronosticPrefs } from "@/lib/pronostics-filters";

/**
 * Filtres, tri et vue de /pronostics, retrouvés au retour d'une page course.
 *
 * Filtres et tri vivent le temps de l'onglet (sessionStorage) ; le choix
 * cartes / vue compacte est une préférence durable (localStorage). Le
 * stockage peut être indisponible (navigation privée stricte) : la valeur en
 * mémoire fait alors foi, rien ne casse.
 *
 * `useSyncExternalStore` plutôt qu'un `useEffect` qui relirait le stockage :
 * le serveur rend les valeurs par défaut, le client les valeurs mémorisées,
 * sans décalage d'hydratation ni rendu en cascade.
 */
const SESSION_KEY = "kz-pronostics-filtres";
const VIEW_KEY = "kz-pronostics-vue";

let current: PronosticPrefs | null = null;
const listeners = new Set<() => void>();

function readStored(): PronosticPrefs {
  try {
    const session = JSON.parse(window.sessionStorage.getItem(SESSION_KEY) ?? "null") as unknown;
    const view = window.localStorage.getItem(VIEW_KEY);
    return sanitizePrefs({ ...(typeof session === "object" && session ? session : {}), view });
  } catch {
    return DEFAULT_PREFS;
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot(): PronosticPrefs {
  if (!current) current = readStored();
  return current;
}

function getServerSnapshot(): PronosticPrefs {
  return DEFAULT_PREFS;
}

function write(next: PronosticPrefs) {
  current = next;
  try {
    window.sessionStorage.setItem(SESSION_KEY, JSON.stringify({ filters: next.filters, sort: next.sort }));
    window.localStorage.setItem(VIEW_KEY, next.view);
  } catch {
    // Stockage indisponible : la préférence vaut pour la visite en cours.
  }
  listeners.forEach((listener) => listener());
}

export function usePrefs() {
  const prefs = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const update = useCallback((patch: Partial<PronosticPrefs>) => write({ ...getSnapshot(), ...patch }), []);
  return { prefs, update };
}
