import Link from "next/link";
import { COMPANY } from "@/lib/site-config";

const PRODUCT_LINKS = [
  { href: "/",                      label: "Programme du jour" },
  { href: "/pronostics",            label: "Pronostics PMU" },
  { href: "/tarifs",                label: "Tarifs & offres" },
  { href: "/techniques-prediction", label: "Notre IA" },
];

const LEGAL_LINKS = [
  { href: "/mentions-legales",  label: "Mentions légales" },
  { href: "/cgu",               label: "CGU" },
  { href: "/cgv",               label: "CGV" },
  { href: "/confidentialite",   label: "RGPD" },
  { href: "/cookies",           label: "Cookies" },
  { href: "/accessibilite",     label: "Accessibilité" },
];

export function SiteFooter() {
  return (
    <footer className="border-t border-border bg-surface">
      <div className="mx-auto max-w-[1480px] px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid gap-10 lg:grid-cols-[1.4fr_1fr_1fr]">

          {/* Brand block */}
          <div>
            <div className="flex items-center gap-3">
              <span className="grid h-9 w-9 place-items-center rounded-lg bg-accent font-display text-sm font-bold text-white">KZ</span>
              <div>
                <p className="font-display text-base font-bold leading-tight text-fg">Kayzen</p>
                <p className="text-[11px] font-medium uppercase tracking-widest text-muted">Pronostic Turf PMU</p>
              </div>
            </div>
            <p className="mt-4 max-w-sm text-sm leading-6 text-muted">
              Plateforme SaaS d'aide à la décision pour pronostics hippiques.
              Analyses IA, tickets optimisés et suivi de performance en temps réel.
            </p>
            <p className="mt-3 text-xs leading-5 text-muted">
              <strong className="text-fg">{COMPANY.editor}</strong> — {COMPANY.legalForm}<br />
              {COMPANY.address}
            </p>
            <p className="mt-4 rounded-lg border border-warn/30 bg-warn-lo px-3 py-2 text-xs leading-5 text-warn">
              Les jeux d'argent comportent des risques : endettement, isolement, dépendance.
              Aucun pronostic ne garantit un gain. Jouez de manière responsable.
            </p>
          </div>

          {/* Product links */}
          <div>
            <p className="mb-4 text-xs font-bold uppercase tracking-widest text-muted">Plateforme</p>
            <ul className="flex flex-col gap-2">
              {PRODUCT_LINKS.map(({ href, label }) => (
                <li key={href}>
                  <Link
                    href={href}
                    className="text-sm font-medium text-muted transition hover:text-accent-text"
                  >
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Legal links */}
          <div>
            <p className="mb-4 text-xs font-bold uppercase tracking-widest text-muted">Légal</p>
            <ul className="flex flex-col gap-2">
              {LEGAL_LINKS.map(({ href, label }) => (
                <li key={href}>
                  <Link
                    href={href}
                    className="text-sm font-medium text-muted transition hover:text-accent-text"
                  >
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="mt-10 flex flex-col gap-2 border-t border-border pt-6 text-xs text-muted sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} {COMPANY.editor}. Tous droits réservés.</p>
          <a
            href={COMPANY.agencyUrl}
            rel="noopener noreferrer"
            target="_blank"
            className="font-semibold text-accent-text transition hover:underline underline-offset-4"
          >
            Réalisé par Kayzen Web
          </a>
        </div>
      </div>
    </footer>
  );
}
