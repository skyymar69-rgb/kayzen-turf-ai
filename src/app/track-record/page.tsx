import Link from "next/link";
import type { Metadata } from "next";
import { ArrowLeft, LineChart } from "lucide-react";
import { CalibrationChart } from "@/components/track/calibration-chart";
import { RoiCurveChart } from "@/components/track/roi-curve-chart";
import { getLatestTrackRecord, type SignalRecord } from "@/lib/race-repository";
import { hasRoiSeries, type DailyPoint } from "./roi-series";

export const metadata: Metadata = {
  title: "Suivi de performance — réussite et ROI de chaque signal",
  description:
    "Le rendement réel de chaque signal Kayzen Turf, calculé sur les rapports officiels PMU, net du prélèvement, avec la période, le nombre de paris et la marge d'erreur — même quand il est négatif.",
  alternates: { canonical: "/track-record" },
};

/** Le rapport est régénéré une fois par jour : une heure de cache suffit. */
export const revalidate = 3600;

type Report = {
  generatedAt: string;
  modelVersion: string;
  fundamentalVersion: string;
  profilesVersion: string;
  period: { from: string; to: string };
  rules: Record<string, string | number>;
  racesConsidered: number;
  racesEvaluated: number;
  racesWithPayouts: number;
  oddsAgeMinutes: { median: number; p25: number; p75: number; within30: number };
  accuracy: { winnerFoundShown: number | null; top3HitsPerRace: number; byModel: Array<{ key: string; logLoss: number; winnerFound: number }> };
  calibration: Array<{ bucket: number; announced: number; observed: number; n: number }>;
  signals: Array<SignalRecord & { description: string; races: number; hits: number; averageOdds: number; daily?: DailyPoint[] }>;
  longshotDiagnostics?: Array<{ label: string; n: number; winRate: number; roiSG: number; roiSP: number }>;
  live?: {
    since: string;
    races: number;
    signals: Array<SignalRecord & { description: string; daily?: DailyPoint[] }>;
  };
};

const dateFr = (iso: string) => new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
const pct = (v: number, d = 1) => (Number.isFinite(v) ? `${(v * 100).toFixed(d).replace(".", ",")} %` : "—");
const signed = (v: number) => (Number.isFinite(v) ? `${v > 0 ? "+" : v < 0 ? "−" : ""}${Math.abs(v * 100).toFixed(1).replace(".", ",")} %` : "—");
const nf = new Intl.NumberFormat("fr-FR");

function SignalTable({ signals }: { signals: Report["signals"] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[720px] text-left text-sm">
        <thead>
          <tr className="border-b border-border text-[10px] font-bold uppercase tracking-widest text-muted">
            <th className="py-2 pr-3">Signal</th>
            <th className="py-2 pr-3">Pari</th>
            <th className="py-2 pr-3 text-right">Paris</th>
            <th className="py-2 pr-3 text-right">Réussite</th>
            <th className="py-2 pr-3 text-right">ROI net</th>
            <th className="py-2 text-right">Marge d&apos;erreur (90 %)</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {signals.map((s) => (
            <tr key={s.key}>
              <td className="py-2.5 pr-3">
                <p className="font-semibold text-fg">{s.label}</p>
                <p className="text-xs text-muted">{s.description}</p>
              </td>
              <td className="py-2.5 pr-3 text-muted">{s.betType === "SG" ? "Simple gagnant" : "Simple placé"}</td>
              <td className="py-2.5 pr-3 text-right font-mono">{nf.format(s.bets)}</td>
              <td className="py-2.5 pr-3 text-right font-mono">{pct(s.hitRate)}</td>
              <td className={`py-2.5 pr-3 text-right font-mono font-bold ${s.roi >= 0 ? "text-accent-text" : "text-danger"}`}>{signed(s.roi)}</td>
              <td className="py-2.5 text-right font-mono text-xs text-muted">
                {s.bets > 0 ? `${signed(s.roiLow)} à ${signed(s.roiHigh)}` : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default async function TrackRecordPage() {
  const report = (await getLatestTrackRecord()) as unknown as Report | null;

  return (
    <main className="min-h-screen bg-bg pb-20" id="contenu-principal">
      <div className="mx-auto max-w-5xl px-4 pt-6 sm:px-6 lg:px-8">
        <Link
          className="mb-6 inline-flex items-center gap-2 rounded-xl border border-border bg-surface px-3.5 py-2 text-sm font-medium text-muted shadow-sm transition hover:border-accent hover:text-accent-text"
          href="/"
        >
          <ArrowLeft size={14} /> Accueil
        </Link>

        <div className="mb-8 flex items-center gap-4">
          <div className="grid size-14 place-items-center rounded-2xl bg-accent-lo">
            <LineChart className="text-accent-text" size={26} />
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-muted">Suivi de performance</p>
            <h1 className="font-display text-3xl font-bold text-fg">Ce que nos signaux ont réellement rapporté</h1>
            <p className="mt-1 text-sm text-muted">
              Calculé sur les rapports officiels du PMU, prélèvement déduit. Publié même quand c&apos;est négatif.
            </p>
          </div>
        </div>

        {!report ? (
          <p className="rounded-2xl border border-border bg-surface p-6 text-sm text-muted">Le premier rapport est en cours de calcul.</p>
        ) : (
          <div className="grid gap-6">
            <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {[
                { label: "Période mesurée", value: `${dateFr(report.period.from)} → ${dateFr(report.period.to)}` },
                { label: "Courses", value: `${nf.format(report.racesEvaluated)} évaluées, ${nf.format(report.racesWithPayouts)} avec rapports` },
                { label: "Notre n° 1 gagne", value: pct(report.signals.find((s) => s.key === "rank1-sg")?.hitRate ?? NaN) },
                { label: "Top 3 trouvés", value: `${report.accuracy.top3HitsPerRace.toFixed(2).replace(".", ",")} sur 3 par course` },
              ].map((c) => (
                <div key={c.label} className="rounded-2xl border border-border bg-surface p-4 shadow-sm">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted">{c.label}</p>
                  <p className="mt-1 text-sm font-semibold text-fg">{c.value}</p>
                </div>
              ))}
            </section>

            <section className="rounded-2xl border border-warn/30 bg-warn-lo p-5 text-sm leading-6 text-warn">
              <p>
                <strong>À lire avant tout chiffre.</strong> Tout pari sur un cheval au hasard perd en moyenne{" "}
                {signed(-(report.signals.find((s) => s.key === "tous-sg")?.roi ?? NaN)).replace("+", "")} : le prélèvement du
                PMU (environ 15 % en simple gagnant), aggravé par les grosses cotes, qui rapportent moins que leur chance réelle. Un signal n&apos;a de valeur que s&apos;il perd nettement moins, et il n&apos;est
                rentable de façon établie que si toute sa marge d&apos;erreur est positive. Sur cette période, les cotes
                de décision avaient en médiane {report.oddsAgeMinutes.median} minutes d&apos;âge (relevées au moins{" "}
                {report.rules.decisionOddsLeadMinutes} minutes avant le départ) : le rafraîchissement des cotes n&apos;a été
                fiabilisé qu&apos;en octobre 2026.
              </p>
            </section>

            <section className="rounded-2xl border border-border bg-surface p-6 shadow-sm">
              <h2 className="font-display text-xl font-bold text-fg">Rendement par signal — backtest</h2>
              <p className="mb-4 mt-1 text-xs text-muted">
                Mise fixe de 1 € par pari. Le modèle de l&apos;IA n&apos;avait vu aucune de ces courses ; en revanche, les
                seuils des profils ({report.profilesVersion}) ont été choisis sur cette même période — seul le suivi en
                direct les mesure sans biais. Marge d&apos;erreur par rééchantillonnage des courses.
              </p>
              <SignalTable signals={report.signals} />
            </section>

            {hasRoiSeries(report.signals) && (
              <section className="rounded-2xl border border-border bg-surface p-6 shadow-sm">
                <h2 className="font-display text-xl font-bold text-fg">ROI cumulé dans le temps — backtest</h2>
                <p className="mb-4 mt-1 text-xs text-muted">
                  Du {dateFr(report.period.from)} au {dateFr(report.period.to)}, mise fixe de 1 € par pari, rapports officiels nets du
                  prélèvement. Chaque point cumule tous les paris depuis le début de la période : les premiers jours reposent sur peu de
                  paris et varient fortement. Les pointillés sont les références (tous les partants, favori du marché).
                </p>
                <RoiCurveChart period={report.period} signals={report.signals} title="ROI cumulé par signal, backtest" />
              </section>
            )}

            {report.live && report.live.races > 0 && (
              <section className="rounded-2xl border border-border bg-surface p-6 shadow-sm">
                <h2 className="font-display text-xl font-bold text-fg">Suivi en direct — pronostics gelés avant le départ</h2>
                <p className="mb-4 mt-1 text-xs text-muted">
                  Depuis le {dateFr(report.live.since)} : {nf.format(report.live.races)} courses dont le pronostic a été gelé juste avant
                  le départ, puis confronté aux rapports officiels. C&apos;est ce suivi qui confirme ou infirme le backtest.
                </p>
                <SignalTable signals={report.live.signals as Report["signals"]} />
                {hasRoiSeries(report.live.signals) && (
                  <div className="mt-6">
                    <h3 className="mb-3 font-display text-base font-bold text-fg">ROI cumulé du suivi en direct</h3>
                    <RoiCurveChart
                      period={{ from: report.live.since.slice(0, 10), to: report.generatedAt.slice(0, 10) }}
                      signals={report.live.signals}
                      title="ROI cumulé par signal, suivi en direct"
                    />
                  </div>
                )}
              </section>
            )}

            <section className="rounded-2xl border border-border bg-surface p-6 shadow-sm">
              <h2 className="font-display text-xl font-bold text-fg">Calibration — quand nous annonçons x %, cela arrive-t-il x % du temps ?</h2>
              <p className="mb-4 mt-1 text-xs text-muted">
                Chaque point regroupe les chevaux d&apos;une tranche de probabilité affichée. Sur la diagonale, la probabilité annoncée
                se réalise exactement ; sous la diagonale, nous surestimons les chances. Plus le point est gros, plus la tranche compte de
                chevaux ; le trait vertical est la marge d&apos;erreur à 90 %.
              </p>
              <CalibrationChart buckets={report.calibration} period={report.period} />
            </section>

            {report.longshotDiagnostics && (
              <section className="rounded-2xl border border-border bg-surface p-6 shadow-sm">
                <h2 className="font-display text-xl font-bold text-fg">Grosses cotes : l&apos;avis de l&apos;IA a-t-il de la valeur ?</h2>
                <p className="mb-4 mt-1 text-xs text-muted">Chevaux à 10/1 et plus, selon le rapport entre la probabilité de l&apos;IA et celle du marché.</p>
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
              </section>
            )}

            <section className="rounded-2xl border border-border bg-surface p-6 text-sm leading-6 text-muted shadow-sm">
              <h2 className="font-display text-xl font-bold text-fg">Règles du calcul</h2>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                <li>Cote de décision : dernier relevé PMU observé au moins {report.rules.decisionOddsLeadMinutes} minutes avant le départ, jamais la cote finale.</li>
                <li>Gains : {report.rules.payouts}.</li>
                <li>Mise : {report.rules.stake}.</li>
                <li>Hors échantillon : {report.rules.outOfSample}.</li>
                <li>Versions : {report.modelVersion} · {report.fundamentalVersion} · {report.profilesVersion}. Rapport généré le {dateFr(report.generatedAt)}.</li>
              </ul>
              <p className="mt-3">
                Les règles des signaux sont détaillées sur la page <Link className="font-semibold text-accent-text underline" href="/methode">Méthode</Link>.
                Les performances passées ne préjugent pas des performances futures. Jouer comporte des risques : endettement,
                dépendance. Appelez le 09 74 75 13 13 (Joueurs Info Service, appel non surtaxé).
              </p>
            </section>
          </div>
        )}
      </div>
    </main>
  );
}
