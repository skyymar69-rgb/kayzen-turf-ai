import { Banknote, CircleSlash, Compass, Eye, Gem, ShieldCheck } from "lucide-react";
import type { CourseViewModel, HorseRow } from "@/lib/course-view-model";
import { READING_LABELS, READING_RULES } from "@/lib/profiles";
import type { SignalRecord } from "@/lib/race-repository";
import { Card, roiLine } from "@/components/course/shared";
import { Term } from "@/components/course/term";

/**
 * VERDICT DE COURSE — une phrase, puis six tuiles.
 *
 * La phrase et les tuiles lisent la même classification (src/lib/profiles.ts)
 * que les badges du tableau : le bandeau ne peut pas annoncer une base que le
 * tableau ne marque pas. Chaque tuile porte le ROI historique du signal, même
 * négatif — un signal sans mesure ne serait qu'une promesse.
 */

type Tile = {
  key: string;
  title: string;
  icon: typeof ShieldCheck;
  rows: HorseRow[];
  signal?: SignalRecord;
  empty: string;
  hint: string;
};

const READING_STYLES = {
  lisible: "bg-accent text-accent-fg",
  ouverte: "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200",
  piege: "bg-danger/10 text-danger",
} as const;

export function VerdictBanner({
  vm,
  signals,
  onSelect,
  selectedNumber,
  summary = null,
}: {
  vm: CourseViewModel;
  signals: Map<string, SignalRecord>;
  onSelect: (number: number) => void;
  selectedNumber: number | null;
  /** Résumé en une phrase pour débutant (lib/beginner-summary). */
  summary?: string | null;
}) {
  const tiles: Tile[] = [
    { key: "base", title: "Bases", icon: ShieldCheck, rows: vm.byProfile.base, signal: signals.get("base-sp"), empty: "Aucune base solide", hint: "en simple placé" },
    { key: "cache", title: "Cachés", icon: Eye, rows: vm.byProfile.cache, signal: signals.get("cache-sg"), empty: "Aucun", hint: "en simple gagnant" },
    { key: "value", title: "Value", icon: Gem, rows: vm.byProfile.value, signal: signals.get("value-sg"), empty: "Aucune", hint: "en simple gagnant" },
    { key: "outsider", title: "Outsiders", icon: Compass, rows: vm.byProfile.outsider, signal: signals.get("outsider-sp"), empty: "Aucun", hint: "en simple placé" },
    { key: "eviter", title: "À éviter", icon: CircleSlash, rows: vm.byProfile.eviter, signal: signals.get("eviter-sg"), empty: "Aucun", hint: "s'ils étaient joués gagnants" },
    { key: "money", title: "Argent fort", icon: Banknote, rows: vm.strongMoney, empty: "Pas de mouvement net", hint: "" },
  ];

  // « Rentable de façon établie » : la borne basse de l'intervalle à 90 % est positive.
  const provenProfitable = [...signals.values()].some((s) => s.bets >= 100 && s.roiLow > 0);

  return (
    <Card className="mt-4 overflow-hidden">
      {summary && (
        <div className="border-b border-border bg-surface-sub px-5 py-3 sm:px-6">
          <p className="text-sm font-semibold leading-6 text-fg">
            <span className="mr-2 rounded-full bg-accent-lo px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-accent-text">En bref</span>
            {summary}
          </p>
          <details className="mt-1 text-xs leading-5 text-muted">
            <summary className="cursor-pointer font-semibold text-accent-text">Comment lire ce résumé</summary>
            <p className="mt-1">
              « 1 chance sur N » traduit la probabilité de victoire retenue par nos calculs (l&apos;avis de l&apos;IA, qui ne voit jamais la cote,
              croisé avec le marché). « {READING_LABELS[vm.verdict.reading]} » suit une règle fixe : {READING_RULES[vm.verdict.reading]} Le détail
              cheval par cheval est dans les tuiles ci-dessous et dans le tableau des partants. Ce résumé décrit la course : ce n&apos;est pas un
              conseil de pari.
            </p>
          </details>
        </div>
      )}
      <div className="flex flex-wrap items-center gap-3 border-b border-border px-5 py-4 sm:px-6">
        <span className={`rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide ${READING_STYLES[vm.verdict.reading]}`} title={READING_RULES[vm.verdict.reading]}>
          {READING_LABELS[vm.verdict.reading]}
        </span>
        <p className="min-w-0 flex-1 text-base font-semibold text-fg sm:text-lg">{vm.verdict.sentence}</p>
      </div>

      <ul className="grid grid-cols-2 divide-border sm:grid-cols-3 xl:grid-cols-6 [&>li]:border-b [&>li]:border-r [&>li]:border-border">
        {tiles.map((tile) => (
          <li key={tile.key} className="flex min-h-[132px] flex-col gap-2 p-4">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-muted">
              <tile.icon aria-hidden="true" size={14} />
              {tile.key === "value" ? <Term name="Value Bet">{tile.title}</Term> : tile.key === "money" ? <Term name="Argent entrant / sortant">{tile.title}</Term> : tile.title}
            </div>
            {tile.rows.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {tile.rows.slice(0, 6).map((row) => (
                  <button
                    key={row.horse.number}
                    aria-label={`Voir la fiche du n° ${row.horse.number}, ${row.horse.horse}`}
                    aria-pressed={selectedNumber === row.horse.number}
                    className={`h-9 min-w-9 rounded-lg px-2 font-mono text-base font-bold transition ${
                      selectedNumber === row.horse.number ? "bg-accent text-accent-fg" : "bg-surface-sub text-fg hover:bg-accent-lo hover:text-accent-text"
                    }`}
                    onClick={() => onSelect(row.horse.number)}
                    type="button"
                  >
                    {row.horse.number}
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted">{tile.empty}</p>
            )}
            <p className="mt-auto text-[11px] leading-4 text-muted">
              {tile.key === "money"
                ? "Part des mises PMU en hausse de 2 pts ou plus sur 15 min. Rendement historique : relevés encore trop récents pour le mesurer."
                : tile.signal && tile.signal.bets > 0
                  ? <>Historique {tile.hint} : <span className={tile.signal.roi >= 0 ? "font-bold text-accent-text" : "font-bold text-danger"}>{roiLine(tile.signal.roi, tile.signal.bets)}</span></>
                  : "Historique non encore mesuré."}
            </p>
          </li>
        ))}
      </ul>

      <p className="px-5 py-3 text-[11px] leading-5 text-muted sm:px-6">
        Ces repères décrivent la course, ils ne recommandent aucun pari.{" "}
        {provenProfitable
          ? "Le rendement de chaque signal est mesuré sur notre historique, net du prélèvement PMU"
          : "Sur notre historique, aucun signal n'est rentable de façon établie une fois le prélèvement PMU déduit"}{" "}
        (<a className="font-semibold underline" href="/track-record">voir le suivi</a>).
        Jouer comporte des risques : endettement, dépendance. Appelez le 09 74 75 13 13 (Joueurs Info Service, appel non surtaxé).
      </p>
    </Card>
  );
}
