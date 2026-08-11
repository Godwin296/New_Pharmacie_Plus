"use client";
/**
 * 🎬 TEMPLATE RACINE — Task 1/20
 *
 * Next.js remonte ce composant à CHAQUE navigation (contrairement au
 * layout.tsx qui persiste). C'est le point d'ancrage parfait pour
 * AnimatePresence + PageTransition.
 *
 * La clé est le pathname : quand il change, Framer Motion joue
 * exit sur l'ancienne page et enter sur la nouvelle.
 */
import { AnimatePresence } from "framer-motion";
import { usePathname } from "next/navigation";
import PageTransition from "@/lib/components/PageTransition";

export default function Template({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <AnimatePresence mode="popLayout" initial={false}>
      <PageTransition key={pathname}>{children}</PageTransition>
    </AnimatePresence>
  );
}
