import Link from "next/link";
import { CookiePreferencesButton } from "@/components/cookie-banner";
import { COMPANY } from "@/lib/site-config";

const PRODUCT_LINKS = [
  { href: "/",                      label: "Programme du jour" },
  { href: "/pronostics",            label: "Pronostics PMU" },
  { href: "/tarifs",                label: "Tarifs & offres" },
  { href: "/techniques-prediction", label: "Notre IA" },
  { href: "/lexique",               label: "Lexique turf" },
  { href: "/kz-score",             label: "Le KZ Score" },
];

const LEGAL_LINKS = [
  { href: "/mentions-legales",  label: "Mentions légales" },
  { href: "/cgu",               label: "CGU" },
  { href: "/cgv",               label: "CGV" },
  { href: "/confidentialite",   label: "RGPD" },
  { href: "/cookies",           label: "Cookies" },
  { href: "/accessibilite",     label: "Accessibilité" },
  { href: "/jeu-responsable",   label: "Jeu responsable" },
];

export function SiteFooter() {
  return (
    /* amélioration #19 — footer sombre pour mieux trancher avec le contenu */
    <footer className="border-t border-border bg-surface-inv/95">
      <div className="mx-auto max-w-[1480px] px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid gap-10 lg:grid-cols-[1.4fr_1fr_1fr]">

          {/* Brand block */}
          <div>
            <div className="flex items-center gap-3">
              <span className="grid h-9 w-9 place-items-center rounded-lg bg-cta font-display text-sm font-bold text-fg">KZ</span>
              <div>
                <p className="font-display text-base font-bold leading-tight text-white">Kayzen</p>
                <p className="text-[11px] font-medium uppercase tracking-widest text-white/50">Pronostic Turf PMU</p>
              </div>
            </div>
            <p className="mt-4 max-w-sm text-sm leading-6 text-white/60">
              Plateforme SaaS d&apos;aide à la décision pour pronostics hippiques.
              Analyses IA, tickets optimisés et suivi de performance en temps réel.
            </p>
            <p className="mt-3 text-xs leading-5 text-white/50">
              <strong className="text-white/80">{COMPANY.editor}</strong> — {COMPANY.legalForm}<br />
              {COMPANY.address}
            </p>

            {/* amélioration #19 — numéro jeu responsable */}
            <div className="mt-4 rounded-lg border border-warn/30 bg-warn-lo/10 px-3 py-2.5 text-xs leading-5 text-amber-300">
              <p className="flex flex-wrap items-center gap-2 font-semibold">
                {/* Le service s'adresse exclusivement aux majeurs : les paris hippiques
                    sont interdits aux mineurs (code de la sécurité intérieure, art. L. 320-8). */}
                <span className="grid size-6 shrink-0 place-items-center rounded-full border border-amber-300/60 text-[10px] font-bold text-amber-200">
                  18+
                </span>
                Interdit aux mineurs — jouez responsable
              </p>
              <p className="mt-1.5 text-amber-400/80">
                Joueurs Info Service :{" "}
                <a href="tel:0974751313" className="font-bold hover:underline">09 74 75 13 13</a>
                {" "}(appel non surtaxé, 7j/7)
              </p>
              <p className="mt-1 text-amber-400/60">
                Aucun pronostic ne garantit un gain. Les jeux comportent des risques : endettement,
                isolement, dépendance.
              </p>
            </div>
          </div>

          {/* Product links */}
          <div>
            <p className="mb-4 text-xs font-bold uppercase tracking-widest text-white/40">Plateforme</p>
            <ul className="flex flex-col gap-2.5">
              {PRODUCT_LINKS.map(({ href, label }) => (
                <li key={href}>
                  <Link
                    href={href}
                    className="text-sm font-medium text-white/60 transition hover:text-cta"
                  >
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Legal links */}
          <div>
            <p className="mb-4 text-xs font-bold uppercase tracking-widest text-white/40">Légal</p>
            <ul className="flex flex-col gap-2.5">
              {LEGAL_LINKS.map(({ href, label }) => (
                <li key={href}>
                  <Link
                    href={href}
                    className="text-sm font-medium text-white/60 transition hover:text-cta"
                  >
                    {label}
                  </Link>
                </li>
              ))}
              {/* RGPD art. 7.3 : retirer son consentement doit être aussi simple
                  que de le donner. Ce bouton rouvre la bannière de choix. */}
              <li>
                <CookiePreferencesButton className="text-left text-sm font-medium text-white/60 underline-offset-4 transition hover:text-cta hover:underline" />
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="mt-10 flex flex-col gap-2 border-t border-white/10 pt-6 text-xs text-white/40 sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} {COMPANY.editor}. Tous droits réservés.</p>
          <a
            href={COMPANY.agencyUrl}
            rel="noopener noreferrer"
            target="_blank"
            className="font-semibold text-cta/80 transition hover:text-cta"
          >
            Réalisé par Kayzen Web
          </a>
        </div>
      </div>
    </footer>
  );
}
