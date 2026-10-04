"use client";

import { useEffect, useState } from "react";

/**
 * Course actuellement lue : la première carte, dans l'ordre de la page, qui
 * traverse la bande haute de l'écran (sous l'en-tête collant).
 *
 * `anchors` liste les cartes présentes dans le DOM, dans l'ordre d'affichage.
 * L'état n'est mis à jour que par l'IntersectionObserver, jamais à chaque
 * événement de défilement.
 */
export function useScrollSpy(anchors: string[]): string | null {
  const [active, setActive] = useState<string | null>(null);
  const key = anchors.join(",");

  useEffect(() => {
    const order = key ? key.split(",") : [];
    if (order.length === 0) return;
    const visible = new Set<string>();

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) visible.add(entry.target.id);
          else visible.delete(entry.target.id);
        }
        const first = order.find((anchor) => visible.has(anchor));
        if (first) setActive(first);
      },
      { rootMargin: "-96px 0px -55% 0px" },
    );

    for (const anchor of order) {
      const el = document.getElementById(anchor);
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  }, [key]);

  return active;
}
