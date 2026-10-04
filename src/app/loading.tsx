/**
 * Squelette affiché pendant le chargement d'une page (navigation ou premier
 * rendu en streaming), au lieu d'un écran vide. Les pages qui ont une forme
 * propre peuvent déclarer leur propre loading.tsx.
 */
export default function Loading() {
  return (
    <main aria-busy="true" aria-label="Chargement" className="min-h-screen bg-bg pb-20" id="contenu-principal">
      <div className="mx-auto max-w-[1480px] px-4 pt-8 sm:px-6 lg:px-8">
        <div className="rounded-2xl border border-border bg-surface p-6 sm:p-8">
          <div className="kz-skeleton h-5 w-40" />
          <div className="kz-skeleton mt-4 h-10 w-2/3 max-w-xl" />
          <div className="kz-skeleton mt-3 h-4 w-full max-w-2xl" />
        </div>
        <div className="mt-6 space-y-3">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="rounded-2xl border border-border bg-surface p-5">
              <div className="kz-skeleton h-4 w-48" />
              <div className="mt-4 grid gap-2 sm:grid-cols-3">
                <div className="kz-skeleton h-14" />
                <div className="kz-skeleton h-14" />
                <div className="kz-skeleton h-14" />
              </div>
            </div>
          ))}
        </div>
        <p className="sr-only" role="status">Chargement de la page…</p>
      </div>
    </main>
  );
}
