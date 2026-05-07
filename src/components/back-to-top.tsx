"use client";
import { useEffect, useState } from "react";
import { ArrowUp } from "lucide-react";

/* amélioration #20 & 21 — progress ring + fade animation */
export function BackToTop() {
  const [scrollPct, setScrollPct] = useState(0);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    function onScroll() {
      const el  = document.documentElement;
      const pct = el.scrollTop / (el.scrollHeight - el.clientHeight);
      setScrollPct(isFinite(pct) ? pct : 0);
      setVisible(el.scrollTop > 300);
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  /* cercle SVG */
  const r   = 16;
  const circ = 2 * Math.PI * r;
  const dash = circ * (1 - scrollPct);

  return (
    <button
      aria-label="Retour en haut de page"
      className="fixed bottom-6 right-6 z-50 flex h-11 w-11 items-center justify-center rounded-full border border-border bg-surface text-muted shadow-lg transition-all hover:bg-accent hover:text-white hover:scale-110"
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      type="button"
      style={{
        opacity:   visible ? 1 : 0,
        transform: visible ? "translateY(0) scale(1)" : "translateY(12px) scale(0.85)",
        pointerEvents: visible ? "auto" : "none",
        transition: "opacity 200ms ease, transform 200ms ease",
      }}
    >
      {/* anneau de progression */}
      <svg
        aria-hidden="true"
        className="absolute inset-0"
        width="44"
        height="44"
        viewBox="0 0 44 44"
        fill="none"
      >
        {/* fond */}
        <circle cx="22" cy="22" r={r} stroke="currentColor" strokeWidth="2.5" opacity="0.12" />
        {/* progression */}
        <circle
          cx="22"
          cy="22"
          r={r}
          stroke="var(--cta)"
          strokeWidth="2.5"
          strokeDasharray={circ}
          strokeDashoffset={dash}
          strokeLinecap="round"
          style={{ transform: "rotate(-90deg)", transformOrigin: "center", transition: "stroke-dashoffset 80ms linear" }}
        />
      </svg>
      <ArrowUp size={16} className="relative z-10" />
    </button>
  );
}
