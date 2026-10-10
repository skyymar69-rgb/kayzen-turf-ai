import { SURPRISE_KIND_LABELS, SURPRISE_LEVELS, SURPRISE_PART_LABELS, SURPRISE_WEIGHTS, type Surprise, type SurpriseAlert, type SurprisePart } from "@/lib/surprise";

/**
 * Pastille d'alerte et jauge du score de surprise — mêmes couleurs dans le
 * tableau, les cartes mobiles, le panneau « Surprise IA » et la fiche cheval.
 */

const KIND_STYLES: Record<SurpriseAlert["kind"], string> = {
  value: "bg-emerald-700 text-white dark:bg-emerald-500 dark:text-emerald-950",
  surprise: "bg-orange-700 text-white dark:bg-orange-500 dark:text-orange-950",
  tocard: "bg-violet-600 text-white dark:bg-violet-500 dark:text-violet-950",
};

const WATCH_STYLE = "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200";

export function alertLabel(alert: SurpriseAlert): string {
  return alert.level === "surveiller" ? "À surveiller" : SURPRISE_KIND_LABELS[alert.kind];
}

export function SurpriseBadge({ alert, className = "" }: { alert: SurpriseAlert | null; className?: string }) {
  if (!alert) return <span className="text-muted">—</span>;
  const style = alert.level === "surveiller" ? WATCH_STYLE : KIND_STYLES[alert.kind];
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 font-sans text-[10px] font-bold uppercase tracking-wide ${style} ${className}`}
      title={alert.level === "forte" ? "Signal fort" : alert.level === "possible" ? "Surprise possible" : "Quelques signaux favorables"}
    >
      {alert.level === "forte" && <span aria-hidden="true">★</span>}
      {alertLabel(alert)}
    </span>
  );
}

function scoreTone(score: number) {
  if (score >= SURPRISE_LEVELS.forte) return { bar: "bg-emerald-500", chip: "bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200" };
  if (score >= SURPRISE_LEVELS.surveiller) return { bar: "bg-amber-500", chip: "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200" };
  return { bar: "bg-border-strong", chip: "bg-surface-sub text-muted" };
}

/** Note sur 100 avec sa jauge, pour une cellule de tableau. */
export function ScoreCell({ surprise }: { surprise: Surprise }) {
  const tone = scoreTone(surprise.score);
  return (
    <span className="inline-flex items-center justify-end gap-2" title="Score de surprise, sur 100">
      <span aria-hidden="true" className="hidden h-1.5 w-12 overflow-hidden rounded-full bg-border lg:block">
        <span className={`block h-full rounded-full ${tone.bar}`} style={{ width: `${surprise.score}%` }} />
      </span>
      <span className={`rounded-md px-1.5 py-0.5 text-xs font-bold ${tone.chip}`}>
        {surprise.score}
        <span className="font-normal">/100</span>
      </span>
    </span>
  );
}

const PARTS = Object.keys(SURPRISE_WEIGHTS) as SurprisePart[];

/** Décomposition du score : une barre par brique, sur son maximum. */
export function ScoreBreakdown({ surprise, compact = false }: { surprise: Surprise; compact?: boolean }) {
  return (
    <dl className={`grid gap-1.5 ${compact ? "text-[11px]" : "text-xs"}`}>
      {PARTS.map((part) => {
        const value = surprise.parts[part];
        const max = SURPRISE_WEIGHTS[part];
        return (
          <div key={part} className="grid grid-cols-[minmax(0,1fr)_72px_44px] items-center gap-2">
            <dt className="truncate text-muted">{SURPRISE_PART_LABELS[part]}</dt>
            <dd aria-hidden="true" className="h-1.5 overflow-hidden rounded-full bg-border">
              <span className="block h-full rounded-full bg-accent" style={{ width: `${Math.round((100 * value) / max)}%` }} />
            </dd>
            <dd className="text-right font-mono text-fg">
              {Math.round(value)}
              <span className="text-muted">/{max}</span>
            </dd>
          </div>
        );
      })}
    </dl>
  );
}
