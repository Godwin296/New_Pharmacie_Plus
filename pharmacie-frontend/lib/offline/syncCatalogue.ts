/**
 * 🚀 MODE OFFLINE (brique 4/4) : synchronise le catalogue complet en local (IndexedDB) via
 * l'endpoint delta `core/api.py::api_catalogue_sync`, et sert les données locales en repli
 * quand le réseau est indisponible.
 *
 * ⚠️ POURQUOI PAS UN SIMPLE CACHE HTTP DANS LE SERVICE WORKER (app/sw.ts) : l'endpoint de
 * sync répond avec un DELTA ("ce qui a changé depuis `?since=...`"), pas un instantané complet
 * du catalogue -- son URL change à chaque appel (le `since` avance). Un cache HTTP classique
 * keyé par URL (Workbox/Serwist runtime caching) ne rejouerait donc, hors-ligne, qu'UN SEUL
 * delta partiel figé dans le temps -- jamais le catalogue complet et à jour. La vraie
 * "mise en cache" doit donc vivre ici, au niveau applicatif : chaque delta reçu est appliqué
 * (upsert + suppression) sur la copie locale complète dans IndexedDB, qui, elle, reste
 * consultable et à jour même hors-ligne.
 *
 * Utilise `/api/v1/...` (préfixe canonique pour tout nouveau code, voir docs/API_VERSIONING.md)
 * -- contrairement au reste du frontend, encore sur `/api/` legacy le temps de sa migration.
 */
import apiClient from "../apiClient";
import {
  dbGetAll,
  dbGet,
  dbPutMany,
  dbDeleteMany,
  dbPut,
  STORE_CATALOGUE_PRODUITS,
  STORE_CATALOGUE_META,
} from "./db";

export interface ProduitCatalogueLocal {
  id: number;
  nom: string;
  prix: number;
  categorie: string;
  quantite: number;
  laboratoire: string;
  description: string;
  statut_stock_label: string;
  image?: string | null;
}

const CLE_META_SINCE = "since";
const CLE_META_CATEGORIES = "categories";

// 🔒 Anti-réentrance, même principe que synchroniserFileAttente() dans syncPanier.ts : évite
// deux synchros catalogue simultanées (badge de nav + page catalogue montés en même temps).
let synchroEnCours = false;

export interface ResultatSynchroCatalogue {
  produitsRecus: number;
  produitsSupprimes: number;
  complete: boolean; // false si arrêtée en cours de route (réseau reperdu)
}

/**
 * Rejoue la synchro delta jusqu'à avoir tout récupéré (boucle sur `has_more`), et persiste
 * le résultat dans IndexedDB. Idempotent et sûr à appeler souvent (ex: à chaque retour de
 * réseau, ou au montage de la page catalogue) : sans changement côté serveur depuis le
 * dernier appel, la réponse est quasi vide (voir docstring api_catalogue_sync).
 */
export async function synchroniserCatalogue(): Promise<ResultatSynchroCatalogue> {
  if (synchroEnCours) {
    return { produitsRecus: 0, produitsSupprimes: 0, complete: false };
  }
  synchroEnCours = true;

  let produitsRecus = 0;
  let produitsSupprimes = 0;
  let complete = true;

  try {
    const curseur = await dbGet<{ cle: string; valeur: string }>(STORE_CATALOGUE_META, CLE_META_SINCE);
    let since = curseur?.valeur;

    // eslint-disable-next-line no-constant-condition
    while (true) {
      let data: any;
      try {
        const res = await apiClient.get("/api/v1/catalogue/sync/", {
          params: since ? { since } : {},
        });
        data = res.data;
      } catch (err: any) {
        // Pas de réseau (ou serveur injoignable) : on s'arrête là sans perdre ce qui a déjà
        // été synchronisé dans cette boucle -- le curseur `since` n'est mis à jour qu'à la
        // toute fin (voir plus bas), donc rien n'est perdu, le prochain appel reprendra
        // proprement là où on s'était arrêté.
        complete = false;
        break;
      }

      if (Array.isArray(data.produits) && data.produits.length > 0) {
        await dbPutMany(STORE_CATALOGUE_PRODUITS, data.produits as ProduitCatalogueLocal[]);
        produitsRecus += data.produits.length;
      }
      if (Array.isArray(data.supprimes) && data.supprimes.length > 0) {
        await dbDeleteMany(STORE_CATALOGUE_PRODUITS, data.supprimes);
        produitsSupprimes += data.supprimes.length;
      }
      if (data.categories) {
        await dbPut(STORE_CATALOGUE_META, { cle: CLE_META_CATEGORIES, valeur: data.categories });
      }

      if (data.has_more) {
        since = data.next_since; // curseur composé, cf. docstring api_catalogue_sync
        continue;
      }

      // Sync complète pour ce passage : on avance le curseur à `server_time`, à utiliser
      // comme `since` du PROCHAIN appel (cf. contrat documenté côté backend).
      await dbPut(STORE_CATALOGUE_META, { cle: CLE_META_SINCE, valeur: data.server_time });
      break;
    }
  } finally {
    synchroEnCours = false;
  }

  return { produitsRecus, produitsSupprimes, complete };
}

export interface OptionsCatalogueLocal {
  search?: string;
  categorie?: string; // "all" ou vide = toutes catégories
  page?: number;
  pageSize?: number;
}

export interface ReponseCatalogueLocal {
  produits: ProduitCatalogueLocal[];
  categories: Record<string, string>;
  count: number;
  hasNext: boolean;
  hasPrevious: boolean;
}

/**
 * Reproduit en local (IndexedDB + JS) ce que fait CataloguePagination côté serveur, pour que
 * la page catalogue affiche exactement la même chose hors-ligne qu'en ligne : recherche
 * (nom/description, insensible à la casse), filtre par catégorie, pagination.
 *
 * ⚠️ Recharge tout le store en mémoire à chaque appel (pas de vraie requête indexée
 * composite recherche+catégorie+pagination en IndexedDB, l'API ne le permet pas simplement).
 * Volontairement acceptable ici : le catalogue d'une pharmacie de quartier reste de l'ordre
 * de quelques centaines de produits, pas des dizaines de milliers -- filtrer en JS reste
 * instantané à cette échelle. À revisiter seulement si ça devient un vrai goulot mesuré.
 */
export async function chargerCatalogueLocal(
  options: OptionsCatalogueLocal = {}
): Promise<ReponseCatalogueLocal> {
  const { search = "", categorie = "all", page = 1, pageSize = 20 } = options;

  const [tousLesProduits, metaCategories] = await Promise.all([
    dbGetAll<ProduitCatalogueLocal>(STORE_CATALOGUE_PRODUITS),
    dbGet<{ cle: string; valeur: Record<string, string> }>(STORE_CATALOGUE_META, CLE_META_CATEGORIES),
  ]);

  const rechercheNormalisee = search.trim().toLowerCase();
  let filtres = tousLesProduits;

  if (categorie && categorie !== "all") {
    filtres = filtres.filter((p) => p.categorie === categorie);
  }
  if (rechercheNormalisee) {
    filtres = filtres.filter(
      (p) =>
        p.nom?.toLowerCase().includes(rechercheNormalisee) ||
        p.description?.toLowerCase().includes(rechercheNormalisee)
    );
  }
  filtres.sort((a, b) => a.nom.localeCompare(b.nom));

  const count = filtres.length;
  const debut = (page - 1) * pageSize;
  const produitsPage = filtres.slice(debut, debut + pageSize);

  return {
    produits: produitsPage,
    categories: metaCategories?.valeur || {},
    count,
    hasNext: debut + pageSize < count,
    hasPrevious: page > 1,
  };
}

/** Vrai si au moins un produit a déjà été synchronisé localement (catalogue offline utilisable). */
export async function catalogueLocalDisponible(): Promise<boolean> {
  try {
    const produits = await dbGetAll<ProduitCatalogueLocal>(STORE_CATALOGUE_PRODUITS);
    return produits.length > 0;
  } catch {
    return false;
  }
}
