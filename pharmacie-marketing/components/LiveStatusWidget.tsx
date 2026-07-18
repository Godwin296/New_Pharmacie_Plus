"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  PackageCheck,
  FileCheck2,
  ShieldCheck,
  AlertTriangle,
  Wallet,
  Plus,
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
    label: "Stock",
    title: "Paracétamol 500mg",
    detail: "Vente au guichet — stock 42 → 41",
    icon: PackageCheck,
    tone: "emerald",
  },
  {
    label: "Ordonnance",
    title: "Commande PHC-2026-00183",
    detail: "Reçue — en attente de validation pharmacien",
    icon: FileCheck2,
    tone: "blue",
  },
  {
    label: "Paiement",
    title: "Orange Money — 12 500 FCFA",
    detail: "Vérifié par la caissière ✓",
    icon: ShieldCheck,
    tone: "emerald",
  },
  {
    label: "Retrait",
    title: "Commande PHC-2026-00183",
    detail: "Prête — à retirer en officine",
    icon: Wallet,
    tone: "blue",
  },
  {
    label: "Alerte stock",
    title: "Vitamine C 500mg",
    detail: "Seuil critique — 3 unités restantes",
    icon: AlertTriangle,
    tone: "amber",
  },
];

const toneClasses: Record<Event["tone"], { bg: string; text: string; ring: string }> = {
  emerald: { bg: "bg-emerald-50", text: "text-emerald-600", ring: "ring-emerald-100" },
  blue: { bg: "bg-blue-50", text: "text-blue-600", ring: "ring-blue-100" },
  amber: { bg: "bg-amber-50", text: "text-amber-600", ring: "ring-amber-100" },
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
    <div className="relative w-full max-w-md rounded-[28px] bg-white/95 backdrop-blur-xl p-6 shadow-2xl shadow-emerald-950/30 border border-white/60">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <div className="flex items-center justify-center h-6 w-6 rounded-full bg-emerald-500">
            <Plus className="h-3.5 w-3.5 text-white" strokeWidth={3} />
          </div>
          <span className="text-[12px] font-semibold text-slate-500">
            Activité de l&apos;officine
          </span>
        </div>
        <span className="text-[11px] font-medium text-slate-400">
          Aperçu
        </span>
      </div>

      <div className="relative h-[100px] overflow-hidden">
        <AnimatePresence mode="wait">
          <motion.div
            key={index}
            initial={reducedMotion ? { opacity: 0 } : { opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reducedMotion ? { opacity: 0 } : { opacity: 0, y: -14 }}
            transition={{ duration: 0.45, ease: "easeOut" }}
            className="absolute inset-0 flex items-start gap-4"
          >
            <div className={`shrink-0 rounded-2xl p-3 ring-4 ${tone.bg} ${tone.ring}`}>
              <Icon className={`h-6 w-6 ${tone.text}`} />
            </div>
            <div className="min-w-0">
              <div className={`text-[11px] font-semibold mb-1 ${tone.text}`}>
                {current.label}
              </div>
              <div className="font-display font-semibold text-[var(--color-ink)] text-[15px] leading-snug truncate">
                {current.title}
              </div>
              <div className="text-slate-500 text-[13px] mt-1 leading-snug">
                {current.detail}
              </div>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between">
        <div className="flex gap-1.5">
          {EVENTS.map((_, i) => (
            <span
              key={i}
              className={`h-1 rounded-full transition-all duration-300 ${
                i === index ? "w-5 bg-emerald-500" : "w-1.5 bg-slate-200"
              }`}
            />
          ))}
        </div>
        <span className="text-[11px] text-slate-400">Exemple illustratif</span>
      </div>
    </div>
  );
}
