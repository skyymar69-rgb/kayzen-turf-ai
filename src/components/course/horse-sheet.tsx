"use client";

import { useMemo } from "react";
import { Star, ThumbsDown, ThumbsUp } from "lucide-react";
import { useFollowedHorses } from "@/hooks/use-followed-horses";
import type { HorseRow } from "@/lib/course-view-model";
import type { FeatureName } from "@/lib/fundamental/features";
import { fundamentalContributions, type Contribution } from "@/lib/fundamental/model";
import { formatOdds } from "@/lib/format";
import { PROFILE_RULES } from "@/lib/profiles";
import type { RaceAnalysis } from "@/lib/types";
import { Card, Eyebrow, ProfileBadge, pct, signedPts } from "@/components/course/shared";

/**
 * FICHE CHEVAL — « pourquoi l'IA l'aime, ou pas ».
 *
 * Les points forts et points faibles ne sont pas des étiquettes génériques : ce
 * sont les contributions réelles de chaque variable au score du cheval dans le
 * modèle fondamental, mesurées par rapport à la moyenne du peloton. Leur somme
 * est exactement l'écart qui sépare ce cheval de ses adversaires.
 */

function describe(c: Contribution): string {
  const v = c.value;
  const n = (x: number) => x.toFixed(1).replace(".", ",");
  const values: Partial<Record<FeatureName, string>> = {
    formAvg: `place moyenne pondérée ${n(v)}`,
    lastRace: v >= 10 ? "non placé ou incident" : `${Math.round(v)}${v === 1 ? "re" : "e"}`,
    winsLast5: `${v} victoire${v > 1 ? "s" : ""}`,
    placesLast5: `${v} podium${v > 1 ? "s" : ""}`,
    incidentsLast5: `${v} incident${v > 1 ? "s" : ""}`,
    experience: `${v} course${v > 1 ? "s" : ""} lue${v > 1 ? "s" : ""}`,
    noMusic: v ? "aucune course connue" : "courses connues",
    earningsRel: v >= 0 ? "au-dessus du peloton" : "sous le peloton",
    age: `${v} ans`,
    female: v ? "oui" : "non",
    male: v ? "oui" : "non",
    blinkers: v ? "oui" : "non",
    jockeyRate: `${Math.round(v * 100)} % estimés`,
    trainerRate: `${Math.round(v * 100)} % estimés`,
    recul: v ? `${Math.round(v * 25)} m` : "aucun",
    drawRel: v <= 0.33 ? "petit numéro" : v >= 0.66 ? "grand numéro" : "numéro médian",
  };
  return values[c.feature] ?? n(v);
}

export function HorseSheet({ race, row }: { race: RaceAnalysis; row: HorseRow | null }) {
  const contributions = useMemo(() => fundamentalContributions(race.horses, race.discipline), [race.horses, race.discipline]);
  const { followed, toggle } = useFollowedHorses();

  if (!row) return null;
  const index = race.horses.findIndex((h) => h.number === row.horse.number);
  const mine = (contributions?.[index] ?? []).filter((c) => Math.abs(c.contribution) >= 0.01);
  const sorted = [...mine].sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution));
  const strengths = sorted.filter((c) => c.contribution > 0).slice(0, 3);
  const weaknesses = sorted.filter((c) => c.contribution < 0).slice(0, 3);
  const maxAbs = Math.max(0.01, ...sorted.map((c) => Math.abs(c.contribution)));
  const rule = PROFILE_RULES.find((r) => r.profile === row.profile)?.rule;

  return (
    <Card className="mt-4 p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Eyebrow>Fiche cheval · {row.rank}{row.rank === 1 ? "er" : "e"} du classement</Eyebrow>
          <h2 className="mt-1 flex flex-wrap items-center gap-2 font-display text-xl font-bold text-fg">
            <span className="font-mono">{row.horse.number}</span> {row.horse.horse}
            <ProfileBadge profile={row.profile} />
          </h2>
          <p className="mt-1 text-sm text-muted">
            {row.horse.jockey} · {row.horse.trainer} · cote {formatOdds(row.horse.odds, 1)}
          </p>
          {row.horse.horseId && (
            <button
              className="mt-2 inline-flex min-h-8 items-center gap-1.5 rounded-lg border border-border bg-surface-sub px-2.5 text-xs font-semibold text-fg transition hover:border-accent"
              onClick={() => toggle({ id: row.horse.horseId!, name: row.horse.horse })}
              type="button"
            >
              <Star aria-hidden="true" className={followed.has(row.horse.horseId) ? "fill-amber-500 text-amber-700 dark:fill-amber-400 dark:text-amber-400" : "text-muted"} size={13} />
              {followed.has(row.horse.horseId) ? "Cheval suivi" : "Suivre ce cheval"}
            </button>
          )}
          {rule && <p className="mt-2 max-w-xl text-xs leading-5 text-muted">Profil attribué parce que : {rule.charAt(0).toLowerCase() + rule.slice(1)}</p>}
        </div>

        {/* Jauge IA contre marché, sur la même échelle */}
        <div className="w-full max-w-xs space-y-2">
          {[
            { label: "IA (sans cote)", value: row.ai, cls: "bg-accent" },
            { label: "Marché", value: row.market, cls: "bg-surface-inv" },
          ].map((g) => (
            <div key={g.label}>
              <div className="flex justify-between text-xs">
                <span className="font-semibold text-fg">{g.label}</span>
                <span className="font-mono font-bold text-fg">{pct(g.value, 1)}</span>
              </div>
              <div className="mt-1 h-2 overflow-hidden rounded-full bg-surface-sub">
                <div className={`h-full rounded-full ${g.cls}`} style={{ width: `${Math.min(100, Math.max(2, (g.value ?? 0) * 2)).toFixed(2)}%` }} />
              </div>
            </div>
          ))}
          <p className="text-xs text-muted">
            Écart <span className="font-bold text-fg">{signedPts(row.gap)}</span>
            {row.ratio !== null && <> · l&apos;IA lui donne {row.ratio.toFixed(2).replace(".", ",")} fois la probabilité du marché</>}
          </p>
        </div>
      </div>

      {sorted.length === 0 ? (
        <p className="mt-5 text-sm text-muted">Le modèle fondamental n&apos;est pas disponible pour cette discipline.</p>
      ) : (
        <>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-border bg-surface-sub p-4">
              <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-accent-text">
                <ThumbsUp aria-hidden="true" size={14} /> Pourquoi l&apos;IA l&apos;aime
              </p>
              <ul className="mt-2 space-y-1.5 text-sm text-fg">
                {strengths.length ? strengths.map((c) => <li key={c.feature}>{c.label} : {describe(c)}</li>) : <li className="text-muted">Aucun point au-dessus du peloton.</li>}
              </ul>
            </div>
            <div className="rounded-xl border border-border bg-surface-sub p-4">
              <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-danger">
                <ThumbsDown aria-hidden="true" size={14} /> Points à surveiller
              </p>
              <ul className="mt-2 space-y-1.5 text-sm text-fg">
                {weaknesses.length ? weaknesses.map((c) => <li key={c.feature}>{c.label} : {describe(c)}</li>) : <li className="text-muted">Aucun point sous le peloton.</li>}
              </ul>
            </div>
          </div>

          <details className="mt-4">
            <summary className="cursor-pointer text-sm font-semibold text-accent-text">Contribution de chaque facteur</summary>
            <ul className="mt-3 space-y-1.5">
              {sorted.map((c) => (
                <li key={c.feature} className="grid grid-cols-[minmax(0,180px)_1fr_56px] items-center gap-3 text-xs">
                  <span className="truncate text-muted" title={c.label}>{c.label}</span>
                  <span className="relative h-2 rounded-full bg-surface-sub">
                    <span
                      className={`absolute top-0 h-2 rounded-full ${c.contribution >= 0 ? "left-1/2 bg-accent" : "right-1/2 bg-danger"}`}
                      style={{ width: `${((Math.abs(c.contribution) / maxAbs) * 50).toFixed(2)}%` }}
                    />
                  </span>
                  <span className={`text-right font-mono font-bold ${c.contribution >= 0 ? "text-accent-text" : "text-danger"}`}>
                    {c.contribution >= 0 ? "+" : "−"}{Math.abs(c.contribution).toFixed(2).replace(".", ",")}
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-[11px] leading-5 text-muted">
              Contributions au score du modèle (échelle logit), par rapport à la moyenne du peloton. Leur somme est
              exactement l&apos;avance ou le retard du cheval sur ses adversaires selon l&apos;IA.
            </p>
          </details>
        </>
      )}
    </Card>
  );
}
