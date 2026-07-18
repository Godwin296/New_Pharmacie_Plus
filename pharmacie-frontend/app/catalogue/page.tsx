"use client";
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Pill, ShoppingCart, Info, Loader2, Filter, Plus, Minus, AlertCircle, X, Check, Camera, WifiOff } from 'lucide-react';

// 🌟 CONFIGURATION : Utilisation de l'instance unifiée apiClient (Gère l'URL de base et le JWT)
import apiClient from '../../lib/apiClient';
import Prix from '../../lib/components/Prix';
import { ajouterAuPanierHorsLigne } from '../../lib/offline/panierQueue';
import { chargerCatalogueLocal, catalogueLocalDisponible } from '../../lib/offline/syncCatalogue';

interface Produit {
  id: number;
  nom: string;
  prix: number;
  categorie: string;
  quantite: number;
  laboratoire: string;
  description: string;
  statut_stock_label: string;
  image?: string;
}

export default function CataloguePage() {
  const [produits, setProduits] = useState<Produit[]>([]);
  const [categories, setCategories] = useState<Record<string, string>>({});
  const [search, setSearch] = useState("");
  const [activeCat, setActiveCat] = useState("all");
  const [loading, setLoading] = useState(true);
  // 🔐 CORRECTIF (bug remonté en test, session 12/07) : `loading` était utilisé pour un
  // early-return "plein écran" (voir plus bas) qui démontait TOUT le composant -- y compris
  // le champ de recherche -- à CHAQUE nouvelle recherche, pas seulement au premier chargement.
  // Résultat concret : l'utilisateur tapait une lettre, le debounce (400ms) déclenchait un
  // fetch, `loading` passait à true, tout l'arbre (input inclus) disparaissait remplacé par
  // le spinner plein écran, puis remontait en tant que NOUVEL élément DOM une fois les
  // données arrivées -- le focus clavier posé sur l'ancien `<input>` (détruit entre-temps)
  // ne pouvait pas suivre. Il fallait recliquer dans le champ à chaque lettre.
  // `hasLoadedOnce` distingue maintenant le tout premier chargement (où rien n'est encore
  // affiché, le plein écran a du sens) des rechargements suivants (recherche, page,
  // catégorie), où le champ de recherche et la mise en page restent montés en permanence --
  // seul le contenu de la grille affiche un indicateur "Recherche..." le temps du fetch,
  // exactement comme /caisse/pos (voir son commentaire "searching").
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [quantites, setQuantites] = useState<Record<number, number>>({});
  // 🚀 MODE OFFLINE (brique 4/4) : true quand les données affichées viennent de la copie
  // locale IndexedDB (réseau indisponible) plutôt que du serveur -- pilote le bandeau
  // d'avertissement ci-dessous. Ne concerne QUE l'affichage : le panier/paiement restent de
  // toute façon impossibles à finaliser sans réseau (brique 3/4, file d'attente).
  const [modeHorsLigne, setModeHorsLigne] = useState(false);

  // 📄 PAGINATION SERVEUR : avant, le catalogue entier était chargé une seule fois puis
  // filtré côté client (useMemo). Sur un catalogue qui grossit (centaines de produits),
  // ça devenait lourd sur 3G/4G. Désormais, page/recherche/catégorie sont envoyés au
  // backend (qui applique CataloguePagination, voir core/pagination.py) et seule la
  // page demandée (20 produits par défaut) est chargée à chaque fois.
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [hasNext, setHasNext] = useState(false);
  const [hasPrevious, setHasPrevious] = useState(false);
  const PAGE_SIZE = 20;

  // 🔎 DEBOUNCE DE LA RECHERCHE : on ne veut pas interroger le serveur à chaque frappe
  // (ça spammerait l'API). On attend 400ms d'inactivité avant d'appliquer la recherche
  // tapée par l'utilisateur. searchInput = ce que l'utilisateur tape en direct (instantané
  // à l'écran), search = la valeur "validée" après le délai, qui déclenche le vrai appel API.
  const [searchInput, setSearchInput] = useState("");
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput);
      setPage(1); // toute nouvelle recherche repart de la page 1
    }, 400);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // 1. RÉCUPÉRATION DU CATALOGUE SYNCHRONISÉ (re-déclenchée à chaque changement de
  // page, de recherche validée, ou de catégorie active)
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const res = await apiClient.get('/api/catalogue/', {
          params: {
            page,
            page_size: PAGE_SIZE,
            ...(activeCat !== 'all' ? { cat: activeCat } : {}),
            ...(search.trim() ? { q: search.trim() } : {}),
          },
        });
        setProduits(res.data.results.produits);
        setCategories(res.data.results.categories);
        setTotalCount(res.data.count);
        setHasNext(Boolean(res.data.next));
        setHasPrevious(Boolean(res.data.previous));
        setModeHorsLigne(false);
      } catch (err: any) {
        // 🚀 MODE OFFLINE (brique 4/4) : `!err.response` = échec réseau réel (pas d'internet,
        // ou serveur injoignable), PAS une erreur métier renvoyée par le serveur -- même
        // distinction que syncPanier.ts. Dans ce cas seulement, on bascule sur la copie
        // locale du catalogue plutôt que de simplement afficher une erreur.
        if (!err?.response && (await catalogueLocalDisponible())) {
          const local = await chargerCatalogueLocal({
            search,
            categorie: activeCat,
            page,
            pageSize: PAGE_SIZE,
          });
          setProduits(local.produits as any);
          setCategories(local.categories);
          setTotalCount(local.count);
          setHasNext(local.hasNext);
          setHasPrevious(local.hasPrevious);
          setModeHorsLigne(true);
        } else {
          console.error("Erreur Catalogue:", err);
        }
      } finally {
        setLoading(false);
        setHasLoadedOnce(true);
      }
    };
    fetchData();
  }, [page, search, activeCat]);

  // Changer de catégorie repart toujours de la page 1 (sinon on pourrait se retrouver
  // sur une page 3 qui n'existe plus dans la nouvelle catégorie filtrée)
  const changerCategorie = (cat: string) => {
    setActiveCat(cat);
    setPage(1);
    setIsModalOpen(false);
  };

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  // 2. MODIFICATION DE LA PHOTO PAR L'ADMINISTRATEUR (Via le bon endpoint core/urls.py)
  const handleUpdatePhoto = async (produitId: number, file: File) => {
    const formData = new FormData();
    formData.append('image', file);

    try {
      const res = await apiClient.post(`/api/modifier-photo/${produitId}/`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      
      setProduits(prev => prev.map(p => 
        p.id === produitId ? { ...p, image: res.data.image_url } : p
      ));
      
      alert("Photo mise à jour ! 📸");
    } catch (err: any) {
      console.error("Erreur upload:", err);
      alert(err.response?.data?.error || "Erreur lors de la mise à jour de la photo. Droits admin requis.");
    }
  };

  // 3. AJOUT SÉCURISÉ AU PANIER CLIENT (Le token est injecté par apiClient)
  // 🚀 MODE OFFLINE (session 12/07, brique 3/4) : si le serveur est injoignable (pas de
  // réponse HTTP du tout -- `!err.response`, cf. apiClient.ts qui distingue déjà ce cas),
  // ce n'est pas une erreur "à afficher et oublier" : on met l'ajout en file d'attente
  // locale (IndexedDB) pour le rejouer automatiquement dès le retour du réseau, plutôt que
  // de faire perdre le geste au client. Une vraie erreur MÉTIER (ex: 400 "Stock
  // insuffisant") reste affichée immédiatement -- le serveur A répondu, il n'y a rien à
  // mettre en attente, l'info est déjà à jour et définitive.
  const handleAddToCart = async (produitId: number) => {
    const qte = quantites[produitId] || 1;
    const produit = produits.find((p) => p.id === produitId);

    if (typeof navigator !== "undefined" && !navigator.onLine) {
      // Hors-ligne détecté AVANT même de tenter la requête : inutile d'attendre un timeout.
      if (produit) await ajouterAuPanierHorsLigne(produitId, produit.nom, produit.prix, qte);
      alert(`Hors-ligne : ${qte} unité(s) mise(s) en attente, sera synchronisé au retour du réseau 📡`);
      return;
    }

    try {
      await apiClient.post('/api/panier/', { 
        produit_id: produitId, 
        quantite: qte 
      });
      alert(`Ajouté : ${qte} unité(s) au panier ! ✅`);
    } catch (err: any) {
      if (!err.response) {
        // Réseau injoignable au moment de la requête (timeout, coupure en cours de frappe...)
        if (produit) await ajouterAuPanierHorsLigne(produitId, produit.nom, produit.prix, qte);
        alert(`Réseau injoignable : ${qte} unité(s) mise(s) en attente, sera synchronisé au retour du réseau 📡`);
        return;
      }
      alert(err.response?.data?.error || "Erreur lors de l'ajout. Veuillez vérifier votre session.");
    }
  };

  const updateLocalQte = (id: number, delta: number, max: number) => {
    const current = quantites[id] || 1;
    const next = Math.max(1, Math.min(max, current + delta));
    setQuantites({ ...quantites, [id]: next });
  };

  const filteredProduits = produits; // le filtrage (recherche + catégorie) est désormais fait côté serveur

  if (loading && !hasLoadedOnce) {
    return (
      <div className="h-screen flex items-center justify-center">
        <Loader2 className="animate-spin text-emerald-500" size={48} />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-6 py-12 min-h-screen">

      {/* 🚀 MODE OFFLINE (brique 4/4) : bandeau discret, visible seulement quand les données
          affichées viennent de la copie locale (réseau indisponible). Pas bloquant : on laisse
          consulter le catalogue normalement, juste prévenir que les prix/stocks affichés
          peuvent dater un peu (dernière synchro réussie). */}
      {modeHorsLigne && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 flex items-center gap-3 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 px-5 py-3 text-amber-700 dark:text-amber-400"
        >
          <WifiOff size={18} className="shrink-0" />
          <p className="text-sm font-bold">
            Mode hors-ligne — catalogue affiché depuis la dernière synchronisation. Le paiement nécessite une connexion.
          </p>
        </motion.div>
      )}

      {/* 🎯 HEADER & RECHERCHE */}
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-16">
        <h1 className="text-5xl font-black text-slate-800 dark:text-white tracking-tighter mb-4">
          <span className="text-slate-800 dark:text-white">Catalogue </span><span className="text-emerald-500 italic">Médicaments</span> 💊
        </h1>
        <p className="text-slate-500 dark:text-slate-400 font-medium text-lg">Stock réel synchronisé avec la pharmacie.</p>

        <div className="max-w-2xl mx-auto mt-10 flex gap-4">
          <div className="relative flex-grow">
            <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-emerald-500" size={24} />
            <input 
              type="text" 
              placeholder="Nom, Laboratoire, Symptôme..." 
              className="w-full pl-16 pr-8 py-5 rounded-full border-2 border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-lg font-bold focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 outline-none transition-all shadow-xl"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
            />
          </div>
          
          <button 
            onClick={() => setIsModalOpen(true)}
            title="Ouvrir les filtres de catégorie"
            aria-label="Ouvrir les filtres de catégorie"
            className="bg-slate-900 text-white p-5 rounded-full hover:bg-emerald-600 transition-all shadow-xl flex items-center justify-center border-none cursor-pointer"
          >
            <Filter size={24} />
          </button>
        </div>

        {activeCat !== 'all' && (
          <div className="mt-4 text-[10px] font-black uppercase text-emerald-500 tracking-widest">
            Filtre : {categories[activeCat]} 
            <button onClick={() => changerCategorie('all')} className="ml-2 underline cursor-pointer bg-transparent border-none text-slate-400">Réinitialiser</button>
          </div>
        )}
      </motion.div>

      {/* 🏗️ GRILLE DES PRODUITS */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {/* Indicateur de chargement INLINE (recherche/pagination/catégorie) -- le formulaire
            et le champ de recherche au-dessus restent montés, contrairement à l'ancien
            early-return plein écran (cf. commentaire sur `hasLoadedOnce`). */}
        {loading && (
          <div className="col-span-full flex items-center justify-center py-12 text-slate-400 text-xs font-black uppercase tracking-widest gap-3">
            <Loader2 size={18} className="animate-spin text-emerald-500" /> Recherche...
          </div>
        )}
        {!loading && filteredProduits.length === 0 && (
          <div className="col-span-full flex items-center justify-center py-12 text-slate-400 text-xs font-black uppercase tracking-widest">
            Aucun produit trouvé
          </div>
        )}
        <AnimatePresence mode="popLayout">
          {!loading && filteredProduits.map((p) => (
            <motion.div
              key={p.id} layout initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
              className="bg-white dark:bg-slate-900 rounded-[3rem] p-8 border border-slate-100 dark:border-slate-800 shadow-sm hover:shadow-2xl transition-all group flex flex-col justify-between"
            >
              <div>
                <div className="relative h-48 bg-slate-50 dark:bg-slate-950 rounded-[2rem] mb-6 overflow-hidden flex items-center justify-center group-hover:bg-emerald-50 transition-colors">
                  
                  {/* 🌟 IMAGE STABILISÉE : Utilise l'URL absolue renvoyée proprement par le backend Django */}
                  {/* ⚡ PERF : loading="lazy" -- ne charge l'image que quand elle approche du viewport,
                      essentiel ici car le catalogue peut afficher des dizaines de produits d'un coup. */}
                  {p.image ? (
                    <img
                      src={p.image}
                      alt={p.nom}
                      loading="lazy"
                      decoding="async"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                    />
                  ) : (
                    <div className="text-7xl group-hover:scale-110 transition-transform">💊</div>
                  )}

                  {/* Zone d'upload pour Admin */}
                  <label className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center cursor-pointer transition-all z-20">
                    <Camera className="text-white mb-2" size={32} />
                    <span className="text-white text-[10px] font-black uppercase tracking-tighter">Modifier Photo</span>
                    <input 
                      type="file" 
                      className="hidden" 
                      accept="image/*"
                      onChange={(e) => {
                        if (e.target.files?.[0]) handleUpdatePhoto(p.id, e.target.files[0]);
                      }}
                    />
                  </label>

                  <div className={`absolute top-4 right-4 px-4 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-sm z-10 ${p.quantite > 0 ? 'bg-white text-emerald-600' : 'bg-red-100 text-red-600'}`}>
                    {p.statut_stock_label}: {p.quantite}
                  </div>
                </div>

                <h3 className="text-2xl font-black text-slate-800 dark:text-white uppercase tracking-tighter mb-1">
                  {p.nom}
                </h3>
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest bg-slate-50 dark:bg-slate-800 px-3 py-1 rounded-lg">
                  {categories[p.categorie] || p.categorie || "Général"}
                </span>
                <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mt-2 mb-3 italic">
                  {p.laboratoire ? `🔬 ${p.laboratoire}` : "🧪 Laboratoire non spécifié"}
                </p>
                <p className="text-slate-500 dark:text-slate-400 text-xs font-medium leading-relaxed line-clamp-2 mb-4">
                  {p.description || "Aucune description disponible pour ce médicament."}
                </p>
              </div>

              <div className="space-y-6">
                <div className="flex items-center justify-between bg-slate-50 dark:bg-slate-800 p-2 rounded-2xl">
                  <span className="text-[10px] font-black text-slate-400 uppercase ml-4">Quantité</span>
                  <div className="flex items-center gap-4">
                    <button onClick={() => updateLocalQte(p.id, -1, p.quantite)} title="Diminuer la quantité" aria-label="Diminuer la quantité" className="p-2 text-slate-400 hover:text-emerald-500 border-none bg-transparent cursor-pointer"><Minus size={16}/></button>
                    <span className="font-black text-lg text-slate-800 dark:text-white">{quantites[p.id] || 1}</span>
                    <button onClick={() => updateLocalQte(p.id, 1, p.quantite)} title="Augmenter la quantité" aria-label="Augmenter la quantité" className="p-2 text-slate-400 hover:text-emerald-500 border-none bg-transparent cursor-pointer"><Plus size={16}/></button>
                  </div>
                </div>

                <div className="flex justify-between items-center">
                  <div className="text-3xl font-black text-slate-800 dark:text-white">
                    <Prix montant={p.prix} className="text-xs text-slate-400 tracking-normal" />
                  </div>
                  <button 
                    disabled={p.quantite <= 0}
                    onClick={() => handleAddToCart(p.id)}
                    title="Ajouter au panier"
                    aria-label="Ajouter au panier"
                    className="bg-emerald-500 hover:bg-emerald-400 text-white p-5 rounded-[1.5rem] shadow-lg shadow-emerald-500/20 transition-all active:scale-90 border-none cursor-pointer disabled:opacity-20 disabled:grayscale"
                  >
                    <ShoppingCart size={24} strokeWidth={2.5} />
                  </button>
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* 🖼️ FENÊTRE DE SÉLECTION (MODALE) */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsModalOpen(false)} className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative bg-white dark:bg-slate-900 w-full max-w-md rounded-[32px] shadow-2xl overflow-hidden border border-slate-100 dark:border-slate-800"
            >
              <div className="p-8 border-b border-slate-50 dark:border-slate-800 flex justify-between items-center bg-slate-900 text-white">
                <h3 className="text-xl font-black italic uppercase">Choisir une catégorie</h3>
                <button onClick={() => setIsModalOpen(false)} title="Fermer" aria-label="Fermer" className="text-white bg-transparent border-none cursor-pointer hover:rotate-90 transition-transform"><X /></button>
              </div>

              <div className="p-8 max-h-[60vh] overflow-y-auto space-y-3 custom-scrollbar">
                <button 
                  onClick={() => changerCategorie("all")}
                  className={`w-full p-5 rounded-2xl text-left font-black text-[10px] uppercase tracking-widest transition-all border-none cursor-pointer flex justify-between items-center ${activeCat === 'all' ? 'bg-emerald-500 text-white' : 'bg-slate-50 dark:bg-slate-800 text-slate-500 hover:bg-slate-100'}`}
                >
                  Tous les soins ✨ {activeCat === 'all' && <Check size={16}/>}
                </button>
                {Object.entries(categories).map(([code, nom]) => (
                  <button 
                    key={code}
                    onClick={() => changerCategorie(code)}
                    className={`w-full p-5 rounded-2xl text-left font-black text-[10px] uppercase tracking-widest transition-all border-none cursor-pointer flex justify-between items-center ${activeCat === code ? 'bg-emerald-500 text-white' : 'bg-slate-50 dark:bg-slate-800 text-slate-500 hover:bg-slate-100'}`}
                  >
                    {nom} {activeCat === code && <Check size={16}/>}
                  </button>
                ))}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 📄 NAVIGATION PAGINATION : volontairement neutre visuellement (boutons simples).
          Le style définitif viendra avec la refonte UI/UX mobile-first (maquettes fournies),
          pour ne pas coder un composant qu'on jetterait juste après. */}
      {!loading && totalCount > 0 && (
        <div className="flex items-center justify-center gap-4 mt-16 mb-8">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={!hasPrevious}
            className="px-6 py-3 rounded-xl font-black text-xs uppercase tracking-widest border-none cursor-pointer bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-emerald-100 dark:hover:bg-emerald-900/30 transition-colors"
          >
            ← Précédent
          </button>

          <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">
            Page {page} / {totalPages} · {totalCount} produit{totalCount > 1 ? 's' : ''}
          </span>

          <button
            onClick={() => setPage(p => p + 1)}
            disabled={!hasNext}
            className="px-6 py-3 rounded-xl font-black text-xs uppercase tracking-widest border-none cursor-pointer bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-emerald-100 dark:hover:bg-emerald-900/30 transition-colors"
          >
            Suivant →
          </button>
        </div>
      )}
    </div>
  );
}
