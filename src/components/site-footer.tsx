import Link from "next/link";
import { COMPANY } from "@/lib/site-config";

const legalLinks = [
  { href: "/pronostics", label: "Pronostics du jour" },
  { href: "/techniques-prediction", label: "Techniques IA" },
  { href: "/mentions-legales", label: "Mentions legales" },
  { href: "/cgu", label: "CGU" },
  { href: "/cgv", label: "CGV" },
  { href: "/confidentialite", label: "RGPD" },
  { href: "/cookies", label: "Cookies" },
  { href: "/accessibilite", label: "Accessibilite" },
];

export function SiteFooter() {
  return (
    <footer className="site-chrome border-t border-[#d9e1de] px-4 py-8">
      <div className="mx-auto grid max-w-[1480px] gap-6 lg:grid-cols-[1fr_auto]">
        <div>
          <p className="font-display text-xl font-bold tracking-normal">{COMPANY.brand}</p>
          <p className="site-muted mt-2 max-w-3xl text-sm leading-6">
            Outil d&apos;aide a la decision pour pronostics hippiques. Les jeux d&apos;argent comportent des risques :
            endettement, isolement, dependance. Aucun pronostic ne garantit un gain.
          </p>
          <p className="site-muted mt-3 text-sm">
            {COMPANY.editor} - {COMPANY.legalForm} - {COMPANY.address}
          </p>
        </div>
        <nav aria-label="Liens legaux" className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4 lg:min-w-[560px]">
          {legalLinks.map((link) => (
            <Link className="site-link rounded-sm px-2 py-2 font-medium" href={link.href} key={link.href}>
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
      <div className="site-muted mx-auto mt-6 flex max-w-[1480px] flex-col gap-2 border-t border-[#d9e1de] pt-4 text-sm sm:flex-row sm:items-center sm:justify-between">
        <p>(c) {new Date().getFullYear()} {COMPANY.editor}. Tous droits reserves.</p>
        <a className="site-accent-text font-semibold underline-offset-4 hover:underline" href={COMPANY.agencyUrl} rel="noopener noreferrer" target="_blank">
          Fierement realise par Kayzen Web
        </a>
      </div>
    </footer>
  );
}
