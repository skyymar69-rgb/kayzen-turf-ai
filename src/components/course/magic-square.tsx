"use client";

import { useMemo, useState } from "react";
import { properName } from "@/lib/format";
import { buildMagicSquare, MAGIC_SUM, type MagicCell, type MagicLine, type MagicLineKind, type MagicRunner } from "@/lib/magic-square";
import { Eyebrow, pct } from "@/components/course/shared";

/**
 * CARRÉ MAGIQUE 16 PARTANTS — la grille 4 × 4 où chaque alignement (lignes,
 * colonnes, diagonales, carrés) est une combinaison de quatre chevaux dont les
 * rangs totalisent 34. Les rangs viennent de la sélection : le carré ne
 * reclasse jamais le peloton, il le redistribue. Voir src/lib/magic-square.ts.
 */

const QUARTER_STYLES: Record<MagicCell["quarter"], string> = {
  1: "border-accent bg-accent text-accent-fg",
  2: "border-accent/30 bg-accent-lo text-accent-text",
  3: "border-border bg-surface-sub text-fg",
  4: "border-dashed border-border-strong bg-surface text-muted",
};

const QUARTER_LABELS: Record<MagicCell["quarter"], string> = {
  1: "Rangs 1-4",
  2: "Rangs 5-8",
  3: "Rangs 9-12",
  4: "Rangs 13-16",
};

const GROUPS: Array<{ kind: MagicLineKind; label: string }> = [
  { kind: "ligne", label: "Lignes" },
  { kind: "colonne", label: "Colonnes" },
  { kind: "diagonale", label: "Diagonales" },
  { kind: "carre", label: "Carrés" },
];

function chance(value: number | null): string {
  if (value === null) return "—";
  // Un Quarté désordre qui inclut un cheval classé 13-16 se joue souvent
  // sous 1 % : deux décimales tant que la valeur reste lisible.
  if (value > 0 && value < 0.01) return "< 0,01 %";
  return pct(value, value < 1 ? 2 : value < 10 ? 1 : 0);
}

export function MagicSquarePanel({
  runners,
  selectedNumber,
  onSelect,
}: {
  /** Partants au départ, dans l'ordre de la sélection. */
  runners: MagicRunner[];
  selectedNumber: number | null;
  onSelect: (number: number) => void;
}) {
  const square = useMemo(() => buildMagicSquare(runners), [runners]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const active = square.lines.find((l) => l.id === activeId) ?? square.best ?? square.lines[0];
  const activeCells = new Set(active.cells.map((c) => `${c.row}-${c.col}`));

  if (square.runners === 0) return null;

  return (
    <section className="@container mt-4 overflow-hidden rounded-2xl border border-border bg-surface shadow-sm" aria-label="Carré magique 16 partants">
      <header className="border-b border-border px-5 py-4 sm:px-6">
        <Eyebrow>Carré magique — 16 partants</Eyebrow>
        <h2 className="mt-1 text-lg font-bold text-fg">Seize chevaux, seize combinaisons équilibrées</h2>
        <p className="mt-1 max-w-3xl text-sm leading-6 text-muted">
          Chaque case porte le rang d&apos;un cheval dans notre classement. Sur chaque ligne, colonne, diagonale et carré,
          les rangs totalisent <strong className="font-semibold text-fg">{MAGIC_SUM}</strong> : chaque alignement réunit un
          cheval de chaque quart du classement — un des 4 premiers, un des rangs 5-8, 9-12 et 13-16.
        </p>
      </header>

      <div className="grid gap-5 p-5 sm:p-6 @3xl:grid-cols-[minmax(0,340px)_minmax(0,1fr)]">
        <div>
          <div className="mx-auto grid max-w-[360px] grid-cols-4 gap-1.5">
            {square.grid.map((row, r) => (
              <div className="contents" key={r}>
                {row.map((cell) => {
                  const on = activeCells.has(`${cell.row}-${cell.col}`);
                  const picked = cell.runner !== null && cell.runner.number === selectedNumber;
                  return (
                    <div className="contents" key={cell.rank}>
                      {cell.runner ? (
                        <button
                          aria-label={`N° ${cell.runner.number} ${properName(cell.runner.name)}, rang ${cell.rank}`}
                          className={`relative flex aspect-square flex-col items-center justify-center rounded-xl border-2 p-1 text-center transition ${QUARTER_STYLES[cell.quarter]} ${
                            on ? "ring-2 ring-cta ring-offset-2 ring-offset-surface" : "opacity-70 hover:opacity-100"
                          } ${picked ? "outline outline-2 outline-fg" : ""}`}
                          onClick={() => onSelect(cell.runner!.number)}
                          type="button"
                        >
                          <span className="absolute left-1.5 top-1 font-mono text-[9px] font-bold opacity-70">{cell.rank}</span>
                          <span className="font-mono text-2xl font-bold leading-none sm:text-3xl">{cell.runner.number}</span>
                          <span className="mt-1 w-full truncate text-[9px] font-medium leading-tight sm:text-[10px]">{properName(cell.runner.name)}</span>
                        </button>
                      ) : (
                        <div
                          aria-label={`Rang ${cell.rank} — pas de partant`}
                          className={`flex aspect-square items-center justify-center rounded-xl border-2 border-dashed border-border text-xs text-muted/60 ${on ? "ring-2 ring-cta/50 ring-offset-2 ring-offset-surface" : ""}`}
                        >
                          {cell.rank}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>

          <ul className="mx-auto mt-3 flex max-w-[360px] flex-wrap gap-x-3 gap-y-1.5 text-[11px] text-muted" aria-label="Légende">
            {([1, 2, 3, 4] as const).map((q) => (
              <li className="inline-flex items-center gap-1.5" key={q}>
                <span aria-hidden="true" className={`inline-block size-3 rounded border-2 ${QUARTER_STYLES[q]}`} />
                {QUARTER_LABELS[q]}
              </li>
            ))}
          </ul>
        </div>

        <div className="min-w-0">
          <ActiveLine line={active} best={square.best?.id === active.id} />

          <div className="mt-4 grid gap-4 @lg:grid-cols-2 @3xl:grid-cols-1 @5xl:grid-cols-2">
            {GROUPS.map((group) => (
              <div key={group.kind}>
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted">{group.label}</p>
                <ul className="mt-1.5 grid gap-1">
                  {square.lines
                    .filter((l) => l.kind === group.kind)
                    .map((line) => (
                      <li key={line.id}>
                        <button
                          aria-pressed={line.id === active.id}
                          className={`flex min-h-9 w-full items-center gap-2 rounded-lg border px-2.5 py-1.5 text-left text-xs transition ${
                            line.id === active.id ? "border-accent bg-accent-lo text-accent-text" : "border-border hover:border-accent/50 hover:bg-surface-sub"
                          }`}
                          onClick={() => setActiveId(line.id)}
                          type="button"
                        >
                          <span className="w-32 shrink-0 truncate font-semibold">
                            {line.label}
                            {square.best?.id === line.id && <span aria-label="meilleure lecture" className="ml-1 text-cta">★</span>}
                          </span>
                          <span className="min-w-0 flex-1 truncate font-mono font-bold">{line.numbers.length ? line.numbers.join("-") : "—"}</span>
                          <span className="shrink-0 font-mono text-[11px] text-muted" title="Chance au 2 sur 4">{chance(line.twoInFourChance)}</span>
                        </button>
                      </li>
                    ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </div>

      <footer className="border-t border-border bg-surface-sub px-5 py-3 text-xs leading-5 text-muted sm:px-6">
        {square.runners < 16 && (
          <p>
            Course à {square.runners} partants : {16 - square.runners} case{16 - square.runners > 1 ? "s" : ""} sans cheval, les
            alignements incomplets ne se jouent pas au Quarté+.
          </p>
        )}
        {square.outside.length > 0 && (
          <p>
            Au-delà du 16e rang, hors carré : {square.outside.map((h) => h.number).join(", ")}.
          </p>
        )}
        <p>
          Le carré équilibre les combinaisons, il ne prédit rien de plus que notre classement. Chances calculées sur nos
          probabilités : <strong className="font-semibold">2 sur 4</strong>, au moins deux des chevaux de l&apos;alignement dans
          les quatre premiers ; <strong className="font-semibold">Quarté+ désordre</strong>, les quatre. Chaque alignement
          comptant un cheval classé 13-16, le Quarté reste un coup de poker — la meilleure lecture se fait au 2 sur 4.
        </p>
      </footer>
    </section>
  );
}

function ActiveLine({ line, best }: { line: MagicLine; best: boolean }) {
  return (
    <div className="rounded-xl border border-accent/30 bg-accent-lo px-4 py-3">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-[10px] font-bold uppercase tracking-widest text-accent-text">{line.label}</p>
        {best && <span className="rounded-full bg-cta px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-cta-text">Meilleure lecture</span>}
      </div>
      <p className="mt-1 font-mono text-3xl font-bold leading-none tracking-tight text-accent-text">
        {line.numbers.length ? line.numbers.join(" – ") : "—"}
      </p>
      <dl className="mt-2 grid grid-cols-2 gap-2 text-xs @md:grid-cols-4">
        <div>
          <dt className="text-muted">Somme des rangs</dt>
          <dd className="font-mono font-bold text-fg">{line.complete ? MAGIC_SUM : "incomplet"}</dd>
        </div>
        <div>
          <dt className="text-muted">2 sur 4</dt>
          <dd className="font-mono font-bold text-fg">{chance(line.twoInFourChance)}</dd>
        </div>
        <div>
          <dt className="text-muted">Gagnant dedans</dt>
          <dd className="font-mono font-bold text-fg">{chance(line.winChance)}</dd>
        </div>
        <div>
          <dt className="text-muted">Quarté+ désordre</dt>
          <dd className="font-mono font-bold text-fg">{chance(line.quarteChance)}</dd>
        </div>
      </dl>
    </div>
  );
}
