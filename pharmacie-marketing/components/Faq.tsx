"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Reveal } from "./Reveal";

type FaqItem = { q: string; a: ReactNode };
type FaqCategory = { label: string; items: FaqItem[] };

const categories: FaqCategory[] = [
  {
    label: "Le produit",
    items: [
      {
        q: "Qu'est-ce que Pharmacie+ exactement ?",
        a: "Une plateforme qui gère à la fois l'intérieur de votre officine (stock, lots, caisse, ordonnances) et la relation avec vos patients (commande en ligne, suivi en temps réel). La plupart des logiciels du marché ne font que l'un ou l'autre.",
      },
      {
        q: "En quoi c'est différent d'un simple logiciel de caisse ?",
        a: "Un logiciel de caisse classique s'arrête au comptoir. Pharmacie+ ajoute une vitrine en ligne pour vos patients : ils peuvent parcourir votre catalogue, envoyer une ordonnance et suivre leur commande en temps réel depuis leur téléphone, sans se déplacer avant que ce soit prêt.",
      },
      {
        q: "Faut-il passer par le Play Store ou l'App Store ?",
        a: "Non. Pharmacie+ est une PWA (Progressive Web App) : elle s'ajoute à l'écran d'accueil directement depuis le navigateur, sans téléchargement classique.",
      },
      {
        q: "Ça fonctionne sur iPhone ?",
        a: "L'application s'installe techniquement depuis Safari (\"Ajouter à l'écran d'accueil\"), mais le développement et les tests sont concentrés sur Android pour l'instant, qui reste l'appareil le plus utilisé dans nos officines cibles. Si votre équipe est sur iPhone, dites-le-nous avant de vous engager, on regarde ensemble.",
      },
      {
        q: "Faut-il une connexion internet stable ?",
        a: "Non : le catalogue et le panier de vos patients restent utilisables même en coupure réseau, grâce à une mise en cache locale sur leur téléphone qui se synchronise automatiquement au retour de la connexion — pensé spécifiquement pour les réseaux 3G/4G instables.",
      },
      {
        q: "Gérez-vous les lots et les dates de péremption ?",
        a: "Oui. Chaque réception de médicament est enregistrée par lot avec sa date de péremption. Lors d'une vente, le système décrémente automatiquement le lot qui périme en premier (méthode FEFO), pour limiter les pertes liées aux produits périmés.",
      },
    ],
  },
  {
    label: "Sécurité & données",
    items: [
      {
        q: "Mes données sont-elles séparées de celles des autres pharmacies ?",
        a: "Oui, complètement. L'architecture repose sur un schéma PostgreSQL dédié par pharmacie : chaque officine a son propre espace, totalement isolé des autres clientes de Pharmacie+.",
      },
      {
        q: "Comment sont traitées les ordonnances envoyées par les patients ?",
        a: "Le patient l'envoie en photo ou en PDF depuis son téléphone. Le fichier est vérifié (signature réelle du fichier, pas juste son extension), re-encodé pour retirer tout contenu caché, compressé, puis chiffré avant stockage — seul un membre autorisé de votre équipe peut le consulter. C'est le pharmacien qui valide ou rejette la commande avant toute préparation.",
      },
      {
        q: "Mes données sont-elles sauvegardées ?",
        a: "Un outil de sauvegarde et restauration existe déjà (export/import complet de la base). Des sauvegardes automatiques programmées sont en cours de mise en place — en attendant, on peut déclencher une sauvegarde manuelle à votre demande.",
      },
      {
        q: "Qui peut se connecter à l'application dans mon officine ?",
        a: "Trois profils existent, chacun avec sa propre authentification sécurisée (JWT) : client, caissière et administrateur. Chaque profil ne voit que ce qui correspond à son rôle — une caissière ne peut pas modifier les prix, par exemple.",
      },
      {
        q: "Que se passe-t-il si j'arrête mon abonnement ?",
        a: "Vos données restent dans votre espace isolé. Contactez-nous pour un export avant toute clôture — on ne supprime jamais un espace pharmacie automatiquement ou sans vous prévenir.",
      },
    ],
  },
  {
    label: "Paiement & vente",
    items: [
      {
        q: "Ça fonctionne avec Orange Money et MTN MoMo ?",
        a: "Oui. Les deux sont intégrés nativement, en FCFA, sans conversion de devise.",
      },
      {
        q: "Le paiement Mobile Money est-il vérifié automatiquement ?",
        a: "Non, et c'est volontaire : chaque paiement Mobile Money est vérifié manuellement par votre caissière avant que le stock ne soit décrémenté. Ça évite les erreurs et les fraudes qu'une vérification 100% automatique pourrait laisser passer.",
      },
      {
        q: "Puis-je vendre au comptoir sans commande en ligne ?",
        a: "Oui, une caisse dédiée à la vente directe existe pour les clients qui passent simplement à l'officine, indépendamment du flux de commande en ligne.",
      },
      {
        q: "Puis-je imprimer un ticket de caisse ?",
        a: "Oui, un format d'impression adapté aux imprimantes thermiques standard (80mm) est prévu pour les tickets et les factures.",
      },
    ],
  },
  {
    label: "Vos patients",
    items: [
      {
        q: "Comment un patient commande-t-il ses médicaments ?",
        a: "Il parcourt votre catalogue en ligne, ajoute au panier, envoie son ordonnance si besoin, et paie par Mobile Money. Vous recevez la commande instantanément côté caisse.",
      },
      {
        q: "Le pharmacien peut-il refuser une commande ou une ordonnance ?",
        a: "Oui, à tout moment avant préparation — c'est même une étape obligatoire du circuit : rien n'est délivré sans validation humaine de votre équipe.",
      },
      {
        q: "Le patient peut-il suivre sa commande en direct ?",
        a: "Oui, la mise à jour du statut (en préparation, prête, retirée...) est envoyée en temps réel, sans que le patient ait besoin de rafraîchir la page ou de rappeler l'officine.",
      },
      {
        q: "Un patient peut-il utiliser le même compte dans plusieurs pharmacies Pharmacie+ ?",
        a: "Techniquement, son compte est unique et partagé entre toutes les officines utilisant Pharmacie+. Une interface pour découvrir facilement plusieurs officines depuis ce compte est encore en construction — pour l'instant, il doit connaître l'adresse de chaque officine.",
      },
    ],
  },
  {
    label: "Tarifs & démarrage",
    items: [
      {
        q: "Combien coûte Pharmacie+ ?",
        a: (
          <>
            À partir de 15 000 FCFA/mois selon vos besoins. Tous les détails,
            forfait par forfait, sont sur notre page{" "}
            <Link href="/forfaits" className="text-emerald-600 font-semibold no-underline">
              Découvrir les forfaits
            </Link>
            .
          </>
        ),
      },
      {
        q: "Y a-t-il un engagement long ou des frais cachés ?",
        a: "Non : facturation simple, mois par mois (ou année par année avec l'offre annuelle). Pas de frais d'installation ni de formation cachés.",
      },
      {
        q: "Comment se déroule la mise en place dans mon officine ?",
        a: "On importe votre stock existant, on installe l'application, on forme votre équipe (caissière et administrateur), et on reste disponible les premières semaines pour ajuster ce qui doit l'être.",
      },
      {
        q: "Puis-je tester avant de m'engager ?",
        a: "Oui — les premières pharmacies bénéficient d'un programme pilote avec conditions préférentielles. Voir la page forfaits pour les détails.",
      },
    ],
  },
];

export function Faq() {
  const [activeCategory, setActiveCategory] = useState(0);
  const [open, setOpen] = useState<number | null>(0);

  const items = categories[activeCategory].items;

  return (
    <section id="faq" className="relative bg-white dark:bg-[#0b1a16] py-24 sm:py-32">
      <div className="mx-auto max-w-3xl px-5 sm:px-8">
        <Reveal className="text-center">
          <span className="text-[12px] font-mono uppercase tracking-[0.2em] text-emerald-600">
            Questions fréquentes
          </span>
          <h2 className="mt-4 font-display font-bold text-[var(--color-ink)] dark:text-white text-4xl sm:text-5xl leading-[1.1] tracking-tight">
            Tout ce que vous vous demandez.
          </h2>
        </Reveal>

        <Reveal delay={0.1} className="mt-8 flex flex-wrap justify-center gap-2">
          {categories.map((cat, i) => (
            <button
              key={cat.label}
              onClick={() => {
                setActiveCategory(i);
                setOpen(0);
              }}
              className={`rounded-full px-4 py-2 text-[13px] font-semibold border cursor-pointer transition-colors ${
                activeCategory === i
                  ? "bg-emerald-500 border-emerald-500 text-white"
                  : "bg-transparent border-slate-200 dark:border-white/15 text-slate-500 dark:text-slate-400 hover:border-emerald-300"
              }`}
            >
              {cat.label}
            </button>
          ))}
        </Reveal>

        <div className="mt-10 space-y-3">
          {items.map((item, i) => {
            const isOpen = open === i;
            return (
              <div
                key={item.q}
                className="rounded-2xl border border-slate-200/70 dark:border-white/10 bg-white dark:bg-[#0b1a16] overflow-hidden"
              >
                <button
                  onClick={() => setOpen(isOpen ? null : i)}
                  className="w-full flex items-center justify-between gap-4 text-left px-6 py-5 bg-transparent border-none cursor-pointer"
                >
                  <span className="font-display font-semibold text-[15px] text-[var(--color-ink)] dark:text-white">
                    {item.q}
                  </span>
                  <motion.span
                    animate={{ rotate: isOpen ? 180 : 0 }}
                    transition={{ duration: 0.3 }}
                    className="shrink-0 rounded-full bg-[var(--color-mist)] dark:bg-[#050e0c] p-1.5"
                  >
                    <ChevronDown size={16} className="text-emerald-600" />
                  </motion.span>
                </button>
                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                      className="overflow-hidden"
                    >
                      <p className="px-6 pb-5 text-[14px] leading-relaxed text-slate-500 dark:text-slate-400">
                        {item.a}
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
