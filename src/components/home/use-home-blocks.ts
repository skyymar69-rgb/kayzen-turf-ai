"use client";

import { useCallback, useSyncExternalStore } from "react";
import {
  HOME_BLOCKS_STORAGE_KEY,
  parseHiddenBlocks,
  serializeHiddenBlocks,
  toggleHiddenBlock,
  type HomeBlockId,
} from "@/lib/home/blocks";

/**
 * Blocs masqués de l'accueil, gardés dans le navigateur. Même mécanique que
 * `useFollowedHorses` : instantané serveur vide (tout est affiché), lecture
 * protégée — un stockage indisponible (navigation privée, quota) ne casse rien,
 * la préférence n'est simplement pas mémorisée.
 */

const CHANGE_EVENT = "kz-accueil-blocs-change";
const NONE: ReadonlySet<HomeBlockId> = new Set();
let cacheRaw: string | null = null;
let cacheSet: ReadonlySet<HomeBlockId> = NONE;

function read(): ReadonlySet<HomeBlockId> {
  let raw: string | null;
  try {
    raw = window.localStorage.getItem(HOME_BLOCKS_STORAGE_KEY);
  } catch {
    return NONE;
  }
  if (raw !== cacheRaw) {
    cacheRaw = raw;
    cacheSet = parseHiddenBlocks(raw);
  }
  return cacheSet;
}

function write(hidden: ReadonlySet<HomeBlockId>) {
  try {
    window.localStorage.setItem(HOME_BLOCKS_STORAGE_KEY, serializeHiddenBlocks(hidden));
  } catch {
    // Stockage indisponible : le choix vaut pour la visite, rien ne casse.
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

function subscribe(onChange: () => void) {
  window.addEventListener(CHANGE_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

const serverSnapshot = () => NONE;

export function useHomeBlocks() {
  const hidden = useSyncExternalStore(subscribe, read, serverSnapshot);
  const toggle = useCallback((id: HomeBlockId) => write(toggleHiddenBlock(read(), id)), []);
  const showAll = useCallback(() => write(NONE), []);
  const isVisible = useCallback((id: HomeBlockId) => !hidden.has(id), [hidden]);
  return { hidden, toggle, showAll, isVisible };
}
