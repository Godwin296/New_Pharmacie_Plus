import { ArrowRight, Search } from "lucide-react";
import { LiveStatusWidget } from "./LiveStatusWidget";

export function Hero() {
  return (
    <section
      id="top"
      className="relative overflow-hidden bg-[var(--color-ink)] pt-36 pb-24 sm:pb-32"
    >
      {/* Ambient glow — restrained, not decorative confetti */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 left-1/2 h-[560px] w-[560px] -translate-x-1/2 rounded-full bg-emerald-500/20 blur-[120px]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute top-1/3 right-0 h-[420px] w-[420px] rounded-full bg-blue-500/15 blur-[110px]"
      />

      <div className="relative mx-auto max-w-7xl px-5 sm:px-8">
        <div className="grid lg:grid-cols-[1.1fr_0.9fr] gap-16 items-center">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-[12px] font-mono uppercase tracking-[0.15em] text-emerald-300">
              Conçu pour la zone CEMAC
            </span>

            <h1 className="mt-7 font-display font-bold text-white text-[2.6rem] leading-[1.08] sm:text-6xl sm:leading-[1.05] tracking-tight">
              Le stock ne dort
              <br />
              jamais. <span className="text-emerald-400">Vos patients</span>
              <br />
              non plus.
            </h1>

            <p className="mt-6 max-w-lg text-[17px] leading-relaxed text-white/60">
              Pharmacie+ relie la gestion d&apos;officine et l&apos;accès aux soins en un
              seul système : stock suivi en temps réel, ordonnances vérifiées,
              paiement Mobile Money — pensé pour fonctionner même quand la
              connexion ne suit pas.
            </p>

            <div className="mt-10 flex flex-col sm:flex-row gap-4">
              <a
                href="#pharmacies"
                className="group inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-500 hover:bg-emerald-400 px-7 py-4 text-[15px] font-bold text-[var(--color-ink)] no-underline transition-all"
              >
                Je gère une pharmacie
                <ArrowRight size={17} className="group-hover:translate-x-0.5 transition-transform" />
              </a>
              <a
                href="#clients"
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/15 bg-white/[0.03] hover:bg-white/[0.08] px-7 py-4 text-[15px] font-bold text-white no-underline transition-all"
              >
                <Search size={17} />
                Je cherche mes médicaments
              </a>
            </div>

            <p className="mt-6 text-[13px] text-white/35">
              Isolation totale des données par pharmacie · FCFA natif · Orange
              Money &amp; MTN MoMo
            </p>
          </div>

          <div className="flex justify-center lg:justify-end">
            <LiveStatusWidget />
          </div>
        </div>
      </div>
    </section>
  );
}
