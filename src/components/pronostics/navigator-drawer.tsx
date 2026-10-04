"use client";

import { useEffect, useRef, useState } from "react";
import { ListOrdered, X } from "lucide-react";
import type { PronosticRace, ReunionGroup } from "@/lib/pronostics-filters";
import type { RaceStatus } from "@/lib/race-status";
import { RaceNavigator } from "./race-navigator";

type Props = {
  groups: ReunionGroup[];
  count: number;
  statusOf: (race: PronosticRace) => RaceStatus;
  activeAnchor: string | null;
  onSelect: (anchor: string) => void;
};

/**
 * Sommaire des courses sur mobile et tablette : un tiroir ouvert par un bouton
 * flottant (à gauche — le retour en haut occupe déjà le coin droit).
 *
 * `<dialog>` en mode modal : le reste de la page devient inerte (le focus
 * reste dans le tiroir), Échap ferme nativement. À la fermeture, le focus
 * revient au bouton — sauf quand une course vient d'être choisie : il part
 * alors sur sa carte.
 */
export function NavigatorDrawer({ groups, count, statusOf, activeAnchor, onSelect }: Props) {
  const [open, setOpen] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const returnFocus = useRef(true);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
      document.documentElement.style.overflow = "hidden";
    }
    if (!open && dialog.open) dialog.close();
    return () => {
      document.documentElement.style.overflow = "";
    };
  }, [open]);

  function handleClose() {
    setOpen(false);
    document.documentElement.style.overflow = "";
    if (returnFocus.current) triggerRef.current?.focus();
    returnFocus.current = true;
  }

  function select(anchor: string) {
    returnFocus.current = false;
    dialogRef.current?.close();
    // L'événement `close` arrive après coup : la page doit pouvoir défiler tout de suite.
    document.documentElement.style.overflow = "";
    onSelect(anchor);
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen(true)}
        className="fixed bottom-6 left-4 z-40 inline-flex items-center gap-2 rounded-full border border-border bg-surface-inv px-4 py-3 text-sm font-bold text-white shadow-lg lg:hidden"
      >
        <ListOrdered aria-hidden="true" size={16} />
        Courses
        <span className="rounded-full bg-accent px-1.5 text-xs text-accent-fg">{count}</span>
      </button>

      <dialog
        ref={dialogRef}
        aria-modal="true"
        aria-labelledby="titre-tiroir-courses"
        onClose={handleClose}
        onClick={(event) => {
          // Clic sur le voile (hors du panneau) : fermeture.
          if (event.target === event.currentTarget) dialogRef.current?.close();
        }}
        className="fixed inset-y-0 left-0 m-0 h-dvh max-h-none w-[min(22rem,88vw)] border-r border-border bg-surface p-0 text-fg shadow-xl backdrop:bg-black/60"
      >
        {open && (
          <div className="flex h-full flex-col">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <h2 id="titre-tiroir-courses" className="font-display text-lg font-bold text-fg">
                Courses ({count})
              </h2>
              <button
                type="button"
                autoFocus
                onClick={() => dialogRef.current?.close()}
                className="rounded-lg p-2 text-muted hover:bg-surface-sub hover:text-fg"
              >
                <X aria-hidden="true" size={18} />
                <span className="sr-only">Fermer la liste des courses</span>
              </button>
            </div>
            <nav aria-label="Courses de la journée" className="min-h-0 flex-1 px-1 py-2">
              <RaceNavigator groups={groups} statusOf={statusOf} activeAnchor={activeAnchor} onSelect={select} idPrefix="tiroir" />
            </nav>
          </div>
        )}
      </dialog>
    </>
  );
}
