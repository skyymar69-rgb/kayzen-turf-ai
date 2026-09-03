"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { Download, Loader2, Menu, X } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { usePdfJour } from "@/hooks/use-pdf-jour";

const NAV_LINKS = [
  { href: "/",                      label: "Programme" },
  { href: "/pronostics",            label: "Pronostics" },
  { href: "/tarifs",                label: "Tarifs" },
  { href: "/techniques-prediction", label: "Notre IA" },
  { href: "/lexique",               label: "Lexique" },
] as const;

const ID_MENU_MOBILE = "menu-navigation-mobile";

export function SiteHeader() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  /* amélioration #14 — compact mode au scroll */
  const [scrolled, setScrolled] = useState(false);
  const boutonMenuRef = useRef<HTMLButtonElement>(null);

  const fermerMenu = useCallback(() => setMobileOpen(false), []);

  useEffect(() => {
    if (!mobileOpen) return;

    function onKey(evenement: KeyboardEvent) {
      if (evenement.key !== "Escape") return;
      setMobileOpen(false);
      // WCAG 2.4.3 : après fermeture au clavier, le focus doit revenir sur
      // l'élément qui a ouvert le panneau, sinon il repart en haut du document.
      boutonMenuRef.current?.focus();
    }

    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [mobileOpen]);

  /**
   * Le panneau mobile se refermait via `useEffect(() => setMobileOpen(false),
   * [pathname])` : un rendu en cascade après chaque navigation, y compris les
   * navigations où le menu était déjà fermé (le linter le signalait en
   * `react-hooks/set-state-in-effect`). Fermer au clic sur le lien exprime la
   * même intention sans état dérivé.
   */

  /* amélioration #14 — écoute du scroll */
  useEffect(() => {
    let planifie = false;

    function mesurer() {
      planifie = false;
      // `setScrolled` était appelé à chaque événement de défilement. React
      // écarte les valeurs identiques, mais la fonction de rendu était tout de
      // même sollicitée en continu pendant un scroll. La mesure est désormais
      // alignée sur la frame d'affichage et l'état ne change qu'au franchissement.
      setScrolled((precedent) => {
        const suivant = window.scrollY > 56;
        return suivant === precedent ? precedent : suivant;
      });
    }

    function onScroll() {
      if (planifie) return;
      planifie = true;
      requestAnimationFrame(mesurer);
    }

    mesurer();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`sticky top-0 z-50 border-b border-white/10 bg-surface-inv transition-shadow duration-200 ${
        scrolled ? "shadow-lg shadow-black/20 backdrop-blur-sm" : ""
      }`}
    >
      <div className="mx-auto flex max-w-[1480px] items-center gap-4 px-4 sm:px-6 lg:px-8">

        {/* Logo */}
        <Link
          href="/"
          className="flex shrink-0 items-center gap-3 py-3.5 transition-opacity hover:opacity-80"
          aria-label="PronoTurf — accueil"
        >
          {/* `alt=""` : le lien porte déjà son intitulé accessible, répéter la
              marque ferait lire deux fois la même chose au lecteur d'écran.
              `priority` parce que la marque est visible d'emblée sur toutes les
              pages — la laisser en chargement différé la ferait apparaître après
              le premier rendu. */}
          <Image
            src="/brand/pronoturf-mark.png"
            alt=""
            width={62}
            height={36}
            priority
            className="h-9 w-auto shrink-0 transition-transform duration-200 hover:scale-105"
          />
          {/* amélioration #15 — logo texte masqué quand scrolled sur mobile */}
          <span className={`hidden flex-col sm:flex transition-opacity duration-200 ${scrolled ? "opacity-80" : ""}`}>
            <span className="font-display text-base font-bold leading-tight tracking-tight text-white">PronoTurf</span>
            <span className="text-[11px] font-medium uppercase tracking-widest text-white/70">Prédictions · Analyses · Gains</span>
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
                // `aria-current` dit au lecteur d'écran quelle page est ouverte :
                // le trait vert sous l'onglet ne portait cette information que
                // visuellement.
                aria-current={active ? "page" : undefined}
                className={`relative px-4 py-5 text-sm font-bold italic tracking-wide transition ${
                  active ? "text-white" : "text-white/80 hover:text-white"
                }`}
              >
                {label}
                {active && (
                  <>
                    <span aria-hidden="true" className="absolute bottom-0 left-2 right-2 h-[3px] rounded-t-full bg-cta" />
                    {/* amélioration #16 — point lumineux sur l'onglet actif */}
                    <span aria-hidden="true" className="absolute bottom-[3px] left-1/2 -translate-x-1/2 h-[3px] w-[3px] rounded-full bg-white/60 animate-pulse-dot" />
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
          <PdfButton variant="desktop" />

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
            aria-controls={ID_MENU_MOBILE}
            aria-expanded={mobileOpen}
            aria-label={mobileOpen ? "Fermer le menu de navigation" : "Ouvrir le menu de navigation"}
            className="inline-flex size-9 items-center justify-center rounded-lg border border-white/30 bg-white/12 text-white transition hover:bg-white/20 hover:text-white lg:hidden"
            onClick={() => setMobileOpen((v) => !v)}
            ref={boutonMenuRef}
            type="button"
          >
            {/* amélioration #17 — animation icône burger/cross */}
            <span
              aria-hidden="true"
              className="transition-transform duration-200"
              style={{ transform: mobileOpen ? "rotate(90deg)" : "rotate(0deg)" }}
            >
              {mobileOpen ? <X size={16} /> : <Menu size={16} />}
            </span>
          </button>
        </div>
      </div>

      {/* Mobile nav panel */}
      {mobileOpen && (
        <div
          className="border-t border-white/10 bg-surface-inv px-4 pb-4 pt-2 lg:hidden animate-slide-down"
          id={ID_MENU_MOBILE}
        >
          <nav aria-label="Navigation mobile" className="flex flex-col gap-1">
            {NAV_LINKS.map(({ href, label }) => {
              const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
              return (
                <Link
                  key={href}
                  href={href}
                  aria-current={active ? "page" : undefined}
                  onClick={fermerMenu}
                  className={`min-h-11 rounded-lg px-4 py-2.5 text-sm font-medium transition ${
                    active ? "bg-white/15 text-white" : "text-white/80 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  {active && <span aria-hidden="true" className="mr-2 inline-block size-1.5 rounded-full bg-cta" />}
                  {label}
                </Link>
              );
            })}
            <div className="mt-2 border-t border-white/10 pt-2">
              <Link
                href="/tarifs"
                onClick={fermerMenu}
                className="mb-2 flex min-h-11 items-center justify-center rounded-lg bg-cta px-4 py-2.5 text-sm font-bold text-cta-text transition hover:bg-cta-hi"
              >
                Commencer gratuitement
              </Link>
              <PdfButton variant="mobile" />
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}

/**
 * Téléchargement du PDF du jour.
 *
 * Le comportement (récupération, ancre, révocation différée, état d'échec) vit
 * dans `usePdfJour`, partagé avec le tableau de bord ; les deux variantes du
 * bouton ne diffèrent que par l'habillage.
 */
function PdfButton({ variant }: { variant: "desktop" | "mobile" }) {
  const { etat, telecharger } = usePdfJour();
  const chargement = etat === "chargement";

  const libelle = chargement
    ? variant === "mobile" ? "Génération en cours…" : "Génération…"
    : etat === "echec"
      ? "Échec — réessayer"
      : variant === "mobile" ? "Pronostics PDF du jour" : "PDF du jour";

  const classes =
    variant === "mobile"
      ? "flex min-h-11 w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-white/80 transition hover:bg-white/10 hover:text-white disabled:opacity-60"
      : "hidden h-9 items-center gap-2 rounded-lg border border-white/30 bg-white/12 px-3 text-sm font-medium text-white transition hover:bg-white/20 disabled:opacity-60 sm:inline-flex";

  return (
    <button
      className={classes}
      disabled={chargement}
      onClick={() => telecharger()}
      // La date n'apparaît plus ici : évaluée au rendu, elle divergeait entre
      // le HTML statique et l'hydratation dès que le jour changeait.
      title="Télécharger les pronostics du jour en PDF"
      type="button"
    >
      {chargement
        ? <Loader2 aria-hidden="true" size={14} className="animate-spin" />
        : <Download aria-hidden="true" size={14} />}
      <span className={variant === "mobile" ? "" : "hidden md:inline"}>{libelle}</span>
      {/* L'échec doit être annoncé, pas seulement affiché. */}
      {etat === "echec" && <span className="sr-only" role="alert">Le PDF n&apos;a pas pu être généré.</span>}
    </button>
  );
}
