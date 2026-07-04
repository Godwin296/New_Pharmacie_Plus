"use client";

import * as React from "react";
import { ThemeProvider as NextThemesProvider } from "next-themes";

/**
 * 🌗 Fine couche autour de next-themes.
 *
 * attribute="class"   -> bascule la classe .dark sur <html> (voir @custom-variant
 *                         dans globals.css pour que Tailwind en tienne compte).
 * defaultTheme="system" -> respecte le thème OS tant que l'utilisateur n'a rien choisi.
 * enableSystem         -> autorise l'option "Système" en plus de clair/sombre.
 * storageKey="theme"   -> même clé localStorage que l'ancienne implémentation manuelle,
 *                         pour ne pas perdre le choix déjà enregistré chez les utilisateurs.
 * next-themes injecte un script inline qui pose la classe AVANT l'hydratation React,
 * ce qui supprime le flash de mauvais thème au chargement (contrairement à l'ancien
 * code qui ne posait la classe qu'après un useEffect).
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider attribute="class" defaultTheme="system" enableSystem storageKey="theme">
      {children}
    </NextThemesProvider>
  );
}
