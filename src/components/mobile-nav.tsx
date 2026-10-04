"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays, LineChart, ListOrdered, Radio } from "lucide-react";

/**
 * Barre de navigation basse, sur mobile et tablette (sous lg).
 *
 * Les quatre destinations qu'on ouvre d'une main pendant une réunion. Le menu
 * complet reste dans l'en-tête. La barre respecte la zone de sécurité des
 * écrans à encoche (`env(safe-area-inset-bottom)`).
 */
const ITEMS = [
  { href: "/", label: "Programme", icon: CalendarDays },
  { href: "/pronostics", label: "Pronostics", icon: ListOrdered },
  { href: "/direct", label: "Direct", icon: Radio },
  { href: "/track-record", label: "Suivi", icon: LineChart },
] as const;

export function MobileNav() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Navigation rapide"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-surface-inv pb-[env(safe-area-inset-bottom)] lg:hidden print:hidden"
    >
      <ul className="mx-auto grid max-w-lg grid-cols-4">
        {ITEMS.map(({ href, label, icon: Icon }) => {
          const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <li key={href}>
              <Link
                aria-current={active ? "page" : undefined}
                className={`flex min-h-14 flex-col items-center justify-center gap-0.5 text-[11px] font-semibold transition ${active ? "text-white" : "text-white/70 hover:text-white"}`}
                href={href}
              >
                <Icon aria-hidden="true" size={20} className={active ? "text-cta" : ""} />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
