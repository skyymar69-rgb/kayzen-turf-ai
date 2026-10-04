"use client";

import { useEffect, useRef } from "react";
import { Keyboard } from "lucide-react";
import { SHORTCUTS } from "./use-shortcuts";

type Props = { open: boolean; onToggle: (open: boolean) => void };

/**
 * Bouton « ? » et sa bulle d'aide. Échap ou un clic ailleurs la ferment, et
 * le focus revient au bouton quand elle se ferme au clavier.
 */
export function ShortcutsHelp({ open, onToggle }: Props) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      onToggle(false);
      buttonRef.current?.focus();
    }
    function onPointer(event: PointerEvent) {
      if (!wrapperRef.current?.contains(event.target as Node)) onToggle(false);
    }
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
    };
  }, [open, onToggle]);

  return (
    <div ref={wrapperRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        aria-expanded={open}
        aria-controls="aide-raccourcis"
        onClick={() => onToggle(!open)}
        className="inline-flex size-10 items-center justify-center rounded-xl border border-border bg-surface text-sm font-bold text-muted hover:text-fg"
      >
        <span aria-hidden="true">?</span>
        <span className="sr-only">Raccourcis clavier</span>
      </button>
      {open && (
        <div
          id="aide-raccourcis"
          role="region"
          aria-label="Raccourcis clavier"
          className="absolute right-0 top-12 z-30 w-64 rounded-xl border border-border bg-surface p-4 shadow-xl"
        >
          <p className="flex items-center gap-2 text-sm font-bold text-fg">
            <Keyboard aria-hidden="true" size={15} /> Raccourcis clavier
          </p>
          <dl className="mt-3 space-y-2 text-sm">
            {SHORTCUTS.map((s) => (
              <div key={s.keys} className="flex items-center justify-between gap-3">
                <dt>
                  <kbd className="rounded border border-border-strong bg-surface-sub px-1.5 py-0.5 font-mono text-xs text-fg">{s.keys}</kbd>
                </dt>
                <dd className="text-right text-muted">{s.label}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-3 text-xs text-muted">Inactifs pendant la saisie dans un champ.</p>
        </div>
      )}
    </div>
  );
}
