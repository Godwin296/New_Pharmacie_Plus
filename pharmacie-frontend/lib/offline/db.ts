/**
 * 🚀 MODE OFFLINE (session 12/07, brique 3/4 ; store catalogue ajouté brique 4/4) : wrapper
 * IndexedDB natif minimal.
 *
 * Pas de dépendance externe (idb, dexie...) volontairement -- le besoin réel tient en
 * quelques opérations simples sur deux object stores, ça ne justifie pas d'ajouter une
 * librairie.
 *
 * ⚠️ IndexedDB n'existe pas côté serveur (SSR/Node) -- toutes les fonctions exportées
 * vérifient `typeof window === 'undefined'` et rejettent proprement plutôt que de planter,
 * pour rester safe à importer depuis n'importe quel composant Next.js.
 */

const DB_NAME = "pharmacie_offline";
const DB_VERSION = 2; // v1 -> v2 : ajout des stores catalogue (brique 4/4)
export const STORE_PANIER_QUEUE = "panier_queue";
// 🚀 Brique 4/4 : copie locale complète du catalogue, alimentée par synchro delta
// (voir syncCatalogue.ts) -- keyPath 'id' = l'id serveur du produit (PAS de localId ici,
// contrairement à panier_queue : ces enregistrements ne sont jamais créés localement,
// uniquement répliqués depuis le serveur).
export const STORE_CATALOGUE_PRODUITS = "catalogue_produits";
// Un seul object store "clé/valeur" générique pour les métadonnées de synchro (curseur
// `since`, dictionnaire des catégories) -- pas besoin d'un store dédié par métadonnée.
export const STORE_CATALOGUE_META = "catalogue_meta";

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
      if (!db.objectStoreNames.contains(STORE_CATALOGUE_PRODUITS)) {
        const store = db.createObjectStore(STORE_CATALOGUE_PRODUITS, { keyPath: "id" });
        // Index nécessaires pour filtrer/trier côté client sans tout recharger en JS à
        // chaque frappe -- reproduit (en local, en dégradé) ce que fait CataloguePagination
        // côté serveur (catégorie + tri par nom).
        store.createIndex("categorie", "categorie", { unique: false });
        store.createIndex("nom", "nom", { unique: false });
      }
      if (!db.objectStoreNames.contains(STORE_CATALOGUE_META)) {
        db.createObjectStore(STORE_CATALOGUE_META, { keyPath: "cle" });
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

export async function dbGet<T>(store: string, key: IDBValidKey): Promise<T | undefined> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, "readonly");
    const req = tx.objectStore(store).get(key);
    req.onsuccess = () => resolve(req.result as T | undefined);
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

// 🚀 Brique 4/4 : upsert en masse dans UNE seule transaction -- un delta de synchro peut
// contenir jusqu'à CATALOGUE_SYNC_BATCH_SIZE (300) produits ; ouvrir 300 transactions
// séparées (dbPut appelé en boucle) serait inutilement lent.
export async function dbPutMany<T>(store: string, values: T[]): Promise<void> {
  if (values.length === 0) return;
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, "readwrite");
    const objStore = tx.objectStore(store);
    for (const value of values) objStore.put(value as any);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// 🚀 Brique 4/4 : suppression en masse (produits retirés du catalogue serveur depuis le
// dernier sync, cf. `supprimes` dans la réponse de api_catalogue_sync).
export async function dbDeleteMany(store: string, keys: IDBValidKey[]): Promise<void> {
  if (keys.length === 0) return;
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, "readwrite");
    const objStore = tx.objectStore(store);
    for (const key of keys) objStore.delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
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
