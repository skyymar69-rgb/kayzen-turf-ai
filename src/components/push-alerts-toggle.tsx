"use client";

import Link from "next/link";
import { Bell, BellOff } from "lucide-react";
import { usePushAlerts } from "@/hooks/use-push-alerts";

/**
 * Activation des alertes push sur les chevaux suivis : notification 30 min
 * avant le départ et en cas de non-partant. Sans compte ni email.
 */
export function PushAlertsToggle({ horseIds }: { horseIds: string[] }) {
  const { status, error, enable, disable } = usePushAlerts(horseIds);

  let note: React.ReactNode = null;
  if (status === "denied") note = "Notifications bloquées : autorisez-les dans les réglages du site de votre navigateur.";
  else if (status === "ios-install") note = "Sur iPhone et iPad : Partager puis « Sur l'écran d'accueil », ouvrez PronoTurf depuis l'icône, puis activez les alertes.";
  else if (status === "unsupported") note = "Ce navigateur ne gère pas les notifications.";
  else if (status === "on") note = "Alerte 30 min avant le départ et en cas de non-partant, sur cet appareil.";
  else if (status === "off") note = "Une notification 30 min avant le départ et si le cheval est déclaré non-partant. Sans compte ni email.";

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 sm:ml-auto sm:justify-end">
      {(status === "off" || (status === "pending")) && (
        <button
          className="inline-flex items-center gap-1.5 rounded-full bg-accent px-3 py-1.5 text-xs font-semibold text-accent-fg transition hover:bg-accent-hi disabled:opacity-60"
          disabled={status === "pending"}
          onClick={enable}
          type="button"
        >
          <Bell aria-hidden="true" size={14} /> Me prévenir avant le départ
        </button>
      )}
      {status === "on" && (
        <>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-accent-lo px-3 py-1.5 text-xs font-semibold text-accent-text" role="status">
            <Bell aria-hidden="true" size={14} /> Alertes actives
          </span>
          <button
            className="inline-flex items-center gap-1 text-xs text-muted underline-offset-2 hover:underline"
            onClick={disable}
            type="button"
          >
            <BellOff aria-hidden="true" size={12} /> Couper
          </button>
        </>
      )}
      <p className="w-full text-[11px] leading-snug text-muted sm:text-right">
        {error ?? note}{" "}
        {(status === "off" || status === "on") && !error && (
          <Link className="underline underline-offset-2 hover:text-accent-text" href="/confidentialite">
            Données
          </Link>
        )}
      </p>
    </div>
  );
}
