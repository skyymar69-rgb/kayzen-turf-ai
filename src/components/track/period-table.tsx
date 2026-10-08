import { NEXT_RUN, betTypeLabel, decimal, nf, pct, readingOf, signed, type PeriodRow } from "@/app/track-record/report-view";

/**
 * TABLEAU D'UNE PÉRIODE — ROI net, marge d'erreur, p-valeur corrigée, CLV,
 * plus forte baisse et pire série, avec une lecture en clair. Les indicateurs
 * absents d'un ancien rapport s'affichent « — » ; la table entière est
 * remplacée par une mention quand le découpage n'existe pas encore.
 */

const TONES = { good: "text-accent-text", bad: "text-danger", neutral: "text-muted" } as const;

export function PeriodTable({ rows, caption, showHolm = true }: { rows: PeriodRow[] | null; caption: string; showHolm?: boolean }) {
  if (!rows) return <p className="rounded-xl border border-border bg-bg p-4 text-sm text-muted">Découpage par période : {NEXT_RUN}.</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[980px] text-left text-sm">
        <caption className="mb-2 text-left text-xs text-muted">{caption}</caption>
        <thead>
          <tr className="border-b border-border text-[10px] font-bold uppercase tracking-widest text-muted">
            <th className="py-2 pr-3" scope="col">Signal</th>
            <th className="py-2 pr-3" scope="col">Pari</th>
            <th className="py-2 pr-3 text-right" scope="col">Paris</th>
            <th className="py-2 pr-3 text-right" scope="col">Réussite</th>
            <th className="py-2 pr-3 text-right" scope="col">ROI net</th>
            <th className="py-2 pr-3 text-right" scope="col">Marge 90 %</th>
            {showHolm && <th className="py-2 pr-3 text-right" scope="col">p corrigée</th>}
            <th className="py-2 pr-3 text-right" scope="col">CLV</th>
            <th className="py-2 pr-3 text-right" scope="col">Baisse max</th>
            <th className="py-2 pr-3 text-right" scope="col">Pire série</th>
            <th className="py-2" scope="col">Lecture</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map((r) => {
            const s = r.stats;
            const reading = r.reference ? { label: "Référence", tone: "neutral" as const } : readingOf(s, r.holm);
            return (
              <tr key={r.key}>
                <th className="py-2.5 pr-3 font-normal" scope="row">
                  <p className="font-semibold text-fg">{r.label}</p>
                  <p className="text-xs text-muted">{r.description}</p>
                </th>
                <td className="py-2.5 pr-3 text-muted">{betTypeLabel(r.betType)}</td>
                <td className="py-2.5 pr-3 text-right font-mono">{s ? nf.format(s.bets) : "0"}</td>
                <td className="py-2.5 pr-3 text-right font-mono">{s ? pct(s.hitRate) : "—"}</td>
                <td className={`py-2.5 pr-3 text-right font-mono font-bold ${!s ? "text-muted" : s.roi >= 0 ? "text-accent-text" : "text-danger"}`}>{s ? signed(s.roi) : "—"}</td>
                <td className="py-2.5 pr-3 text-right font-mono text-xs text-muted">{s && s.bets > 0 ? `${signed(s.roiLow)} à ${signed(s.roiHigh)}` : "—"}</td>
                {showHolm && <td className="py-2.5 pr-3 text-right font-mono text-xs text-muted">{r.reference ? "—" : decimal(r.holm)}</td>}
                <td className="py-2.5 pr-3 text-right font-mono text-xs text-muted">
                  {s?.clv ? (
                    <>
                      {signed(s.clv.mean)}
                      <span className="block text-[10px]">{pct(s.clv.positiveShare, 0)} positives</span>
                    </>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="py-2.5 pr-3 text-right font-mono text-xs text-muted">{typeof s?.maxDrawdown === "number" ? `${nf.format(Math.round(s.maxDrawdown))} mises` : "—"}</td>
                <td className="py-2.5 pr-3 text-right font-mono text-xs text-muted">{typeof s?.longestLosingStreak === "number" ? `${nf.format(s.longestLosingStreak)} perdus` : "—"}</td>
                <td className={`py-2.5 text-xs font-semibold ${TONES[reading.tone]}`}>{reading.label}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
