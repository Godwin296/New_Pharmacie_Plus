"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Sun, Moon } from "lucide-react";

/**
 * 🌗 Bouton de bascule clair/sombre, basé sur next-themes.
 *
 * `mounted` évite un mismatch d'hydratation : next-themes pose la bonne classe .dark
 * sur <html> via un script inline AVANT l'hydratation React (donc pas de flash visuel),
 * mais React lui-même ne "connaît" resolvedTheme qu'après le premier rendu côté client.
 * Tant que mounted === false, on affiche un bouton neutre (sans icône) plutôt que de
 * risquer d'afficher la mauvaise icône puis de la changer brusquement.
 *
 * Doit être rendu à l'intérieur de <ThemeProvider> (voir lib/context/ThemeProvider.tsx).
 */
export function ThemeToggleButton({ className }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const isDark = mounted && resolvedTheme === "dark";

  return (
    <button
      type="button"
      aria-label="Basculer le thème clair/sombre"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className={
        className ??
        // 🔧 CORRECTIF (bug remonté en test, 30/07) : "text-white" codé en dur était pensé
        // pour un header sombre -- avec le header clair (bg-white/95), l'icône blanche
        // devenait invisible en mode clair (blanc sur blanc). Couleur adaptative désormais,
        // cohérente avec les autres boutons du header (hamburger, panier). active:scale-95
        // ajouté pour le retour tactile (spec app native -- aucun bouton ne doit paraître
        // inerte au toucher).
        "bg-slate-50 dark:bg-white/[0.06] hover:bg-emerald-50 dark:hover:bg-emerald-900/20 active:scale-95 p-2.5 rounded-2xl border-0 text-slate-700 dark:text-slate-200 cursor-pointer transition-all outline-none"
      }
    >
      {mounted && (isDark ? <Sun size={20} /> : <Moon size={20} />)}
    </button>
  );
}
