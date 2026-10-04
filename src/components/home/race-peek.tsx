"use client";

import { Zap } from "lucide-react";
import { useCallback, useEffect, useId, useMemo, useRef, useState, type FocusEvent, type KeyboardEvent, type PointerEvent } from "react";
import { createPortal } from "react-dom";
import { titleCase } from "@/components/badges";
import { formatPct } from "@/lib/format";
import { racePeek } from "@/lib/home/race-peek";
import type { RaceAnalysis } from "@/lib/types";

/**
 * APERÇU AU SURVOL — Top 3 de l'IA et value bet d'une course, sans quitter
 * l'accueil. S'ouvre au survol à la souris (après un court délai) et au focus
 * clavier ; Échap, la sortie du pointeur, la perte du focus ou le défilement
 * le referment. La bulle n'est pas interactive (`role="tooltip"`) : le lien
 * reste la seule cible, et l'aperçu lui est relié par `aria-describedby`.
 * Au toucher, rien ne s'ouvre : le lien navigue directement.
 */

const WIDTH = 288;
const GAP = 8;
const OPEN_DELAY = 250;

type Open = { race: RaceAnalysis; top: number; left: number; above: boolean; width: number };

function place(race: RaceAnalysis, el: HTMLElement): Open {
  const rect = el.getBoundingClientRect();
  const width = Math.min(WIDTH, window.innerWidth - 32);
  const left = Math.min(Math.max(rect.left, 16), window.innerWidth - width - 16);
  const above = rect.bottom + 220 > window.innerHeight && rect.top > 220;
  return { race, width, left, above, top: above ? window.innerHeight - rect.top + GAP : rect.bottom + GAP };
}

export function useRacePeek() {
  const id = useId();
  const [open, setOpen] = useState<Open | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const close = useCallback(() => {
    clearTimeout(timer.current);
    setOpen(null);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: globalThis.KeyboardEvent) => { if (e.key === "Escape") close(); };
    window.addEventListener("keydown", onKey);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [open, close]);

  useEffect(() => () => clearTimeout(timer.current), []);

  const peekProps = useCallback((race: RaceAnalysis) => ({
    "aria-describedby": open?.race.id === race.id ? id : undefined,
    onPointerEnter: (e: PointerEvent<HTMLElement>) => {
      if (e.pointerType !== "mouse") return;
      const el = e.currentTarget;
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setOpen(place(race, el)), OPEN_DELAY);
    },
    onPointerLeave: close,
    onFocus: (e: FocusEvent<HTMLElement>) => {
      clearTimeout(timer.current);
      setOpen(place(race, e.currentTarget));
    },
    onBlur: close,
    onKeyDown: (e: KeyboardEvent<HTMLElement>) => { if (e.key === "Escape") close(); },
  }), [open, id, close]);

  const popover = open ? <PeekBubble id={id} open={open} /> : null;
  return { peekProps, popover };
}

function PeekBubble({ id, open }: { id: string; open: Open }) {
  const peek = useMemo(() => racePeek(open.race), [open.race]);
  const style = open.above
    ? { bottom: open.top, left: open.left, width: open.width }
    : { top: open.top, left: open.left, width: open.width };
  return createPortal(
    <div
      className="pointer-events-none fixed z-[60] rounded-xl border border-border bg-surface p-3 text-left shadow-lg"
      id={id}
      role="tooltip"
      style={style}
    >
      <p className="font-mono text-[10px] font-bold uppercase tracking-widest text-muted">
        {open.race.programCode} · {open.race.startTime} · aperçu
      </p>
      <p className="mt-0.5 truncate text-sm font-semibold text-fg">{titleCase(open.race.name)}</p>
      <p className="mt-2 text-[10px] font-bold uppercase tracking-widest text-muted">Top 3 de l&apos;IA</p>
      {peek.top3.length === 0 ? (
        <p className="mt-1 text-xs text-muted">Classement indisponible.</p>
      ) : (
        <ol className="mt-1 grid gap-1">
          {peek.top3.map((h, i) => (
            <li key={h.number} className="flex items-center gap-2 text-xs">
              <span className={`grid size-5 shrink-0 place-items-center rounded font-mono text-[10px] font-bold ${i === 0 ? "bg-accent text-accent-fg" : "bg-surface-sub text-fg"}`}>{h.number}</span>
              <span className="min-w-0 flex-1 truncate font-semibold text-fg">{titleCase(h.name)}</span>
              <span className="shrink-0 font-mono text-muted">Top 3 {formatPct(h.top3Probability, 0)}</span>
            </li>
          ))}
        </ol>
      )}
      <p className={`mt-2 flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-bold ${peek.valueBet ? "bg-warn-lo text-warn" : "bg-surface-sub text-muted"}`}>
        <Zap aria-hidden="true" size={11} />
        {peek.valueBet
          ? `Value : n° ${peek.valueBet.number} ${titleCase(peek.valueBet.name)}, ${formatPct(peek.valueBet.valueIndex, 0, true)}`
          : open.race.oddsAvailable === false ? "Value : cotes pas encore publiées" : "Pas de value repérée"}
      </p>
    </div>,
    document.body,
  );
}
