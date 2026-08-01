"use client";
import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, AlertCircle, Info } from "lucide-react";

/**
 * 🍞 SYSTÈME DE TOAST PARTAGÉ -- remplace les alert()/confirm() du navigateur partout
 * dans l'app (ils bloquent le fil d'exécution et ont l'air d'une page web, pas d'une
 * app native). Extrait du catalogue (app/catalogue/page.tsx, où ce système avait été
 * conçu en premier) vers ce hook partagé, pour que chaque nouvelle page de la refonte
 * UI/UX en bénéficie sans dupliquer le code -- exactement la remarque du 30/07 ("celui
 * du catalogue peut être extrait en composant partagé").
 *
 * Usage dans une page :
 *   const { toasts, showToast } = useToast();
 *   showToast("Ajouté au panier", "success");
 *   ...
 *   return (
 *     <div>
 *       ... contenu de la page ...
 *       <ToastContainer toasts={toasts} />
 *     </div>
 *   );
 */
export type ToastType = "success" | "error" | "info";
export interface ToastState {
  id: number;
  message: string;
  type: ToastType;
}

export function useToast() {
  const [toasts, setToasts] = useState<ToastState[]>([]);
  const showToast = (message: string, type: ToastType = "info") => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3000);
  };
  return { toasts, showToast };
}

/**
 * Empilé en bas d'écran, au-dessus de la bottom nav (z-[140] < 150 du splash screen,
 * mais > la nav fixe à z-40) -- mêmes valeurs que l'implémentation d'origine du
 * catalogue, pour un rendu identique partout où ce composant est utilisé.
 */
export function ToastContainer({ toasts }: { toasts: ToastState[] }) {
  return (
    <div className="fixed bottom-24 left-0 right-0 z-[140] flex flex-col items-center gap-2 px-4 pointer-events-none">
      <AnimatePresence>
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            initial={{ opacity: 0, y: 20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.9 }}
            transition={{ type: "spring", damping: 22, stiffness: 300 }}
            className={`pointer-events-auto flex items-center gap-2 max-w-sm px-4 py-3 rounded-2xl shadow-xl text-sm font-medium text-white backdrop-blur-md ${
              t.type === "success" ? "bg-emerald-600/95" : t.type === "error" ? "bg-red-600/95" : "bg-slate-800/95"
            }`}
          >
            {t.type === "success" && <Check size={16} className="shrink-0" />}
            {t.type === "error" && <AlertCircle size={16} className="shrink-0" />}
            {t.type === "info" && <Info size={16} className="shrink-0" />}
            {t.message}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
