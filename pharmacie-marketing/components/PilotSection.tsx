import { Sparkles, Users2, MessageSquareHeart } from "lucide-react";
import { Reveal } from "./Reveal";
import { DEMO_WHATSAPP_LINK } from "@/lib/contact";

const perks = [
  {
    icon: Sparkles,
    title: "Conditions de lancement préférentielles",
    text: "Les premières pharmacies équipées bénéficient de conditions avantageuses, discutées directement avec vous.",
  },
  {
    icon: Users2,
    title: "Accompagnement personnalisé",
    text: "Installation, formation de votre équipe, import de votre stock existant — nous sommes à vos côtés à chaque étape.",
  },
  {
    icon: MessageSquareHeart,
    title: "Votre avis façonne le produit",
    text: "En tant que pharmacie pilote, vos retours orientent directement les prochaines fonctionnalités développées.",
  },
];

export function PilotSection() {
  return (
    <section className="relative bg-[var(--color-mist)] dark:bg-[#050e0c] py-24 sm:py-32">
      <div className="mx-auto max-w-5xl px-5 sm:px-8">
        <Reveal className="text-center max-w-2xl mx-auto">
          <span className="text-[12px] font-mono uppercase tracking-[0.2em] text-emerald-600">
            Programme pilote
          </span>
          <h2 className="mt-4 font-display font-bold text-[var(--color-ink)] dark:text-white text-4xl sm:text-5xl leading-[1.1] tracking-tight">
            Nous cherchons nos premières pharmacies pilotes.
          </h2>
          <p className="mt-5 text-[17px] leading-relaxed text-slate-600 dark:text-slate-400">
            Pharmacie+ est un produit jeune, construit avec des officines réelles
            plutôt que dans l&apos;abstrait. Rejoindre le programme pilote, c&apos;est
            avoir une influence directe sur l&apos;outil que vous utiliserez au
            quotidien.
          </p>
        </Reveal>

        <div className="mt-14 grid sm:grid-cols-3 gap-5">
          {perks.map((p, i) => (
            <Reveal key={p.title} delay={i * 0.08}>
              <div className="h-full rounded-[24px] bg-white dark:bg-[#0b1a16] border border-slate-200/70 dark:border-white/10 p-7">
                <div className="rounded-2xl bg-emerald-50 dark:bg-emerald-500/10 p-3 w-fit">
                  <p.icon className="h-6 w-6 text-emerald-600" />
                </div>
                <h3 className="mt-5 font-display font-bold text-[16px] text-[var(--color-ink)] dark:text-white">
                  {p.title}
                </h3>
                <p className="mt-2.5 text-[14px] leading-relaxed text-slate-500 dark:text-slate-400">
                  {p.text}
                </p>
              </div>
            </Reveal>
          ))}
        </div>

        <Reveal delay={0.2} className="mt-10 text-center">
          <a
            href={DEMO_WHATSAPP_LINK}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center justify-center rounded-2xl bg-emerald-600 hover:bg-emerald-500 px-7 py-4 text-[15px] font-bold text-white no-underline transition-colors"
          >
            Candidater comme pharmacie pilote
          </a>
        </Reveal>
      </div>
    </section>
  );
}
