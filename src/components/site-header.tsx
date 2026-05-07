"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Download, Loader2, Menu, X } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";

const NAV_LINKS = [
  { href: "/",                  label: "Programme" },
  { href: "/pronostics",        label: "Pronostics" },
  { href: "/tarifs",            label: "Tarifs" },
  { href: "/techniques-prediction", label: "Notre IA" },
] as const;

function parisToday(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Paris",
    year: "numeric", month: "2-digit", day: "2-digit",
  }).format(new Date());
}

export function SiteHeader() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  /* amélioration #14 — compact mode au scroll */
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") setMobileOpen(false); }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => { setMobileOpen(false); }, [pathname]);

  /* amélioration #14 — écoute du scroll */
  useEffect(() => {
    function onScroll() { setScrolled(window.scrollY > 56); }
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`sticky top-0 z-50 border-b border-white/10 bg-surface-inv transition-all duration-200 ${
        scrolled ? "shadow-lg shadow-black/20 backdrop-blur-sm" : ""
      }`}
    >
      <div className={`mx-auto flex max-w-[1480px] items-center gap-4 px-4 sm:px-6 lg:px-8 transition-all duration-200 ${
        scrolled ? "py-0" : "py-0"
      }`}>

        {/* Logo */}
        <Link
          href="/"
          className="flex shrink-0 items-center gap-3 py-3.5 transition-opacity hover:opacity-80"
          aria-label="Kayzen Turf AI — accueil"
        >
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-cta font-display text-sm font-bold text-fg transition-transform duration-200 hover:scale-105">
            KZ
          </span>
          {/* amélioration #15 — logo texte masqué quand scrolled sur mobile */}
          <span className={`hidden flex-col sm:flex transition-all duration-200 ${scrolled ? "opacity-80" : ""}`}>
            <span className="font-display text-base font-bold leading-tight tracking-tight text-white">Kayzen</span>
            <span className="text-[11px] font-medium uppercase tracking-widest text-white/70">Pronostic Turf PMU</span>
          </span>
        </Link>

        {/* Desktop nav */}
        <nav aria-label="Navigation principale" className="ml-4 hidden items-center gap-0.5 lg:flex">
          {NAV_LINKS.map(({ href, label }) => {
            const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={`relative px-4 py-5 text-sm font-bold italic tracking-wide transition ${
                  active ? "text-white" : "text-white/80 hover:text-white"
                }`}
              >
                {label}
                {active && (
                  <>
                    <span className="absolute bottom-0 left-2 right-2 h-[3px] rounded-t-full bg-cta" />
                    {/* amélioration #16 — point lumineux sur l'onglet actif */}
                    <span className="absolute bottom-[3px] left-1/2 -translate-x-1/2 h-[3px] w-[3px] rounded-full bg-white/60 animate-pulse-dot" />
                  </>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Actions */}
        <div className="flex items-center gap-2">

          {/* PDF pronostics du jour */}
          <HeaderPdfButton />

          {/* CTA principal */}
          <Link
            href="/tarifs"
            className="hidden h-9 items-center rounded-lg bg-cta px-4 text-sm font-bold text-cta-text transition hover:bg-cta-hi hover:scale-[1.02] sm:inline-flex"
          >
            Commencer
          </Link>

          <ThemeToggle />

          {/* Mobile menu button */}
          <button
            aria-expanded={mobileOpen}
            aria-label="Menu de navigation"
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-white/30 bg-white/12 text-white transition hover:bg-white/20 hover:text-white lg:hidden"
            onClick={() => setMobileOpen((v) => !v)}
            type="button"
          >
            {/* amélioration #17 — animation icône burger/cross */}
            <span className="transition-transform duration-200" style={{ transform: mobileOpen ? "rotate(90deg)" : "rotate(0deg)" }}>
              {mobileOpen ? <X size={16} /> : <Menu size={16} />}
            </span>
          </button>
        </div>
      </div>

      {/* Mobile nav panel */}
      {mobileOpen && (
        <div className="border-t border-white/10 bg-surface-inv px-4 pb-4 pt-2 lg:hidden animate-slide-down">
          <nav aria-label="Navigation mobile" className="flex flex-col gap-1">
            {NAV_LINKS.map(({ href, label }) => {
              const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
              return (
                <Link
                  key={href}
                  href={href}
                  className={`rounded-lg px-4 py-2.5 text-sm font-medium transition ${
                    active ? "bg-white/15 text-white" : "text-white/80 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  {active && <span className="mr-2 inline-block h-1.5 w-1.5 rounded-full bg-cta" />}
                  {label}
                </Link>
              );
            })}
            <div className="mt-2 border-t border-white/10 pt-2">
              <Link
                href="/tarifs"
                className="mb-2 flex items-center justify-center rounded-lg bg-cta px-4 py-2.5 text-sm font-bold text-cta-text transition hover:bg-cta-hi"
              >
                Commencer gratuitement
              </Link>
              <MobileHeaderPdfButton />
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}

function HeaderPdfButton() {
  const [loading, setLoading] = useState(false);

  async function handleDownload() {
    if (loading) return;
    setLoading(true);
    try {
      const date = parisToday();
      const res  = await fetch(`/api/pdf/pronostics?date=${date}`);
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement("a");
      a.href     = url;
      a.download = `kayzen-pronostics-${date}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      alert("Impossible de générer le PDF. Réessayez.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      disabled={loading}
      onClick={handleDownload}
      type="button"
      className="hidden h-9 items-center gap-2 rounded-lg border border-white/30 bg-white/12 px-3 text-sm font-medium text-white transition hover:bg-white/20 disabled:opacity-60 sm:inline-flex"
      title={`Télécharger les pronostics du ${parisToday()} en PDF`}
    >
      {loading
        ? <><Loader2 size={14} className="animate-spin" /><span className="hidden md:inline">Génération…</span></>
        : <><Download size={14} /><span className="hidden md:inline">PDF du jour</span></>
      }
    </button>
  );
}

function MobileHeaderPdfButton() {
  const [loading, setLoading] = useState(false);

  async function handleDownload() {
    if (loading) return;
    setLoading(true);
    try {
      const date = parisToday();
      const res  = await fetch(`/api/pdf/pronostics?date=${date}`);
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement("a");
      a.href     = url;
      a.download = `kayzen-pronostics-${date}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      alert("Impossible de générer le PDF. Réessayez.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      disabled={loading}
      onClick={handleDownload}
      type="button"
      className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-white/80 transition hover:bg-white/10 hover:text-white disabled:opacity-60"
    >
      {loading
        ? <><Loader2 size={14} className="animate-spin" /> Génération en cours…</>
        : <><Download size={14} /> Pronostics PDF du jour</>
      }
    </button>
  );
}
