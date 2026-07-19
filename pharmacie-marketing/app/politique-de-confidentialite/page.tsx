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
          <p className="mt-3 text-[13px] text-slate-400">Dernière mise à jour : juillet 2026</p>

          <div className="mt-10 space-y-8 text-[15px] leading-relaxed text-slate-600 dark:text-slate-400">
            <section>
              <h2 className="font-display font-semibold text-[var(--color-ink)] dark:text-white text-lg mb-2">
                1. Ce que ce site vitrine collecte
              </h2>
              <p>
                Ce site (vitrine) ne collecte aucune donnée personnelle via un
                formulaire de manière automatisée : le formulaire de contact ouvre
                WhatsApp avec un message pré-rempli, que vous choisissez ou non
                d&apos;envoyer. Si vous nous contactez par WhatsApp ou par e-mail, nous
                recevons les informations que vous transmettez (nom, numéro,
                message) dans le seul but de vous répondre.
              </p>
            </section>

            <section>
              <h2 className="font-display font-semibold text-[var(--color-ink)] dark:text-white text-lg mb-2">
                2. Cadre légal applicable
              </h2>
              <p>
                Le traitement des données à caractère personnel au Cameroun est
                encadré par la <strong>loi n° 2024/017 du 23 décembre 2024</strong>{" "}
                relative à la protection des données à caractère personnel, qui
                instaure une Autorité de protection des données à caractère
                personnel et impose, notamment pour les traitements à grande
                échelle ou portant sur des données sensibles (dont les données de
                santé), une autorisation préalable de cette Autorité. Les
                entreprises disposent d&apos;un délai de mise en conformité expirant le{" "}
                23 juin 2026.
              </p>
            </section>

            <section>
              <h2 className="font-display font-semibold text-[var(--color-ink)] dark:text-white text-lg mb-2">
                3. Mesure d&apos;audience
              </h2>
              <p>
                Ce site utilise <strong>Umami</strong>, un outil de mesure d&apos;audience
                open source et respectueux de la vie privée : il ne dépose aucun
                cookie, ne collecte aucune donnée personnelle identifiable
                (adresse IP non stockée, aucun identifiant unique persistant) et
                ne partage rien avec des tiers publicitaires. Il nous permet
                uniquement de savoir combien de personnes visitent le site,
                quelles pages elles consultent et quels boutons elles utilisent
                (ex. « Demander une démo »), afin d&apos;améliorer le site. Les
                données sont hébergées par Umami (cloud.umami.is).
              </p>
            </section>

            <section>
              <h2 className="font-display font-semibold text-[var(--color-ink)] dark:text-white text-lg mb-2">
                4. Cookies
              </h2>
              <p>
                Ce site utilise uniquement une préférence technique locale (mode clair
                / sombre), stockée dans votre navigateur, jamais transmise à un
                serveur. Aucun cookie de suivi publicitaire n&apos;est utilisé à ce jour.
              </p>
            </section>

            <section>
              <h2 className="font-display font-semibold text-[var(--color-ink)] dark:text-white text-lg mb-2">
                5. Application Pharmacie+ (produit)
              </h2>
              <p>
                Cette page concerne uniquement le site vitrine. L&apos;application
                Pharmacie+ traite des données plus sensibles (dossiers clients,
                ordonnances, ventes), certaines pouvant être qualifiées de données
                de santé au sens de la loi n° 2024/017. Une politique de
                confidentialité dédiée, ainsi que les démarches d&apos;autorisation
                requises auprès de l&apos;Autorité de protection des données à
                caractère personnel, seront finalisées avant l&apos;ouverture aux
                premières pharmacies pilotes.
              </p>
            </section>

            <section>
              <h2 className="font-display font-semibold text-[var(--color-ink)] dark:text-white text-lg mb-2">
                6. Vos droits
              </h2>
              <p>
                La loi n° 2024/017 vous reconnaît le droit d&apos;être informé du
                traitement de vos données, de donner votre consentement préalable,
                et de saisir l&apos;Autorité en cas de violation de vos droits. Pour
                toute question sur vos données ou pour demander leur suppression,
                contactez-nous : <a href={`mailto:${CONTACT.email}`} className="text-emerald-600 no-underline">{CONTACT.email}</a>.
              </p>
            </section>

            <p className="text-[13px] text-slate-400 italic pt-4 border-t border-slate-200 dark:border-white/10">
              Document à finaliser avec un professionnel du droit avant mise en ligne
              publique, en particulier pour la politique de confidentialité de
              l&apos;application et les démarches d&apos;autorisation auprès de l&apos;Autorité
              de protection des données à caractère personnel du Cameroun.
            </p>
          </div>
        </div>
      </main>
      <CTAFooter />
    </>
  );
}
