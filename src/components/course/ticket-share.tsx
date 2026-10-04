"use client";

import { useState } from "react";
import { AlertTriangle, Check, Copy, Share2 } from "lucide-react";
import { useClipboard } from "@/hooks/use-clipboard";
import type { buildBetRecommendations } from "@/lib/bet-recommendations";
import { normalizeLabel, normalizeTicket, pmuTicketText, ticketImagePath } from "@/lib/ticket-format";

/**
 * COPIER OU PARTAGER UN TICKET — texte au format PMU (« Quinté+ 4-8-2-11-6 »)
 * et image générée par /races/[id]/ticket.
 *
 * Partage : la feuille de partage du téléphone avec l'image quand le
 * navigateur accepte les fichiers, sinon le lien de l'image, sinon son
 * téléchargement. Fermer la feuille de partage n'enchaîne sur rien d'autre.
 */

type Recommendation = ReturnType<typeof buildBetRecommendations>[number];
type ShareState = "repos" | "en-cours" | "partage" | "telecharge" | "echec";

async function shareTicketImage(path: string, text: string, filename: string): Promise<ShareState> {
  const url = new URL(path, window.location.origin).toString();
  try {
    const response = await fetch(url);
    if (!response.ok) return "echec";
    const blob = await response.blob();
    const file = new File([blob], filename, { type: "image/png" });
    if (typeof navigator.share === "function" && navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file], title: text, text });
      return "partage";
    }
    if (typeof navigator.share === "function") {
      await navigator.share({ title: text, text, url });
      return "partage";
    }
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(link.href), 10_000);
    return "telecharge";
  } catch (cause) {
    // `AbortError` : la feuille de partage a été fermée, c'est un choix.
    if (cause instanceof DOMException && cause.name === "AbortError") return "repos";
    return "echec";
  }
}

const SHARE_LABELS: Record<ShareState, string> = {
  repos: "Partager le ticket",
  "en-cours": "Préparation…",
  partage: "Ticket partagé",
  telecharge: "Image téléchargée",
  echec: "Partage impossible",
};

export function TicketShare({ raceId, programCode, recommendations }: { raceId: string; programCode: string; recommendations: Recommendation[] }) {
  const [type, setType] = useState(recommendations[0]?.type ?? "");
  const [share, setShare] = useState<ShareState>("repos");
  const { etat, copier } = useClipboard();
  const current = recommendations.find((r) => r.type === type) ?? recommendations[0];
  if (!current) return null;

  const text = pmuTicketText(current.label, current.ticket);
  const ticket = normalizeTicket(current.ticket);
  const label = normalizeLabel(current.label);
  const shareable = ticket !== null && label !== null;

  async function onShare() {
    if (!ticket || !label) return;
    setShare("en-cours");
    const result = await shareTicketImage(ticketImagePath(raceId, ticket, label), `${programCode} — ${text}`, `ticket-${programCode}-${current.type.toLowerCase()}.png`);
    setShare(result);
    if (result !== "repos") setTimeout(() => setShare("repos"), 2500);
  }

  return (
    <div className="rounded-2xl border border-border bg-surface p-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <label className="flex min-w-0 flex-col gap-1.5 text-[10px] font-bold uppercase tracking-widest text-muted">
          Ticket à copier ou partager
          <select
            className="h-10 max-w-full rounded-xl border border-border bg-surface px-3 text-sm font-semibold normal-case tracking-normal text-fg"
            onChange={(e) => setType(e.target.value)}
            value={current.type}
          >
            {recommendations.map((r) => (
              <option key={r.type} value={r.type}>{r.label}</option>
            ))}
          </select>
        </label>
        <p className="font-mono text-lg font-bold text-accent-text">{text}</p>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-border bg-surface-sub px-3 text-sm font-semibold text-fg transition hover:border-accent"
          onClick={() => copier(text)}
          type="button"
        >
          {etat === "copie" ? <Check aria-hidden="true" className="text-accent-text" size={15} /> : etat === "echec" ? <AlertTriangle aria-hidden="true" className="text-danger" size={15} /> : <Copy aria-hidden="true" size={15} />}
          {etat === "copie" ? "Ticket copié" : etat === "echec" ? "Copie impossible" : "Copier le ticket"}
        </button>
        <button
          className="inline-flex min-h-10 items-center gap-1.5 rounded-xl bg-accent px-3 text-sm font-semibold text-accent-fg transition hover:bg-accent-hi disabled:opacity-50"
          disabled={!shareable || share === "en-cours"}
          onClick={onShare}
          type="button"
        >
          <Share2 aria-hidden="true" size={15} />
          {SHARE_LABELS[share]}
        </button>
        <span className="sr-only" role="status">
          {etat === "copie" ? "Ticket copié" : etat === "echec" ? "Copie impossible" : share !== "repos" && share !== "en-cours" ? SHARE_LABELS[share] : ""}
        </span>
      </div>
      <p className="mt-2 text-[11px] leading-5 text-muted">
        Texte au format du PMU, à reporter sur votre ticket. Conf. {current.confidence}/99 = probabilité estimée que le ticket passe : aucun gain
        n&apos;est garanti.
      </p>
    </div>
  );
}
