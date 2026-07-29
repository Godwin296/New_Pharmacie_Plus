"use client";
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Pill, ShoppingCart, Info, Loader2, Filter, Plus, Minus, AlertCircle, X, Check, Camera, WifiOff, ScanLine } from 'lucide-react';

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
  // 🔐 (19/07) : l'overlay "changer la photo au survol" plus bas s'affichait pour TOUT
  // visiteur du catalogue (client, caissière) alors que seul l'admin du tenant peut
  // réellement réussir cette action -- api_modifier_photo_produit vérifie déjà
  // `request.user.is_superuser` côté backend (la vraie barrière de sécurité), mais rien
  // n'empêchait un client ou une caissière de VOIR le bouton et de se heurter à un 403.
  // Purement déclaratif : ne remplace pas la vérification backend, l'améliore.
  const [isAdmin, setIsAdmin] = useState(false);
  // 🎠 Bannière promo en diaporama (mockup 25/07) -- contenu réel pour l'instant (pas de
  // placeholder vide), mais l'emplacement est prévu pour accueillir de vraies visuels/
  // promotions gérées par la pharmacie plus tard (hors scope aujourd'hui).
  const [bannerIndex, setBannerIndex] = useState(0);
  const banniere = [
    { titre: "Produits authentiques", sous: "Stock en temps réel", texte: "Achetez en toute confiance" },
    { titre: "Livraison rapide", sous: "Retrait en pharmacie", texte: "Votre commande prête en quelques minutes" },
    { titre: "Paiement sécurisé", sous: "Mobile Money vérifié", texte: "Chaque paiement est contrôlé par la pharmacie" },
  ];
  useEffect(() => {
    const timer = setInterval(() => setBannerIndex((i) => (i + 1) % banniere.length), 5000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    setIsAdmin(typeof window !== 'undefined' && localStorage.getItem('user_role') === 'admin');
  }, []);
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
      window.dispatchEvent(new Event('panier-maj')); // 🔔 rafraîchit le badge panier (header + nav du bas)
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
    <div className="max-w-md md:max-w-2xl mx-auto px-4 py-5 min-h-screen">

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

      {/* 🔎 RECHERCHE + SCAN */}
      <div className="flex gap-3 mb-4">
        <div className="relative flex-grow">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
          <input 
            type="text" 
            placeholder="Rechercher un produit, médicament..." 
            className="w-full pl-12 pr-12 py-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-800 dark:text-white text-sm font-medium focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-400 outline-none transition-all"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
          />
          <ScanLine className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
        </div>
      </div>

      {/* 🏷️ CHIPS CATÉGORIES -- les 4 premières en accès direct, "Filtres" ouvre la liste
          complète (dynamique, dépend du catalogue réel du tenant -- pas de noms figés). */}
      <div className="flex gap-2 overflow-x-auto pb-1 mb-6 -mx-1 px-1 scrollbar-none">
        <button
          onClick={() => changerCategorie('all')}
          className={`shrink-0 px-4 py-2 rounded-full text-xs font-bold border transition-colors cursor-pointer ${activeCat === 'all' ? 'bg-emerald-500 text-white border-emerald-500' : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-800'}`}
        >
          Tous
        </button>
        {Object.entries(categories).slice(0, 4).map(([code, nom]) => (
          <button
            key={code}
            onClick={() => changerCategorie(code)}
            className={`shrink-0 px-4 py-2 rounded-full text-xs font-bold border transition-colors cursor-pointer ${activeCat === code ? 'bg-emerald-500 text-white border-emerald-500' : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-800'}`}
          >
            {nom}
          </button>
        ))}
        <button
          onClick={() => setIsModalOpen(true)}
          className="shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 cursor-pointer"
        >
          <Filter size={13} /> Filtres
        </button>
      </div>

      {activeCat !== 'all' && (
        <div className="mb-4 text-[10px] font-black uppercase text-emerald-500 tracking-widest">
          Filtre : {categories[activeCat]}
          <button onClick={() => changerCategorie('all')} className="ml-2 underline cursor-pointer bg-transparent border-none text-slate-400">Réinitialiser</button>
        </div>
      )}

      {/* 🎠 BANNIÈRE PROMO EN DIAPORAMA */}
      <div className="relative rounded-3xl bg-gradient-to-br from-emerald-50 to-emerald-100 dark:from-emerald-900/20 dark:to-emerald-950/20 p-6 mb-6 overflow-hidden">
        <AnimatePresence mode="wait">
          <motion.div key={bannerIndex} initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }} transition={{ duration: 0.3 }} className="flex items-center gap-4">
            <div className="w-11 h-11 rounded-2xl bg-emerald-500 flex items-center justify-center shrink-0">
              <ShoppingCart size={20} className="text-white" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">{banniere[bannerIndex].titre}</p>
              <p className="text-base font-black text-emerald-700 dark:text-emerald-400 truncate">{banniere[bannerIndex].sous}</p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">{banniere[bannerIndex].texte}</p>
            </div>
          </motion.div>
        </AnimatePresence>
        <div className="flex justify-center gap-1.5 mt-4">
          {banniere.map((_, i) => (
            <button key={i} onClick={() => setBannerIndex(i)} aria-label={`Voir la bannière ${i + 1}`}
              className={`h-1.5 rounded-full border-none cursor-pointer transition-all ${i === bannerIndex ? 'w-5 bg-emerald-500' : 'w-1.5 bg-emerald-200 dark:bg-emerald-800'}`} />
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-black text-slate-800 dark:text-white">
          {activeCat === 'all' ? 'Tous les produits' : categories[activeCat]}
        </h2>
        <span className="text-[11px] font-bold text-slate-400">{totalCount} produit{totalCount > 1 ? 's' : ''}</span>
      </div>


      {/* 🏗️ LISTE DES PRODUITS (lignes, fidèle à la maquette du 25/07) */}
      <div className="space-y-3">
        {/* Indicateur de chargement INLINE (recherche/pagination/catégorie) -- le formulaire
            et le champ de recherche au-dessus restent montés, contrairement à l'ancien
            early-return plein écran (cf. commentaire sur `hasLoadedOnce`). */}
        {loading && (
          <div className="flex items-center justify-center py-12 text-slate-400 text-xs font-black uppercase tracking-widest gap-3">
            <Loader2 size={18} className="animate-spin text-emerald-500" /> Recherche...
          </div>
        )}
        {!loading && filteredProduits.length === 0 && (
          <div className="flex items-center justify-center py-12 text-slate-400 text-xs font-black uppercase tracking-widest">
            Aucun produit trouvé
          </div>
        )}
        <AnimatePresence mode="popLayout">
          {!loading && filteredProduits.map((p) => (
            <motion.div
              key={p.id} layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
              className="bg-white dark:bg-slate-900 rounded-2xl p-3 border border-slate-100 dark:border-slate-800 flex items-center gap-3 group"
            >
              {/* Vignette produit + zone d'upload (admin uniquement, cf. isAdmin) */}
              <div className="relative w-16 h-16 shrink-0 bg-slate-50 dark:bg-slate-950 rounded-xl overflow-hidden flex items-center justify-center">
                {p.image ? (
                  <img src={p.image} alt={p.nom} loading="lazy" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-2xl">💊</span>
                )}
                {isAdmin && (
                  <label className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center cursor-pointer transition-all z-20">
                    <Camera className="text-white" size={16} />
                    <input
                      type="file" className="hidden" accept="image/*"
                      onChange={(e) => { if (e.target.files?.[0]) handleUpdatePhoto(p.id, e.target.files[0]); }}
                    />
                  </label>
                )}
              </div>

              {/* Infos produit */}
              <div className="min-w-0 flex-grow">
                <h3 className="text-sm font-black text-slate-800 dark:text-white truncate">{p.nom}</h3>
                <p className="text-[11px] text-slate-400 truncate">{p.laboratoire || categories[p.categorie] || "Général"}</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${p.quantite > 0 ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30' : 'bg-red-50 text-red-500 dark:bg-red-900/20'}`}>
                    {p.quantite > 0 ? 'En stock' : 'Rupture'}
                  </span>
                  <Prix montant={p.prix} className="text-sm font-black text-slate-800 dark:text-white" />
                </div>
              </div>

              {/* Stock + bouton panier */}
              <div className="flex flex-col items-end gap-1.5 shrink-0">
                <span className="text-[10px] text-slate-400 text-right leading-tight">Stock<br/><span className="font-bold text-slate-600 dark:text-slate-300">{p.quantite} unités</span></span>
                <button
                  disabled={p.quantite <= 0}
                  onClick={() => handleAddToCart(p.id)}
                  title="Ajouter au panier"
                  aria-label="Ajouter au panier"
                  className="bg-emerald-500 hover:bg-emerald-600 text-white p-2.5 rounded-xl transition-all active:scale-90 border-none cursor-pointer disabled:opacity-20 disabled:grayscale"
                >
                  <ShoppingCart size={16} strokeWidth={2.5} />
                </button>
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
