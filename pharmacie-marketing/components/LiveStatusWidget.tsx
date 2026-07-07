"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  PackageCheck,
  FileCheck2,
  ShieldCheck,
  AlertTriangle,
  Wallet,
} from "lucide-react";

type Event = {
  label: string;
  title: string;
  detail: string;
  icon: typeof PackageCheck;
  tone: "emerald" | "blue" | "amber";
};

const EVENTS: Event[] = [
  {
    label: "STOCK",
    title: "Paracétamol 500mg",
    detail: "Vente au guichet — stock 42 → 41",
    icon: PackageCheck,
    tone: "emerald",
  },
  {
    label: "ORDONNANCE",
    title: "Commande PHC-2026-00183",
    detail: "Reçue — en attente de validation pharmacien",
    icon: FileCheck2,
    tone: "blue",
  },
  {
    label: "PAIEMENT",
    title: "Orange Money — 12 500 FCFA",
    detail: "Vérifié par la caissière ✓",
    icon: ShieldCheck,
    tone: "emerald",
  },
  {
    label: "RETRAIT",
    title: "Commande PHC-2026-00183",
    detail: "Prête — à retirer en officine",
    icon: Wallet,
    tone: "blue",
  },
  {
    label: "ALERTE STOCK",
    title: "Vitamine C 500mg",
    detail: "Seuil critique — 3 unités restantes",
    icon: AlertTriangle,
    tone: "amber",
  },
];

const toneClasses: Record<Event["tone"], { bg: string; text: string; ring: string }> = {
  emerald: { bg: "bg-emerald-500/15", text: "text-emerald-400", ring: "ring-emerald-500/30" },
  blue: { bg: "bg-blue-500/15", text: "text-blue-400", ring: "ring-blue-500/30" },
  amber: { bg: "bg-amber-500/15", text: "text-amber-400", ring: "ring-amber-500/30" },
};

export function LiveStatusWidget() {
  const [index, setIndex] = useState(0);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mq.matches);
  }, []);

  useEffect(() => {
    const id = setInterval(() => {
      setIndex((i) => (i + 1) % EVENTS.length);
    }, 2800);
    return () => clearInterval(id);
  }, []);

  const current = EVENTS[index];
  const Icon = current.icon;
  const tone = toneClasses[current.tone];

  return (
    <div className="relative w-full max-w-md rounded-3xl border border-white/10 bg-[var(--color-ink-soft)]/80 backdrop-blur-xl p-6 shadow-2xl shadow-black/40">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
          </span>
          <span className="text-[11px] font-mono uppercase tracking-[0.2em] text-white/50">
            Activité en direct
          </span>
        </div>
        <span className="text-[11px] font-mono text-white/30">Pharmacie Dupont</span>
      </div>

      <div className="relative h-[104px] overflow-hidden">
        <AnimatePresence mode="wait">
          <motion.div
            key={index}
            initial={reducedMotion ? { opacity: 0 } : { opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reducedMotion ? { opacity: 0 } : { opacity: 0, y: -16 }}
            transition={{ duration: 0.45, ease: "easeOut" }}
            className="absolute inset-0 flex items-start gap-4"
          >
            <div className={`shrink-0 rounded-2xl p-3 ring-1 ${tone.bg} ${tone.ring}`}>
              <Icon className={`h-6 w-6 ${tone.text}`} />
            </div>
            <div className="min-w-0">
              <div className={`text-[10px] font-mono uppercase tracking-[0.2em] mb-1 ${tone.text}`}>
                {current.label}
              </div>
              <div className="font-display font-semibold text-white text-[15px] leading-snug truncate">
                {current.title}
              </div>
              <div className="text-white/50 text-[13px] mt-1 leading-snug">
                {current.detail}
              </div>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="mt-4 pt-4 border-t border-white/10 flex items-center justify-between">
        <div className="flex gap-1.5">
          {EVENTS.map((_, i) => (
            <span
              key={i}
              className={`h-1 rounded-full transition-all duration-300 ${
                i === index ? "w-5 bg-emerald-400" : "w-1.5 bg-white/15"
              }`}
            />
          ))}
        </div>
        <span className="text-[10px] font-mono text-white/30">WebSocket · temps réel</span>
      </div>
    </div>
  );
}
