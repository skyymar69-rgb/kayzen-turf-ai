"use client";

import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from "react";
import { lexiqueDefinition, type LexiqueTerm } from "@/lib/lexique";

/**
 * TERME DU LEXIQUE — un mot technique souligné en pointillé, dont la
 * définition s'affiche au survol, au focus clavier ou au toucher.
 *
 * La définition vient du lexique du site (src/lib/lexique.ts) : l'infobulle
 * ne peut pas dire autre chose que la page /lexique. Elle est reliée au mot
 * par `aria-describedby`, donc lue par les lecteurs d'écran même fermée.
 * Positionnée en `fixed` et bornée à l'écran : elle ne crée jamais de
 * défilement horizontal sur un téléphone.
 */

const WIDTH = 256;
const MARGIN = 8;

export function Term({ name, children }: { name: LexiqueTerm; children: ReactNode }) {
  const id = useId();
  const ref = useRef<HTMLButtonElement>(null);
  const [position, setPosition] = useState<{ left: number; top?: number; bottom?: number } | null>(null);
  const definition = lexiqueDefinition(name);

  const open = useCallback(() => {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;
    const width = Math.min(WIDTH, window.innerWidth - 2 * MARGIN);
    const left = Math.min(Math.max(MARGIN, rect.left + rect.width / 2 - width / 2), window.innerWidth - MARGIN - width);
    // Trop près du bas de l'écran : au-dessus du mot plutôt qu'en dessous.
    const below = rect.bottom + 160 < window.innerHeight;
    setPosition(below ? { left, top: rect.bottom + 6 } : { left, bottom: window.innerHeight - rect.top + 6 });
  }, []);
  const close = useCallback(() => setPosition(null), []);

  // Une infobulle fixe ne suit pas le défilement : on la ferme.
  useEffect(() => {
    if (!position) return;
    window.addEventListener("scroll", close, { passive: true, once: true });
    return () => window.removeEventListener("scroll", close);
  }, [position, close]);

  if (!definition) return <>{children}</>;

  return (
    <>
      <button
        ref={ref}
        aria-describedby={id}
        className="cursor-help rounded-sm underline decoration-dotted decoration-1 underline-offset-2"
        onBlur={close}
        onClick={(e) => {
          e.stopPropagation();
          if (position) close();
          else open();
        }}
        onFocus={open}
        onKeyDown={(e) => {
          if (e.key === "Escape") close();
        }}
        onMouseEnter={open}
        onMouseLeave={close}
        type="button"
      >
        {children}
      </button>
      <span
        className={`fixed z-50 rounded-lg bg-surface-inv p-2.5 text-left text-xs font-normal normal-case leading-5 tracking-normal text-white shadow-lg ${position ? "block" : "hidden"}`}
        id={id}
        role="tooltip"
        style={position ? { left: position.left, top: position.top, bottom: position.bottom, width: `min(${WIDTH}px, calc(100vw - ${2 * MARGIN}px))` } : undefined}
      >
        <span className="font-bold">{name} — </span>
        {definition}
      </span>
    </>
  );
}
