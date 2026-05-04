import Link from "next/link";
import type { ReactNode } from "react";
import { MapPin, QrCode, Star, WalletCards } from "lucide-react";
import QRCode from "qrcode";
import { COMPANY, CONTACT_LINKS, SITE_URL } from "@/lib/site-config";

async function svgQr(value: string) {
  return QRCode.toString(value, {
    errorCorrectionLevel: "M",
    margin: 1,
    type: "svg",
    width: 116,
    color: {
      dark: "#04130f",
      light: "#ffffff",
    },
  });
}

export async function SiteHeader() {
  const [siteQr, mapsQr, reviewsQr] = await Promise.all([
    svgQr(SITE_URL),
    svgQr(CONTACT_LINKS.maps),
    svgQr(CONTACT_LINKS.reviews),
  ]);

  return (
    <header className="site-chrome border-b border-[#d9e1de] px-3 py-3 shadow-sm backdrop-blur-md">
      <div className="mx-auto flex max-w-[1480px] flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <Link className="site-link inline-flex min-h-11 items-center gap-3 rounded-sm font-bold uppercase" href="/">
          <span className="grid h-10 w-10 place-items-center rounded-sm bg-emerald-700 text-white">KZ</span>
          <span className="font-display text-lg tracking-normal">{COMPANY.brand}</span>
        </Link>
        <nav aria-label="Navigation principale" className="flex gap-2 overflow-x-auto text-sm font-semibold">
          <Link className="site-link min-h-10 shrink-0 rounded-sm px-3 py-2" href="/pronostics">Pronostics du jour</Link>
          <Link className="site-link min-h-10 shrink-0 rounded-sm px-3 py-2" href="/techniques-prediction">Techniques IA</Link>
          <Link className="site-link min-h-10 shrink-0 rounded-sm px-3 py-2" href="/accèssibilité">Accessibilité</Link>
        </nav>
        <details className="site-panel group rounded-md border border-[#d9e1de]">
          <summary className="site-accent-text flex min-h-11 cursor-pointer list-none items-center gap-2 px-3 text-sm font-bold">
            <WalletCards size={18} />
            Carte de contact numérique
          </summary>
          <div className="grid gap-3 border-t border-[#d9e1de] p-3 sm:grid-cols-3">
            <QrTile href={SITE_URL} icon={<QrCode size={17} />} label="QR site" svg={siteQr} />
            <QrTile href={CONTACT_LINKS.maps} icon={<MapPin size={17} />} label="QR Maps" svg={mapsQr} />
            <QrTile href={CONTACT_LINKS.reviews} icon={<Star size={17} />} label="QR Avis" svg={reviewsQr} />
            <a className="site-tile site-accent-text sm:col-span-3 rounded-sm border border-emerald-700/20 px-3 py-2 text-center text-sm font-bold hover:bg-emerald-50" href={CONTACT_LINKS.vcard}>
              Télécharger la vCard
            </a>
          </div>
        </details>
      </div>
    </header>
  );
}

function QrTile({ href, icon, label, svg }: { href: string; icon: ReactNode; label: string; svg: string }) {
  return (
    <a className="site-tile group rounded-md border border-[#d9e1de] p-2 text-center text-xs font-bold transition hover:-translate-y-0.5 hover:shadow-lg" href={href} rel="noopener noreferrer" target="_blank">
      <span className="mb-2 flex items-center justify-center gap-1">{icon}{label}</span>
      <span className="mx-auto block h-[116px] w-[116px] overflow-hidden rounded-sm" dangerouslySetInnerHTML={{ __html: svg }} />
    </a>
  );
}
