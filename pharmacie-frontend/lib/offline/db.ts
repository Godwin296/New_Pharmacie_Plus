/**
 * 🚀 MODE OFFLINE (session 12/07, brique 3/4) : wrapper IndexedDB natif minimal.
 *
 * Pas de dépendance externe (idb, dexie...) volontairement -- le besoin réel ici tient en
 * 4 opérations sur UN SEUL object store (la file d'attente panier), ça ne justifie pas
 * d'ajouter une librairie. Si un futur besoin (cache catalogue complet en local, brique 2/4
 * côté FRONTEND) élargit vraiment l'usage d'IndexedDB, réévaluer à ce moment-là.
 *
 * ⚠️ IndexedDB n'existe pas côté serveur (SSR/Node) -- toutes les fonctions exportées
 * vérifient `typeof window === 'undefined'` et rejettent proprement plutôt que de planter,
 * pour rester safe à importer depuis n'importe quel composant Next.js.
 */

const DB_NAME = "pharmacie_offline";
const DB_VERSION = 1;
export const STORE_PANIER_QUEUE = "panier_queue";

function openDB(): Promise<IDBDatabase> {
  if (typeof window === "undefined" || !("indexedDB" in window)) {
    return Promise.reject(new Error("IndexedDB indisponible (rendu serveur ou navigateur trop ancien)"));
  }
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_PANIER_QUEUE)) {
        // keyPath 'localId' auto-incrémenté : identifiant purement local, distinct de
        // l'id serveur du produit (produitId, stocké comme simple champ de la valeur).
        db.createObjectStore(STORE_PANIER_QUEUE, { keyPath: "localId", autoIncrement: true });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function dbGetAll<T>(store: string): Promise<T[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, "readonly");
    const req = tx.objectStore(store).getAll();
    req.onsuccess = () => resolve(req.result as T[]);
    req.onerror = () => reject(req.error);
  });
}

export async function dbAdd<T>(store: string, value: T): Promise<IDBValidKey> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, "readwrite");
    const req = tx.objectStore(store).add(value as any);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function dbPut<T>(store: string, value: T): Promise<IDBValidKey> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, "readwrite");
    const req = tx.objectStore(store).put(value as any);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function dbDelete(store: string, key: IDBValidKey): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, "readwrite");
    const req = tx.objectStore(store).delete(key);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}
