"use client";
import React, { useState, useEffect, Suspense, useRef } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search, Pill, ShoppingCart, Loader2, Filter, Plus, Minus, X, Check,
  Camera, WifiOff, ScanLine,
} from "lucide-react";

// 🌟 CONFIGURATION : Utilisation de l'instance unifiée apiClient (Gère l'URL de base et le JWT)
import apiClient from "../../lib/apiClient";
import Prix from "../../lib/components/Prix";
import { ajouterAuPanierHorsLigne } from "../../lib/offline/panierQueue";
import { chargerCatalogueLocal, catalogueLocalDisponible } from "../../lib/offline/syncCatalogue";
import { useToast, ToastContainer } from "../../lib/hooks/useToast";
import { useRouter, useSearchParams } from "next/navigation";

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
  ordonnance?: boolean; // ← pour le badge jaune si le backend l'envoie
}

const EASE = [0.22, 1, 0.36, 1] as const;

function CataloguePageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toasts, showToast } = useToast();
  const [produits, setProduits] = useState<Produit[]>([]);
  const [categories, setCategories] = useState<Record<string, string>>({});
  const [search, setSearch] = useState(() => searchParams.get("q") || "");
  const [activeCat, setActiveCat] = useState(() => searchParams.get("cat") || "all");
  const [isAdmin, setIsAdmin] = useState(false);
  const [peutAcheter, setPeutAcheter] = useState(false);
  const [produitPourQuantite, setProduitPourQuantite] = useState<Produit | null>(null);
  const [bannerIndex, setBannerIndex] = useState(0);
  const banniere = [
    { titre: "Produits authentiques", sous: "Stock en temps réel" },
    { titre: "Retrait en pharmacie", sous: "Commande prête en quelques minutes" },
    { titre: "Paiement sécurisé", sous: "Mobile Money vérifié" },
  ];
  useEffect(() => {
    const timer = setInterval(() => setBannerIndex((i) => (i + 1) % banniere.length), 5000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    setIsAdmin(typeof window !== "undefined" && localStorage.getItem("user_role") === "admin");
    const role = typeof window !== "undefined" ? localStorage.getItem("user_role") : null;
    setPeutAcheter(role !== "admin" && role !== "caissiere" && role !== "caissière");
  }, []);
  const [loading, setLoading] = useState(true);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const [modeHorsLigne, setModeHorsLigne] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(() => searchParams.get("filtres") === "1");
  const [quantites, setQuantites] = useState<Record<number, number>>({});
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [hasNext, setHasNext] = useState(false);
  const [hasPrevious, setHasPrevious] = useState(false);
  const PAGE_SIZE = 20;

  const [searchInput, setSearchInput] = useState(() => searchParams.get("q") || "");
    const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput);
      setPage(1);
    }, 400);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // 1. RÉCUPÉRATION DU CATALOGUE SYNCHRONISÉ
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const res = await apiClient.get("/api/catalogue/", {
          params: {
            page,
            page_size: PAGE_SIZE,
            ...(activeCat !== "all" ? { cat: activeCat } : {}),
            ...(search.trim() ? { q: search.trim() } : {}),
          },
        });
        // ✅ CORRIGÉ — accumulate les pages
        setProduits((prev) =>
          page === 1
            ? res.data.results.produits
            : [...prev, ...res.data.results.produits]
      );
        setCategories(res.data.results.categories);
        setTotalCount(res.data.count);
        setHasNext(Boolean(res.data.next));
        setHasPrevious(Boolean(res.data.previous));
        setModeHorsLigne(false);
      } catch (err: any) {
        if (!err?.response && (await catalogueLocalDisponible())) {
          const local = await chargerCatalogueLocal({
            search,
            categorie: activeCat,
            page,
            pageSize: PAGE_SIZE,
          });
          setProduits((prev) =>
          page === 1
            ? (local.produits as Produit[])
            : [...prev, ...(local.produits as Produit[])]
          );
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

  const changerCategorie = (cat: string) => {
    setActiveCat(cat);
    setPage(1);
    setIsModalOpen(false);
  };

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  // 2. MODIFICATION DE LA PHOTO PAR L'ADMINISTRATEUR
  const handleUpdatePhoto = async (produitId: number, file: File) => {
    const formData = new FormData();
    formData.append("image", file);
    try {
      const res = await apiClient.post(`/api/modifier-photo/${produitId}/`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setProduits((prev) =>
        prev.map((p) => (p.id === produitId ? { ...p, image: res.data.image_url } : p))
      );
      showToast("Photo mise à jour", "success");
    } catch (err: any) {
      console.error("Erreur upload:", err);
      showToast(err.response?.data?.error || "Erreur lors de la mise à jour de la photo. Droits admin requis.", "error");
    }
  };

  // 3. AJOUT SÉCURISÉ AU PANIER CLIENT
  const handleAddToCart = async (produitId: number) => {
    const qte = quantites[produitId] || 1;
    const produit = produits.find((p) => p.id === produitId);

    if (typeof navigator !== "undefined" && !navigator.onLine) {
      if (produit) await ajouterAuPanierHorsLigne(produitId, produit.nom, produit.prix, qte);
      showToast(`${qte} unité(s) mise(s) en attente — sera synchronisé au retour du réseau`, "info");
      return;
    }

    try {
      await apiClient.post("/api/panier/", { produit_id: produitId, quantite: qte });
      window.dispatchEvent(new Event("panier-maj"));
      showToast(`${qte} unité(s) ajoutée(s) au panier`, "success");
    } catch (err: any) {
      if (!err.response) {
        if (produit) await ajouterAuPanierHorsLigne(produitId, produit.nom, produit.prix, qte);
        showToast(`Réseau injoignable — ${qte} unité(s) en attente de synchronisation`, "info");
        return;
      }
      showToast(err.response?.data?.error || "Erreur lors de l'ajout. Veuillez vérifier votre session.", "error");
    }
  };

  const updateLocalQte = (id: number, delta: number, max: number) => {
    const current = quantites[id] || 1;
    const next = Math.max(1, Math.min(max, current + delta));
    setQuantites({ ...quantites, [id]: next });
  };

  // ─── INFINITE SCROLL (visuel uniquement, garde la pagination existante) ───
  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!loadMoreRef.current || !hasNext || loading) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) setPage((p) => p + 1);
      },
      { rootMargin: "200px" }
    );
    observer.observe(loadMoreRef.current);
    return () => observer.disconnect();
  }, [hasNext, loading]);

  if (loading && !hasLoadedOnce) {
    return (
      <div className="max-w-md mx-auto px-4 pt-4 pb-28 space-y-4">
        <div className="h-11 rounded-2xl bg-gray-200 dark:bg-gray-800 animate-pulse" />
        <div className="flex gap-2 overflow-hidden">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-9 w-24 rounded-full bg-gray-200 dark:bg-gray-800 animate-pulse flex-shrink-0" />
          ))}
        </div>
        <div className="grid grid-cols-2 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <div className="aspect-square rounded-[20px] bg-gray-200 dark:bg-gray-800 animate-pulse" />
              <div className="h-3 w-full rounded bg-gray-200 dark:bg-gray-800 animate-pulse" />
              <div className="h-3 w-2/3 rounded bg-gray-200 dark:bg-gray-800 animate-pulse" />
              <div className="flex justify-between">
                <div className="h-4 w-16 rounded bg-gray-200 dark:bg-gray-800 animate-pulse" />
                <div className="h-8 w-8 rounded-full bg-gray-200 dark:bg-gray-800 animate-pulse" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <main className="max-w-md mx-auto pb-28">
      {/* ═══ HEADER STICKY : Search + Catégories ═══ */}
      <div className="sticky top-0 z-30 bg-white/80 dark:bg-[#050e0c]/80 backdrop-blur-xl border-b border-black/5 dark:border-white/5">
        <div className="px-4 pt-3 pb-2">
          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="search"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Rechercher un médicament..."
                className="w-full h-11 pl-10 pr-10 rounded-2xl bg-gray-100 dark:bg-gray-800 text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all"
              />
              {searchInput && (
                <button
                  onClick={() => { setSearchInput(""); setSearch(""); }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 border-none bg-transparent"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={() => showToast("Scan de code-barres bientôt disponible", "info")}
              className="w-11 h-11 rounded-2xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center active:bg-gray-200 dark:active:bg-gray-700 transition-colors border-none"
              aria-label="Scanner un code-barres"
            >
              <ScanLine className="w-5 h-5 text-gray-600 dark:text-gray-400" />
            </motion.button>
          </div>
        </div>

        {/* Catégories horizontal scroll */}
        <div className="flex gap-2 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden px-4 pb-3">
          <button
            onClick={() => changerCategorie("all")}
            className={`flex-shrink-0 px-4 py-2 rounded-full text-xs font-semibold transition-all border-none ${
              activeCat === "all"
                ? "bg-emerald-600 text-white shadow-sm shadow-emerald-900/20"
                : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 active:bg-gray-200 dark:active:bg-gray-700"
            }`}
          >
            Tous
          </button>
          {Object.entries(categories).slice(0, 6).map(([code, nom]) => (
            <button
              key={code}
              onClick={() => changerCategorie(code)}
              className={`flex-shrink-0 px-4 py-2 rounded-full text-xs font-semibold transition-all border-none ${
                activeCat === code
                  ? "bg-emerald-600 text-white shadow-sm shadow-emerald-900/20"
                  : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 active:bg-gray-200 dark:active:bg-gray-700"
              }`}
            >
              {nom}
            </button>
          ))}
          <button
            onClick={() => setIsModalOpen(true)}
            className="flex-shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-semibold bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 active:bg-gray-200 dark:active:bg-gray-700 border-none"
          >
            <Filter className="w-3 h-3" /> Plus
          </button>
        </div>
      </div>

      <div className="px-4 pt-4">
        {/* Bandeau offline */}
        {modeHorsLigne && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-4 flex items-center gap-3 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 px-4 py-3 text-amber-700 dark:text-amber-400"
          >
            <WifiOff size={16} className="shrink-0" />
            <p className="text-xs font-medium">
              Mode hors-ligne — catalogue affiché depuis la dernière synchro.
            </p>
          </motion.div>
        )}

        {/* Bannière promo */}
        <div className="relative rounded-3xl bg-gradient-to-br from-emerald-50 to-emerald-100 dark:from-emerald-900/20 dark:to-emerald-950/20 p-5 mb-5 overflow-hidden">
          <AnimatePresence mode="wait">
            <motion.div
              key={bannerIndex}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
            >
              <p className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
                {banniere[bannerIndex].titre}
              </p>
              <p className="text-sm font-bold text-gray-900 dark:text-gray-100 mt-0.5">
                {banniere[bannerIndex].sous}
              </p>
            </motion.div>
          </AnimatePresence>
          <div className="flex gap-1.5 mt-3">
            {banniere.map((_, i) => (
              <button
                key={i}
                onClick={() => setBannerIndex(i)}
                className={`h-1 rounded-full transition-all border-none ${
                  i === bannerIndex ? "w-5 bg-emerald-500" : "w-1.5 bg-emerald-200 dark:bg-emerald-800"
                }`}
              />
            ))}
          </div>
        </div>

        {/* Compteur résultats */}
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-bold text-gray-900 dark:text-gray-100">
            {activeCat === "all" ? "Tous les produits" : categories[activeCat]}
          </h2>
          <span className="text-[11px] font-medium text-gray-400">
            {totalCount} produit{totalCount > 1 ? "s" : ""}
          </span>
        </div>

        {/* ═══ GRILLE 2 COLONNES ═══ */}
        {produits.length === 0 && !loading ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="py-20 text-center"
          >
            <Pill className="w-12 h-12 text-gray-200 dark:text-gray-800 mx-auto mb-3" />
            <p className="text-sm text-gray-400 font-medium">Aucun produit trouvé</p>
            {activeCat !== "all" && (
              <button
                onClick={() => changerCategorie("all")}
                className="mt-3 text-emerald-600 text-xs font-semibold border-none bg-transparent"
              >
                Voir tout le catalogue
              </button>
            )}
          </motion.div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <AnimatePresence mode="popLayout">
              {produits.map((p, i) => (
                <motion.div
                  key={p.id}
                  layout
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(i * 0.04, 0.3), duration: 0.4, ease: EASE }}
                >
                  <div
                    onClick={() => router.push(`/produit/${p.id}`)}
                    className="bg-white dark:bg-gray-900 rounded-[20px] border border-black/5 dark:border-white/5 overflow-hidden shadow-sm active:scale-[0.98] transition-transform cursor-pointer"
                  >
                    {/* Image */}
                    <div className="relative aspect-square bg-gray-100 dark:bg-gray-800">
                      {p.image ? (
                        <img
                          src={p.image}
                          alt={p.nom}
                          loading="lazy"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Pill className="w-10 h-10 text-gray-300 dark:text-gray-600" />
                        </div>
                      )}

                      {/* Badge ordonnance */}
                      {p.ordonnance && (
                        <span className="absolute top-2 left-2 px-2 py-0.5 rounded-full bg-amber-500 text-white text-[9px] font-bold uppercase tracking-wide shadow-sm">
                          Ordonnance
                        </span>
                      )}

                      {/* Badge stock */}
                      <span
                        className={`absolute top-2 right-2 w-2.5 h-2.5 rounded-full border-2 border-white dark:border-gray-900 shadow-sm ${
                          p.quantite > 0 ? "bg-emerald-500" : "bg-red-500"
                        }`}
                      />

                      {/* Upload photo admin */}
                      {isAdmin && (
                        <label
                          onClick={(e) => e.stopPropagation()}
                          className="absolute inset-0 bg-black/0 hover:bg-black/30 flex items-end justify-end p-2 cursor-pointer transition-colors z-10 opacity-0 hover:opacity-100"
                        >
                          <span className="h-7 w-7 rounded-full bg-white/90 dark:bg-gray-900/90 shadow flex items-center justify-center">
                            <Camera className="text-gray-800 dark:text-white" size={12} />
                          </span>
                          <input
                            type="file"
                            className="hidden"
                            accept="image/*"
                            onChange={(e) => {
                              if (e.target.files?.[0]) handleUpdatePhoto(p.id, e.target.files[0]);
                            }}
                          />
                        </label>
                      )}
                    </div>

                    {/* Contenu */}
                    <div className="p-3">
                      <h3 className="text-[13px] font-semibold text-gray-900 dark:text-gray-100 line-clamp-2 leading-snug min-h-[2.4em]">
                        {p.nom}
                      </h3>
                      <p className="text-[11px] text-gray-400 mt-0.5 truncate">
                        {p.laboratoire || categories[p.categorie] || "Pharmacie"}
                      </p>

                      <div className="flex items-center justify-between mt-2">
                        <Prix
                          montant={p.prix}
                          className="text-sm font-bold text-gray-900 dark:text-gray-100"
                        />
                        {peutAcheter && (
                          <motion.button
                            whileTap={{ scale: 0.78 }}
                            onClick={(e) => {
                              e.stopPropagation();
                              setProduitPourQuantite(p);
                            }}
                            disabled={p.quantite <= 0}
                            className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors border-none ${
                              p.quantite > 0
                                ? "bg-emerald-600 text-white active:bg-emerald-700 shadow-sm"
                                : "bg-gray-200 text-gray-400 dark:bg-gray-700 cursor-not-allowed"
                            }`}
                          >
                            <Plus className="w-4 h-4" />
                          </motion.button>
                        )}
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}

        {/* Infinite scroll trigger */}
        {hasNext && (
          <div ref={loadMoreRef} className="py-6 flex justify-center min-h-[60px]">
            <Loader2
              className={`animate-spin text-emerald-500 ${loading ? "opacity-100" : "opacity-0"}`}
              size={24}
            />
          </div>
        )}

        {!hasNext && produits.length > 0 && (
          <p className="text-center text-[11px] text-gray-400 py-6">
            Vous avez tout vu
          </p>
        )}
      </div>

      {/* ═══ MODALE CATÉGORIES (bottom sheet) ═══ */}
      {mounted &&
        createPortal(
          <AnimatePresence>
            {isModalOpen && (
              <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center">
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onClick={() => setIsModalOpen(false)}
                  className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                />
                <motion.div
                  initial={{ y: "100%" }}
                  animate={{ y: 0 }}
                  exit={{ y: "100%" }}
                  transition={{ type: "spring", damping: 30, stiffness: 300 }}
                  className="relative bg-white dark:bg-[#0b1a16] w-full sm:max-w-md rounded-t-[28px] sm:rounded-[28px] shadow-2xl overflow-hidden border border-black/5 dark:border-white/5 max-h-[85vh] flex flex-col"
                >
                  <div className="sm:hidden flex justify-center pt-3">
                    <div className="h-1.5 w-10 rounded-full bg-gray-200 dark:bg-white/20" />
                  </div>
                  <div className="px-6 py-4 border-b border-black/5 dark:border-white/5 flex justify-between items-center">
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white">Catégories</h3>
                    <button
                      onClick={() => setIsModalOpen(false)}
                      className="h-9 w-9 flex items-center justify-center rounded-full bg-gray-100 dark:bg-white/5 text-gray-500 border-none"
                    >
                      <X size={18} />
                    </button>
                  </div>
                  <div className="p-4 overflow-y-auto space-y-1" style={{ paddingBottom: "calc(1rem + env(safe-area-inset-bottom))" }}>
                    <button
                      onClick={() => changerCategorie("all")}
                      className={`w-full p-4 rounded-2xl text-left font-semibold text-sm transition-all flex justify-between items-center border-none ${
                        activeCat === "all"
                          ? "bg-emerald-600 text-white"
                          : "bg-gray-50 dark:bg-white/5 text-gray-700 dark:text-gray-300 active:bg-gray-100 dark:active:bg-white/10"
                      }`}
                    >
                      Toutes les catégories {activeCat === "all" && <Check size={16} />}
                    </button>
                    {Object.entries(categories).map(([code, nom]) => (
                      <button
                        key={code}
                        onClick={() => changerCategorie(code)}
                        className={`w-full p-4 rounded-2xl text-left font-semibold text-sm transition-all flex justify-between items-center border-none ${
                          activeCat === code
                            ? "bg-emerald-600 text-white"
                            : "bg-gray-50 dark:bg-white/5 text-gray-700 dark:text-gray-300 active:bg-gray-100 dark:active:bg-white/10"
                        }`}
                      >
                        {nom} {activeCat === code && <Check size={16} />}
                      </button>
                    ))}
                  </div>
                </motion.div>
              </div>
            )}
          </AnimatePresence>,
          document.body
        )}

            {/* ═══ BOTTOM SHEET QUANTITÉ ═══ */}
      {mounted &&
        createPortal(
          <AnimatePresence>
            {produitPourQuantite && (
              <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center">
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onClick={() => setProduitPourQuantite(null)}
                  className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                />
                <motion.div
                  initial={{ y: "100%" }}
                  animate={{ y: 0 }}
                  exit={{ y: "100%" }}
                  transition={{ type: "spring", damping: 30, stiffness: 300 }}
                  className="relative bg-white dark:bg-[#0b1a16] w-full sm:max-w-sm rounded-t-[28px] sm:rounded-[28px] shadow-2xl overflow-hidden border border-black/5 dark:border-white/5"
                >
                  <div className="sm:hidden flex justify-center pt-3">
                    <div className="h-1.5 w-10 rounded-full bg-gray-200 dark:bg-white/20" />
                  </div>
                  <div className="px-6 py-4 border-b border-black/5 dark:border-white/5 flex justify-between items-center">
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white truncate pr-4">
                      {produitPourQuantite.nom}
                    </h3>
                    <button
                      onClick={() => setProduitPourQuantite(null)}
                      className="h-9 w-9 shrink-0 flex items-center justify-center rounded-full bg-gray-100 dark:bg-white/5 text-gray-500 border-none"
                    >
                      <X size={18} />
                    </button>
                  </div>

                  <div className="p-6" style={{ paddingBottom: "calc(1.5rem + env(safe-area-inset-bottom))" }}>
                    <div className="flex items-center justify-between mb-6">
                      <Prix montant={produitPourQuantite.prix} className="text-xl font-bold text-gray-900 dark:text-white" />
                      <span className="text-xs font-medium text-gray-400">
                        {produitPourQuantite.quantite} unités en stock
                      </span>
                    </div>

                    <div className="flex items-center justify-center gap-5 mb-6">
                      <button
                        onClick={() => updateLocalQte(produitPourQuantite.id, -1, produitPourQuantite.quantite)}
                        disabled={(quantites[produitPourQuantite.id] || 1) <= 1}
                        className="h-12 w-12 rounded-2xl bg-gray-100 dark:bg-white/5 text-gray-700 dark:text-gray-300 flex items-center justify-center border-none active:scale-90 transition-all disabled:opacity-30"
                      >
                        <Minus size={18} />
                      </button>
                      <span className="text-2xl font-bold text-gray-900 dark:text-white w-10 text-center tabular-nums">
                        {quantites[produitPourQuantite.id] || 1}
                      </span>
                      <button
                        onClick={() => updateLocalQte(produitPourQuantite.id, 1, produitPourQuantite.quantite)}
                        disabled={(quantites[produitPourQuantite.id] || 1) >= produitPourQuantite.quantite}
                        className="h-12 w-12 rounded-2xl bg-gray-100 dark:bg-white/5 text-gray-700 dark:text-gray-300 flex items-center justify-center border-none active:scale-90 transition-all disabled:opacity-30"
                      >
                        <Plus size={18} />
                      </button>
                    </div>

                    <motion.button
                      whileTap={{ scale: 0.97 }}
                      onClick={() => {
                        handleAddToCart(produitPourQuantite.id);
                        setProduitPourQuantite(null);
                      }}
                      className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm py-4 rounded-2xl transition-colors border-none flex items-center justify-center gap-2"
                    >
                      <ShoppingCart size={17} /> Ajouter au panier
                    </motion.button>
                  </div>
                </motion.div>
              </div>
            )}
          </AnimatePresence>,
          document.body
        )}

      <ToastContainer toasts={toasts} />
    </main>
  );
}

export default function CataloguePage() {
  return (
    <Suspense
      fallback={
        <div className="h-screen flex items-center justify-center">
          <Loader2 className="animate-spin text-emerald-500" size={40} />
        </div>
      }
    >
      <CataloguePageInner />
    </Suspense>
  );
}