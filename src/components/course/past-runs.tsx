import { musicRuns } from "@/lib/horse-compare";

/**
 * DERNIÈRES COURSES — lues dans la musique, faute de mieux : la base ne
 * relie pas encore un cheval à ses courses passées de façon indexée, donc ni
 * date, ni hippodrome, ni lien vers la course. La fiche le dit plutôt que
 * d'afficher un historique incomplet comme s'il était complet.
 */
export function PastRuns({ music }: { music?: string | null }) {
  const runs = musicRuns(music);
  return (
    <div className="mt-4 rounded-xl border border-border bg-surface-sub p-4">
      <p className="text-xs font-bold uppercase tracking-widest text-muted">Dernières courses</p>
      {runs.length === 0 ? (
        <p className="mt-2 text-sm text-muted">Aucune course connue pour ce cheval.</p>
      ) : (
        <ol className="mt-2 flex flex-wrap gap-1.5">
          {runs.map((run) => (
            <li
              key={run.order}
              className={`rounded-lg border px-2 py-1 text-xs font-semibold ${
                run.position === null ? "border-danger/30 bg-danger/10 text-danger" : run.position <= 3 ? "border-accent/30 bg-accent-lo text-accent-text" : "border-border bg-surface text-fg"
              }`}
            >
              <span className="sr-only">{run.order === 1 ? "Dernière course" : `${run.order}e course en remontant`} : </span>
              {run.label}
            </li>
          ))}
        </ol>
      )}
      <p className="mt-2 text-[11px] leading-5 text-muted">
        De la plus récente à la plus ancienne, d&apos;après la musique publiée par le PMU ({music || "vide"}). Les dates, hippodromes et liens vers
        ces courses ne sont pas encore disponibles.
      </p>
    </div>
  );
}
