import Link from "next/link";
import type { Metadata } from "next";
import { ArrowLeft, Scale } from "lucide-react";
import modelFile from "@/lib/fundamental/model.json";
import { FEATURE_LABELS } from "@/lib/fundamental/features";
import { FUNDAMENTAL_TRAIN_CUTOFF, FUNDAMENTAL_VERSION } from "@/lib/fundamental/model";
import { ACCORD_MAX_GAP_PTS, ACCORD_RATIO_MAX, ACCORD_RATIO_MIN, CONFRONT_MIN_PCT } from "@/lib/confrontation";
import { FLOW_ACCEL_PTS, FLOW_ACCEL_WINDOW_MIN, FLOW_WINDOW_MIN, MVT_NOISE_PCT, STRONG_MONEY_PTS } from "@/lib/market";
import { MODEL_VERSION, MODEL_WEIGHT } from "@/lib/probability";
import { PROFILES_VERSION, PROFILE_LABELS, PROFILE_RULES, READING_LABELS, READING_RULES, type RaceReading } from "@/lib/profiles";
import { ProfileBadge } from "@/components/course/shared";

export const metadata: Metadata = {
  title: "Méthode — comment Kayzen Turf calcule ses pronostics",
  description:
    "Les règles publiées de Kayzen Turf : probabilité du marché, avis de l'IA sans cote, profils des chevaux (Base, Caché, Value, Outsider, Tocard, À éviter), MVT et parts des mises PMU.",
  alternates: { canonical: "/methode" },
};

type Evaluation = Record<string, { trainRaces: number; testRaces: number; uniform: { top1: number }; fundamental: { top1: number; logLoss: number }; marketClosing: { top1: number; logLoss: number } }>;
const evaluation = (modelFile as { evaluation: Evaluation }).evaluation;

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-border bg-surface p-6 shadow-sm">
      <h2 className="font-display text-xl font-bold text-fg">{title}</h2>
      <div className="mt-3 space-y-3 text-sm leading-6 text-muted">{children}</div>
    </section>
  );
}

const fr = (v: number) => v.toFixed(1).replace(".", ",");

export default function MethodePage() {
  return (
    <main className="min-h-screen bg-bg pb-20" id="contenu-principal">
      <div className="mx-auto max-w-4xl px-4 pt-6 sm:px-6 lg:px-8">
        <Link
          className="mb-6 inline-flex items-center gap-2 rounded-xl border border-border bg-surface px-3.5 py-2 text-sm font-medium text-muted shadow-sm transition hover:border-accent hover:text-accent-text"
          href="/"
        >
          <ArrowLeft size={14} /> Accueil
        </Link>

        <div className="mb-8 flex items-center gap-4">
          <div className="grid size-14 place-items-center rounded-2xl bg-accent-lo">
            <Scale className="text-accent-text" size={26} />
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-muted">Méthode · {MODEL_VERSION} · {PROFILES_VERSION}</p>
            <h1 className="font-display text-3xl font-bold text-fg">Comment nous calculons, en toutes lettres</h1>
            <p className="mt-1 text-sm text-muted">
              Toutes les règles du site sont ici, avec leurs seuils. Leur rendement réel est publié sur le{" "}
              <Link className="font-semibold text-accent-text underline" href="/track-record">suivi de performance</Link>.
            </p>
          </div>
        </div>

        <div className="grid gap-6">
          <Section title="1. Deux avis indépendants : le marché et l'IA">
            <p>
              <strong className="text-fg">Le marché</strong> : la cote PMU, convertie en probabilité (1 ÷ cote), puis
              normalisée sur le peloton pour retirer la marge du PMU. C&apos;est le meilleur prédicteur gratuit qui
              existe, surtout à l&apos;approche du départ.
            </p>
            <p>
              <strong className="text-fg">L&apos;IA</strong> : un modèle fondamental ({FUNDAMENTAL_VERSION}) qui estime
              la probabilité de victoire <em>sans jamais voir la cote</em>. Il compare les chevaux d&apos;une même course
              (logit conditionnel, un modèle par discipline) à partir de :
            </p>
            <ul className="grid gap-1 sm:grid-cols-2">
              {Object.values(FEATURE_LABELS).map((label) => (
                <li key={label} className="rounded-lg bg-surface-sub px-3 py-1.5 text-xs text-fg">{label}</li>
              ))}
            </ul>
            <p>
              Il a été ajusté sur les courses antérieures au {new Date(FUNDAMENTAL_TRAIN_CUTOFF).toLocaleDateString("fr-FR")} et mesuré
              sur les suivantes, qu&apos;il n&apos;avait jamais vues :
            </p>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[480px] text-left text-xs">
                <thead>
                  <tr className="border-b border-border text-[10px] uppercase tracking-widest text-muted">
                    <th className="py-2">Discipline</th>
                    <th className="py-2 text-right">Courses mesurées</th>
                    <th className="py-2 text-right">Hasard</th>
                    <th className="py-2 text-right">IA</th>
                    <th className="py-2 text-right">Marché (cote finale)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border text-fg">
                  {Object.entries(evaluation).map(([discipline, e]) => (
                    <tr key={discipline}>
                      <td className="py-2 font-semibold">{discipline}</td>
                      <td className="py-2 text-right font-mono">{e.testRaces}</td>
                      <td className="py-2 text-right font-mono">{fr(e.uniform.top1)} %</td>
                      <td className="py-2 text-right font-mono">{fr(e.fundamental.top1)} %</td>
                      <td className="py-2 text-right font-mono">{fr(e.marketClosing.top1)} %</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="mt-2 text-xs">Part des courses où le cheval jugé le plus probable a gagné.</p>
            </div>
            <p>
              Conclusion honnête : l&apos;IA lit vraiment la forme, mais elle trouve moins de gagnants que le marché. Son
              intérêt est d&apos;être <strong className="text-fg">indépendante</strong> : quand elle contredit le marché, le
              site le signale — et mesure si ce désaccord a de la valeur.
            </p>
          </Section>

          <Section title="2. La probabilité retenue et le classement">
            <p>
              Le classement de la page course suit une probabilité unique : le marché, corrigé à {Math.round(MODEL_WEIGHT * 100)} %
              par l&apos;IA (mélange log-linéaire p ∝ marché<sup>{1 - MODEL_WEIGHT}</sup> × IA<sup>{MODEL_WEIGHT}</sup>). Les
              probabilités Top 3 et Top 5 en sont tirées par simulation Plackett-Luce (20 000 arrivées simulées par course).
            </p>
            <p>
              Le poids de {Math.round(MODEL_WEIGHT * 100)} % est un compromis mesuré : contre les cotes de départ, l&apos;IA
              n&apos;améliore pas le marché ; contre des cotes de plusieurs heures, elle l&apos;améliore. La sélection publiée
              compte huit chevaux ; son Top 3 est simplement les trois premiers.
            </p>
          </Section>

          <Section title="3. Les profils des chevaux">
            <p>Chaque partant reçoit un seul profil, évalué dans cet ordre. Le premier qui s&apos;applique l&apos;emporte.</p>
            <ol className="space-y-2">
              {PROFILE_RULES.map(({ profile, rule }, i) => (
                <li key={profile} className="flex gap-3 rounded-xl border border-border bg-surface-sub p-3">
                  <span className="font-mono text-xs font-bold text-muted">{i + 1}</span>
                  <div>
                    <ProfileBadge profile={profile} />
                    <p className="mt-1 text-sm text-fg">{rule}</p>
                  </div>
                </li>
              ))}
            </ol>
            <p>
              Ces seuils sont des points de départ. Le suivi de performance publie le rendement de chacun — y compris
              lorsqu&apos;il est négatif — et toute modification change la version ({PROFILES_VERSION}).
              Le bandeau, les badges, la fiche cheval et le suivi lisent tous cette même classification.
            </p>
          </Section>

          <Section title="4. La lecture de la course">
            <ul className="space-y-2">
              {(Object.keys(READING_LABELS) as RaceReading[]).map((r) => (
                <li key={r}>
                  <strong className="text-fg">{READING_LABELS[r]}</strong> — {READING_RULES[r]}
                </li>
              ))}
            </ul>
            <p>Aucun pourcentage de « confiance » n&apos;est affiché : aucune mesure ne permettrait de le justifier.</p>
          </Section>

          <Section title="5. Mouvement des cotes (MVT) et parts des mises">
            <p>
              <strong className="text-fg">MVT</strong> : variation de la cote depuis le premier relevé du jour de la
              course. Sous ±{MVT_NOISE_PCT} %, nous parlons de stabilité. Une cote qui baisse signifie que le cheval est
              joué.
            </p>
            <p>
              <strong className="text-fg">Parts des mises</strong> : part du cheval dans le pool simple gagnant du PMU,
              et sa variation sur {FLOW_WINDOW_MIN} minutes ({FLOW_ACCEL_WINDOW_MIN} minutes pour l&apos;accélération).
              La tuile « Argent fort » s&apos;allume à +{STRONG_MONEY_PTS} points en {FLOW_WINDOW_MIN} minutes. Le PMU ne publie pas
              les mises individuelles : nous mesurons une part des enjeux, jamais « l&apos;argent des initiés ».
            </p>
            <p>
              <strong className="text-fg">Confrontation IA × marché</strong> : seuls les chevaux à au moins{" "}
              {CONFRONT_MIN_PCT} % pour l&apos;IA ou pour le marché sont classés. <em>Accord IA + marché</em> : écart de{" "}
              {ACCORD_MAX_GAP_PTS} points au plus, ou rapport IA ÷ marché entre {String(ACCORD_RATIO_MIN).replace(".", ",")} et{" "}
              {String(ACCORD_RATIO_MAX).replace(".", ",")}. Au-delà, le cheval est <em>favori IA</em> si l&apos;IA l&apos;estime plus
              haut que le marché, <em>favori marché</em> dans le cas inverse.
            </p>
            <p>
              <strong className="text-fg">Signaux d&apos;argent</strong> : <em>argent entrant</em> à +{STRONG_MONEY_PTS} points de
              part des mises en {FLOW_WINDOW_MIN} minutes ; <em>accélération</em> à +{FLOW_ACCEL_PTS} point en{" "}
              {FLOW_ACCEL_WINDOW_MIN} minutes, plus vite que sur les 10 minutes précédentes ; <em>smart money</em> quand
              l&apos;argent entre ou accélère, que la cote baisse et que l&apos;IA — qui ne voit jamais la cote — est
              favorable ou d&apos;accord. C&apos;est un argent que notre modèle indépendant confirme, pas une information sur
              ceux qui misent. Le rendement de chaque famille et de chaque signal est mesuré et publié sur le suivi de
              performance.
            </p>
          </Section>

          <Section title="6. Fraîcheur, pronostics gelés et suivi">
            <p>
              Les cotes des courses imminentes sont relues toutes les 15 minutes au-delà d&apos;une heure du départ, toutes
              les 4 minutes jusqu&apos;à H-15, puis chaque minute. Chaque page affiche l&apos;âge de la cote. Le pari mutuel
              ne fixe la cote qu&apos;après le départ : aucune cote affichée n&apos;est définitive.
            </p>
            <p>
              Le pronostic affiché est gelé à H-60, H-15 et juste avant le départ, avec la version du modèle. Le suivi de
              performance se calcule sur ces pronostics gelés et sur les rapports officiels du PMU — jamais sur un
              pronostic recalculé après l&apos;arrivée.
            </p>
          </Section>

          <Section title="7. Ce que nous ne faisons pas">
            <ul className="list-disc space-y-1 pl-5">
              <li>Aucune promesse de gain. Un rendement est toujours donné avec sa période, son nombre de paris et sa marge d&apos;erreur.</li>
              <li>Aucune autre source que le PMU : Betfair n&apos;est pas agréé par l&apos;ANJ, et les opérateurs n&apos;ouvrent pas de flux de données.</li>
              <li>Aucun « {PROFILE_LABELS.cache.toLowerCase()} » ou « value » présenté comme un pari gagnant : ce sont des désaccords entre l&apos;IA et le marché, dont nous mesurons la valeur.</li>
            </ul>
          </Section>
        </div>
      </div>
    </main>
  );
}
