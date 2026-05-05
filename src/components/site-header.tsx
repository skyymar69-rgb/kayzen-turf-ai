"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Globe2, MapPin, Menu, Star, WalletCards, X } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { COMPANY, CONTACT_LINKS, SITE_URL } from "@/lib/site-config";

const NAV_LINKS = [
  { href: "/",                  label: "Programme" },
  { href: "/pronostics",        label: "Pronostics" },
  { href: "/tarifs",            label: "Tarifs" },
  { href: "/techniques-prediction", label: "Notre IA" },
] as const;

export function SiteHeader() {
  const pathname = usePathname();
  const [contactOpen, setContactOpen] = useState(false);
  const [mobileOpen, setMobileOpen]   = useState(false);
  const contactRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") { setContactOpen(false); setMobileOpen(false); } }
    function onClick(e: MouseEvent) {
      if (contactRef.current && !contactRef.current.contains(e.target as Node)) setContactOpen(false);
    }
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onClick);
    return () => { document.removeEventListener("keydown", onKey); document.removeEventListener("mousedown", onClick); };
  }, []);

  useEffect(() => { setMobileOpen(false); setContactOpen(false); }, [pathname]);

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-surface/95 backdrop-blur-md">
      <div className="mx-auto flex max-w-[1480px] items-center gap-4 px-4 py-0 sm:px-6 lg:px-8">

        {/* Logo */}
        <Link
          href="/"
          className="flex shrink-0 items-center gap-3 py-4 text-fg transition-opacity hover:opacity-80"
          aria-label="Kayzen Turf AI — accueil"
        >
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-accent font-display text-sm font-bold text-white">
            KZ
          </span>
          <span className="hidden flex-col sm:flex">
            <span className="font-display text-base font-bold leading-tight tracking-tight text-fg">Kayzen</span>
            <span className="text-[11px] font-medium uppercase tracking-widest text-muted">Pronostic Turf PMU</span>
          </span>
        </Link>

        {/* Desktop nav */}
        <nav aria-label="Navigation principale" className="ml-4 hidden items-center gap-1 lg:flex">
          {NAV_LINKS.map(({ href, label }) => {
            const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={`relative rounded-lg px-3.5 py-2 text-sm font-medium transition ${
                  active
                    ? "bg-accent-lo text-accent-text"
                    : "text-muted hover:bg-surface-sub hover:text-fg"
                }`}
              >
                {label}
                {active && (
                  <span className="absolute bottom-0 left-1/2 h-0.5 w-4 -translate-x-1/2 rounded-full bg-accent" />
                )}
              </Link>
            );
          })}
        </nav>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Actions */}
        <div className="flex items-center gap-2">
          {/* Contact dropdown */}
          <div className="relative hidden sm:block" ref={contactRef}>
            <button
              aria-expanded={contactOpen}
              aria-haspopup="true"
              className="inline-flex h-9 items-center gap-2 rounded-lg border border-border bg-surface px-3 text-sm font-medium text-muted transition hover:border-accent hover:text-accent-text"
              onClick={() => setContactOpen((v) => !v)}
              type="button"
            >
              <WalletCards size={15} />
              <span className="hidden md:inline">Contact</span>
            </button>
            {contactOpen && (
              <div
                role="menu"
                className="absolute right-0 top-full z-50 mt-2 w-56 overflow-hidden rounded-xl border border-border bg-surface shadow-xl"
              >
                <div className="border-b border-border px-4 py-3">
                  <p className="text-xs font-semibold uppercase tracking-widest text-muted">{COMPANY.editor}</p>
                  <p className="mt-0.5 text-sm font-medium text-fg">{COMPANY.brand}</p>
                </div>
                <div className="p-2">
                  <ContactItem href={SITE_URL}              icon={<Globe2 size={14} />} label="Site officiel" />
                  <ContactItem href={CONTACT_LINKS.maps}    icon={<MapPin size={14} />} label="Itinéraire" />
                  <ContactItem href={CONTACT_LINKS.reviews} icon={<Star size={14} />}   label="Avis Google" />
                  <a
                    href={CONTACT_LINKS.vcard}
                    className="mt-1 block w-full rounded-lg border border-accent/30 bg-accent-lo px-3 py-2 text-center text-sm font-semibold text-accent-text transition hover:bg-accent hover:text-white"
                  >
                    Télécharger la vCard
                  </a>
                </div>
              </div>
            )}
          </div>

          <ThemeToggle />

          {/* Mobile menu button */}
          <button
            aria-expanded={mobileOpen}
            aria-label="Menu de navigation"
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-surface text-muted transition hover:border-accent hover:text-accent-text lg:hidden"
            onClick={() => setMobileOpen((v) => !v)}
            type="button"
          >
            {mobileOpen ? <X size={16} /> : <Menu size={16} />}
          </button>
        </div>
      </div>

      {/* Mobile nav panel */}
      {mobileOpen && (
        <div className="border-t border-border bg-surface px-4 pb-4 pt-2 lg:hidden">
          <nav aria-label="Navigation mobile" className="flex flex-col gap-1">
            {NAV_LINKS.map(({ href, label }) => {
              const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
              return (
                <Link
                  key={href}
                  href={href}
                  className={`rounded-lg px-4 py-2.5 text-sm font-medium transition ${
                    active
                      ? "bg-accent-lo text-accent-text"
                      : "text-muted hover:bg-surface-sub hover:text-fg"
                  }`}
                >
                  {label}
                </Link>
              );
            })}
            <div className="mt-2 border-t border-border pt-2">
              <ContactItem href={SITE_URL}              icon={<Globe2 size={14} />} label="Site officiel" />
              <ContactItem href={CONTACT_LINKS.maps}    icon={<MapPin size={14} />} label="Itinéraire" />
              <ContactItem href={CONTACT_LINKS.reviews} icon={<Star size={14} />}   label="Avis Google" />
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}

function ContactItem({ href, icon, label }: { href: string; icon: React.ReactNode; label: string }) {
  return (
    <a
      href={href}
      rel="noopener noreferrer"
      target="_blank"
      className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-muted transition hover:bg-surface-sub hover:text-fg"
    >
      {icon}
      <span>{label}</span>
    </a>
  );
}
