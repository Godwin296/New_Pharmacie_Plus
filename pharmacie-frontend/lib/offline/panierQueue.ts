/**
 * 🚀 MODE OFFLINE (session 12/07, brique 3/4) : file d'attente panier hors-ligne.
 *
 * Quand un client ajoute un produit au panier sans réseau (ou que le serveur est injoignable
 * -- zone CEMAC, 3G/4G instable), on ne peut PAS valider le stock côté serveur en temps réel
 * (voir core/api.py::api_panier -- `if qte > produit.quantite: return 400`). On enregistre donc
 * l'INTENTION localement dans IndexedDB, on l'affiche optimistiquement, et on la rejoue contre
 * le serveur dès que le réseau revient (voir syncPanier.ts) -- le serveur reste la seule
 * source de vérité sur le stock réel, jamais contournée.
 */
import { dbGetAll, dbAdd, dbDelete, dbPut, STORE_PANIER_QUEUE } from "./db";

export type StatutFileAttente = "en_attente" | "en_cours" | "erreur";

export interface ItemFileAttente {
  localId: number;       // clé locale IndexedDB (autoIncrement) -- PAS l'id serveur
  produitId: number;
  nom: string;            // dénormalisé pour affichage immédiat sans dépendre du réseau
  prix: number;            // idem -- purement informatif côté UI
  quantite: number;
  ajouteLe: string;        // ISO8601, horodatage LOCAL (l'appareil peut être hors-ligne)
  statut: StatutFileAttente;
  erreur?: string;         // message lisible si statut === 'erreur' (ex: "Stock insuffisant")
}

// 📡 Événement DOM custom : tout composant intéressé par le nombre d'items en attente
// (badge dans la nav, page panier...) peut simplement écouter cet évènement plutôt que de
// dépendre d'un state manager global -- cohérent avec le reste du projet, qui n'utilise ni
// Redux ni Zustand.
const EVENEMENT_FILE_MISE_A_JOUR = "panier-file-attente-maj";
function notifierMiseAJour() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(EVENEMENT_FILE_MISE_A_JOUR));
  }
}
export function ecouterFileAttente(callback: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(EVENEMENT_FILE_MISE_A_JOUR, callback);
  return () => window.removeEventListener(EVENEMENT_FILE_MISE_A_JOUR, callback);
}

export async function ajouterAuPanierHorsLigne(produitId: number, nom: string, prix: number, quantite: number): Promise<void> {
  const item: Omit<ItemFileAttente, "localId"> = {
    produitId, nom, prix, quantite,
    ajouteLe: new Date().toISOString(),
    statut: "en_attente",
  };
  await dbAdd(STORE_PANIER_QUEUE, item);
  notifierMiseAJour();
}

export async function listerFileAttente(): Promise<ItemFileAttente[]> {
  try {
    const items = await dbGetAll<ItemFileAttente>(STORE_PANIER_QUEUE);
    // Ordre d'ajout : rejoué FIFO côté sync, affiché pareil côté UI pour rester cohérent.
    return items.sort((a, b) => a.localId - b.localId);
  } catch {
    // IndexedDB indisponible (SSR, navigateur trop ancien, mode privé restrictif...) :
    // dégrade en file vide plutôt que de faire planter l'UI qui l'affiche.
    return [];
  }
}

export async function supprimerDeFileAttente(localId: number): Promise<void> {
  await dbDelete(STORE_PANIER_QUEUE, localId);
  notifierMiseAJour();
}

export async function marquerStatutFileAttente(item: ItemFileAttente, statut: StatutFileAttente, erreur?: string): Promise<void> {
  await dbPut(STORE_PANIER_QUEUE, { ...item, statut, erreur });
  notifierMiseAJour();
}
