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
      className="relative overflow-hidden bg-brand-deep pt-36 pb-40"
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
        <PulseLine className="w-full h-24" stroke="#158f5f" />
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
                className="group inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-500 hover:bg-emerald-400 px-7 py-4 text-[15px] font-bold text-white no-underline transition-all hover:shadow-[0_0_30px_-6px_rgba(16,185,129,0.6)]"
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

      {/* Paint-drip transition: the hero's dark paint drips down over the light wall below */}
      <div className="absolute bottom-0 left-0 right-0 leading-[0] translate-y-[1px]">
        <svg viewBox="0 0 1440 220" className="w-full h-[130px] sm:h-[220px]" preserveAspectRatio="none">
          {/* light wall base */}
          <rect x="0" y="0" width="1440" height="220" fill="var(--color-mist)" />

          <defs>
            <linearGradient id="paintGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#0a5033" />
              <stop offset="100%" stopColor="#0b6440" />
            </linearGradient>
          </defs>

          {/* irregular dark paint edge, coming down from the hero */}
          <motion.path
            fill="url(#paintGrad)"
            animate={{
              d: [
                "M0,0 L1440,0 L1440,58 C1260,90 1120,40 980,72 C840,100 700,48 560,78 C420,102 280,50 140,80 C90,88 40,76 0,70 Z",
                "M0,0 L1440,0 L1440,66 C1260,72 1120,58 980,80 C840,92 700,60 560,70 C420,88 280,62 140,74 C90,80 40,68 0,62 Z",
                "M0,0 L1440,0 L1440,58 C1260,90 1120,40 980,72 C840,100 700,48 560,78 C420,102 280,50 140,80 C90,88 40,76 0,70 Z",
              ],
            }}
            transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
          />

          {/* dripping streaks + droplets */}
          {[
            { x: 70, y: 78, len: 88, w: 7, dur: 5.2, delay: 0 },
            { x: 190, y: 66, len: 54, w: 5, dur: 4.4, delay: 0.7 },
            { x: 330, y: 96, len: 118, w: 8, dur: 6.2, delay: 1.3 },
            { x: 470, y: 62, len: 46, w: 4, dur: 3.9, delay: 0.3 },
            { x: 610, y: 86, len: 96, w: 6, dur: 5.6, delay: 1.8 },
            { x: 760, y: 72, len: 68, w: 5, dur: 4.7, delay: 0.2 },
            { x: 900, y: 100, len: 128, w: 9, dur: 6.6, delay: 1.0 },
            { x: 1040, y: 64, len: 52, w: 4, dur: 4.1, delay: 1.5 },
            { x: 1180, y: 84, len: 90, w: 6, dur: 5.4, delay: 0.5 },
            { x: 1320, y: 76, len: 74, w: 5, dur: 4.9, delay: 2.0 },
          ].map((d, i) => (
            <g key={i}>
              <motion.line
                x1={d.x}
                y1={d.y}
                x2={d.x}
                y2={d.y + d.len}
                stroke={i % 2 === 0 ? "#0b6440" : "#0a5570"}
                strokeWidth={d.w}
                strokeLinecap="round"
                initial={{ pathLength: 0, opacity: 0.9 }}
                animate={{ pathLength: [0, 1, 1, 0] }}
                transition={{
                  duration: d.dur,
                  times: [0, 0.4, 0.8, 1],
                  repeat: Infinity,
                  ease: "easeInOut",
                  delay: d.delay,
                }}
              />
              <motion.circle
                cx={d.x}
                cy={d.y + d.len}
                r={d.w * 0.95}
                fill={i % 2 === 0 ? "#0b6440" : "#0a5570"}
                animate={{ opacity: [0, 0, 1, 1, 0], scale: [0.5, 0.5, 1, 1, 0.5] }}
                transition={{
                  duration: d.dur,
                  times: [0, 0.38, 0.45, 0.8, 0.95],
                  repeat: Infinity,
                  ease: "easeInOut",
                  delay: d.delay,
                }}
              />
            </g>
          ))}
        </svg>
      </div>
    </section>
  );
}
