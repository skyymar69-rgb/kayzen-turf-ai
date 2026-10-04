import Link from "next/link";
import { BarChart3, Brain, Trophy, Zap } from "lucide-react";
import { formatPct } from "@/lib/format";
import type { DashboardPerformance } from "./types";

const fr = new Intl.NumberFormat("fr-FR");

/** Performances de l'IA — chiffres mesurés du dernier rapport de suivi. */
export function PerformancePanel({ performance }: { performance: DashboardPerformance | null }) {
  const tiles = [
    { icon: <Trophy size={20} />, label: "Notre n° 1 gagne", value: performance?.rank1WinRate != null ? `${Math.round(performance.rank1WinRate * 100)} %` : "—", hint: "Part des courses où le premier de notre classement a gagné" },
    { icon: <BarChart3 size={20} />, label: "ROI net du n° 1", value: performance?.rank1Roi != null ? formatPct(performance.rank1Roi * 100, 1, true) : "—", hint: performance ? `Simple gagnant, rapports officiels PMU, sur ${fr.format(performance.rank1Bets)} paris` : "Calcul en cours" },
    { icon: <Brain size={20} />, label: "Top 3 trouvés", value: performance ? `${performance.top3HitsPerRace.toFixed(2).replace(".", ",")} / 3` : "—", hint: performance ? `En moyenne, sur ${fr.format(performance.racesEvaluated)} courses mesurées` : "Calcul en cours" },
    { icon: <Zap size={20} />, label: "Dernier calcul", value: performance ? new Date(performance.generatedAt).toLocaleDateString("fr-FR", { timeZone: "Europe/Paris" }) : "—", hint: "Le suivi complet est publié sur la page Suivi" },
  ];
  return (
    <section className="mt-4 rounded-2xl border border-border bg-surface shadow-sm" aria-labelledby="perf-title">
      <div className="border-b border-border px-5 py-4">
        <p className="text-xs font-bold uppercase tracking-widest text-muted">Mémoire & auto-apprentissage</p>
        <h2 id="perf-title" className="font-display text-xl font-bold text-fg">Performances de l’IA</h2>
        <p className="mt-1 text-sm text-muted">
          Chaque pronostic est gelé avant le départ, puis confronté à l’arrivée et aux rapports officiels du PMU.
          Les chiffres ci-dessous sont mesurés, prélèvement déduit — même quand ils sont négatifs.
        </p>
      </div>
      <div className="grid gap-px bg-border sm:grid-cols-2 lg:grid-cols-4">
        {tiles.map(({ icon, label, value, hint }) => (
          <div key={label} className="flex gap-4 bg-surface px-5 py-5">
            <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent-lo text-accent-text">{icon}</div>
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-muted">{label}</p>
              <p className="mt-1 font-display text-2xl font-bold text-fg">{value}</p>
              <p className="mt-1 text-xs leading-5 text-muted">{hint}</p>
            </div>
          </div>
        ))}
      </div>
      <div className="border-t border-border px-5 py-4 text-center">
        <Link href="/track-record" className="text-sm font-semibold text-accent-text hover:text-accent">Voir le suivi complet →</Link>
      </div>
    </section>
  );
}
