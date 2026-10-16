"use client";

/**
 * 🚀 SPLASH SCREEN -- identité GLOBALE de la plateforme Pharmacie+, identique pour tous les
 * tenants (décision 16/10) : plus aucun appel à la config d'une pharmacie ici (l'ancienne
 * version appelait useConfigPharmacie() pour afficher le logo du tenant -- impossible à
 * fiabiliser sur un écran affiché avant même que le tenant soit connu, et incohérent avec
 * la marketplace où l'on entre sans pharmacie choisie).
 *
 * Visuel = l'image officielle public/static/SplashScreen.png, dont le mot "PHARMA" a été
 * effacé (public/static/splash-bg.webp, même image, bande de texte reconstruite). Le nom de
 * l'app est rendu en VRAI texte par-dessus ("PHARMACIE +") : net à toute résolution, modifiable
 * sans retoucher l'image.
 *
 * Quand il s'affiche : UNIQUEMENT à l'entrée dans l'app (voir lib/splashSession.ts). Le masquage
 * au rechargement est fait AVANT le premier rendu par un script inline dans app/layout.tsx
 * (attribut data-splash="vu" sur <html>) + la règle CSS dans app/globals.css -- c'est ce qui
 * évite tout clignotement. L'attribut `data-splash-root` ci-dessous est la cible de cette règle.
 *
 * Mise en page : l'image est un cadre 1152x2048 (9:16). `.splash-frame` (globals.css) le fait
 * "couvrir" l'écran en portrait (téléphone) ou le contient en paysage (ordinateur), et le texte
 * est positionné en % DU CADRE -- donc toujours calé sous le logo, quelle que soit la taille de
 * l'écran.
 */

import { useEffect } from "react";
import { motion } from "framer-motion";

interface Props {
  onComplete: () => void;
  /** Durée d'affichage du splash en millisecondes avant l'appel de onComplete. */
  duration?: number;
}

export default function SplashScreen({ onComplete, duration = 1500 }: Props) {
  useEffect(() => {
    const timer = setTimeout(onComplete, duration);
    return () => clearTimeout(timer);
  }, [onComplete, duration]);

  return (
    <motion.div
      key="splash"
      data-splash-root
      initial={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      className="splash-backdrop fixed inset-0 z-[100] overflow-hidden"
      role="status"
      aria-label="Chargement de Pharmacie +"
    >
      <div className="splash-frame">
        {/* eslint-disable-next-line @next/next/no-img-element -- image plein cadre, déjà optimisée (WebP) */}
        <img
          src="/static/splash-bg.webp"
          alt=""
          draggable={false}
          className="absolute inset-0 h-full w-full select-none"
        />
        <span
          className="splash-title absolute inset-x-0 text-center text-white"
          style={{ fontFamily: "Poppins, sans-serif" }}
        >
          PHARMACIE +
        </span>
      </div>
    </motion.div>
  );
}
