"use client";

import { useEffect } from "react";

/** Au-delà, la position mémorisée ne correspond plus à une « visite en cours ». */
const MAX_AGE_MS = 30 * 60_000;

/**
 * Position de défilement de /pronostics, par jour affiché, rendue au retour
 * d'une page course. Ignorée quand l'adresse vise une course (#R1C3) : l'ancre
 * l'emporte.
 */
export function useScrollMemory(day: string) {
  useEffect(() => {
    const key = `kz-pronostics-defilement:${day}`;

    if (!window.location.hash) {
      try {
        const saved = JSON.parse(window.sessionStorage.getItem(key) ?? "null") as { y?: unknown; at?: unknown } | null;
        if (saved && typeof saved.y === "number" && typeof saved.at === "number" && Date.now() - saved.at < MAX_AGE_MS) {
          const y = saved.y;
          requestAnimationFrame(() => window.scrollTo({ top: y, behavior: "auto" }));
        }
      } catch {
        // Stockage illisible : on part du haut de page.
      }
    }

    let timer: ReturnType<typeof setTimeout> | null = null;
    function save() {
      timer = null;
      try {
        window.sessionStorage.setItem(key, JSON.stringify({ y: Math.round(window.scrollY), at: Date.now() }));
      } catch {
        // Stockage indisponible : la position ne sera pas retrouvée.
      }
    }
    function onScroll() {
      if (timer) return;
      timer = setTimeout(save, 250);
    }

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      // Une sauvegarde en attente écrirait la position de la page suivante.
      if (timer) clearTimeout(timer);
    };
  }, [day]);
}
