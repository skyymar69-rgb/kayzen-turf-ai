import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { racecourseHue } from "@/lib/racecourse-color";

/**
 * Petits composants d'interface partagés entre les pages.
 */

/** Pastille de couleur de l'hippodrome — repère visuel, le nom reste écrit à côté. */
export function RacecourseDot({ racecourse, className = "" }: { racecourse: string; className?: string }) {
  const hue = racecourseHue(racecourse);
  return (
    <span
      aria-hidden="true"
      className={`inline-block size-2.5 shrink-0 rounded-full ring-2 ring-surface ${className}`}
      style={{ backgroundColor: `hsl(${hue} 65% 45%)` }}
    />
  );
}

/** État vide soigné : icône, message, explication et action éventuelle. */
export function EmptyState({
  icon: Icon,
  title,
  children,
  action,
  className = "",
}: {
  icon: LucideIcon;
  title: string;
  children?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={`rounded-2xl border border-dashed border-border-strong bg-surface px-6 py-10 text-center ${className}`}>
      <span className="mx-auto grid size-14 place-items-center rounded-full bg-surface-sub text-muted">
        <Icon aria-hidden="true" size={26} />
      </span>
      <p className="mt-4 text-base font-semibold text-fg">{title}</p>
      {children && <div className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted">{children}</div>}
      {action && <div className="mt-5 flex justify-center">{action}</div>}
    </div>
  );
}
