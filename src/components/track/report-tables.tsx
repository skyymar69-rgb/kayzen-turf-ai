import type { MultipleTesting, Report, ReportSignal } from "@/app/track-record/report-types";
import { NEXT_RUN, betTypeLabel, decimal, nf, pct, readingOf, relativeGap, signed, ticketGroups } from "@/app/track-record/report-view";

/**
 * Tableaux secondaires de /track-record : tests multiples, tickets du site,
 * A/E par tranche de cote, log loss mois par mois et ventilation par
 * discipline. Chacun affiche « disponible au prochain calcul » si le dernier
 * rapport ne porte pas encore son champ.
 */

const TH = "py-2 pr-3 text-[10px] font-bold uppercase tracking-widest text-muted";
const Pending = ({ what }: { what: string }) => (
  <p className="rounded-xl border border-border bg-bg p-4 text-sm text-muted">
    {what} : {NEXT_RUN}.
  </p>
);

export function MultipleTestingSummary({ mt, labels }: { mt: MultipleTesting | undefined; labels: Map<string, string> }) {
  if (!mt) return <Pending what="Correction des tests multiples" />;
  const primaryLabel = labels.get(mt.primary.key) ?? mt.primary.key;
  return (
    <div className="grid gap-2 text-sm leading-6 text-fg">
      <p>
        <strong>{nf.format(mt.tested)} signaux testés</strong> hors échantillon (références exclues). Tester beaucoup de signaux fait
        mécaniquement apparaître des « gagnants » par hasard : chaque p-valeur est donc corrigée par la méthode de Holm, au seuil de{" "}
        {pct(mt.alpha, 0)} (test unilatéral, ROI supérieur à zéro).
      </p>
      <p>
        {mt.survivors.length === 0 ? (
          <strong>Aucun signal ne reste significatif après correction.</strong>
        ) : (
          <strong>
            {nf.format(mt.survivors.length)} signal{mt.survivors.length > 1 ? "aux" : ""} reste{mt.survivors.length > 1 ? "nt" : ""} significatif
            {mt.survivors.length > 1 ? "s" : ""} après correction : {mt.survivors.map((k) => labels.get(k) ?? k).join(", ")}.
          </strong>
        )}{" "}
        Signal principal, déclaré dans le code avant toute mesure : {primaryLabel} — p = {decimal(mt.primary.pValue)}
        {mt.primary.significant ? ", significatif à lui seul." : ", non significatif."}
      </p>
    </div>
  );
}

export function TicketsTable({ tickets }: { tickets: Report["tickets"] }) {
  if (!tickets) return <Pending what="Rendement des tickets du site" />;
  const groups = ticketGroups(tickets.rows);
  return (
    <div className="grid gap-5">
      {groups.length === 0 && <p className="text-sm text-muted">Aucun ticket chiffrable sur la période.</p>}
      {groups.map((g) => (
        <div className="overflow-x-auto" key={g.title}>
          <table className="w-full min-w-[820px] text-left text-sm">
            <caption className="mb-2 text-left text-sm font-bold text-fg">{g.title}</caption>
            <thead>
              <tr className="border-b border-border">
                <th className={TH} scope="col">Ticket</th>
                <th className={TH} scope="col">Pari</th>
                <th className={`${TH} text-right`} scope="col">Hors échantillon</th>
                <th className={`${TH} text-right`} scope="col">Tickets / mises</th>
                <th className={`${TH} text-right`} scope="col">ROI net, période complète</th>
                <th className={`${TH} text-right`} scope="col">Marge 90 %</th>
                <th className={`${TH} text-right`} scope="col">Baisse max</th>
                <th className={TH} scope="col">Lecture</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {g.rows.map((t) => (
                <tr key={t.key}>
                  <th className="py-2 pr-3 font-semibold text-fg" scope="row">{t.label}</th>
                  <td className="py-2 pr-3 text-muted">{betTypeLabel(t.betType)}</td>
                  <td className="py-2 pr-3 text-right font-mono text-xs">
                    {t.outOfSample ? `${signed(t.outOfSample.roi)} (${nf.format(t.outOfSample.bets)})` : "aucun"}
                  </td>
                  <td className="py-2 pr-3 text-right font-mono">
                    {nf.format(t.bets)} / {nf.format(Math.round(t.staked ?? t.bets))} €
                  </td>
                  <td className={`py-2 pr-3 text-right font-mono font-bold ${t.roi >= 0 ? "text-accent-text" : "text-danger"}`}>{signed(t.roi)}</td>
                  <td className="py-2 pr-3 text-right font-mono text-xs text-muted">{`${signed(t.roiLow)} à ${signed(t.roiHigh)}`}</td>
                  <td className="py-2 pr-3 text-right font-mono text-xs text-muted">{typeof t.maxDrawdown === "number" ? `${nf.format(Math.round(t.maxDrawdown))} €` : "—"}</td>
                  <td className="py-2 text-xs text-muted">{readingOf(t).label}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
      {tickets.unpriceable.length > 0 && (
        <div className="text-xs leading-5 text-muted">
          <p className="font-semibold text-fg">Non chiffrés, et pourquoi :</p>
          <ul className="list-disc pl-5">
            {tickets.unpriceable.map((u) => (
              <li key={u.label}>
                {u.label} — {u.reason}.
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export function OddsBandTable({ bands }: { bands: Report["oddsBands"] }) {
  if (!bands) return <Pending what="A/E par tranche de cote" />;
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[560px] text-left text-sm">
        <thead>
          <tr className="border-b border-border">
            <th className={TH} scope="col">Cote de décision</th>
            <th className={`${TH} text-right`} scope="col">Partants</th>
            <th className={`${TH} text-right`} scope="col">Gagnants</th>
            <th className={`${TH} text-right`} scope="col">A/E marché</th>
            <th className={`${TH} text-right`} scope="col">A/E notre modèle</th>
            <th className={`${TH} text-right`} scope="col">ROI gagnant</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border font-mono">
          {bands.map((b) => (
            <tr key={b.label}>
              <th className="py-2 pr-3 font-sans font-normal text-fg" scope="row">{b.label}</th>
              <td className="py-2 pr-3 text-right">{nf.format(b.n)}</td>
              <td className="py-2 pr-3 text-right">{nf.format(b.wins)}</td>
              <td className="py-2 pr-3 text-right">{decimal(b.aeMarket, 2)}</td>
              <td className="py-2 pr-3 text-right">{decimal(b.aeModel, 2)}</td>
              <td className={`py-2 text-right ${b.roiSG >= 0 ? "text-accent-text" : "text-danger"}`}>{signed(b.roiSG)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function MonthlyLogLossTable({ months }: { months: Report["monthlyLogLoss"] }) {
  if (!months) return <Pending what="Log loss mois par mois" />;
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[560px] text-left text-sm">
        <thead>
          <tr className="border-b border-border">
            <th className={TH} scope="col">Mois</th>
            <th className={`${TH} text-right`} scope="col">Courses</th>
            <th className={`${TH} text-right`} scope="col">Marché</th>
            <th className={`${TH} text-right`} scope="col">IA seule</th>
            <th className={`${TH} text-right`} scope="col">Affiché (mélange)</th>
            <th className={`${TH} text-right`} scope="col">Affiché vs marché</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border font-mono">
          {months.map((m) => {
            const gap = relativeGap(m.blend, m.market);
            return (
              <tr key={m.month}>
                <th className="py-2 pr-3 font-sans font-normal text-fg" scope="row">
                  {new Date(`${m.month}-15T12:00:00Z`).toLocaleDateString("fr-FR", { month: "long", year: "numeric", timeZone: "UTC" })}
                </th>
                <td className="py-2 pr-3 text-right">{nf.format(m.races)}</td>
                <td className="py-2 pr-3 text-right">{decimal(m.market, 4)}</td>
                <td className="py-2 pr-3 text-right">{decimal(m.model, 4)}</td>
                <td className="py-2 pr-3 text-right">{decimal(m.blend, 4)}</td>
                <td className={`py-2 text-right ${gap <= 0 ? "text-accent-text" : "text-danger"}`}>{signed(gap)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function BreakdownTable({ signals }: { signals: ReportSignal[] }) {
  const withBreakdown = signals.filter((s) => Array.isArray(s.byDiscipline) && s.byDiscipline.length > 0);
  if (withBreakdown.length === 0) return <Pending what="Ventilation par discipline" />;
  return (
    <div className="grid gap-5">
      {withBreakdown.map((s) => (
        <div className="overflow-x-auto" key={s.key}>
          <table className="w-full min-w-[560px] text-left text-sm">
            <caption className="mb-2 text-left text-sm font-bold text-fg">
              {s.label} — {betTypeLabel(s.betType).toLowerCase()}
            </caption>
            <thead>
              <tr className="border-b border-border">
                <th className={TH} scope="col">Discipline / spécialité</th>
                <th className={`${TH} text-right`} scope="col">Paris</th>
                <th className={`${TH} text-right`} scope="col">Réussite</th>
                <th className={`${TH} text-right`} scope="col">ROI net</th>
                <th className={`${TH} text-right`} scope="col">Marge 90 %</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border font-mono">
              {[...(s.byDiscipline ?? []), ...(s.bySpecialty ?? []).filter((r) => r.bets >= 100)].map((r, i) => (
                <tr key={`${i}-${r.group}`}>
                  <th className="py-2 pr-3 font-sans font-normal text-fg" scope="row">{r.group}</th>
                  <td className="py-2 pr-3 text-right">{nf.format(r.bets)}</td>
                  <td className="py-2 pr-3 text-right">{pct(r.hitRate)}</td>
                  <td className={`py-2 pr-3 text-right ${r.roi >= 0 ? "text-accent-text" : "text-danger"}`}>{signed(r.roi)}</td>
                  <td className="py-2 text-right text-xs text-muted">{`${signed(r.roiLow)} à ${signed(r.roiHigh)}`}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}
