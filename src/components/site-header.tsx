import Link from "next/link";
import type { ReactNode } from "react";
import { Globe2, MapPin, Star, WalletCards } from "lucide-react";
import { COMPANY, CONTACT_LINKS, SITE_URL } from "@/lib/site-config";

export async function SiteHeader() {
  return (
    <header className="site-chrome border-b border-[#d9e1de] px-3 py-3 shadow-sm backdrop-blur-md">
      <div className="mx-auto flex max-w-[1480px] flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <Link className="site-link inline-flex min-h-11 items-center gap-3 rounded-sm font-bold uppercase" href="/">
          <span className="grid h-10 w-10 place-items-center rounded-sm bg-emerald-700 text-white">KZ</span>
          <span className="font-display text-lg tracking-normal">{COMPANY.brand}</span>
        </Link>

        <nav aria-label="Navigation principale" className="flex gap-2 overflow-x-auto text-sm font-semibold">
          <Link className="site-link min-h-10 shrink-0 rounded-sm px-3 py-2" href="/pronostics">
            Pronostics du jour
          </Link>
          <Link className="site-link min-h-10 shrink-0 rounded-sm px-3 py-2" href="/techniques-prediction">
            Techniques IA
          </Link>
          <Link className="site-link min-h-10 shrink-0 rounded-sm px-3 py-2" href="/accessibilite">
            Accessibilité
          </Link>
        </nav>

        <details className="site-panel group rounded-md border border-[#d9e1de]">
          <summary className="site-accent-text flex min-h-11 cursor-pointer list-none items-center gap-2 px-3 text-sm font-bold">
            <WalletCards size={18} />
            Carte de contact numérique
          </summary>
          <div className="grid min-w-[260px] gap-2 border-t border-[#d9e1de] p-3 sm:min-w-[420px] sm:grid-cols-2">
            <ContactTile href={SITE_URL} icon={<Globe2 size={17} />} label="Site officiel" />
            <ContactTile href={CONTACT_LINKS.maps} icon={<MapPin size={17} />} label="Itinéraire Maps" />
            <ContactTile href={CONTACT_LINKS.reviews} icon={<Star size={17} />} label="Avis Google" />
            <a className="site-tile site-accent-text rounded-sm border border-emerald-700/20 px-3 py-2 text-center text-sm font-bold hover:bg-emerald-50" href={CONTACT_LINKS.vcard}>
              Télécharger la vCard
            </a>
          </div>
        </details>
      </div>
    </header>
  );
}

function ContactTile({ href, icon, label }: { href: string; icon: ReactNode; label: string }) {
  return (
    <a className="site-tile flex min-h-11 items-center justify-center gap-2 rounded-sm border border-[#d9e1de] px-3 py-2 text-sm font-bold transition hover:-translate-y-0.5 hover:shadow-md" href={href} rel="noopener noreferrer" target="_blank">
      {icon}
      <span>{label}</span>
    </a>
  );
}
