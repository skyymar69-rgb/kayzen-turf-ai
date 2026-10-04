"use client";

import { useEffect, useEffectEvent } from "react";

export type ShortcutHandlers = {
  next: () => void;
  previous: () => void;
  focusSearch: () => void;
  toggleHelp: () => void;
};

export const SHORTCUTS: Array<{ keys: string; label: string }> = [
  { keys: "j", label: "Course suivante" },
  { keys: "k", label: "Course précédente" },
  { keys: "/", label: "Rechercher" },
  { keys: "?", label: "Afficher ou masquer cette aide" },
  { keys: "Échap", label: "Fermer l’aide ou le panneau des courses" },
];

/** Saisie en cours : les touches appartiennent au champ, pas aux raccourcis. */
function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
}

/** j / k pour passer d'une course à l'autre, / pour chercher, ? pour l'aide. */
export function useShortcuts(handlers: ShortcutHandlers) {
  const onKey = useEffectEvent((event: KeyboardEvent) => {
    if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey || isTyping(event.target)) return;
    if (document.querySelector("dialog[open]")) return;
    const actions: Record<string, () => void> = {
      j: handlers.next,
      k: handlers.previous,
      "/": handlers.focusSearch,
      "?": handlers.toggleHelp,
    };
    const action = actions[event.key];
    if (!action) return;
    event.preventDefault();
    action();
  });

  useEffect(() => {
    const listener = (event: KeyboardEvent) => onKey(event);
    document.addEventListener("keydown", listener);
    return () => document.removeEventListener("keydown", listener);
  }, []);
}
