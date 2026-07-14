import { FileUp, ShieldCheck, Radio, PackageCheck, MessageCircle } from "lucide-react";
import { Reveal } from "./Reveal";
import { CLIENT_WHATSAPP_LINK } from "@/lib/contact";

const steps = [
  {
    n: "01",
    icon: FileUp,
    title: "Envoyez votre ordonnance",
    text: "Prenez-la en photo depuis votre téléphone et transmettez-la en toute sécurité.",
  },
  {
    n: "02",
    icon: ShieldCheck,
    title: "Payez par Mobile Money",
    text: "Orange Money ou MTN MoMo — votre paiement est vérifié avant préparation.",
  },
  {
    n: "03",
    icon: Radio,
    title: "Suivez la préparation",
    text: "Le statut de votre commande évolue en temps réel, jusqu'à la sortie de caisse.",
  },
  {
    n: "04",
    icon: PackageCheck,
    title: "Retirez en pharmacie",
    text: "Récupérez votre commande et votre facture, déjà prête à votre arrivée.",
  },
];

export function ClientSection() {
  return (
    <section id="clients" className="relative bg-white dark:bg-[#0b1a16] py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <div className="grid lg:grid-cols-[0.85fr_1.15fr] gap-16 items-start">
          <Reveal>
            <span className="text-[12px] font-mono uppercase tracking-[0.2em] text-blue-600">
              Pour vous
            </span>
            <h2 className="mt-4 font-display font-bold text-[var(--color-ink)] dark:text-white text-4xl sm:text-5xl leading-[1.1] tracking-tight">
              Commandez vos médicaments sans faire la queue.
            </h2>
            <p className="mt-5 text-[17px] leading-relaxed text-slate-600 dark:text-slate-400">
              Si votre pharmacie utilise déjà Pharmacie+, vous pouvez consulter
              son catalogue, envoyer votre ordonnance et suivre votre commande
              depuis chez vous.
            </p>

            <div className="mt-8 rounded-2xl bg-[var(--color-mist)] dark:bg-[#050e0c] border border-emerald-100 p-6">
              <p className="text-[14px] text-slate-600 dark:text-slate-400 leading-relaxed">
                <strong className="text-[var(--color-ink)] dark:text-white">Votre pharmacie n&apos;est pas encore
                équipée ?</strong> Parlez-lui de Pharmacie+, ou contactez-nous et
                nous nous en chargeons.
              </p>
              <a
                href={CLIENT_WHATSAPP_LINK}
                target="_blank"
                rel="noreferrer"
                className="mt-4 inline-flex items-center gap-2 text-[14px] font-bold text-emerald-700 no-underline"
              >
                <MessageCircle size={16} />
                Recommander ma pharmacie
              </a>
            </div>
          </Reveal>

          <div className="relative">
            {/* Connecting line — real sequence, so numbering carries information */}
            <div
              aria-hidden
              className="hidden sm:block absolute left-[27px] top-10 bottom-10 w-px bg-gradient-to-b from-blue-200 via-emerald-200 to-transparent"
            />
            <div className="space-y-4">
              {steps.map((step, i) => (
                <Reveal key={step.n} delay={i * 0.08}>
                  <div className="relative flex gap-5 rounded-3xl border border-slate-200/70 dark:border-white/10 bg-white dark:bg-[#0b1a16] p-6 hover:border-emerald-200 transition-colors">
                    <div className="relative z-10 shrink-0 h-14 w-14 rounded-2xl bg-[var(--color-mist)] dark:bg-[#050e0c] border border-emerald-100 flex items-center justify-center">
                      <step.icon className="h-6 w-6 text-emerald-600" />
                    </div>
                    <div>
                      <span className="text-[11px] font-mono text-slate-400 dark:text-slate-500 tracking-widest">
                        ÉTAPE {step.n}
                      </span>
                      <h3 className="font-display font-bold text-[17px] text-[var(--color-ink)] dark:text-white mt-0.5">
                        {step.title}
                      </h3>
                      <p className="mt-1.5 text-[14px] leading-relaxed text-slate-500 dark:text-slate-400">
                        {step.text}
                      </p>
                    </div>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
