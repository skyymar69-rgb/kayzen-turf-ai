import { History } from "lucide-react";
import { Card, Eyebrow, ProfileBadge, pct, signedPct, signedPts } from "@/components/course/shared";
import { formatOdds } from "@/lib/format";
import { diffFrozen, pickComparedStages, type FrozenDiff, type FrozenStage, type HorseChange } from "@/lib/frozen-diff";

/**
 * « CE QUE L'IA A CHANGÉ ENTRE H-60 ET LE DÉPART » — compare le premier et le
 * dernier pronostic gelés d'une course (lib/frozen-diff). Les données arrivent
 * en props (`getFrozenPredictions`) : le composant ne lit rien lui-même.
 */

export type FrozenDiffPanelProps = {
  /** Pronostics gelés de la course, dans n'importe quel ordre. */
  stages: FrozenStage[];
  /** Nom de chaque cheval par numéro, pour l'affichage. Optionnel. */
  horseNames?: Record<number, string>;
  /** Nombre de lignes du tableau des écarts (les plus marquants d'abord). Défaut : 8. */
  maxRows?: number;
};

const timeFmt = new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Paris" });
const stageLabel = (stage: string) => (stage === "H-2" ? "le départ" : stage);
/** « aucun cheval n'a », « 1 cheval a », « 3 chevaux ont » — accord du verbe compris. */
const counted = (n: number, none: string, one: string, many: string, rest: string) =>
  n === 0 ? `${none} n'a ${rest}` : n === 1 ? `1 ${one} a ${rest}` : `${n} ${many} ont ${rest}`;

/** Les chevaux dont quelque chose a bougé, les écarts les plus nets en tête. */
function notable(diff: FrozenDiff, max: number): HorseChange[] {
  const weight = (h: HorseChange) =>
    (h.status !== "present" ? 100 : 0) +
    (h.profileChanged ? 50 : 0) +
    Math.abs(h.rankDelta ?? 0) * 10 +
    Math.abs(h.oddsChangePct ?? 0) / 10;
  return diff.horses.filter((h) => weight(h) > 0).sort((a, b) => weight(b) - weight(a)).slice(0, max);
}

function Summary({ diff, name }: { diff: FrozenDiff; name: (n: number | null) => string }) {
  const items = [
    diff.topPickChanged
      ? `Le n° 1 du classement a changé : ${name(diff.topPickBefore)} → ${name(diff.topPickAfter)}.`
      : `Le n° 1 du classement est resté ${name(diff.topPickAfter)}.`,
    `${counted(diff.rankChanges.length, "Aucun cheval", "cheval", "chevaux", "changé de rang")} ; ${counted(diff.profileChanges.length, "aucun profil", "profil", "profils", "changé")}.`,
    `${counted(diff.oddsMoves.length, "Aucune cote", "cote", "cotes", "bougé d'au moins 10 % entre les deux gels")}.`,
    diff.scratched.length > 0 ? `Non-partant${diff.scratched.length > 1 ? "s" : ""} entre-temps : ${diff.scratched.map((n) => `n° ${n}`).join(", ")}.` : null,
  ].filter(Boolean);
  return (
    <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-fg">
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
}

function RankCell({ h }: { h: HorseChange }) {
  if (h.status === "retire") return <span className="text-danger">retiré (était {h.rankBefore}ᵉ)</span>;
  if (h.status === "ajoute") return <span>{h.rankAfter}ᵉ (absent avant)</span>;
  const delta = h.rankDelta ?? 0;
  return (
    <span>
      {h.rankBefore}ᵉ → {h.rankAfter}ᵉ{" "}
      {delta !== 0 && (
        <span className={delta > 0 ? "text-accent-text" : "text-danger"}>
          ({delta > 0 ? `+${delta}` : `−${Math.abs(delta)}`})
        </span>
      )}
    </span>
  );
}

export function FrozenDiffPanel({ stages, horseNames = {}, maxRows = 8 }: FrozenDiffPanelProps) {
  const pair = pickComparedStages(stages);
  const name = (n: number | null) => (n === null ? "—" : horseNames[n] ? `n° ${n} ${horseNames[n]}` : `n° ${n}`);

  if (!pair) {
    return (
      <Card className="p-5">
        <Eyebrow>Pronostics gelés</Eyebrow>
        <p className="mt-2 text-sm text-muted">
          {stages.length === 0
            ? "Aucun pronostic gelé pour cette course : la comparaison H-60 / départ apparaîtra une fois les gels enregistrés."
            : `Un seul pronostic gelé (${stages[0].stage}) : il en faut deux pour mesurer ce que l'IA a changé.`}
        </p>
      </Card>
    );
  }

  const diff = diffFrozen(pair.from, pair.to);
  const rows = notable(diff, maxRows);
  const title = `Ce que l'IA a changé entre ${pair.from.stage} et ${stageLabel(pair.to.stage)}`;

  return (
    <Card className="p-5">
      <div className="flex items-center gap-2">
        <History aria-hidden="true" className="text-accent-text" size={16} />
        <Eyebrow>Pronostics gelés</Eyebrow>
      </div>
      <h2 className="mt-1 font-display text-lg font-bold text-fg">{title}</h2>
      <p className="mt-1 text-xs text-muted">
        Gel {diff.from.stage} à {timeFmt.format(new Date(diff.from.capturedAt))} (départ dans {diff.from.minutesToStart} min), gel{" "}
        {diff.to.stage} à {timeFmt.format(new Date(diff.to.capturedAt))} (départ dans {diff.to.minutesToStart} min). Les deux
        pronostics sont conservés tels que publiés, sans recalcul.
      </p>
      <Summary diff={diff} name={name} />

      {rows.length > 0 && (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[560px] text-left text-sm">
            <caption className="sr-only">{title} : rang, profil, cote et probabilité de victoire de chaque cheval aux deux gels</caption>
            <thead>
              <tr className="border-b border-border text-[10px] font-bold uppercase tracking-widest text-muted">
                <th className="py-2 pr-3" scope="col">Cheval</th>
                <th className="py-2 pr-3" scope="col">Rang</th>
                <th className="py-2 pr-3" scope="col">Profil</th>
                <th className="py-2 pr-3 text-right" scope="col">Cote</th>
                <th className="py-2 text-right" scope="col">Victoire</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((h) => (
                <tr key={h.number}>
                  <th className="py-2 pr-3 font-semibold text-fg" scope="row">{name(h.number)}</th>
                  <td className="py-2 pr-3 font-mono text-xs"><RankCell h={h} /></td>
                  <td className="py-2 pr-3">
                    {h.profileChanged && h.profileBefore && h.profileAfter ? (
                      <span className="inline-flex flex-wrap items-center gap-1">
                        <ProfileBadge profile={h.profileBefore} /> <span aria-label="devient">→</span> <ProfileBadge profile={h.profileAfter} />
                      </span>
                    ) : h.profileAfter || h.profileBefore ? (
                      <ProfileBadge profile={(h.profileAfter ?? h.profileBefore)!} />
                    ) : (
                      <span className="text-muted">—</span>
                    )}
                  </td>
                  <td className="py-2 pr-3 text-right font-mono text-xs">
                    {formatOdds(h.oddsBefore)} → {formatOdds(h.oddsAfter)}
                    {h.oddsChangePct !== null && <span className="block text-muted">{signedPct(h.oddsChangePct)}</span>}
                  </td>
                  <td className="py-2 text-right font-mono text-xs">
                    {pct(h.winBefore, 1)} → {pct(h.winAfter, 1)}
                    {h.winDeltaPts !== null && <span className="block text-muted">{signedPts(h.winDeltaPts)}</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="mt-3 text-xs text-muted">
        Une cote qui baisse signifie que le cheval est davantage joué ; sous ±10 %, le mouvement est tenu pour du bruit. Ces
        changements décrivent le pronostic, ils ne garantissent aucun résultat.
      </p>
    </Card>
  );
}
