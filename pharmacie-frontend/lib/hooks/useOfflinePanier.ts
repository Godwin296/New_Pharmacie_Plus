"use client";
/**
 * 🚀 MODE OFFLINE (session 12/07, brique 3/4) : hook partagé entre le badge de la nav
 * (app/layout.tsx) et la page panier (app/panier/page.tsx) -- évite de dupliquer la logique
 * d'écoute réseau/IndexedDB à deux endroits différents.
 */
import { useCallback, useEffect, useState } from "react";
import { ItemFileAttente, listerFileAttente, ecouterFileAttente } from "../offline/panierQueue";
import { synchroniserFileAttente } from "../offline/syncPanier";

export function useOfflinePanier() {
  const [file, setFile] = useState<ItemFileAttente[]>([]);
  const [isOnline, setIsOnline] = useState(true);
  const [syncing, setSyncing] = useState(false);

  const rafraichirFile = useCallback(async () => {
    setFile(await listerFileAttente());
  }, []);

  const synchroniser = useCallback(async () => {
    if (typeof navigator !== "undefined" && !navigator.onLine) return; // évite un aller-retour réseau voué à échouer
    setSyncing(true);
    try {
      await synchroniserFileAttente();
    } finally {
      setSyncing(false);
      await rafraichirFile();
    }
  }, [rafraichirFile]);

  useEffect(() => {
    // État initial : `navigator.onLine` peut mentir légèrement (il détecte la présence
    // d'une interface réseau, pas forcément un accès internet réel) mais reste le signal le
    // plus simple et le plus large sur les navigateurs -- le vrai test de vérité reste
    // l'échec effectif d'un appel API (géré dans syncPanier.ts).
    setIsOnline(typeof navigator === "undefined" ? true : navigator.onLine);
    rafraichirFile();

    const gererRetourReseau = () => {
      setIsOnline(true);
      synchroniser(); // 🔁 déclenchement automatique dès que le réseau revient
    };
    const gererPerteReseau = () => setIsOnline(false);
    const gererMajFile = () => rafraichirFile();

    window.addEventListener("online", gererRetourReseau);
    window.addEventListener("offline", gererPerteReseau);
    const arreterEcoute = ecouterFileAttente(gererMajFile);

    return () => {
      window.removeEventListener("online", gererRetourReseau);
      window.removeEventListener("offline", gererPerteReseau);
      arreterEcoute();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { file, isOnline, syncing, synchroniser, rafraichirFile };
}
