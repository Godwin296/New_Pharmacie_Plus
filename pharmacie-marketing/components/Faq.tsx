"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Reveal } from "./Reveal";

const faqs = [
  {
    q: "Pharmacie+ fonctionne-t-il avec Orange Money et MTN MoMo ?",
    a: "Oui. Les deux sont intégrés nativement, en FCFA, sans conversion de devise. Chaque paiement Mobile Money est vérifié par la caissière avant que le stock ne soit décrémenté.",
  },
  {
    q: "Mes données sont-elles séparées de celles des autres pharmacies ?",
    a: "Oui, complètement. L'architecture repose sur un schéma PostgreSQL dédié par pharmacie : chaque officine a son propre espace, totalement isolé des autres clientes de Pharmacie+.",
  },
  {
    q: "Faut-il passer par un store pour installer l'application ?",
    a: "Non. Pharmacie+ est une PWA (Progressive Web App) : elle s'ajoute à l'écran d'accueil directement depuis le navigateur, sans passer par le Play Store ou l'App Store.",
  },
  {
    q: "Qui peut se connecter à l'application dans mon officine ?",
    a: "Trois profils existent, chacun avec sa propre authentification : client, caissière et administrateur. Chaque profil ne voit que ce qui correspond à son rôle.",
  },
  {
    q: "Comment sont traitées les ordonnances envoyées par les patients ?",
    a: "Le patient l'envoie en photo depuis son téléphone. Le fichier est vérifié puis re-encodé avant d'être stocké, et c'est le pharmacien qui valide la commande avant préparation.",
  },
  {
    q: "Combien coûte Pharmacie+ ?",
    a: "Cela dépend de la taille et des besoins de votre officine. Le plus simple est de nous écrire pour une démo : on regarde votre situation ensemble et on vous propose une offre adaptée.",
  },
];

export function Faq() {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <section id="faq" className="relative bg-white py-24 sm:py-32">
      <div className="mx-auto max-w-3xl px-5 sm:px-8">
        <Reveal className="text-center">
          <span className="text-[12px] font-mono uppercase tracking-[0.2em] text-emerald-600">
            Questions fréquentes
          </span>
          <h2 className="mt-4 font-display font-bold text-[var(--color-ink)] text-4xl sm:text-5xl leading-[1.1] tracking-tight">
            Tout ce que vous vous demandez.
          </h2>
        </Reveal>

        <div className="mt-12 space-y-3">
          {faqs.map((item, i) => {
            const isOpen = open === i;
            return (
              <Reveal key={item.q} delay={i * 0.05}>
                <div className="rounded-2xl border border-slate-200/70 bg-white overflow-hidden">
                  <button
                    onClick={() => setOpen(isOpen ? null : i)}
                    className="w-full flex items-center justify-between gap-4 text-left px-6 py-5 bg-transparent border-none cursor-pointer"
                  >
                    <span className="font-display font-semibold text-[15px] text-[var(--color-ink)]">
                      {item.q}
                    </span>
                    <motion.span
                      animate={{ rotate: isOpen ? 180 : 0 }}
                      transition={{ duration: 0.3 }}
                      className="shrink-0 rounded-full bg-[var(--color-mist)] p-1.5"
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
                        <p className="px-6 pb-5 text-[14px] leading-relaxed text-slate-500">
                          {item.a}
                        </p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}
