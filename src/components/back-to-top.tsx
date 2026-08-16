"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowUp } from "lucide-react";

const RAYON = 16;
const CIRCONFERENCE = 2 * Math.PI * RAYON;

/**
 * Bouton de retour en haut de page, avec anneau de progression.
 *
 * Deux défauts corrigés :
 *
 * 1. Performance (INP). `setScrollPct` était appelé à chaque événement de
 *    défilement — soit des dizaines de rendus React par seconde, chacun
 *    recalculant le SVG. La progression est désormais écrite directement sur
 *    l'attribut du cercle via une ref, hors du cycle de rendu, et la mesure est
 *    alignée sur la frame d'affichage. Seule la visibilité — qui ne bascule
 *    qu'une fois par franchissement — reste un état React.
 *
 * 2. Accessibilité (WCAG 2.4.3 et 2.4.7). Le bouton restait dans le DOM avec
 *    `opacity: 0` et `pointer-events: none` : invisible à la souris, mais
 *    toujours atteignable au clavier. Un utilisateur tabulant depuis le haut de
 *    page posait le focus sur un bouton qu'il ne voyait pas. `visibility:
 *    hidden` le retire de l'ordre de tabulation tout en conservant la
 *    transition.
 */
export function BackToTop() {
  const [visible, setVisible] = useState(false);
  const cercleRef = useRef<SVGCircleElement>(null);

  useEffect(() => {
    let planifie = false;

    function mesurer() {
      planifie = false;
      const el = document.documentElement;
      const parcourable = el.scrollHeight - el.clientHeight;
      const ratio = parcourable > 0 ? el.scrollTop / parcourable : 0;
      const borne = Math.min(1, Math.max(0, ratio));

      cercleRef.current?.setAttribute("stroke-dashoffset", String(CIRCONFERENCE * (1 - borne)));

      setVisible((precedent) => {
        const suivant = el.scrollTop > 300;
        return suivant === precedent ? precedent : suivant;
      });
    }

    function onScroll() {
      if (planifie) return;
      planifie = true;
      requestAnimationFrame(mesurer);
    }

    mesurer();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  function remonter() {
    // `scroll-behavior: smooth` est déjà neutralisé par la requête média
    // `prefers-reduced-motion` de globals.css ; on respecte ici la même
    // préférence pour le défilement programmatique.
    const mouvementReduit = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top: 0, behavior: mouvementReduit ? "auto" : "smooth" });
  }

  return (
    <button
      aria-label="Retour en haut de page"
      className="fixed bottom-6 right-6 z-50 flex size-11 items-center justify-center rounded-full border border-border bg-surface text-muted shadow-lg transition-all hover:bg-accent hover:text-white hover:scale-110"
      onClick={remonter}
      style={{
        opacity: visible ? 1 : 0,
        visibility: visible ? "visible" : "hidden",
        transform: visible ? "translateY(0) scale(1)" : "translateY(12px) scale(0.85)",
        transition: "opacity 200ms ease, transform 200ms ease, visibility 200ms",
      }}
      type="button"
    >
      {/* anneau de progression */}
      <svg
        aria-hidden="true"
        className="absolute inset-0"
        fill="none"
        height="44"
        viewBox="0 0 44 44"
        width="44"
      >
        {/* fond */}
        <circle cx="22" cy="22" opacity="0.12" r={RAYON} stroke="currentColor" strokeWidth="2.5" />
        {/* progression */}
        <circle
          cx="22"
          cy="22"
          r={RAYON}
          ref={cercleRef}
          stroke="var(--cta)"
          strokeDasharray={CIRCONFERENCE}
          strokeDashoffset={CIRCONFERENCE}
          strokeLinecap="round"
          strokeWidth="2.5"
          style={{ transform: "rotate(-90deg)", transformOrigin: "center", transition: "stroke-dashoffset 80ms linear" }}
        />
      </svg>
      <ArrowUp aria-hidden="true" className="relative z-10" size={16} />
    </button>
  );
}
