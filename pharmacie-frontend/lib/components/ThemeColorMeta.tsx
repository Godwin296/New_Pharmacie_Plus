"use client";
/**
 * 🎨 THEME COLOR META — Task 1/20
 *
 * Met à jour dynamiquement la balise <meta name="theme-color"> selon
 * le thème actuel (clair/sombre). Cela colore la status bar du navigateur
 * sur mobile (Android) et la barre d'outils (iOS Safari en mode standalone/PWA).
 *
 * Couleurs synchronisées avec globals.css :
 *   - Clair : #ffffff (blanc pur)
 *   - Sombre  : #050e0c (vert très profond, identique au fond dark)
 */
import { useEffect } from "react";
import { useTheme } from "next-themes";

const THEME_COLORS = {
  light: "#ffffff",
  dark: "#050e0c",
};

export default function ThemeColorMeta() {
  const { resolvedTheme } = useTheme();

  useEffect(() => {
    const theme = resolvedTheme === "dark" ? "dark" : "light";
    const color = THEME_COLORS[theme];

    // Met à jour ou crée la balise theme-color
    let meta = document.querySelector('meta[name="theme-color"]') as HTMLMetaElement | null;
    if (!meta) {
      meta = document.createElement("meta");
      meta.name = "theme-color";
      document.head.appendChild(meta);
    }
    meta.content = color;

    // Met aussi à jour apple-mobile-web-app-status-bar-style pour iOS
    let appleMeta = document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]') as HTMLMetaElement | null;
    if (!appleMeta) {
      appleMeta = document.createElement("meta");
      appleMeta.name = "apple-mobile-web-app-status-bar-style";
      document.head.appendChild(appleMeta);
    }
    // "black-translucent" permet à la web app de s'étendre sous la status bar
    // en mode sombre on met "black", en clair on met "default"
    appleMeta.content = theme === "dark" ? "black" : "default";
  }, [resolvedTheme]);

  return null;
}
