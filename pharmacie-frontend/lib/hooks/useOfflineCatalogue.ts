"use client";
/**
 * 🚀 MODE OFFLINE (brique 4/4) : déclenche la synchro delta du catalogue (voir
 * syncCatalogue.ts) au montage de l'app et à chaque retour de réseau -- même pattern que
 * useOfflinePanier.ts pour la file d'attente panier, gardé volontairement séparé (deux
 * responsabilités distinctes : rejouer des INTENTIONS locales vs. rapatrier des DONNÉES
 * serveur).
 *
 * Ce hook ne bloque jamais le rendu : la synchro tourne en tâche de fond, silencieusement.
 * Monté une fois globalement (voir app/layout.tsx) plutôt que dans chaque page qui affiche
 * le catalogue, pour que la copie locale reste fraîche même si l'utilisateur ne visite pas
 * /catalogue à chaque session.
 */
import { useCallback, useEffect, useState } from "react";
import { synchroniserCatalogue } from "../offline/syncCatalogue";

export function useOfflineCatalogue() {
  const [isOnline, setIsOnline] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [derniereSynchro, setDerniereSynchro] = useState<Date | null>(null);

  const synchroniser = useCallback(async () => {
    if (typeof navigator !== "undefined" && !navigator.onLine) return;
    setSyncing(true);
    try {
      const resultat = await synchroniserCatalogue();
      if (resultat.complete) setDerniereSynchro(new Date());
    } finally {
      setSyncing(false);
    }
  }, []);

  useEffect(() => {
    setIsOnline(typeof navigator === "undefined" ? true : navigator.onLine);
    synchroniser(); // 🔁 synchro initiale au montage (silencieuse, sans bloquer l'UI)

    const gererRetourReseau = () => {
      setIsOnline(true);
      synchroniser();
    };
    const gererPerteReseau = () => setIsOnline(false);

    window.addEventListener("online", gererRetourReseau);
    window.addEventListener("offline", gererPerteReseau);
    return () => {
      window.removeEventListener("online", gererRetourReseau);
      window.removeEventListener("offline", gererPerteReseau);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { isOnline, syncing, derniereSynchro, synchroniser };
}
