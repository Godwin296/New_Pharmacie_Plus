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
        "bg-white/10 hover:bg-white/20 p-3 rounded-2xl border-0 text-white cursor-pointer transition-all outline-none"
      }
    >
      {mounted && (isDark ? <Sun size={20} /> : <Moon size={20} />)}
    </button>
  );
}
