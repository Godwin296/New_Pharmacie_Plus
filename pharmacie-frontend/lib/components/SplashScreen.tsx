"use client";

import { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useConfigPharmacie } from "@/lib/context/ConfigPharmacieContext";

interface Props {
  onComplete: () => void;
}

export default function SplashScreen({ onComplete }: Props) {
  const { config } = useConfigPharmacie();

  useEffect(() => {
    const timer = setTimeout(onComplete, 1500);
    return () => clearTimeout(timer);
  }, [onComplete]);

  return (
    <AnimatePresence>
      <motion.div
        key="splash"
        initial={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 1.015 }}
        transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
        className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-[#04241a]"
      >
        {/* Logo zone — grande et centrée */}
        <div className="flex flex-col items-center gap-6">
          {config?.logo ? (
            <div className="relative w-32 h-32 rounded-3xl overflow-hidden bg-white/5 ring-1 ring-white/10 flex items-center justify-center p-4">
              <img
                src={config.logo}
                alt={config.nom}
                className="w-full h-full object-contain"
              />
            </div>
          ) : (
            <div className="w-32 h-32 rounded-3xl bg-emerald-500/20 flex items-center justify-center">
              <span className="text-5xl font-bold text-emerald-400">P+</span>
            </div>
          )}
          
          <h1 className="text-3xl font-bold text-white tracking-tight" style={{ fontFamily: "Poppins, sans-serif" }}>
            Pharmacie+
          </h1>
        </div>

        {/* 3 dots pulse iOS style */}
        <div className="flex gap-2.5 mt-10">
          {[0, 1, 2].map((i) => (
            <motion.div
              key={i}
              className="w-3 h-3 rounded-full bg-emerald-400"
              animate={{ opacity: [0.3, 1, 0.3], scale: [0.8, 1.1, 0.8] }}
              transition={{
                duration: 1.2,
                repeat: Infinity,
                delay: i * 0.2,
                ease: "easeInOut",
              }}
            />
          ))}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}