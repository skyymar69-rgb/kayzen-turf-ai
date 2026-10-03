import Link from "next/link";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { COMPANY, LEGAL_SOURCES } from "@/lib/site-config";

type Section = {
  title: string;
  body: string[];
};

export function LegalPage({ intro, sections, title }: { intro: string; sections: Section[]; title: string }) {
  return (
    <main className="min-h-screen bg-bg px-3 py-12 text-fg sm:px-5 lg:px-8" id="contenu-principal">
      <article className="mx-auto max-w-[1120px] rounded-2xl border border-border bg-surface p-5 shadow-sm sm:p-8">
        <p className="text-sm font-bold uppercase text-accent-text">{COMPANY.brand}</p>
        <h1 className="mt-2 text-3xl font-bold tracking-normal sm:text-4xl">{title}</h1>
        <p className="mt-4 max-w-3xl text-base leading-7 text-muted">{intro}</p>
        <div className="mt-5 rounded-2xl border border-warn/30 bg-warn-lo p-4 text-sm leading-6 text-fg">
          <AlertTriangle aria-hidden="true" className="mb-2 text-warn" size={18} />
          Document opérationnel de conformité. Une validation par un avocat ou conseil habilité reste recommandée avant exploitation commerciale définitive.
        </div>
        <div className="mt-8 grid gap-5">
          {sections.map((section) => (
            <section className="rounded-2xl border border-border bg-surface-sub p-4" key={section.title}>
              <h2 className="text-xl font-bold">{section.title}</h2>
              <div className="mt-3 space-y-3 text-sm leading-7 text-muted">
                {section.body.map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))}
              </div>
            </section>
          ))}
        </div>
        <section className="mt-8 rounded-2xl border border-accent/20 bg-accent-lo p-4">
          <h2 className="flex items-center gap-2 text-lg font-bold text-accent-text">
            <CheckCircle2 aria-hidden="true" size={18} />
            Références utilisées
          </h2>
          <ul className="mt-3 grid gap-2 text-sm text-accent-text sm:grid-cols-2">
            {LEGAL_SOURCES.map((source) => (
              <li key={source.href}>
                <a className="font-semibold underline-offset-4 hover:underline" href={source.href} rel="noopener noreferrer" target="_blank">
                  {source.label}
                </a>
              </li>
            ))}
          </ul>
        </section>
        <div className="mt-8">
          <Link className="inline-flex min-h-11 items-center rounded-xl bg-cta px-5 font-bold text-cta-text transition hover:bg-cta-hi" href="/">
            Retour au programme
          </Link>
        </div>
      </article>
    </main>
  );
}

export const editorSection: Section = {
  title: "Identification de l'éditeur",
  body: [
    `${COMPANY.editor}, ${COMPANY.legalForm}, SIREN/SIRET ${COMPANY.siren}, RCS ${COMPANY.rcs}, TVA intracommunautaire ${COMPANY.vat}, code APE ${COMPANY.ape}.`,
    `Siège social : ${COMPANY.address}. Téléphone : ${COMPANY.phone}. Email : ${COMPANY.email}. Agence web : ${COMPANY.agencyUrl}.`,
  ],
};
