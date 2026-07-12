import type { Metadata } from "next";
import Link from "next/link";
import { Nav } from "@/components/Nav";
import { CTAFooter } from "@/components/CTAFooter";
import { CONTACT } from "@/lib/contact";

export const metadata: Metadata = {
  title: "Politique de confidentialité",
  description: "Politique de confidentialité de Pharmacie+.",
  robots: { index: false, follow: true },
};

export default function PolitiqueConfidentialite() {
  return (
    <>
      <Nav />
      <main className="pt-40 pb-24 bg-white dark:bg-[#050e0c] min-h-screen">
        <div className="mx-auto max-w-3xl px-5 sm:px-8">
          <Link href="/" className="text-[13px] font-semibold text-emerald-600 no-underline">
            ← Retour à l&apos;accueil
          </Link>

          <h1 className="mt-6 font-display font-bold text-[var(--color-ink)] dark:text-white text-4xl tracking-tight">
            Politique de confidentialité
          </h1>
          <p className="mt-3 text-[13px] text-slate-400">Dernière mise à jour : à compléter</p>

          <div className="mt-10 space-y-8 text-[15px] leading-relaxed text-slate-600 dark:text-slate-400">
            <section>
              <h2 className="font-display font-semibold text-[var(--color-ink)] dark:text-white text-lg mb-2">
                1. Ce que ce site vitrine collecte
              </h2>
              <p>
                Ce site (pharmacieplus, site vitrine) ne collecte aujourd&apos;hui aucune
                donnée personnelle via un formulaire. Si vous nous contactez par
                WhatsApp ou par e-mail, nous recevons les informations que vous
                choisissez de nous transmettre (nom, numéro, message) dans le seul but
                de vous répondre.
              </p>
            </section>

            <section>
              <h2 className="font-display font-semibold text-[var(--color-ink)] dark:text-white text-lg mb-2">
                2. Mesure d&apos;audience
              </h2>
              <p>
                [À compléter dès qu&apos;un outil de mesure d&apos;audience sera mis en place —
                préciser l&apos;outil utilisé, les données collectées et la durée de
                conservation.]
              </p>
            </section>

            <section>
              <h2 className="font-display font-semibold text-[var(--color-ink)] dark:text-white text-lg mb-2">
                3. Cookies
              </h2>
              <p>
                Ce site utilise uniquement une préférence technique locale (mode clair
                / sombre), stockée dans votre navigateur, jamais transmise à un
                serveur. Aucun cookie de suivi publicitaire n&apos;est utilisé à ce jour.
              </p>
            </section>

            <section>
              <h2 className="font-display font-semibold text-[var(--color-ink)] dark:text-white text-lg mb-2">
                4. Application Pharmacie+ (produit)
              </h2>
              <p>
                Cette page concerne uniquement le site vitrine. Le traitement des
                données au sein de l&apos;application Pharmacie+ (dossiers clients,
                ordonnances, ventes) fera l&apos;objet d&apos;une politique de confidentialité
                dédiée et plus détaillée, publiée avant l&apos;ouverture aux premières
                pharmacies pilotes.
              </p>
            </section>

            <section>
              <h2 className="font-display font-semibold text-[var(--color-ink)] dark:text-white text-lg mb-2">
                5. Vos droits
              </h2>
              <p>
                Pour toute question sur vos données ou pour demander leur suppression,
                contactez-nous : <a href={`mailto:${CONTACT.email}`} className="text-emerald-600 no-underline">{CONTACT.email}</a>.
              </p>
            </section>

            <p className="text-[13px] text-slate-400 italic pt-4 border-t border-slate-200 dark:border-white/10">
              Document à finaliser avec un professionnel du droit avant mise en ligne
              publique, en particulier pour la politique de confidentialité de
              l&apos;application (données de santé indirectes via les ordonnances).
            </p>
          </div>
        </div>
      </main>
      <CTAFooter />
    </>
  );
}
