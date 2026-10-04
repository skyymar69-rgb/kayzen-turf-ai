"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { Download, WifiOff, X } from "lucide-react";

/**
 * APPLICATION INSTALLABLE ET HORS LIGNE
 *
 * - Enregistre le service worker (public/sw.js) dès la première visite : il ne
 *   garde que des copies de pages, réseau toujours en premier.
 * - Bandeau « hors ligne » quand le navigateur perd le réseau : les pages
 *   affichées sont alors des copies, cotes figées.
 * - Proposition d'installation au bon moment : jamais à la première visite,
 *   seulement à partir de la troisième page vue, et plus jamais après un refus.
 */

type InstallPrompt = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };

const VIEWS_KEY = "kayzen-pwa-vues";
const DISMISS_KEY = "kayzen-pwa-refus";
const MIN_VIEWS = 3;

function lire(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function ecrire(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Stockage indisponible : la proposition reviendra, rien ne casse.
  }
}

function souscrireReseau(onChange: () => void) {
  window.addEventListener("online", onChange);
  window.addEventListener("offline", onChange);
  return () => {
    window.removeEventListener("online", onChange);
    window.removeEventListener("offline", onChange);
  };
}

export function PwaSupport() {
  const enLigne = useSyncExternalStore(souscrireReseau, () => navigator.onLine, () => true);
  const [installation, setInstallation] = useState<InstallPrompt | null>(null);

  useEffect(() => {
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => undefined);
    }
    ecrire(VIEWS_KEY, String(Number(lire(VIEWS_KEY) ?? 0) + 1));

    function onPrompt(event: Event) {
      event.preventDefault();
      if (lire(DISMISS_KEY) || Number(lire(VIEWS_KEY) ?? 0) < MIN_VIEWS) return;
      setInstallation(event as InstallPrompt);
    }
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  async function installer() {
    if (!installation) return;
    await installation.prompt();
    const { outcome } = await installation.userChoice;
    if (outcome === "dismissed") ecrire(DISMISS_KEY, "1");
    setInstallation(null);
  }

  function refuser() {
    ecrire(DISMISS_KEY, "1");
    setInstallation(null);
  }

  return (
    <>
      {!enLigne && (
        <div className="fixed inset-x-0 top-0 z-[95] bg-warn px-4 py-1.5 text-center text-xs font-bold text-bg print:hidden" role="status">
          <WifiOff aria-hidden="true" className="mr-1.5 inline" size={12} />
          Hors ligne — pages en copie, cotes figées.
        </div>
      )}
      {installation && (
        <section
          aria-label="Installer l'application"
          className="fixed inset-x-3 bottom-[calc(4.25rem+env(safe-area-inset-bottom))] z-[85] flex items-center gap-3 rounded-xl border border-border bg-surface p-3 shadow-2xl lg:inset-x-auto lg:bottom-4 lg:left-4 lg:max-w-sm"
        >
          <Download aria-hidden="true" className="shrink-0 text-accent-text" size={18} />
          <p className="text-sm text-fg">Installer Kayzen Turf sur cet appareil, comme une application.</p>
          <button className="min-h-10 shrink-0 rounded-lg bg-accent px-3 text-sm font-bold text-accent-fg hover:bg-accent-hi" onClick={installer} type="button">
            Installer
          </button>
          <button aria-label="Ne plus proposer" className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg text-muted hover:bg-surface-sub" onClick={refuser} type="button">
            <X aria-hidden="true" size={16} />
          </button>
        </section>
      )}
    </>
  );
}
