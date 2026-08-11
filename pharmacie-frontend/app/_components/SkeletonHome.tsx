"use client";
/**
 * 🦴 SKELETON HOME — Affiché immédiatement après le splash screen
 *
 * Pendant que les données chargent (infos pharmacie, catalogue, commandes...),
 * on montre un squelette qui ressemble EXACTEMENT à la structure de la page
 * d'accueil. L'utilisateur "voit" déjà l'app, même si les données ne sont
 * pas encore là. C'est le pattern natif (Instagram, Twitter, etc.).
 *
 * Aucun spinner circulaire. Aucun texte "Chargement...". Juste des
 * placeholders gris qui pulse doucement.
 */
import { motion } from "framer-motion";

function SkeletonPulse({ className }: { className?: string }) {
  return (
    <div
      className={`
        animate-pulse rounded-xl bg-slate-200 dark:bg-white/[0.06]
        ${className || ""}
      `}
    />
  );
}

export default function SkeletonHome() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2 }}
      className="min-h-[100dvh] bg-white dark:bg-[#050e0c]"
    >
      {/* Header */}
      <div className="px-4 pt-4 pb-3">
        <div className="flex items-center justify-between">
          <SkeletonPulse className="h-5 w-32 rounded-lg" />
          <SkeletonPulse className="h-9 w-9 rounded-full" />
        </div>
      </div>

      {/* Barre de recherche */}
      <div className="px-4 pb-4">
        <SkeletonPulse className="h-12 w-full rounded-2xl" />
      </div>

      {/* Bannière promo */}
      <div className="px-4 pb-5">
        <SkeletonPulse className="h-36 w-full rounded-2xl" />
      </div>

      {/* Catégories */}
      <div className="px-4 pb-5">
        <div className="flex items-center justify-between mb-3">
          <SkeletonPulse className="h-5 w-24 rounded-lg" />
          <SkeletonPulse className="h-4 w-12 rounded" />
        </div>
        <div className="flex gap-3 overflow-hidden">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex flex-col items-center gap-2 min-w-[72px]">
              <SkeletonPulse className="h-14 w-14 rounded-2xl" />
              <SkeletonPulse className="h-3 w-14 rounded" />
            </div>
          ))}
        </div>
      </div>

      {/* Produits populaires */}
      <div className="px-4 pb-6">
        <div className="flex items-center justify-between mb-3">
          <SkeletonPulse className="h-5 w-32 rounded-lg" />
          <SkeletonPulse className="h-4 w-12 rounded" />
        </div>
        <div className="flex gap-3 overflow-hidden">
          {[1, 2, 3].map((i) => (
            <div key={i} className="min-w-[160px] flex flex-col gap-2">
              <SkeletonPulse className="h-40 w-full rounded-2xl" />
              <SkeletonPulse className="h-4 w-28 rounded" />
              <SkeletonPulse className="h-3 w-20 rounded" />
              <SkeletonPulse className="h-5 w-16 rounded-lg" />
            </div>
          ))}
        </div>
      </div>

      {/* Bottom nav placeholder */}
      <div className="fixed bottom-0 left-0 right-0 h-16 bg-white dark:bg-[#050e0c] border-t border-slate-100 dark:border-white/5 flex items-center justify-around px-2">
        {[1, 2, 3, 4].map((i) => (
          <SkeletonPulse key={i} className="h-8 w-12 rounded-lg" />
        ))}
      </div>
    </motion.div>
  );
}
