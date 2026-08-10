"use client";
/**
 * 🚀 SPLASH SCREEN NATIF — Refonte radicale
 *
 * Philosophie : "L'app est déjà là, elle charge silencieusement."
 *
 * Ce qu'on retire par rapport à l'ancien :
 *   ❌ 6 secondes d'attente → 1.5s max
 *   ❌ Masses lumineuses qui dérivent (web marketing)
 *   ❌ Tracé ECG animé (trop bruyant visuellement)
 *   ❌ Salutation conversationnelle (pas natif)
 *   ❌ Dégradé brand-deep (même que le site marketing)
 *   ❌ Halo blur-2xl derrière le logo
 *
 * Ce qu'on garde :
 *   ✅ Logo centré, fade-in doux
 *   ✅ Couleur de fond du brand (unie, pas dégradée)
 *   ✅ Exit rapide et élégant
 *
 * Ce qu'on ajoute :
 *   🆕 Fond uni sombre (#04241a) — distinct du site marketing
 *   🆕 Scale subtil 0.92→1 + opacity (pas de rotation, pas de spring agressif)
 *   🆕 Exit en 0.35s (scale 1→1.015 + fade)
 *   🆕 Indicateur de chargement minimaliste (3 dots qui pulse, style iOS)
 *   🆕 Appel à onComplete pour déclencher le skeleton home
 */
import { motion } from "framer-motion";
import { useEffect } from "react";

interface SplashScreenProps {
  onComplete?: () => void;
  duration?: number; // ms, défaut 1500
}

export default function SplashScreen({
  onComplete,
  duration = 1500,
}: SplashScreenProps) {
  useEffect(() => {
    const timer = setTimeout(() => {
      onComplete?.();
    }, duration);
    return () => clearTimeout(timer);
  }, [duration, onComplete]);

  return (
    <motion.div
      key="splash"
      exit={{ opacity: 0, scale: 1.015 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      className="fixed inset-0 z-[150] flex flex-col items-center justify-center bg-[#04241a]"
    >
      {/* Logo : apparition douce, scale subtil */}
      <motion.div
        initial={{ opacity: 0, scale: 0.92 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="relative"
      >
        {/* Lueur très discrète, statique, pas de blur excessif */}
        <div className="absolute inset-0 -m-4 rounded-3xl bg-emerald-500/8" />

        {/* Logo container — style iOS app icon */}
        <div className="relative h-20 w-20 bg-white rounded-[1.125rem] flex items-center justify-center shadow-lg shadow-black/15">
          {/* Ici, remplace par ton vrai logo SVG ou Image */}
          <svg
            viewBox="0 0 24 24"
            fill="none"
            className="w-10 h-10 text-[#0e9f6e]"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
            <path d="M12 5 9.04 12.5" />
            <path d="m15 12.5-3-7.5" />
          </svg>
        </div>
      </motion.div>

      {/* Nom de l'app — discret, en dessous du logo */}
      <motion.span
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15, duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
        className="mt-5 font-display text-[15px] font-semibold text-white/90 tracking-tight"
      >
        Pharmacie+
      </motion.span>

      {/* Indicateur de chargement minimaliste — 3 dots style iOS */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4, duration: 0.3 }}
        className="mt-6 flex items-center gap-1.5"
      >
        {[0, 1, 2].map((i) => (
          <motion.div
            key={i}
            className="w-1.5 h-1.5 rounded-full bg-emerald-400/60"
            animate={{
              opacity: [0.3, 1, 0.3],
              scale: [0.8, 1.1, 0.8],
            }}
            transition={{
              duration: 1.2,
              repeat: Infinity,
              delay: i * 0.2,
              ease: "easeInOut",
            }}
          />
        ))}
      </motion.div>
    </motion.div>
  );
}
