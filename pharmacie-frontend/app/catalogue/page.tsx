"use client";
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Pill, ShoppingCart, Info, Loader2, Filter, Plus, Minus, AlertCircle, X, Check, Camera } from 'lucide-react';

// 🌟 CONFIGURATION : Utilisation de l'instance unifiée apiClient (Gère l'URL de base et le JWT)
import apiClient from '../../lib/apiClient';
import Prix from '../../lib/components/Prix';

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
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [quantites, setQuantites] = useState<Record<number, number>>({});

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
      } catch (err) {
        console.error("Erreur Catalogue:", err);
      } finally {
        setLoading(false);
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
  const handleAddToCart = async (produitId: number) => {
    const qte = quantites[produitId] || 1;
    try {
      await apiClient.post('/api/panier/', { 
        produit_id: produitId, 
        quantite: qte 
      });
      alert(`Ajouté : ${qte} unité(s) au panier ! ✅`);
    } catch (err: any) {
      alert(err.response?.data?.error || "Erreur lors de l'ajout. Veuillez vérifier votre session.");
    }
  };

  const updateLocalQte = (id: number, delta: number, max: number) => {
    const current = quantites[id] || 1;
    const next = Math.max(1, Math.min(max, current + delta));
    setQuantites({ ...quantites, [id]: next });
  };

  const filteredProduits = produits; // le filtrage (recherche + catégorie) est désormais fait côté serveur

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <Loader2 className="animate-spin text-emerald-500" size={48} />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-6 py-12">
      
      {/* 🎯 HEADER & RECHERCHE */}
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-16">
        <h1 className="text-5xl font-black text-slate-800 dark:text-white tracking-tighter mb-4">
          Catalogue <span className="text-emerald-500 italic">Médicaments</span> 💊
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
        <AnimatePresence mode="popLayout">
          {filteredProduits.map((p) => (
            <motion.div
              key={p.id} layout initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
              className="bg-white dark:bg-slate-900 rounded-[3rem] p-8 border border-slate-100 dark:border-slate-800 shadow-sm hover:shadow-2xl transition-all group flex flex-col justify-between"
            >
              <div>
                <div className="relative h-48 bg-slate-50 dark:bg-slate-950 rounded-[2rem] mb-6 overflow-hidden flex items-center justify-center group-hover:bg-emerald-50 transition-colors">
                  
                  {/* 🌟 IMAGE STABILISÉE : Utilise l'URL absolue renvoyée proprement par le backend Django */}
                  {p.image ? (
                    <img src={p.image} alt={p.nom} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
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
