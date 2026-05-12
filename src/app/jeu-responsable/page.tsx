import Link from "next/link";
import { ArrowLeft, AlertTriangle, Phone, ShieldCheck, HeartHandshake } from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Jeu responsable | Kayzen Pronostic",
  description: "Informations sur le jeu responsable, les risques liés aux paris hippiques et les ressources d'aide disponibles.",
};

export default function JeuResponsablePage() {
  return (
    <main className="min-h-screen bg-bg pb-20">
      <div className="mx-auto max-w-3xl px-4 pt-6 sm:px-6 lg:px-8">

        <Link
          href="/"
          className="mb-6 inline-flex items-center gap-2 rounded-xl border border-border bg-surface px-3.5 py-2 text-sm font-medium text-muted shadow-sm transition hover:border-accent hover:text-accent-text"
        >
          <ArrowLeft size={14} /> Accueil
        </Link>

        {/* Alerte urgente */}
        <div className="mb-8 flex items-start gap-4 rounded-2xl border border-warn/40 bg-warn-lo p-5">
          <Phone size={24} className="mt-0.5 shrink-0 text-warn" />
          <div>
            <p className="font-bold text-fg">Joueurs Info Service — Ligne gratuite</p>
            <a href="tel:0974751313" className="mt-1 block text-2xl font-display font-bold text-warn hover:underline">
              09 74 75 13 13
            </a>
            <p className="mt-1 text-sm text-muted">7j/7, de 8h à 2h. Appel non surtaxé depuis un poste fixe ou mobile.</p>
          </div>
        </div>

        <div className="mb-8">
          <div className="flex items-center gap-3">
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-warn-lo">
              <HeartHandshake size={24} className="text-warn" />
            </div>
            <div>
              <h1 className="font-display text-2xl font-bold text-fg">Jeu responsable</h1>
              <p className="text-sm text-muted">Kayzen Pronostic s'engage pour un jeu sain et maîtrisé.</p>
            </div>
          </div>
        </div>

        <div className="grid gap-5">

          <section className="rounded-2xl border border-border bg-surface p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-4">
              <AlertTriangle size={20} className="text-warn" />
              <h2 className="font-display text-lg font-bold text-fg">Les paris comportent des risques</h2>
            </div>
            <div className="space-y-3 text-sm leading-6 text-muted">
              <p>Les paris hippiques sont une activité de loisir qui comporte des risques financiers réels. Aucun système de pronostic — y compris le nôtre — ne peut garantir des gains.</p>
              <p>Nos analyses sont des <strong className="text-fg">outils d'aide à la décision</strong>, pas des certitudes. Le modèle KZ Score est une probabilité statistique, pas une prédiction certaine.</p>
              <p>Misez uniquement des sommes que vous pouvez vous permettre de perdre. Ne cherchez jamais à récupérer vos pertes en augmentant vos mises.</p>
            </div>
          </section>

          <section className="rounded-2xl border border-border bg-surface p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-4">
              <ShieldCheck size={20} className="text-accent-text" />
              <h2 className="font-display text-lg font-bold text-fg">Nos engagements</h2>
            </div>
            <ul className="space-y-2 text-sm leading-6 text-muted">
              {[
                "Affichage systématique du disclaimer légal sur chaque prédiction",
                "Rappel du numéro Joueurs Info Service dans chaque ticket PDF",
                "Aucune incitation à miser plus que son budget habituel",
                "Interdiction stricte d'accès aux mineurs de moins de 18 ans",
                "Respect de la réglementation ANJ (Autorité Nationale des Jeux)",
                "Transparence totale sur les limites de notre modèle prédictif",
              ].map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                  {item}
                </li>
              ))}
            </ul>
          </section>

          <section className="rounded-2xl border border-border bg-surface p-6 shadow-sm">
            <h2 className="font-display text-lg font-bold text-fg mb-4">Signes d'une dépendance au jeu</h2>
            <p className="text-sm text-muted mb-3">Si vous reconnaissez plusieurs de ces comportements, consultez un professionnel :</p>
            <ul className="space-y-2 text-sm leading-6 text-muted">
              {[
                "Miser de l'argent prévu pour les dépenses essentielles (loyer, courses…)",
                "Augmenter les mises pour ressentir les mêmes sensations",
                "Miser pour récupérer des pertes précédentes",
                "Mentir à vos proches sur votre activité de jeu",
                "Négliger votre travail, famille ou santé à cause du jeu",
                "Emprunter de l'argent pour jouer",
              ].map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-warn" />
                  {item}
                </li>
              ))}
            </ul>
          </section>

          <section className="rounded-2xl border border-border bg-surface p-6 shadow-sm">
            <h2 className="font-display text-lg font-bold text-fg mb-4">Ressources d'aide</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {[
                { name: "Joueurs Info Service", tel: "09 74 75 13 13", desc: "Ligne d'écoute gratuite 7j/7" },
                { name: "SOS Joueurs",          tel: "01 53 26 13 13", desc: "Association d'entraide aux joueurs pathologiques" },
              ].map(({ name, tel, desc }) => (
                <div key={name} className="rounded-xl border border-border bg-surface-sub p-4">
                  <p className="font-semibold text-fg">{name}</p>
                  <a href={`tel:${tel.replace(/\s/g, "")}`} className="mt-1 block font-mono font-bold text-accent-text hover:text-accent">{tel}</a>
                  <p className="mt-1 text-xs text-muted">{desc}</p>
                </div>
              ))}
            </div>
          </section>

        </div>

        <p className="mt-8 text-center text-xs text-muted">
          Kayzen Pronostic — Éditeur soumis à la réglementation ANJ.{" "}
          <Link href="/mentions-legales" className="text-accent-text hover:text-accent">Mentions légales</Link>
        </p>

      </div>
    </main>
  );
}
