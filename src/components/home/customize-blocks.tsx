"use client";

import { SlidersHorizontal } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { HOME_BLOCKS, type HomeBlockId } from "@/lib/home/blocks";

/**
 * « Personnaliser » : afficher ou masquer les blocs secondaires de l'accueil.
 * Le choix est mémorisé dans ce navigateur. Échap referme le panneau et rend
 * le focus au bouton.
 */
export function CustomizeBlocks({ hidden, onToggle, onShowAll }: {
  hidden: ReadonlySet<HomeBlockId>;
  onToggle: (id: HomeBlockId) => void;
  onShowAll: () => void;
}) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setOpen(false);
      buttonRef.current?.focus();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <div className="relative flex justify-end">
      <button
        ref={buttonRef}
        aria-controls={panelId}
        aria-expanded={open}
        className="inline-flex min-h-9 items-center gap-1.5 rounded-xl border border-border bg-surface px-3 text-xs font-bold text-muted transition hover:border-accent/40 hover:text-accent-text"
        onClick={() => setOpen((v) => !v)}
        type="button"
      >
        <SlidersHorizontal aria-hidden="true" size={13} /> Personnaliser
        {hidden.size > 0 && <span className="rounded-full bg-accent-lo px-1.5 text-[10px] text-accent-text">{hidden.size} masqué{hidden.size > 1 ? "s" : ""}</span>}
      </button>
      {open && (
        <div id={panelId} className="absolute right-0 top-full z-40 mt-2 w-[min(18rem,calc(100vw-2rem))] rounded-xl border border-border bg-surface p-4 shadow-lg">
          <fieldset>
            <legend className="text-xs font-bold uppercase tracking-widest text-muted">Blocs affichés</legend>
            <div className="mt-2 grid gap-1">
              {HOME_BLOCKS.map((block) => (
                <label key={block.id} className="flex min-h-9 cursor-pointer items-center gap-2 rounded-lg px-1 text-sm text-fg hover:bg-surface-sub">
                  <input
                    checked={!hidden.has(block.id)}
                    className="size-4 accent-accent"
                    onChange={() => onToggle(block.id)}
                    type="checkbox"
                  />
                  {block.label}
                </label>
              ))}
            </div>
          </fieldset>
          <div className="mt-3 flex items-center justify-between gap-2 border-t border-border pt-3">
            <button
              className="text-xs font-semibold text-accent-text hover:underline disabled:text-muted disabled:no-underline"
              disabled={hidden.size === 0}
              onClick={onShowAll}
              type="button"
            >
              Tout afficher
            </button>
            <button className="text-xs font-semibold text-muted hover:text-fg" onClick={() => setOpen(false)} type="button">Fermer</button>
          </div>
          <p className="mt-2 text-[11px] text-muted">Mémorisé dans ce navigateur uniquement.</p>
        </div>
      )}
    </div>
  );
}
