import Image from "next/image";
import { Mail, Phone, MessageCircle } from "lucide-react";
import { Reveal } from "./Reveal";

export function CTAFooter() {
  return (
    <>
      <section id="contact" className="relative bg-[var(--color-mist)] py-24 sm:py-32">
        <div className="mx-auto max-w-4xl px-5 sm:px-8 text-center">
          <Reveal>
            <h2 className="font-display font-bold text-[var(--color-ink)] text-4xl sm:text-5xl leading-[1.1] tracking-tight">
              Parlons de votre officine.
            </h2>
            <p className="mt-5 text-[17px] leading-relaxed text-slate-600 max-w-xl mx-auto">
              Que vous gériez une pharmacie ou que vous cherchiez simplement à
              commander vos médicaments plus simplement, écrivez-nous.
            </p>

            <div className="mt-10 flex flex-col sm:flex-row gap-4 justify-center">
              <a
                href="https://wa.me/237000000000"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-500 hover:bg-emerald-400 px-7 py-4 text-[15px] font-bold text-[var(--color-ink)] no-underline transition-colors"
              >
                <MessageCircle size={17} />
                Écrire sur WhatsApp
              </a>
              <a
                href="mailto:contact@pharmacieplus.cm"
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-300 hover:border-emerald-400 px-7 py-4 text-[15px] font-bold text-[var(--color-ink)] no-underline transition-colors"
              >
                <Mail size={17} />
                contact@pharmacieplus.cm
              </a>
            </div>
          </Reveal>
        </div>
      </section>

      <footer className="bg-[var(--color-ink)] pt-16 pb-10">
        <div className="mx-auto max-w-7xl px-5 sm:px-8">
          <div className="flex flex-col sm:flex-row justify-between gap-10 pb-10 border-b border-white/10">
            <div className="max-w-xs">
              <div className="flex items-center gap-2.5">
                <Image
                  src="/branding/icon-mark.png"
                  alt="Pharmacie+"
                  width={28}
                  height={28}
                  className="h-7 w-7 object-contain"
                />
                <span className="font-display font-bold text-white text-[15px]">
                  Pharmacie<span className="text-emerald-400">+</span>
                </span>
              </div>
              <p className="mt-4 text-[13px] leading-relaxed text-white/40">
                Le SaaS de gestion de pharmacie pour la zone CEMAC. Votre
                santé, notre priorité.
              </p>
            </div>

            <div className="flex gap-16">
              <div>
                <div className="text-[11px] font-mono uppercase tracking-widest text-white/30 mb-3">
                  Produit
                </div>
                <div className="flex flex-col gap-2.5">
                  <a href="#pharmacies" className="text-[14px] text-white/60 hover:text-white no-underline">
                    Pour les pharmacies
                  </a>
                  <a href="#clients" className="text-[14px] text-white/60 hover:text-white no-underline">
                    Pour les patients
                  </a>
                  <a href="#confiance" className="text-[14px] text-white/60 hover:text-white no-underline">
                    Sécurité
                  </a>
                </div>
              </div>

              <div>
                <div className="text-[11px] font-mono uppercase tracking-widest text-white/30 mb-3">
                  Contact
                </div>
                <div className="flex flex-col gap-2.5">
                  <a href="mailto:contact@pharmacieplus.cm" className="flex items-center gap-2 text-[14px] text-white/60 hover:text-white no-underline">
                    <Mail size={14} /> contact@pharmacieplus.cm
                  </a>
                  <a href="https://wa.me/237000000000" target="_blank" rel="noreferrer" className="flex items-center gap-2 text-[14px] text-white/60 hover:text-white no-underline">
                    <Phone size={14} /> WhatsApp
                  </a>
                </div>
              </div>
            </div>
          </div>

          <p className="pt-8 text-center text-[12px] text-white/25">
            © {new Date().getFullYear()} Pharmacie+ — Fait au Cameroun 🇨🇲 pour l&apos;Afrique Centrale
          </p>
        </div>
      </footer>
    </>
  );
}
