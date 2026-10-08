import Link from "next/link";
import type { ReactNode } from "react";
import type { Report } from "@/app/track-record/report-types";
import { NEXT_RUN, dateFr, earliestFreeze, fullRows, nf, pct, periodRows, signed } from "@/app/track-record/report-view";
import { hasRoiSeries } from "@/app/track-record/roi-series";
import { CalibrationChart } from "@/components/track/calibration-chart";
import { PeriodTable } from "@/components/track/period-table";
import { BreakdownTable, MonthlyLogLossTable, MultipleTestingSummary, OddsBandTable, TicketsTable } from "@/components/track/report-tables";
import { RoiCurveChart } from "@/components/track/roi-curve-chart";

/**
 * CORPS DE /track-record — hors échantillon et suivi en direct d'abord, puis
 * tickets du site, période d'ajustement (étiquetée comme telle), calibration,
 * A/E, log loss mensuel et ventilation. Tolère un rapport ancien : chaque bloc
 * absent affiche « disponible au prochain calcul ».
 */

function Section({ title, intro, children }: { title: string; intro?: ReactNode; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-border bg-surface p-6 shadow-sm">
      <h2 className="font-display text-xl font-bold text-fg">{title}</h2>
      {intro && <div className="mb-4 mt-1 text-xs leading-5 text-muted">{intro}</div>}
      {children}
    </section>
  );
}

export function TrackRecordBody({ report }: { report: Report }) {
  const signals = Array.isArray(report.signals) ? report.signals : [];
  const labels = new Map(signals.map((s) => [s.key, `${s.label} (${s.betType === "SP" ? "placé" : "gagnant"})`]));
  const oosTesting = report.multipleTesting?.outOfSample;
  const freeze = earliestFreeze({ profilesFrozenAt: report.profilesFrozenAt, signals });
  const oosRows = periodRows(signals, "outOfSample", oosTesting);
  const inRows = periodRows(signals, "inSample", report.multipleTesting?.inSample);
  const primary = signals.find((s) => s.key === (report.primarySignal ?? "rank1-sp"));
  const live = report.live && report.live.races > 0 ? report.live : null;

  return (
    <div className="grid gap-6">
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Période mesurée", value: `${dateFr(report.period.from)} → ${dateFr(report.period.to)}` },
          {
            label: "Hors échantillon",
            value: freeze ? `depuis le ${dateFr(freeze)} (gel des règles)` : NEXT_RUN,
          },
          {
            label: "Signaux testés",
            value: oosTesting
              ? `${nf.format(oosTesting.tested)} — ${oosTesting.survivors.length === 0 ? "aucun" : nf.format(oosTesting.survivors.length)} significatif après correction`
              : NEXT_RUN,
          },
          {
            label: "Signal principal hors échantillon",
            value: primary?.outOfSample
              ? `${labels.get(primary.key)} : ${signed(primary.outOfSample.roi)} sur ${nf.format(primary.outOfSample.bets)} paris`
              : primary && "outOfSample" in primary
                ? "aucun pari encore"
                : NEXT_RUN,
          },
        ].map((c) => (
          <div className="rounded-2xl border border-border bg-surface p-4 shadow-sm" key={c.label}>
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted">{c.label}</p>
            <p className="mt-1 text-sm font-semibold text-fg">{c.value}</p>
          </div>
        ))}
      </section>

      <section className="rounded-2xl border border-warn/30 bg-warn-lo p-5 text-sm leading-6 text-warn">
        <p>
          <strong>À lire avant tout chiffre.</strong> Tout pari sur un cheval au hasard perd en moyenne{" "}
          {signed(-(signals.find((s) => s.key === "tous-sg")?.roi ?? NaN)).replace("+", "")} : le prélèvement du PMU (environ 15 % en
          simple gagnant), aggravé par les grosses cotes, qui rapportent moins que leur chance réelle. Un signal n&apos;a de valeur que
          s&apos;il perd nettement moins, et il n&apos;est rentable de façon établie que si toute sa marge d&apos;erreur est positive{" "}
          <em>et</em> qu&apos;il résiste à la correction pour le nombre de signaux testés. Les seuils des signaux ont été réglés sur les
          courses antérieures à leur date de gel : ces courses-là ne mesurent rien, elles sont publiées à part. Les cotes de décision
          avaient en médiane {report.oddsAgeMinutes.median} minutes d&apos;âge (relevées au moins {report.rules.decisionOddsLeadMinutes}{" "}
          minutes avant le départ) : le rafraîchissement des cotes n&apos;a été fiabilisé qu&apos;en octobre 2026.
        </p>
      </section>

      <Section
        intro={
          <p>
            Courses courues <strong>après</strong> le gel des règles de chaque signal : ni le modèle de l&apos;IA ni les seuils
            n&apos;ont pu s&apos;y ajuster. C&apos;est la seule mesure du backtest sans biais. Les premiers jours reposent sur peu de
            paris : tant qu&apos;un signal compte moins de 100 paris, aucune conclusion n&apos;est tirée. « p corrigée » : p-valeur
            unilatérale ajustée par Holm. CLV : cote prise ÷ cote finale − 1, quand un relevé postérieur à la décision existe.
          </p>
        }
        title="Hors échantillon — depuis le gel des règles"
      >
        <PeriodTable caption="Mise fixe de 1 € par pari, rapports officiels nets du prélèvement." rows={oosRows} />
      </Section>

      <Section title="Combien de signaux avons-nous testés ?">
        <MultipleTestingSummary labels={labels} mt={oosTesting} />
      </Section>

      <Section
        intro={
          live ? (
            <p>
              Depuis le {dateFr(live.since ?? report.generatedAt)} : {nf.format(live.races)} courses dont le pronostic a été gelé juste
              avant le départ, avec les règles en vigueur ce jour-là, puis confronté aux rapports officiels. Mesure strictement hors
              échantillon : c&apos;est elle qui confirme ou infirme le backtest.
            </p>
          ) : undefined
        }
        title="Suivi en direct — pronostics gelés avant le départ"
      >
        {live ? (
          <>
            <PeriodTable caption="Pronostics gelés, mise fixe de 1 € par pari." rows={fullRows(live.signals, live.multipleTesting)} showHolm={live.multipleTesting !== undefined} />
            {hasRoiSeries(live.signals) && (
              <div className="mt-6">
                <h3 className="mb-3 font-display text-base font-bold text-fg">ROI cumulé du suivi en direct</h3>
                <RoiCurveChart
                  period={{ from: (live.since ?? report.generatedAt).slice(0, 10), to: report.generatedAt.slice(0, 10) }}
                  signals={live.signals}
                  title="ROI cumulé par signal, suivi en direct"
                />
              </div>
            )}
          </>
        ) : (
          <p className="text-sm text-muted">Aucune course gelée n&apos;a encore ses rapports officiels.</p>
        )}
      </Section>

      <Section
        intro={
          <p>
            Les tickets que le site propose, reconstitués course par course avec le code de production et la cote de décision, puis
            payés aux rapports officiels : 1 € par combinaison. La colonne « Hors échantillon » ne retient que les courses depuis le{" "}
            {report.tickets ? dateFr(report.tickets.frozenAt) : "gel des règles"}.
          </p>
        }
        title="Rendement des tickets du site, par type de pari"
      >
        <TicketsTable tickets={report.tickets} />
      </Section>

      <Section
        intro={
          <p>
            Période d&apos;ajustement : les seuils ont été choisis en regardant ces courses-là. Un ROI élevé ici est attendu et ne
            prouve rien ; il n&apos;est publié que par transparence.
          </p>
        }
        title="Période d'ajustement — dans l'échantillon, à ne pas lire comme une performance"
      >
        {inRows ? (
          <PeriodTable caption="Courses antérieures au gel des règles de chaque signal." rows={inRows} />
        ) : (
          <PeriodTable
            caption="Ancien rapport : période complète, dont la période d'ajustement des seuils (découpage disponible au prochain calcul)."
            rows={fullRows(signals)}
            showHolm={false}
          />
        )}
      </Section>

      {hasRoiSeries(signals) && (
        <Section
          intro={
            <p>
              Du {dateFr(report.period.from)} au {dateFr(report.period.to)}, période d&apos;ajustement comprise : la courbe montre la
              trajectoire, pas une performance. Mise fixe de 1 € par pari, rapports officiels nets du prélèvement. Les pointillés sont
              les références (tous les partants, favori du marché).
            </p>
          }
          title="ROI cumulé dans le temps — période complète"
        >
          <RoiCurveChart period={report.period} signals={signals} title="ROI cumulé par signal, période complète" />
        </Section>
      )}

      <Section
        intro={
          <p>
            Chaque point regroupe les chevaux d&apos;une tranche de probabilité affichée. Sur la diagonale, la probabilité annoncée se
            réalise exactement ; sous la diagonale, nous surestimons les chances. A/E = victoires observées ÷ victoires annoncées.
          </p>
        }
        title="Calibration — quand nous annonçons x %, cela arrive-t-il x % du temps ?"
      >
        <CalibrationChart buckets={report.calibration} period={report.period} scheme={report.calibrationScheme} />
      </Section>

      <Section
        intro={<p>Par tranche de cote de décision : victoires observées ÷ victoires annoncées par le marché, puis par notre modèle. Sous 1, la tranche gagne moins qu&apos;annoncé.</p>}
        title="A/E par tranche de cote"
      >
        <OddsBandTable bands={report.oddsBands} />
      </Section>

      <Section
        intro={
          <p>
            Log loss moyen du gagnant, mois par mois (plus bas = meilleur). Le modèle de l&apos;IA est figé avant la période : chaque
            mois est une nouvelle mesure, lue dans l&apos;ordre. « Affiché » est le mélange publié sur le site.
          </p>
        }
        title="Précision mois par mois — l'IA contre le marché"
      >
        <MonthlyLogLossTable months={report.monthlyLogLoss} />
      </Section>

      <Section intro={<p>Période complète, période d&apos;ajustement comprise. Les spécialités de moins de 100 paris sont masquées.</p>} title="Par discipline">
        <BreakdownTable signals={signals} />
      </Section>

      {report.longshotDiagnostics && (
        <Section intro={<p>Chevaux à 10/1 et plus, selon le rapport entre la probabilité de l&apos;IA et celle du marché (période complète).</p>} title="Grosses cotes : l'avis de l'IA a-t-il de la valeur ?">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead>
                <tr className="border-b border-border text-[10px] font-bold uppercase tracking-widest text-muted">
                  <th className="py-2">Groupe</th>
                  <th className="py-2 text-right">Chevaux</th>
                  <th className="py-2 text-right">Gagnants</th>
                  <th className="py-2 text-right">ROI gagnant</th>
                  <th className="py-2 text-right">ROI placé</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {report.longshotDiagnostics.map((d) => (
                  <tr key={d.label}>
                    <td className="py-2 text-fg">{d.label}</td>
                    <td className="py-2 text-right font-mono">{nf.format(d.n)}</td>
                    <td className="py-2 text-right font-mono">{pct(d.winRate)}</td>
                    <td className={`py-2 text-right font-mono ${d.roiSG >= 0 ? "text-accent-text" : "text-danger"}`}>{signed(d.roiSG)}</td>
                    <td className={`py-2 text-right font-mono ${d.roiSP >= 0 ? "text-accent-text" : "text-danger"}`}>{signed(d.roiSP)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      )}

      <section className="rounded-2xl border border-border bg-surface p-6 text-sm leading-6 text-muted shadow-sm">
        <h2 className="font-display text-xl font-bold text-fg">Règles du calcul</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>Cote de décision : dernier relevé PMU observé au moins {report.rules.decisionOddsLeadMinutes} minutes avant le départ, jamais la cote finale.</li>
          <li>Gains : {report.rules.payouts}.</li>
          <li>Mise : {report.rules.stake}.</li>
          <li>Hors échantillon : {report.rules.outOfSample}.</li>
          <li>Cote finale (CLV) : {report.rules.closingOdds ?? NEXT_RUN}.</li>
          <li>Tests multiples : {report.rules.multipleTesting ?? NEXT_RUN}.</li>
          <li>
            Courses : {nf.format(report.racesEvaluated)} évaluées, {nf.format(report.racesWithPayouts)} avec rapports. Versions : {report.modelVersion} ·{" "}
            {report.fundamentalVersion} · {report.profilesVersion}. Rapport généré le {dateFr(report.generatedAt)}.
          </li>
        </ul>
        <p className="mt-3">
          Les règles des signaux sont détaillées sur la page <Link className="font-semibold text-accent-text underline" href="/methode">Méthode</Link>.
          Les performances passées ne préjugent pas des performances futures. Jouer comporte des risques : endettement, dépendance. Appelez le
          09 74 75 13 13 (Joueurs Info Service, appel non surtaxé).
        </p>
      </section>
    </div>
  );
}
