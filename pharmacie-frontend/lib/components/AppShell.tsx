"use client";
/**
 * 🏛️ APP SHELL — Task 1/20
 *
 * Wrapper non-invasif qui injecte dans le layout existant :
 *   - NavigationProvider (pour les transitions directionnelles)
 *   - ThemeColorMeta (status bar clair/sombre dynamique)
 *   - Classes de safe area sur le conteneur principal
 *
 * UTILISATION dans app/layout.tsx :
 *   Remplacer le return actuel par :
 *     <AppShell>
 *       {/* tout le contenu existant du return */}
 *     </AppShell>
 *
 * Aucune autre modification du layout n'est nécessaire.
 */
import { NavigationProvider } from "@/lib/context/NavigationContext";
import ThemeColorMeta from "@/lib/components/ThemeColorMeta";

interface AppShellProps {
  children: React.ReactNode;
}

export default function AppShell({ children }: AppShellProps) {
  return (
    <NavigationProvider>
      <ThemeColorMeta />
      {/* 
        Conteneur racine avec gestion des safe areas iOS.
        pt-[env(safe-area-inset-top)] : espace pour le notch / Dynamic Island
        pb-[env(safe-area-inset-bottom)] : espace pour la home indicator
      */}
      <div className="min-h-[100dvh] flex flex-col pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
        {children}
      </div>
    </NavigationProvider>
  );
}
