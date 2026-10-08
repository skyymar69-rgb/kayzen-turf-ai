"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, Check, Copy, Share2 } from "lucide-react";
import { useClipboard, type EtatCopie } from "@/hooks/use-clipboard";
import { buildBetRecommendations, type XTicket } from "@/lib/bet-recommendations";
import { formatEuros } from "@/lib/format";
import { pmuTicketText } from "@/lib/ticket-format";
import type { BetOffer } from "@/lib/types";

/**
 * Outils de tickets de la page course, hors du chemin de décision : tickets par
 * stratégie, notation en X, générateur sur budget, jeux disponibles, partage.
 * Déplacés tels quels de l'ancien composant de 1 693 lignes.
 */

type TicketMode = "agressif" | "equilibre" | "securise";

const RETURN_EXPLANATION =
  "Retour estimé pour 1 € misé : probabilité du ticket selon nos calculs × rapport estimé, (1 − prélèvement PMU) ÷ probabilité que lui prête le public. Hypothèse non vérifiée sur les rapports réels.";

/** « ×0,82 » — retour estimé pour 1 € misé. */
export function formatReturn(value: number): string {
  return `×${value.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/**
 * Retour estimé d'un ticket. Sous 1, il est dit « en dessous de la mise »
 * plutôt que caché : c'est le cas normal au pari mutuel, prélèvement oblige.
 */
function ReturnBadge({ value }: { value: number | null | undefined }) {
  if (value == null) {
    return <span className="text-muted" title="Pas de cote publiée, ou combinaison trop rare pour estimer son rapport.">Retour non estimé</span>;
  }
  const below = value < 1;
  return (
    <span className={`font-bold ${below ? "text-warn" : "text-accent-text"}`} title={RETURN_EXPLANATION}>
      Retour estimé {formatReturn(value)}
      {below ? " · en dessous de la mise" : " · théorique"}
    </span>
  );
}

const BET_COLORS: Record<string, string> = {
  SIMPLE_GAGNANT:  "bg-cyan-700",
  SIMPLE_PLACE:    "bg-cyan-700",
  COUPLE_GAGNANT:  "bg-orange-700",
  COUPLE_PLACE:    "bg-orange-700",
  COUPLE_ORDRE:    "bg-orange-700",
  DEUX_SUR_QUATRE: "bg-purple-700",
  TRIO:            "bg-amber-700",
  TRIO_ORDRE:      "bg-amber-700",
  MULTI:           "bg-pink-700",
  SUPER_QUATRE:    "bg-slate-600",
  QUARTE_PLUS:     "bg-sky-700",
  QUINTE_PLUS:     "bg-red-700",
  PICK5:           "bg-lime-700",
};

function TicketCombinationsPanel({ recommendations }: { recommendations: ReturnType<typeof buildBetRecommendations> }) {
  if (!recommendations.length) return null;
  return (
    // Fermé par défaut : cette grille proposait jusqu'à 5 chevaux différents en
    // Simple Gagnant, ce qui contredisait le ticket recommandé de la sélection.
    <details className="mt-4 rounded-2xl border border-border bg-surface">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-5">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-muted">Jeux disponibles</p>
          <p className="mt-0.5 text-sm font-medium text-fg">Top 5 tickets par pari — priorisés par confiance IA</p>
        </div>
        <span className="shrink-0 rounded-full border border-border bg-surface-sub px-3 py-1 text-xs font-bold text-muted">Voir →</span>
      </summary>
      <div className="grid gap-3 p-5 pt-0 xl:grid-cols-2">
        {recommendations.map((r) => (
          <article key={`variants-${r.type}`} className="rounded-xl border border-border bg-surface-sub p-3">
            <div className="flex items-center justify-between gap-3">
              <p className="font-semibold text-fg">{r.label}</p>
              <span className="rounded-full bg-accent-lo px-2 py-0.5 text-xs font-bold text-accent-text">{r.confidence}/99</span>
            </div>
            <TicketVariantCloud recommendation={r} />
          </article>
        ))}
      </div>
    </details>
  );
}

const MAX_VARIANTS_SHOWN = 5;

function TicketVariantCloud({ recommendation }: { recommendation: ReturnType<typeof buildBetRecommendations>[number] }) {
  const shown = recommendation.variants.slice(0, MAX_VARIANTS_SHOWN);
  const hidden = recommendation.variantCount - shown.length;
  return (
    <div className="mt-3 flex flex-wrap gap-1.5">
      {shown.map((v) => (
        <span
          key={`${recommendation.type}-${v.ticket}`}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-2 py-1 font-mono text-xs font-bold text-fg"
          title={`${v.confidence}/99 — ${v.rationale}${v.expectedReturn != null ? ` Retour estimé ${formatReturn(v.expectedReturn)} pour 1 €.` : ""}`}
        >
          {v.ticket}
          <span className="font-sans text-[10px] font-semibold text-accent-text">{v.confidence}</span>
          {v.expectedReturn != null && (
            <span className={`font-sans text-[10px] font-semibold ${v.expectedReturn < 1 ? "text-warn" : "text-accent-text"}`}>{formatReturn(v.expectedReturn)}</span>
          )}
        </span>
      ))}
      {hidden > 0 && (
        <span className="inline-flex items-center rounded-lg border border-border bg-surface-sub px-2 py-1 text-xs text-muted">
          +{hidden} autres
        </span>
      )}
    </div>
  );
}

function XTicketsSection({ xTickets }: { xTickets: XTicket[] }) {
  const byType = useMemo(() => {
    const map = new Map<string, XTicket[]>();
    for (const t of xTickets) {
      const arr = map.get(t.betType) ?? [];
      arr.push(t);
      map.set(t.betType, arr);
    }
    return Array.from(map.entries());
  }, [xTickets]);

  return (
    // Fermé par défaut : les tickets en X sont un outil de construction avancée,
    // pas une étape de la décision rapide.
    <details className="overflow-hidden rounded-2xl border border-border bg-surface">
      <summary className="flex cursor-pointer list-none items-center justify-between p-5">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted">Notation X</p>
          <p className="mt-0.5 text-base font-bold text-fg">Tickets en X — bases fixes + champ variable</p>
        </div>
        <span className="shrink-0 rounded-full border border-border bg-surface-sub px-3 py-1 text-xs font-bold text-muted">Voir →</span>
      </summary>
      <div className="px-5 pb-5">
        <p className="mb-4 rounded-xl border border-border bg-surface-sub px-4 py-3 text-xs leading-5 text-muted">
          <strong className="text-fg">Base</strong> = cheval sélectionné fixe ·{" "}
          <strong className="text-fg">X</strong> = n’importe quel cheval du champ ·{" "}
          Le coût estimé correspond au nombre de combinaisons × mise de base PMU. Le retour estimé n&apos;est calculé que pour les tickets à une seule combinaison.
        </p>
        <div className="grid gap-5">
          {byType.map(([betType, tickets]) => (
            <div key={betType}>
              <p className="mb-2 text-xs font-bold uppercase tracking-widest text-accent-text">
                {betTypeLabel(betType)}
              </p>
              <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                {tickets.map((t) => (
                  <XTicketCard key={`${t.betType}-${t.ticket}`} ticket={t} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </details>
  );
}

function XTicketCard({ ticket: t }: { ticket: XTicket }) {
  const { etat, copier } = useClipboard();

  const confColor = t.confidence >= 65 ? "text-accent-text" : t.confidence >= 45 ? "text-warn" : "text-muted";

  return (
    <div className="rounded-xl border border-border bg-surface-sub p-3">
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-semibold text-fg">{t.label}</p>
        <BoutonCopier etat={etat} onCopier={() => copier(t.ticket)} taille={11} />
      </div>
      <p className="mt-2 font-mono text-xl font-bold text-accent-text">{t.ticket}</p>
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-muted">
        <span>{t.combinations} combinaison{t.combinations > 1 ? "s" : ""}</span>
        <span>·</span>
        <span>~{formatEuros(t.costEuros)}</span>
        <span>·</span>
        <span className={`font-bold ${confColor}`}>Conf. {t.confidence}/99</span>
        {t.combinations === 1 && (
          <>
            <span>·</span>
            <ReturnBadge value={t.expectedReturn} />
          </>
        )}
      </div>
    </div>
  );
}

function TicketCard({ label, ticket, confidence, strategy, expectedReturn }: {
  label: string; ticket: string; confidence: number; strategy: string; expectedReturn?: number | null;
}) {
  const { etat, copier } = useClipboard();

  const confColor = confidence >= 65 ? "text-accent-text" : confidence >= 45 ? "text-warn" : "text-muted";

  return (
    <div className="rounded-xl border border-border bg-surface-sub p-3">
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-semibold text-fg">{label}</p>
        <BoutonCopier etat={etat} onCopier={() => copier(pmuTicketText(label, ticket))} taille={11} />
      </div>
      <p className="mt-1 font-mono text-base font-bold text-accent-text">{ticket}</p>
      <p className="mt-1 text-[10px] text-muted">
        <span className={`font-bold ${confColor}`}>Conf. {confidence}/99</span>
        {" · "}{strategy}
      </p>
      <p className="mt-1 text-[10px]">
        <ReturnBadge value={expectedReturn} />
      </p>
    </div>
  );
}

export function ShareButton({ programCode, name }: { programCode: string; name: string }) {
  const { etat, copier } = useClipboard();

  async function handleShare() {
    const text = `${programCode} — ${name} | Pronostics Kayzen Turf`;
    const url = window.location.href;

    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ title: text, url });
        return;
      } catch (cause) {
        // `AbortError` = l'utilisateur a fermé la feuille de partage. Retomber
        // sur la copie dans ce cas reviendrait à agir contre son choix.
        if (cause instanceof DOMException && cause.name === "AbortError") return;
      }
    }

    await copier(`${text}\n${url}`);
  }

  return (
    <button
      aria-label="Partager cette course"
      className="flex min-h-9 items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-1.5 text-xs font-semibold text-muted transition hover:text-accent-text"
      onClick={handleShare}
      type="button"
    >
      {etat === "copie" ? (
        <Check aria-hidden="true" className="text-accent-text" size={13} />
      ) : etat === "echec" ? (
        <AlertTriangle aria-hidden="true" className="text-danger" size={13} />
      ) : (
        <Share2 aria-hidden="true" size={13} />
      )}
      {etat === "copie" ? "Lien copié" : etat === "echec" ? "Échec" : "Partager"}
      <span className="sr-only" role="status">
        {etat === "copie" ? "Lien de la course copié" : etat === "echec" ? "Partage impossible" : ""}
      </span>
    </button>
  );
}

function buildTicketPlan(recommendations: ReturnType<typeof buildBetRecommendations>, mode: TicketMode, budget: number) {
  const filtered = recommendations.filter((r) => {
    if (mode === "securise") return r.strategy === "Confiance" || r.strategy === "Couverture";
    if (mode === "agressif") return r.strategy === "Speculatif" || r.strategy === "Value";
    return true;
  });
  const limited = filtered.slice().sort((a, b) => b.confidence - a.confidence).slice(0, mode === "agressif" ? 4 : 3);
  const total   = limited.reduce((s, i) => s + ticketWeight(i.strategy, mode), 0) || 1;
  // Un budget vide, nul ou négatif ramené au minimum : sinon chaque ticket
  // gardait sa mise plancher de 1 € et la somme dépassait le budget saisi.
  budget = Math.min(10_000, Math.max(5, Number.isFinite(budget) ? budget : 5));
  return limited.map((item) => ({ ...item, stake: Math.max(1, Math.round((budget * ticketWeight(item.strategy, mode)) / total)) }));
}

function ticketWeight(strategy: string, mode: TicketMode) {
  if (mode === "securise") return strategy === "Couverture" ? 1.2 : 1;
  if (mode === "agressif") return strategy === "Speculatif" ? 1.4 : 1;
  return strategy === "Value" ? 1.25 : 1;
}

function ticketModeLabel(mode: TicketMode) {
  if (mode === "securise") return "Sécurisé";
  if (mode === "agressif") return "Agressif";
  return "Équilibré";
}

function visibleBetBadges(offers: BetOffer[]) {
  const priority = ["SIMPLE_GAGNANT","COUPLE_GAGNANT","DEUX_SUR_QUATRE","TRIO","MULTI","TIERCE","QUARTE_PLUS","QUINTE_PLUS","PICK5"];
  const byType   = new Map(offers.map((o) => [o.type, o]));
  return priority.flatMap((type) => byType.get(type) ?? []);
}

function shortBetLabel(offer: BetOffer) {
  const labels: Record<string, string> = {
    SIMPLE_GAGNANT: "Simple", SIMPLE_PLACE: "Simple", COUPLE_GAGNANT: "Couplé", COUPLE_PLACE: "Couplé",
    DEUX_SUR_QUATRE: "2 sur 4", TRIO: "Trio", MULTI: "Multi", TIERCE: "Tiercé",
    QUARTE_PLUS: "Quarté+", QUINTE_PLUS: "Quinté+", PICK5: "Pick5",
  };
  return labels[offer.type] ?? offer.label;
}

export function formatLongDate(date: string) {
  return new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(new Date(`${date}T12:00:00`));
}

function formatStrategyLabel(s: string) { if (s === "Speculatif") return "Spéculatif"; return s; }

function betTypeLabel(type: string): string {
  const map: Record<string, string> = {
    TIERCE: "Tiercé", TRIO: "Trio", TRIO_ORDRE: "Trio ordre",
    QUARTE_PLUS: "Quarté+", QUINTE_PLUS: "Quinté+", PICK5: "Pick 5",
    MULTI: "Multi", MINI_MULTI: "Mini-Multi",
  };
  return map[type] ?? type;
}

/**
 * Bouton de copie partagé.
 *
 * L'état d'échec était jusqu'ici invisible : le bouton ne bougeait pas et rien
 * n'était annoncé. `role="status"` porte maintenant le résultat aux lecteurs
 * d'écran, dans les deux cas.
 */
function BoutonCopier({
  className,
  etat,
  onCopier,
  taille,
}: {
  className?: string;
  etat: EtatCopie;
  onCopier: () => void;
  taille: number;
}) {
  return (
    <button
      aria-label="Copier le ticket"
      className={
        className ??
        "shrink-0 rounded-lg border border-border bg-surface px-2 py-0.5 text-[10px] font-bold text-muted transition hover:text-accent-text"
      }
      onClick={onCopier}
      type="button"
    >
      {etat === "copie" ? (
        <Check aria-hidden="true" className="text-accent-text" size={taille} />
      ) : etat === "echec" ? (
        <AlertTriangle aria-hidden="true" className="text-danger" size={taille} />
      ) : (
        <Copy aria-hidden="true" className="text-muted" size={taille} />
      )}
      <span className="sr-only" role="status">
        {etat === "copie" ? "Ticket copié" : etat === "echec" ? "Copie impossible" : ""}
      </span>
    </button>
  );
}

/** Pastilles des paris proposés par le PMU sur la course. */
export function BetBadges({ offers }: { offers: BetOffer[] }) {
  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {visibleBetBadges(offers).map((bet) => (
        <span key={`${bet.type}-${bet.audience ?? "N"}`} className={`rounded-full px-3 py-1 text-xs font-bold text-white ${BET_COLORS[bet.type] ?? "bg-emerald-800"}`}>
          {shortBetLabel(bet)}
        </span>
      ))}
    </div>
  );
}

/** Les outils de tickets, repliés : de la construction avancée, pas de la décision. */
export function TicketTools({
  recommendations,
  xTickets,
}: {
  recommendations: ReturnType<typeof buildBetRecommendations>;
  xTickets: XTicket[];
}) {
  const [ticketBudget, setTicketBudget] = useState(30);
  const [ticketMode, setTicketMode] = useState<TicketMode>("equilibre");
  const ticketPlan = useMemo(() => buildTicketPlan(recommendations, ticketMode, ticketBudget), [recommendations, ticketBudget, ticketMode]);

  return (
    <div className="mt-4 grid gap-3">
      <details className="overflow-hidden rounded-2xl border border-border bg-surface">
        <summary className="flex cursor-pointer list-none items-center justify-between p-5">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted">Tous les paris</p>
            <p className="mt-0.5 text-base font-bold text-fg">Tickets proposés par type de pari</p>
          </div>
          <span className="shrink-0 rounded-full border border-border bg-surface-sub px-3 py-1 text-xs font-bold text-muted">Voir →</span>
        </summary>
        <div className="grid gap-2 px-5 pb-5 sm:grid-cols-2 xl:grid-cols-3">
          {recommendations.map((r) => (
            <TicketCard key={r.type} label={r.label} ticket={r.ticket} confidence={r.confidence} strategy={formatStrategyLabel(r.strategy)} expectedReturn={r.expectedReturn} />
          ))}
        </div>
        <p className="px-5 pb-5 text-[11px] leading-5 text-muted">
          Conf. = probabilité estimée que le ticket passe, en %, selon nos probabilités. Retour estimé = ce que rend en moyenne 1 € misé
          (×0,80 : 80 centimes) ; sous ×1, le ticket rend moins que la mise — c&apos;est le cas normal, le PMU prélevant 15 à 27 % des enjeux.
          Nos probabilités suivant aujourd&apos;hui le marché, aucun ticket n&apos;a d&apos;espérance positive établie.
        </p>
      </details>

      {xTickets.length > 0 && <XTicketsSection xTickets={xTickets} />}

      <details className="overflow-hidden rounded-2xl border border-border bg-surface">
        <summary className="flex cursor-pointer list-none items-center justify-between p-5">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted">Générateur</p>
            <p className="mt-0.5 text-base font-bold text-fg">Tickets sur mesure — budget et stratégie</p>
          </div>
          <span className="shrink-0 rounded-full border border-border bg-surface-sub px-3 py-1 text-xs font-bold text-muted">Personnaliser →</span>
        </summary>
        <div className="px-5 pb-5">
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <div aria-label="Mode de stratégie" className="flex overflow-hidden rounded-xl border border-border bg-surface-sub text-xs font-bold" role="group">
              {(["securise", "equilibre", "agressif"] as TicketMode[]).map((mode) => (
                <button
                  key={mode}
                  aria-pressed={ticketMode === mode}
                  className={`min-h-9 px-4 transition ${ticketMode === mode ? "bg-accent text-accent-fg" : "text-muted hover:bg-surface"}`}
                  onClick={() => setTicketMode(mode)}
                  type="button"
                >
                  {ticketModeLabel(mode)}
                </button>
              ))}
            </div>
            <label className="flex items-center gap-2 text-xs font-bold text-muted">
              Budget €
              <input
                className="h-9 w-24 rounded-xl border border-border bg-surface px-3 text-fg outline-none"
                min={5}
                onChange={(e) => setTicketBudget(Number(e.target.value))}
                step={5}
                type="number"
                value={ticketBudget}
              />
            </label>
          </div>
          <div className="grid gap-2 sm:grid-cols-3">
            {ticketPlan.map((ticket) => (
              <div key={ticket.type} className="rounded-xl border border-border bg-surface-sub p-3">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-xs font-semibold text-fg">{ticket.label}</p>
                  <span className="shrink-0 rounded-full bg-accent-lo px-2 py-0.5 text-xs font-bold text-accent-text">{ticket.stake} €</span>
                </div>
                <p className="mt-2 font-mono text-lg font-bold text-accent-text">{ticket.ticket}</p>
                <p className="mt-1 text-xs leading-5 text-muted">{ticket.rationale}</p>
              </div>
            ))}
            {ticketPlan.length === 0 && <p className="col-span-3 p-4 text-sm text-muted">Aucun ticket disponible pour ce mode.</p>}
          </div>
        </div>
      </details>

      <TicketCombinationsPanel recommendations={recommendations} />
    </div>
  );
}
