import Link from "next/link";
import { Bot } from "lucide-react";

/**
 * Transparence sur le caractère automatisé des contenus : les pronostics
 * affichés sont produits par des modèles statistiques, sans relecture humaine
 * course par course. Le règlement européen sur l'IA (art. 50) impose d'informer
 * l'utilisateur ; rien ne le disait sur les pages de pronostics.
 */
export function AiDisclosure() {
  return (
    <aside
      aria-label="Information sur les contenus générés par intelligence artificielle"
      className="mb-6 flex flex-col gap-3 rounded-2xl border border-border bg-surface-sub p-4 sm:flex-row sm:items-start sm:p-5"
    >
      <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-accent-lo text-accent-text">
        <Bot aria-hidden="true" size={18} />
      </span>
      <div className="min-w-0 text-sm leading-6 text-muted">
        <p className="font-bold text-fg">Contenus générés par intelligence artificielle</p>
        <p className="mt-1">
          Ordres probables, probabilités, value bets et tickets de cette page sont calculés
          automatiquement par nos modèles à partir de données publiques. Ils ne sont pas relus
          course par course par un humain, peuvent contenir des erreurs et ne constituent ni un
          conseil en investissement ni une garantie de gain.{" "}
          <Link className="font-semibold text-accent-text underline-offset-4 hover:underline" href="/techniques-prediction">
            Comment nos modèles fonctionnent
          </Link>
          .
        </p>
        <p className="mt-2 flex flex-wrap items-center gap-2 font-semibold text-fg">
          <span className="grid size-6 shrink-0 place-items-center rounded-full border border-warn text-[10px] font-bold text-warn">
            18+
          </span>
          Service réservé aux personnes majeures — jouer comporte des risques.{" "}
          <Link className="font-semibold text-accent-text underline-offset-4 hover:underline" href="/jeu-responsable">
            Jeu responsable
          </Link>
        </p>
      </div>
    </aside>
  );
}
