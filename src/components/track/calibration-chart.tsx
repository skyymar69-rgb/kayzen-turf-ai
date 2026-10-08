import { bubbleRadius, calibrationAxisMax, calibrationPoints } from "@/app/track-record/calibration";

/**
 * CALIBRATION — probabilité annoncée (abscisse) contre fréquence observée
 * (ordonnée). Sur la diagonale, « x % annoncés » arrivent x % du temps. La
 * surface de chaque point suit le nombre de chevaux de la tranche ; le trait
 * vertical est la marge d'erreur à 90 % (Wilson). Table de repli incluse.
 */

const BOX = { size: 300, left: 44, right: 12, top: 12, bottom: 36 };
const pct = (v: number, d = 0) => (Number.isFinite(v) ? `${(v * 100).toFixed(d).replace(".", ",")} %` : "—");
const nf = new Intl.NumberFormat("fr-FR");

export function CalibrationChart({ buckets, period, scheme }: { buckets: unknown; period: { from: string; to: string }; scheme?: string }) {
  const points = calibrationPoints(buckets);
  const labelled = points.some((p) => p.label !== undefined);
  const withAe = points.some((p) => p.ae !== undefined);
  if (points.length === 0) {
    return <p className="text-sm text-muted">Pas assez de chevaux par tranche (30 au moins) pour tracer la calibration.</p>;
  }
  const max = calibrationAxisMax(points);
  const maxN = Math.max(...points.map((p) => p.n));
  const inner = BOX.size - BOX.left - BOX.right;
  const innerH = BOX.size - BOX.top - BOX.bottom;
  const x = (v: number) => BOX.left + (v / max) * inner;
  const y = (v: number) => BOX.top + (1 - v / max) * innerH;
  const ticks = Array.from({ length: Math.round(max * 10) + 1 }, (_, i) => i / 10).filter((_, i, all) => all.length <= 6 || i % 2 === 0);
  const total = points.reduce((s, p) => s + p.n, 0);

  return (
    <div className="grid gap-4 md:grid-cols-[minmax(0,320px)_1fr] md:items-start">
      <svg aria-describedby="calibration-desc" aria-labelledby="calibration-titre" className="w-full max-w-[320px]" role="img" viewBox={`0 0 ${BOX.size} ${BOX.size}`}>
        <title id="calibration-titre">Calibration : probabilité annoncée contre fréquence de victoire observée</title>
        <desc id="calibration-desc">
          {nf.format(total)} chevaux répartis en {points.length} tranches. {points.map((p) => `Annoncé ${pct(p.announced, 1)}, observé ${pct(p.observed, 1)} sur ${nf.format(p.n)} chevaux`).join(" ; ")}.
        </desc>
        {ticks.map((v) => (
          <g key={v}>
            <line stroke="var(--border)" strokeDasharray="2 3" x1={BOX.left} x2={BOX.size - BOX.right} y1={y(v)} y2={y(v)} />
            <text fill="var(--muted)" fontSize="9" textAnchor="end" x={BOX.left - 5} y={y(v) + 3}>{pct(v)}</text>
            <text fill="var(--muted)" fontSize="9" textAnchor="middle" x={x(v)} y={BOX.size - BOX.bottom + 12}>{pct(v)}</text>
          </g>
        ))}
        <line stroke="var(--muted)" strokeDasharray="5 4" x1={x(0)} x2={x(max)} y1={y(0)} y2={y(max)} />
        <text fill="var(--muted)" fontSize="9" textAnchor="end" x={x(max) - 4} y={y(max) + 12}>calibration parfaite</text>
        {points.map((p) => (
          <g key={p.bucket}>
            {Number.isFinite(p.low) && <line stroke="var(--accent)" strokeOpacity="0.5" strokeWidth="1.5" x1={x(p.announced)} x2={x(p.announced)} y1={y(p.low)} y2={y(p.high)} />}
            <circle cx={x(p.announced)} cy={y(p.observed)} fill="var(--accent)" fillOpacity="0.75" r={bubbleRadius(p.n, maxN)} stroke="var(--surface)" strokeWidth="1" />
          </g>
        ))}
        <text fill="var(--muted)" fontSize="9" textAnchor="middle" x={BOX.left + inner / 2} y={BOX.size - 6}>Probabilité annoncée</text>
        <text fill="var(--muted)" fontSize="9" textAnchor="middle" transform={`rotate(-90 10 ${BOX.top + innerH / 2})`} x={10} y={BOX.top + innerH / 2}>Victoires observées</text>
      </svg>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[360px] text-left text-xs">
          <caption className="mb-2 text-left text-muted">
            Backtest du {new Date(period.from).toLocaleDateString("fr-FR")} au {new Date(period.to).toLocaleDateString("fr-FR")}, tranches d&apos;au moins 30 chevaux
            {scheme === "log2"
              ? " : tranches logarithmiques (moins de 1 %, 1-2 %, 2-4 %… 32 % et plus), qui détaillent les grosses cotes."
              : " : déciles linéaires (ancien rapport ; tranches logarithmiques disponibles au prochain calcul)."}
          </caption>
          <thead>
            <tr className="border-b border-border text-[10px] font-bold uppercase tracking-widest text-muted">
              {labelled && <th className="py-1.5 pr-3" scope="col">Tranche</th>}
              <th className="py-1.5 pr-3" scope="col">Annoncé</th>
              <th className="py-1.5 pr-3 text-right" scope="col">Observé</th>
              <th className="py-1.5 pr-3 text-right" scope="col">Marge 90 %</th>
              {withAe && <th className="py-1.5 pr-3 text-right" scope="col">A/E</th>}
              <th className="py-1.5 text-right" scope="col">Chevaux</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border font-mono">
            {points.map((p) => (
              <tr key={p.bucket}>
                {labelled ? (
                  <>
                    <th className="py-1 pr-3 font-sans font-normal text-fg" scope="row">{p.label ?? "—"}</th>
                    <td className="py-1 pr-3 text-fg">{pct(p.announced, 1)}</td>
                  </>
                ) : (
                  <th className="py-1 pr-3 font-normal text-fg" scope="row">{pct(p.announced, 1)}</th>
                )}
                <td className="py-1 pr-3 text-right text-fg">{pct(p.observed, 1)}</td>
                <td className="py-1 pr-3 text-right text-muted">{pct(p.low, 1)} à {pct(p.high, 1)}</td>
                {withAe && <td className="py-1 pr-3 text-right text-muted">{p.ae !== undefined ? p.ae.toFixed(2).replace(".", ",") : "—"}</td>}
                <td className="py-1 text-right text-muted">{nf.format(p.n)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
