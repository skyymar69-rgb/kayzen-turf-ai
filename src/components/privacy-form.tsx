"use client";

import { useId, useState } from "react";
import type { FormEvent } from "react";
import { AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";
import { COMPANY } from "@/lib/site-config";

/**
 * Formulaire d'exercice des droits RGPD.
 *
 * L'ancienne version n'envoyait rien : elle affichait « Formulaire prêt :
 * branchement email/API à finaliser » et perdait la saisie. Pire, dès que le
 * piège à robots était rempli, elle affichait « Votre demande a été prise en
 * compte » — un message de succès pour une demande jetée. Une demande d'accès
 * ou d'effacement ouvre un délai légal d'un mois (RGPD art. 12.3) : la confirmer
 * à tort prive la personne de son recours.
 *
 * Le formulaire poste maintenant sur /api/privacy-request, qui consigne la
 * demande et renvoie une référence. En cas d'échec, l'écran le dit et donne
 * l'adresse du responsable de traitement.
 */

type Etat =
  | { phase: "repos" }
  | { phase: "envoi" }
  | { phase: "succes"; reference: string }
  | { phase: "echec"; message: string; contact?: string };

const OBJETS = [
  { valeur: "access", libelle: "Droit d'accès" },
  { valeur: "rectification", libelle: "Rectification" },
  { valeur: "erasure", libelle: "Effacement" },
  { valeur: "opposition", libelle: "Opposition" },
  { valeur: "limitation", libelle: "Limitation du traitement" },
  { valeur: "portability", libelle: "Portabilité" },
] as const;

export function PrivacyForm() {
  const [etat, setEtat] = useState<Etat>({ phase: "repos" });
  // `useId` évite les collisions d'identifiants si le formulaire est monté deux
  // fois, et garantit la correspondance label/champ après hydratation.
  const idBase = useId();
  const idEmail = `${idBase}-email`;
  const idObjet = `${idBase}-objet`;
  const idMessage = `${idBase}-message`;
  const idConsent = `${idBase}-consent`;

  async function envoyer(evenement: FormEvent<HTMLFormElement>) {
    evenement.preventDefault();
    if (etat.phase === "envoi") return;

    const formulaire = new FormData(evenement.currentTarget);
    setEtat({ phase: "envoi" });

    try {
      const reponse = await fetch("/api/privacy-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: String(formulaire.get("email") ?? ""),
          requestType: String(formulaire.get("requestType") ?? ""),
          message: String(formulaire.get("message") ?? ""),
          consent: formulaire.get("consent") === "on",
          website: String(formulaire.get("website") ?? ""),
        }),
      });

      const charge = (await reponse.json()) as {
        reference?: string;
        error?: string;
        contact?: string;
        details?: Array<{ champ: string; message: string }>;
      };

      if (!reponse.ok || !charge.reference) {
        setEtat({
          phase: "echec",
          message:
            charge.details?.[0]?.message ??
            charge.error ??
            "L'envoi a échoué. Réessayez dans un instant.",
          contact: charge.contact,
        });
        return;
      }

      setEtat({ phase: "succes", reference: charge.reference });
    } catch {
      setEtat({
        phase: "echec",
        message: "Connexion impossible. Vérifiez votre réseau, puis réessayez.",
        contact: COMPANY.email,
      });
    }
  }

  if (etat.phase === "succes") {
    return (
      <div
        className="mt-5 rounded-md border border-emerald-700/30 bg-emerald-50 p-5 text-[#26312e]"
        role="status"
      >
        <h2 className="flex items-center gap-2 text-lg font-bold text-emerald-900">
          <CheckCircle2 aria-hidden="true" size={19} />
          Demande enregistrée
        </h2>
        <p className="mt-3 text-sm leading-6 text-[#52615d]">
          Votre demande est consignée sous la référence{" "}
          <strong className="font-mono font-bold text-[#26312e]">{etat.reference}</strong>. Une
          réponse vous sera adressée sous un mois au maximum, conformément à l&apos;article 12.3 du
          RGPD. Conservez cette référence pour tout échange ultérieur.
        </p>
        <p className="mt-3 text-sm leading-6 text-[#52615d]">
          En cas de difficulté, vous pouvez saisir la CNIL à tout moment.
        </p>
      </div>
    );
  }

  return (
    <form className="mt-5 grid gap-4 rounded-md border border-[#d9e1de] bg-white p-5" onSubmit={envoyer}>
      <div>
        <h2 className="text-lg font-bold text-[#26312e]">Exercer vos droits RGPD</h2>
        <p className="mt-1 text-sm leading-6 text-[#52615d]">
          Accès, rectification, effacement, opposition, limitation ou portabilité de vos données.
          Réponse sous un mois maximum.
        </p>
      </div>

      <div className="grid gap-1.5">
        <label className="text-sm font-semibold text-[#52615d]" htmlFor={idEmail}>
          Email <span aria-hidden="true">*</span>
        </label>
        <input
          autoComplete="email"
          className="min-h-11 w-full rounded-sm border border-[#cdd7d3] px-3 text-[#26312e]"
          id={idEmail}
          name="email"
          required
          type="email"
        />
        <p className="text-xs leading-5 text-[#65746f]">
          Utilisé uniquement pour vous répondre et vérifier votre identité.
        </p>
      </div>

      <div className="grid gap-1.5">
        <label className="text-sm font-semibold text-[#52615d]" htmlFor={idObjet}>
          Objet de la demande <span aria-hidden="true">*</span>
        </label>
        <select
          className="min-h-11 w-full rounded-sm border border-[#cdd7d3] px-3 text-[#26312e]"
          defaultValue="access"
          id={idObjet}
          name="requestType"
          required
        >
          {OBJETS.map(({ valeur, libelle }) => (
            <option key={valeur} value={valeur}>
              {libelle}
            </option>
          ))}
        </select>
      </div>

      <div className="grid gap-1.5">
        <label className="text-sm font-semibold text-[#52615d]" htmlFor={idMessage}>
          Message <span aria-hidden="true">*</span>
        </label>
        <textarea
          className="min-h-28 w-full rounded-sm border border-[#cdd7d3] px-3 py-2 text-[#26312e]"
          id={idMessage}
          minLength={10}
          name="message"
          required
        />
      </div>

      {/* Case décochée par défaut : un consentement pré-coché n'en est pas un
          (RGPD considérant 32, et CJUE Planet49 C-673/17). */}
      <div className="flex items-start gap-2.5">
        <input
          className="mt-1 size-4 shrink-0"
          id={idConsent}
          name="consent"
          required
          type="checkbox"
        />
        <label className="text-sm leading-6 text-[#52615d]" htmlFor={idConsent}>
          J&apos;accepte que mon adresse email et le contenu de ma demande soient conservés le temps
          de l&apos;instruction, puis archivés selon la{" "}
          <a className="font-semibold underline underline-offset-4" href="#conservation">
            politique de conservation
          </a>
          . <span aria-hidden="true">*</span>
        </label>
      </div>

      {/* Piège à robots : masqué visuellement et retiré de l'ordre de tabulation
          comme de l'arbre d'accessibilité. */}
      <div aria-hidden="true" className="hidden">
        <label htmlFor={`${idBase}-website`}>Site web</label>
        <input autoComplete="off" id={`${idBase}-website`} name="website" tabIndex={-1} />
      </div>

      <p className="text-xs leading-5 text-[#65746f]">
        Champs limités au strict nécessaire (RGPD art. 5.1.c). Responsable du traitement :{" "}
        {COMPANY.editor} — {COMPANY.email}.
      </p>

      <button
        className="inline-flex min-h-11 items-center justify-center gap-2 rounded-sm bg-emerald-700 px-4 font-bold text-white transition hover:bg-emerald-800 disabled:opacity-60"
        disabled={etat.phase === "envoi"}
        type="submit"
      >
        {etat.phase === "envoi" ? (
          <>
            <Loader2 aria-hidden="true" className="animate-spin" size={16} />
            Envoi en cours…
          </>
        ) : (
          "Envoyer la demande"
        )}
      </button>

      {/* `role="alert"` : l'échec doit être annoncé immédiatement, sans attendre
          que l'utilisateur revienne sur la zone. */}
      {etat.phase === "echec" && (
        <p className="flex items-start gap-2 text-sm leading-6 font-semibold text-[#a1112f]" role="alert">
          <AlertTriangle aria-hidden="true" className="mt-0.5 shrink-0" size={16} />
          <span>
            {etat.message}
            {etat.contact && (
              <>
                {" "}
                Écrivez directement à{" "}
                <a className="underline underline-offset-4" href={`mailto:${etat.contact}`}>
                  {etat.contact}
                </a>
                .
              </>
            )}
          </span>
        </p>
      )}
    </form>
  );
}
