"use client";

import { useState } from "react";
import type { FormEvent } from "react";

export function PrivacyForm() {
  const [status, setStatus] = useState("");

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    if (String(form.get("website") ?? "").trim()) {
      setStatus("Votre demande a ete prise en compte.");
      return;
    }
    setStatus("Formulaire pret : branchement email/API a finaliser avant collecte réelle.");
  }

  return (
    <form className="mt-5 grid gap-3 rounded-md border border-[#d9e1de] bg-white p-4" onSubmit={submit}>
      <h2 className="text-lg font-bold text-[#26312e]">Exercer vos droits RGPD</h2>
      <label className="text-sm font-semibold text-[#52615d]">
        Email
        <input className="mt-1 min-h-11 w-full rounded-sm border border-[#cdd7d3] px-3 text-[#26312e]" name="email" required type="email" />
      </label>
      <label className="text-sm font-semibold text-[#52615d]">
        Objet de la demande
        <select className="mt-1 min-h-11 w-full rounded-sm border border-[#cdd7d3] px-3 text-[#26312e]" name="requestType" required>
          <option value="access">Droit d’accès</option>
          <option value="rectification">Rectification</option>
          <option value="erasure">Effacement</option>
          <option value="opposition">Opposition</option>
          <option value="portability">Portabilite</option>
        </select>
      </label>
      <label className="text-sm font-semibold text-[#52615d]">
        Message
        <textarea className="mt-1 min-h-28 w-full rounded-sm border border-[#cdd7d3] px-3 py-2 text-[#26312e]" name="message" required />
      </label>
      <label className="hidden" aria-hidden="true">
        Site web
        <input autoComplete="off" name="website" tabIndex={-1} />
      </label>
      <p className="text-xs leading-5 text-[#65746f]">
        Les champs sont limités au strict nécessaire. Ce formulaire contient un honeypot anti-spam invisible aux utilisateurs.
      </p>
      <button className="min-h-11 rounded-sm bg-emerald-700 px-4 font-bold text-white" type="submit">
        Preparer la demande
      </button>
      {status ? <p className="text-sm font-semibold text-emerald-700" role="status">{status}</p> : null}
    </form>
  );
}
