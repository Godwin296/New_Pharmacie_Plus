"use client";

import { useRef } from "react";
import { motion, useScroll, useTransform } from "framer-motion";
import { ArrowRight, Search } from "lucide-react";
import { LiveStatusWidget } from "./LiveStatusWidget";
import { FloatingCapsules } from "./FloatingCapsules";
import { PulseLine } from "./PulseLine";
import { TiltCard } from "./TiltCard";

const headlineLines = [
  ["Le", "stock", "ne", "dort"],
  ["jamais.", "Vos", "patients"],
  ["non", "plus."],
];

const container = {
  hidden: {},
  show: {
    transition: { staggerChildren: 0.045, delayChildren: 0.15 },
  },
};

const word = {
  hidden: { opacity: 0, y: 28, rotateX: -40 },
  show: {
    opacity: 1,
    y: 0,
    rotateX: 0,
    transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] as const },
  },
};

export function Hero() {
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });

  const glowY = useTransform(scrollYProgress, [0, 1], [0, 140]);
  const contentY = useTransform(scrollYProgress, [0, 1], [0, 80]);
  const contentOpacity = useTransform(scrollYProgress, [0, 0.8], [1, 0]);
  const widgetY = useTransform(scrollYProgress, [0, 1], [0, 40]);

  return (
    <section
      ref={ref}
      id="top"
      className="relative overflow-hidden bg-[var(--color-ink)] pt-36 pb-40"
    >
      <FloatingCapsules />

      <motion.div
        aria-hidden
        style={{ y: glowY }}
        className="pointer-events-none absolute -top-40 left-1/2 h-[560px] w-[560px] -translate-x-1/2 rounded-full bg-emerald-500/20 blur-[120px]"
      />
      <motion.div
        aria-hidden
        style={{ y: glowY }}
        className="pointer-events-none absolute top-1/3 right-0 h-[420px] w-[420px] rounded-full bg-blue-500/15 blur-[110px]"
      />

      {/* Ambient ECG pulse threading behind the headline — pharma signature motif */}
      <div className="pointer-events-none absolute left-0 right-0 top-[30%] opacity-70">
        <PulseLine className="w-full h-24" stroke="#10b981" />
      </div>

      <motion.div style={{ y: contentY, opacity: contentOpacity }} className="relative mx-auto max-w-7xl px-5 sm:px-8">
        <div className="grid lg:grid-cols-[1.1fr_0.9fr] gap-16 items-center">
          <div>
            <motion.span
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-[12px] font-mono uppercase tracking-[0.15em] text-emerald-300"
            >
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
              </span>
              Conçu pour la zone CEMAC
            </motion.span>

            <motion.h1
              variants={container}
              initial="hidden"
              animate="show"
              style={{ perspective: 600 }}
              className="mt-7 font-display font-bold text-white text-[2.6rem] leading-[1.08] sm:text-6xl sm:leading-[1.05] tracking-tight"
            >
              {headlineLines.map((line, li) => (
                <span key={li} className="block overflow-hidden">
                  {line.map((w, wi) => (
                    <motion.span
                      key={wi}
                      variants={word}
                      className={`inline-block mr-[0.28em] ${w === "Vos" || w === "patients" ? "text-emerald-400" : ""}`}
                    >
                      {w}
                    </motion.span>
                  ))}
                </span>
              ))}
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.75 }}
              className="mt-6 max-w-lg text-[17px] leading-relaxed text-white/60"
            >
              Pharmacie+ relie la gestion d&apos;officine et l&apos;accès aux soins en un
              seul système : stock suivi en temps réel, ordonnances vérifiées,
              paiement Mobile Money — pensé pour fonctionner même quand la
              connexion ne suit pas.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.9 }}
              className="mt-10 flex flex-col sm:flex-row gap-4"
            >
              <a
                href="#pharmacies"
                className="group inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-500 hover:bg-emerald-400 px-7 py-4 text-[15px] font-bold text-[var(--color-ink)] no-underline transition-all hover:shadow-[0_0_30px_-6px_rgba(16,185,129,0.6)]"
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
            </motion.div>

            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.6, delay: 1.05 }}
              className="mt-6 text-[13px] text-white/35"
            >
              Isolation totale des données par pharmacie · FCFA natif · Orange
              Money &amp; MTN MoMo
            </motion.p>
          </div>

          <motion.div
            style={{ y: widgetY }}
            initial={{ opacity: 0, scale: 0.92, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.5, ease: [0.22, 1, 0.36, 1] }}
            className="flex justify-center lg:justify-end"
          >
            <TiltCard>
              <LiveStatusWidget />
            </TiltCard>
          </motion.div>
        </div>
      </motion.div>

      {/* Cinematic curved transition into the next section, instead of a hard cut */}
      <div className="absolute bottom-0 left-0 right-0 leading-[0]">
        <svg viewBox="0 0 1440 110" className="w-full h-[70px] sm:h-[110px]" preserveAspectRatio="none">
          <path d="M0,110 L0,40 C240,110 480,0 720,40 C960,80 1200,10 1440,50 L1440,110 Z" fill="var(--color-mist)" />
        </svg>
      </div>
    </section>
  );
}
