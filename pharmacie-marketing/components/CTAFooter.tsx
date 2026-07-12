import Image from "next/image";
import { Mail, Phone, MessageCircle, ArrowUpRight } from "lucide-react";
import { Reveal } from "./Reveal";
import { PulseLine } from "./PulseLine";
import { CONTACT, GENERAL_WHATSAPP_LINK, DEMO_WHATSAPP_LINK } from "@/lib/contact";

export function CTAFooter() {
  return (
    <>
      <section id="contact" className="relative bg-[var(--color-mist)] dark:bg-[#050e0c] py-24 sm:py-32 overflow-hidden">
        <div
          aria-hidden
          className="pointer-events-none absolute -top-24 left-1/2 -translate-x-1/2 h-[420px] w-[420px] rounded-full bg-emerald-400/20 blur-[110px]"
        />
        <div className="relative mx-auto max-w-4xl px-5 sm:px-8 text-center">
          <Reveal>
            <h2 className="font-display font-bold text-[var(--color-ink)] dark:text-white text-4xl sm:text-5xl leading-[1.1] tracking-tight">
              Parlons de votre officine.
            </h2>
            <p className="mt-5 text-[17px] leading-relaxed text-slate-600 dark:text-slate-400 max-w-xl mx-auto">
              Que vous gériez une pharmacie ou que vous cherchiez simplement à
              commander vos médicaments plus simplement, écrivez-nous.
            </p>

            <div className="mt-10 flex flex-col sm:flex-row gap-4 justify-center">
              <a
                href={GENERAL_WHATSAPP_LINK}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-500 hover:bg-emerald-400 px-7 py-4 text-[15px] font-bold text-white no-underline transition-all hover:shadow-[0_0_30px_-6px_rgba(16,185,129,0.5)]"
              >
                <MessageCircle size={17} />
                Écrire sur WhatsApp
              </a>
              <a
                href={`mailto:${CONTACT.email}`}
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-300 dark:border-white/15 hover:border-emerald-400 px-7 py-4 text-[15px] font-bold text-[var(--color-ink)] dark:text-white no-underline transition-colors"
              >
                <Mail size={17} />
                {CONTACT.email}
              </a>
            </div>
          </Reveal>
        </div>
      </section>

      <footer className="relative bg-brand-deep pt-20 pb-10 overflow-hidden">
        <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 opacity-40">
          <PulseLine className="w-full h-16" stroke="#0e7a4e" />
        </div>

        <div className="relative mx-auto max-w-7xl px-5 sm:px-8">
          <div className="grid sm:grid-cols-[1.3fr_1fr_1fr] gap-12 pb-12 border-b border-white/10">
            <div className="max-w-sm">
              <div className="flex items-center gap-2.5">
                <Image
                  src="/branding/icon-mark.png"
                  alt="Pharmacie+"
                  width={32}
                  height={32}
                  className="h-8 w-8 object-contain"
                />
                <span className="font-display font-bold text-white text-lg">
                  Pharmacie<span className="text-emerald-400">+</span>
                </span>
              </div>
              <p className="mt-4 text-[14px] leading-relaxed text-white/50">
                Le SaaS de gestion de pharmacie pour la zone CEMAC. Stock en
                temps réel, ordonnances sécurisées, Mobile Money — votre
                santé, notre priorité.
              </p>
              <a
                href={DEMO_WHATSAPP_LINK}
                target="_blank"
                rel="noreferrer"
                className="mt-5 inline-flex items-center gap-1.5 text-[13px] font-semibold text-emerald-300 no-underline"
              >
                Demander une démo
                <ArrowUpRight size={14} />
              </a>
            </div>

            <div>
              <div className="text-[11px] font-mono uppercase tracking-widest text-white/30 mb-4">
                Produit
              </div>
              <div className="flex flex-col gap-3">
                <a href="#pharmacies" className="text-[14px] text-white/60 hover:text-white no-underline transition-colors">
                  Pour les pharmacies
                </a>
                <a href="#clients" className="text-[14px] text-white/60 hover:text-white no-underline transition-colors">
                  Pour les patients
                </a>
                <a href="#confiance" className="text-[14px] text-white/60 hover:text-white no-underline transition-colors">
                  Sécurité
                </a>
                <a href="#faq" className="text-[14px] text-white/60 hover:text-white no-underline transition-colors">
                  FAQ
                </a>
              </div>
            </div>

            <div>
              <div className="text-[11px] font-mono uppercase tracking-widest text-white/30 mb-4">
                Contact
              </div>
              <div className="flex flex-col gap-3">
                <a href={`mailto:${CONTACT.email}`} className="flex items-center gap-2 text-[14px] text-white/60 hover:text-white no-underline transition-colors">
                  <Mail size={14} /> {CONTACT.email}
                </a>
                <a href={GENERAL_WHATSAPP_LINK} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-[14px] text-white/60 hover:text-white no-underline transition-colors">
                  <Phone size={14} /> WhatsApp
                </a>
              </div>
            </div>
          </div>

          <div className="pt-8 flex flex-col sm:flex-row items-center justify-between gap-3">
            <p className="text-[12px] text-white/30">
              © {new Date().getFullYear()} Pharmacie+ — Fait au Cameroun 🇨🇲 pour l&apos;Afrique Centrale
            </p>
            <p className="text-[12px] text-white/20">
              Isolation des données · FCFA natif · Orange Money &amp; MTN MoMo
            </p>
          </div>
        </div>
      </footer>
    </>
  );
}
