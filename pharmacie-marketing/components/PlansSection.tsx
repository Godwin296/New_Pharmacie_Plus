"use client";

import { useState } from "react";
import { Check, X, Sparkles, MessageCircle } from "lucide-react";
import { Reveal } from "./Reveal";
import { PLANS, PILOT_OFFER } from "@/lib/plans";
import { planWhatsappLink, DEMO_WHATSAPP_LINK } from "@/lib/contact";

function formatFcfa(amount: number) {
  return `${amount.toLocaleString("fr-FR")} FCFA`;
}

const pricingFaqs = [
  {
    q: "Puis-je changer de forfait plus tard ?",
    a: "Oui, à tout moment. Écrivez-nous sur WhatsApp et on ajuste votre abonnement — pas de procédure compliquée, pas de frais de changement.",
  },
  {
    q: "Y a-t-il des frais d'installation ou de formation ?",
    a: "Non. L'installation et la formation de votre équipe (caissière, administrateur) sont incluses dans le forfait, quel qu'il soit.",
  },
  {
    q: "Que se passe-t-il si je veux arrêter ?",
    a: "Aucun engagement long terme imposé : facturation simple, mois par mois (ou année par année si vous avez choisi l'offre annuelle). Vos données restent dans votre espace isolé ; contactez-nous pour un export avant toute clôture.",
  },
  {
    q: "Le prix affiché est-il définitif ?",
    a: "C'est notre tarif de lancement, pensé pour rester accessible aux officines camerounaises. Il peut évoluer à mesure que de nouvelles fonctionnalités arrivent, mais jamais rétroactivement sur un abonnement déjà en cours.",
  },
];

export function PlansSection() {
  const [yearly, setYearly] = useState(false);

  return (
    <>
      <section className="relative pt-40 pb-20 bg-gradient-to-b from-[#053a30] to-[#0b1a16]">
        <div className="mx-auto max-w-3xl px-5 sm:px-8 text-center">
          <Reveal>
            <span className="text-[12px] font-mono uppercase tracking-[0.2em] text-emerald-400">
              Forfaits
            </span>
            <h1 className="mt-4 font-display font-bold text-white text-4xl sm:text-5xl leading-[1.1] tracking-tight">
              Un tarif simple, pensé pour votre officine.
            </h1>
            <p className="mt-5 text-[17px] leading-relaxed text-white/70">
              Pas de frais cachés, pas d&apos;engagement imposé. Choisissez le forfait
              qui correspond à votre officine aujourd&apos;hui — vous pourrez toujours
              évoluer plus tard.
            </p>
          </Reveal>

          <Reveal delay={0.1} className="mt-8 inline-flex items-center gap-3 rounded-full bg-white/10 border border-white/10 p-1.5">
            <button
              onClick={() => setYearly(false)}
              className={`rounded-full px-5 py-2 text-[13px] font-semibold border-none cursor-pointer transition-colors ${
                !yearly ? "bg-emerald-500 text-white" : "bg-transparent text-white/60"
              }`}
            >
              Mensuel
            </button>
            <button
              onClick={() => setYearly(true)}
              className={`rounded-full px-5 py-2 text-[13px] font-semibold border-none cursor-pointer transition-colors ${
                yearly ? "bg-emerald-500 text-white" : "bg-transparent text-white/60"
              }`}
            >
              Annuel <span className="opacity-80">(2 mois offerts)</span>
            </button>
          </Reveal>
        </div>
      </section>

      <section className="relative bg-white dark:bg-[#0b1a16] pb-24">
        <div className="mx-auto max-w-6xl px-5 sm:px-8 -mt-10">
          <div className="grid md:grid-cols-3 gap-6 items-start">
            {PLANS.map((plan, i) => (
              <Reveal key={plan.id} delay={i * 0.08}>
                <div
                  className={`relative h-full rounded-[28px] p-8 flex flex-col ${
                    plan.highlighted
                      ? "bg-[#053a30] border-2 border-emerald-400 shadow-2xl shadow-emerald-950/40 md:-translate-y-4"
                      : "bg-[var(--color-mist)] dark:bg-white/[0.03] border border-slate-200/70 dark:border-white/10"
                  }`}
                >
                  {plan.highlighted && (
                    <span className="absolute -top-3.5 left-1/2 -translate-x-1/2 inline-flex items-center gap-1 rounded-full bg-emerald-400 px-3 py-1 text-[11px] font-bold text-emerald-950">
                      <Sparkles size={12} /> Le plus choisi
                    </span>
                  )}

                  <h2
                    className={`font-display font-bold text-2xl ${
                      plan.highlighted ? "text-white" : "text-[var(--color-ink)] dark:text-white"
                    }`}
                  >
                    {plan.name}
                  </h2>
                  <p className={`mt-2 text-[14px] ${plan.highlighted ? "text-white/70" : "text-slate-500"}`}>
                    {plan.tagline}
                  </p>

                  <div className="mt-6">
                    {plan.monthlyPrice === null ? (
                      <span className={`font-display font-bold text-3xl ${plan.highlighted ? "text-white" : "text-[var(--color-ink)] dark:text-white"}`}>
                        Sur devis
                      </span>
                    ) : (
                      <div className="flex items-baseline gap-1.5">
                        <span className={`font-display font-bold text-4xl ${plan.highlighted ? "text-white" : "text-[var(--color-ink)] dark:text-white"}`}>
                          {formatFcfa(yearly ? plan.yearlyPrice! : plan.monthlyPrice)}
                        </span>
                        <span className={`text-[13px] ${plan.highlighted ? "text-white/60" : "text-slate-400"}`}>
                          / {yearly ? "an" : "mois"}
                        </span>
                      </div>
                    )}
                  </div>

                  <a
                    href={plan.monthlyPrice === null ? DEMO_WHATSAPP_LINK : planWhatsappLink(plan.name)}
                    target="_blank"
                    rel="noreferrer"
                    data-umami-event={`plan-cta-${plan.id}`}
                    className={`mt-6 inline-flex items-center justify-center gap-2 rounded-2xl px-5 py-3.5 text-[14px] font-bold no-underline transition-colors ${
                      plan.highlighted
                        ? "bg-emerald-500 hover:bg-emerald-400 text-white"
                        : "bg-white dark:bg-white/10 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-white/10 hover:bg-emerald-50"
                    }`}
                  >
                    <MessageCircle size={16} />
                    {plan.monthlyPrice === null ? "Nous contacter" : `Choisir ${plan.name}`}
                  </a>

                  <ul className="mt-8 space-y-3 flex-1">
                    {plan.features.map((f) => (
                      <li
                        key={f}
                        className={`flex items-start gap-2.5 text-[13.5px] leading-snug ${
                          plan.highlighted ? "text-white/85" : "text-slate-600 dark:text-slate-300"
                        }`}
                      >
                        <Check size={16} className="shrink-0 mt-0.5 text-emerald-400" />
                        {f}
                      </li>
                    ))}
                    {plan.notIncluded?.map((f) => (
                      <li key={f} className="flex items-start gap-2.5 text-[13.5px] leading-snug text-slate-400">
                        <X size={16} className="shrink-0 mt-0.5 text-slate-300 dark:text-slate-600" />
                        {f}
                      </li>
                    ))}
                  </ul>
                </div>
              </Reveal>
            ))}
          </div>

          <Reveal delay={0.2}>
            <div className="mt-10 rounded-[28px] bg-emerald-50 dark:bg-emerald-500/5 border border-emerald-100 dark:border-emerald-500/20 p-8 text-center">
              <span className="inline-flex items-center gap-1.5 text-[12px] font-mono uppercase tracking-[0.15em] text-emerald-700 dark:text-emerald-400">
                <Sparkles size={13} /> {PILOT_OFFER.title}
              </span>
              <p className="mt-3 max-w-2xl mx-auto text-[15px] leading-relaxed text-slate-600 dark:text-slate-300">
                {PILOT_OFFER.description}
              </p>
              <a
                href={DEMO_WHATSAPP_LINK}
                target="_blank"
                rel="noreferrer"
                data-umami-event="plan-cta-pilote"
                className="mt-5 inline-flex items-center gap-2 text-[14px] font-bold text-emerald-700 dark:text-emerald-400 no-underline"
              >
                Candidater au programme pilote →
              </a>
            </div>
          </Reveal>

          <div className="mt-24 max-w-2xl mx-auto">
            <Reveal className="text-center">
              <h2 className="font-display font-bold text-[var(--color-ink)] dark:text-white text-3xl tracking-tight">
                Questions sur les forfaits
              </h2>
            </Reveal>
            <div className="mt-8 space-y-6">
              {pricingFaqs.map((item) => (
                <Reveal key={item.q}>
                  <div>
                    <h3 className="font-display font-semibold text-[15px] text-[var(--color-ink)] dark:text-white">
                      {item.q}
                    </h3>
                    <p className="mt-1.5 text-[14px] leading-relaxed text-slate-500 dark:text-slate-400">
                      {item.a}
                    </p>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
