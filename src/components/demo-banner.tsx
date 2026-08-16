import { FlaskConical } from "lucide-react";

/**
 * Signale que les courses affichées sont fictives.
 *
 * Sans base configurée, le site sert `raceCards` — des courses inventées, avec
 * chevaux, cotes et pronostics d'apparence réelle. Rien ne le disait à
 * l'écran. Sur un service d'aide à la décision de pari, laisser croire à des
 * données authentiques est une pratique commerciale trompeuse
 * (code de la consommation, art. L. 121-2) autant qu'un manquement à la
 * transparence exigée par le règlement européen sur l'IA (art. 50).
 */
export function DemoBanner() {
  return (
    <div
      className="border-b border-amber-500/40 bg-amber-50 text-amber-950 dark:bg-amber-950/40 dark:text-amber-100"
      role="status"
    >
      <div className="mx-auto flex max-w-[1480px] items-start gap-3 px-4 py-3 sm:px-6 lg:px-8">
        <FlaskConical aria-hidden="true" className="mt-0.5 shrink-0" size={18} />
        <p className="text-sm leading-6">
          <strong className="font-bold">Mode démonstration.</strong>{" "}
          Aucune source de données n&apos;est connectée : les courses, cotes et pronostics affichés
          sont fictifs et ne correspondent à aucune épreuve réelle. Ils ne doivent servir à aucune
          décision de jeu.
        </p>
      </div>
    </div>
  );
}
