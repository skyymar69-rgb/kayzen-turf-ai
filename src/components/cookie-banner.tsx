"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const STORAGE_KEY = "kayzen-cookie-choice";

/** Efface le choix enregistré, pour permettre le retrait du consentement (RGPD art. 7.3). */
export function resetCookieChoice() {
  window.localStorage.removeItem(STORAGE_KEY);
}

export function CookieBanner() {
  // Lire localStorage dans l'initialiseur de useState divergeait entre le rendu
  // serveur (toujours `false`, donc rien) et le rendu client (`true` à la
  // première visite, donc une section entière) — mismatch d'hydratation sur
  // 100 % des nouveaux visiteurs, et sur toutes les pages.
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!window.localStorage.getItem(STORAGE_KEY)) setVisible(true);
  }, []);

  function saveChoice(choice: "accepted" | "refused") {
    window.localStorage.setItem(STORAGE_KEY, choice);
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <section aria-label="Gestion des cookies" className="fixed inset-x-3 bottom-3 z-[90] rounded-md border border-[#d9e1de] bg-white p-4 text-[#26312e] shadow-2xl sm:inset-x-auto sm:right-4 sm:max-w-xl">
      <h2 className="text-base font-bold">Confidentialité et cookies</h2>
      <p className="mt-2 text-sm leading-6 text-[#52615d]">
        Nous utilisons uniquement les cookies strictement nécessaires par défaut. Les mesures d’audience ou services tiers ne sont activés qu’après consentement.
      </p>
      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <button className="min-h-11 rounded-sm bg-emerald-700 px-4 font-bold text-white" onClick={() => saveChoice("accepted")} type="button">
          Accepter
        </button>
        <button className="min-h-11 rounded-sm border border-[#cdd7d3] bg-white px-4 font-bold text-[#26312e]" onClick={() => saveChoice("refused")} type="button">
          Refuser
        </button>
        <Link className="inline-flex min-h-11 items-center justify-center rounded-sm px-4 font-bold text-emerald-700 underline-offset-4 hover:underline" href="/cookies">
          Personnaliser
        </Link>
      </div>
    </section>
  );
}
