import type { Metadata } from "next";
import Link from "next/link";
import { Nav } from "@/components/Nav";
import { CTAFooter } from "@/components/CTAFooter";
import { CONTACT } from "@/lib/contact";

export const metadata: Metadata = {
  title: "Mentions légales",
  description: "Mentions légales de Pharmacie+.",
  robots: { index: false, follow: true },
};

export default function MentionsLegales() {
  return (
    <>
      <Nav />
      <main className="pt-40 pb-24 bg-white dark:bg-[#050e0c] min-h-screen">
        <div className="mx-auto max-w-3xl px-5 sm:px-8">
          <Link href="/" className="text-[13px] font-semibold text-emerald-600 no-underline">
            ← Retour à l&apos;accueil
          </Link>

          <h1 className="mt-6 font-display font-bold text-[var(--color-ink)] dark:text-white text-4xl tracking-tight">
            Mentions légales
          </h1>
          <p className="mt-3 text-[13px] text-slate-400">Dernière mise à jour : à compléter</p>

          <div className="mt-10 space-y-8 text-[15px] leading-relaxed text-slate-600 dark:text-slate-400">
            <section>
              <h2 className="font-display font-semibold text-[var(--color-ink)] dark:text-white text-lg mb-2">
                1. Éditeur du site
              </h2>
              <p>
                Le site Pharmacie+ est édité par : <strong>[raison sociale à compléter]</strong>,
                [forme juridique, ex. entreprise individuelle / SARL — à compléter],
                immatriculée sous le numéro [à compléter], dont le siège est situé à
                [adresse à compléter], Cameroun.
              </p>
              <p className="mt-2">
                Directeur de la publication : [nom à compléter].
              </p>
              <p className="mt-2">
                Contact : <a href={`mailto:${CONTACT.email}`} className="text-emerald-600 no-underline">{CONTACT.email}</a> — {CONTACT.whatsappDisplay}
              </p>
            </section>

            <section>
              <h2 className="font-display font-semibold text-[var(--color-ink)] dark:text-white text-lg mb-2">
                2. Hébergement
              </h2>
              <p>
                Ce site est hébergé par [nom de l&apos;hébergeur à compléter une fois le
                déploiement effectué], [adresse de l&apos;hébergeur].
              </p>
            </section>

            <section>
              <h2 className="font-display font-semibold text-[var(--color-ink)] dark:text-white text-lg mb-2">
                3. Propriété intellectuelle
              </h2>
              <p>
                L&apos;ensemble des contenus présents sur ce site (textes, logos, graphismes,
                identité visuelle Pharmacie+) est protégé et ne peut être reproduit,
                distribué ou exploité sans autorisation préalable.
              </p>
            </section>

            <section>
              <h2 className="font-display font-semibold text-[var(--color-ink)] dark:text-white text-lg mb-2">
                4. Limitation de responsabilité
              </h2>
              <p>
                Les informations présentées sur ce site sont fournies à titre indicatif.
                Pharmacie+ met tout en œuvre pour assurer leur exactitude mais ne saurait
                être tenu responsable d&apos;éventuelles erreurs ou omissions.
              </p>
            </section>

            <section>
              <h2 className="font-display font-semibold text-[var(--color-ink)] dark:text-white text-lg mb-2">
                5. Droit applicable
              </h2>
              <p>Les présentes mentions légales sont soumises au droit camerounais.</p>
            </section>

            <p className="text-[13px] text-slate-400 italic pt-4 border-t border-slate-200 dark:border-white/10">
              Document à finaliser avec un professionnel du droit avant mise en ligne
              publique, notamment une fois la structure juridique de l&apos;entreprise
              formalisée.
            </p>
          </div>
        </div>
      </main>
      <CTAFooter />
    </>
  );
}
