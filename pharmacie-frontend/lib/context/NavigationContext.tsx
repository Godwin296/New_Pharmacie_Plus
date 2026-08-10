"use client";
/**
 * 🧭 NAVIGATION CONTEXT — Task 1/20
 *
 * Tracker intelligent de l'historique de navigation pour déterminer
 * la direction de transition (forward / backward) à chaque changement de page.
 *
 * Utilisé par PageTransition pour animer slide-from-right en forward
 * et slide-from-left en backward — exactement comme iOS natif.
 */
import { createContext, useContext, useEffect, useRef, useState, useCallback } from "react";
import { usePathname } from "next/navigation";

interface NavigationContextType {
  direction: "forward" | "backward";
  isNavigating: boolean;
  history: string[];
}

const NavigationContext = createContext<NavigationContextType>({
  direction: "forward",
  isNavigating: false,
  history: [],
});

/**
 * Détermine la profondeur logique d'une route pour le fallback
 * quand l'historique ne suffit pas (ex: lien direct, refresh).
 */
const ROUTE_DEPTH: Record<string, number> = {
  "/": 0,
  "/login": 0,
  "/catalogue": 1,
  "/panier": 1,
  "/commandes": 1,
  "/profil": 1,
  "/produit": 2, // prefix match
};

function getRouteDepth(path: string): number {
  if (ROUTE_DEPTH[path] !== undefined) return ROUTE_DEPTH[path];
  // Check prefixes (e.g. /produit/123)
  for (const [prefix, depth] of Object.entries(ROUTE_DEPTH)) {
    if (path.startsWith(prefix + "/")) return depth;
  }
  return 1;
}

export function NavigationProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [direction, setDirection] = useState<"forward" | "backward">("forward");
  const [isNavigating, setIsNavigating] = useState(false);
  const historyRef = useRef<string[]>([]);
  const prevPathnameRef = useRef<string>("");
  const isFirstRenderRef = useRef(true);

  useEffect(() => {
    // Premier montage : initialiser l'historique sans animation
    if (isFirstRenderRef.current) {
      isFirstRenderRef.current = false;
      historyRef.current = [pathname];
      prevPathnameRef.current = pathname;
      return;
    }

    const prev = prevPathnameRef.current;
    if (!prev || pathname === prev) return;

    setIsNavigating(true);

    const history = historyRef.current;
    const prevIndex = history.indexOf(pathname);

    if (prevIndex !== -1 && prevIndex < history.length - 1) {
      // 🔙 On revient en arrière dans l'historique (back button, swipe-back)
      setDirection("backward");
      historyRef.current = history.slice(0, prevIndex + 1);
    } else {
      // 🔜 Nouvelle page — forward par défaut
      // Fallback par profondeur de route si l'historique est neuf
      const prevDepth = getRouteDepth(prev);
      const currDepth = getRouteDepth(pathname);
      setDirection(currDepth >= prevDepth ? "forward" : "backward");
      historyRef.current = [...history, pathname];
    }

    prevPathnameRef.current = pathname;

    // Libère le flag après la durée de transition
    const timer = setTimeout(() => setIsNavigating(false), 400);
    return () => clearTimeout(timer);
  }, [pathname]);

  const value: NavigationContextType = {
    direction,
    isNavigating,
    history: historyRef.current,
  };

  return (
    <NavigationContext.Provider value={value}>
      {children}
    </NavigationContext.Provider>
  );
}

export function useNavigation() {
  const ctx = useContext(NavigationContext);
  if (!ctx) {
    throw new Error("useNavigation must be used within NavigationProvider");
  }
  return ctx;
}
