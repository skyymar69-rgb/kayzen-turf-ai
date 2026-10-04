"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { BellOff, History } from "lucide-react";
import { EmptyState } from "@/components/ui-kit";

type Item = { kind: string; sentAt: string; raceId: string; horse: string | null; code: string | null; startTime: string; raceDate: string };
type State = { status: "loading" } | { status: "none" } | { status: "error" } | { status: "ready"; items: Item[] };

const KIND_LABELS: Record<string, string> = {
  depart: "Départ imminent",
  "non-partant": "Non-partant",
  "smart-money": "Smart money",
  delaisse: "Délaissé",
  arrivee: "Arrivée",
};

const dateFmt = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Paris" });

async function loadHistory(): Promise<State> {
  if (!("serviceWorker" in navigator)) return { status: "none" };
  const registration = await navigator.serviceWorker.getRegistration("/");
  const subscription = await registration?.pushManager?.getSubscription();
  if (!subscription) return { status: "none" };
  const response = await fetch("/api/push/historique", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ endpoint: subscription.endpoint }),
  });
  if (!response.ok) return { status: "error" };
  const data = (await response.json()) as { items: Item[] };
  return { status: "ready", items: data.items };
}

/** Historique des alertes de ce navigateur, lu via son abonnement push. */
export function AlertHistory() {
  const [state, setState] = useState<State>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    loadHistory()
      .catch((): State => ({ status: "error" }))
      .then((next) => {
        if (!cancelled) setState(next);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (state.status === "loading") return <div aria-busy="true" className="kz-skeleton h-32 w-full" />;
  if (state.status === "none") {
    return (
      <EmptyState
        action={
          <Link className="rounded-xl bg-accent px-4 py-2.5 text-sm font-bold text-accent-fg hover:bg-accent-hi" href="/">
            Voir le programme
          </Link>
        }
        icon={BellOff}
        title="Les alertes ne sont pas activées sur cet appareil."
      >
        Suivez un cheval depuis sa fiche (étoile), puis activez les alertes : vous serez prévenu de son départ, d&apos;un
        mouvement de marché et de l&apos;arrivée.
      </EmptyState>
    );
  }
  if (state.status === "error") {
    return <EmptyState icon={History} title="Historique momentanément indisponible.">Réessayez dans quelques minutes.</EmptyState>;
  }
  if (state.items.length === 0) {
    return <EmptyState icon={History} title="Aucune alerte reçue pour l'instant.">Elles apparaîtront ici dès le premier envoi.</EmptyState>;
  }
  return (
    <ol className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface">
      {state.items.map((item) => (
        <li key={`${item.kind}-${item.raceId}-${item.sentAt}-${item.horse}`} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3">
          <span className="rounded-full bg-accent-lo px-2 py-0.5 text-[11px] font-bold text-accent-text">{KIND_LABELS[item.kind] ?? item.kind}</span>
          <span className="font-semibold text-fg">{item.horse ?? "Cheval"}</span>
          <Link className="text-sm text-muted underline-offset-2 hover:text-accent-text hover:underline" href={`/races/${encodeURIComponent(item.raceId)}`}>
            {item.code ?? "Course"} · {item.startTime}
          </Link>
          <time className="ml-auto text-xs text-muted" dateTime={item.sentAt}>
            {dateFmt.format(new Date(item.sentAt))}
          </time>
        </li>
      ))}
    </ol>
  );
}
