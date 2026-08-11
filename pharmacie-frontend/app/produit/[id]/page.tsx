"use client";
import React, { useState, useEffect, type ReactNode } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowLeft, Heart, Share2, Pill, ShoppingCart, Plus, Minus, Loader2,
  ShieldAlert, Package, ArrowDownCircle, ArrowUpCircle, ChevronRight,
  CheckCircle2,
} from "lucide-react";

import apiClient from "../../../lib/apiClient";
import Prix from "../../../lib/components/Prix";
import { useToast, ToastContainer } from "../../../lib/hooks/useToast";
import { ajouterAuPanierHorsLigne } from "../../../lib/offline/panierQueue";

/* ═══════════════════════════════════════════════════════════════
   TYPES — INCHANGÉS
   ═══════════════════════════════════════════════════════════════ */
interface ProduitDetail {
  id: number;
  identifiant: string;
  nom: string;
  prix: number;
  prix_achat?: number | null;
  categorie: string;
  categorie_display?: string;
  quantite: number;
  seuil_alerte: number;
  laboratoire: string;
  description: string;
  ordonnance_obligatoire: boolean;
  date_expiration?: string | null;
  statut_stock_label: string;
  image?: string | null;
}

interface ProduitSimilaire {
  id: number;
  nom: string;
  prix: number;
  laboratoire: string;
  categorie_display?: string;
  image?: string | null;
  quantite: number;
}

const EASE = [0.22, 1, 0.36, 1] as const;

/* ═══ SKELETON FICHE PRODUIT ═══ */
function ProduitSkeleton() {
  const shimmer = "animate-pulse bg-gray-200 dark:bg-gray-800";
  return (
    <div className="max-w-md mx-auto min-h-screen bg-white dark:bg-[#050e0c] pb-32">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3">
        <div className={`h-10 w-10 rounded-full ${shimmer}`} />
        <div className="flex gap-2">
          <div className={`h-10 w-10 rounded-full ${shimmer}`} />
          <div className={`h-10 w-10 rounded-full ${shimmer}`} />
        </div>
      </div>

      {/* Image */}
      <div className="px-4 pt-2">
        <div className={`w-full aspect-[4/3] max-h-[280px] rounded-3xl ${shimmer}`} />
      </div>

      {/* Infos */}
      <div className="px-4 pt-5 space-y-3">
        <div className={`h-3 w-24 rounded ${shimmer}`} />
        <div className={`h-7 w-3/4 rounded-lg ${shimmer}`} />
        <div className="flex items-center justify-between pt-2">
          <div className={`h-8 w-32 rounded-lg ${shimmer}`} />
          <div className={`h-10 w-28 rounded-2xl ${shimmer}`} />
        </div>
        <div className={`h-3 w-20 rounded ${shimmer}`} />
      </div>

      {/* Description card */}
      <div className="px-4 pt-6">
        <div className={`h-3 w-24 rounded mb-3 ${shimmer}`} />
        <div className={`h-24 w-full rounded-2xl ${shimmer}`} />
      </div>

      {/* CTA fixe */}
      <div className="fixed bottom-0 left-0 right-0 px-4 pt-3 pb-6 bg-white dark:bg-[#050e0c] border-t border-gray-100 dark:border-white/5">
        <div className={`h-[52px] w-full rounded-2xl ${shimmer}`} />
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   PAGE PRINCIPALE
   ═══════════════════════════════════════════════════════════════ */
export default function ProduitDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { toasts, showToast } = useToast();

  const produitId = params?.id as string;

  const [produit, setProduit] = useState<ProduitDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isStaff, setIsStaff] = useState(false);
  const [quantite, setQuantite] = useState(1);
  const [ajoutEnCours, setAjoutEnCours] = useState(false);
  const [estFavori, setEstFavori] = useState(false);
  const [favoriEnCours, setFavoriEnCours] = useState(false);
  const [similaires, setSimilaires] = useState<ProduitSimilaire[] | null>(null);

  /* ─── Auth ─── */
  useEffect(() => {
    const role = typeof window !== "undefined" ? localStorage.getItem("user_role") : null;
    setIsAdmin(role === "admin");
    setIsStaff(role === "admin" || role === "caissiere");
  }, []);

  /* ─── Fetch produit ─── */
  useEffect(() => {
    if (!produitId) return;
    const fetchProduit = async () => {
      setLoading(true);
      setNotFound(false);
      try {
        const res = await apiClient.get(`/api/produits/${produitId}/`);
        setProduit(res.data);
        setQuantite(1);
      } catch (err: any) {
        if (err.response?.status === 404) {
          setNotFound(true);
        } else {
          console.error("Erreur chargement produit:", err);
          showToast("Impossible de charger ce produit. Vérifiez votre connexion.", "error");
        }
      } finally {
        setLoading(false);
      }
    };
    fetchProduit();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [produitId]);

  /* ─── Favoris ─── */
  useEffect(() => {
    if (isStaff || !produitId) return;
    apiClient
      .get("/api/favoris/")
      .then((res) => {
        const favoris = res.data as { produit: { id: number } }[];
        setEstFavori(favoris.some((f) => f.produit.id === Number(produitId)));
      })
      .catch(() => {});
  }, [produitId, isStaff]);

  const toggleFavori = async () => {
    if (!produit || favoriEnCours) return;
    setFavoriEnCours(true);
    const etatPrecedent = estFavori;
    setEstFavori(!etatPrecedent);
    try {
      const res = await apiClient.post(`/api/favoris/${produit.id}/`);
      setEstFavori(res.data.favori);
    } catch (err: any) {
      setEstFavori(etatPrecedent);
      if (err.response?.status === 401) {
        showToast("Connectez-vous pour enregistrer vos favoris.", "info");
      } else {
        showToast("Impossible de mettre à jour vos favoris.", "error");
      }
    } finally {
      setFavoriEnCours(false);
    }
  };

  /* ─── Partage ─── */
  const partager = async () => {
    if (!produit) return;
    const url = typeof window !== "undefined" ? window.location.href : "";
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title: produit.nom, text: `${produit.nom} — ${produit.laboratoire || "Pharmacie+"}`, url });
      } catch {}
    } else if (typeof navigator !== "undefined" && navigator.clipboard) {
      await navigator.clipboard.writeText(url);
      showToast("Lien copié dans le presse-papiers", "success");
    }
  };

  /* ─── Similaires ─── */
  useEffect(() => {
    if (!produit) return;
    apiClient
      .get(`/api/catalogue/?cat=${encodeURIComponent(produit.categorie)}&page_size=8`)
      .then((res) => {
        const liste: ProduitSimilaire[] = (res.data?.results?.produits || res.data?.produits || [])
          .filter((p: ProduitSimilaire) => p.id !== produit.id)
          .slice(0, 6);
        setSimilaires(liste);
      })
      .catch(() => setSimilaires([]));
  }, [produit?.categorie, produit?.id]);

  const modifierQuantite = (delta: number) => {
    if (!produit) return;
    setQuantite((q) => Math.max(1, Math.min(produit.quantite, q + delta)));
  };

  const handleAddToCart = async () => {
    if (!produit) return;
    setAjoutEnCours(true);
    try {
      if (typeof navigator !== "undefined" && !navigator.onLine) {
        await ajouterAuPanierHorsLigne(produit.id, produit.nom, produit.prix, quantite);
        showToast(`${quantite} unité(s) mise(s) en attente — sera synchronisé au retour du réseau`, "info");
        return;
      }
      await apiClient.post("/api/panier/", { produit_id: produit.id, quantite });
      window.dispatchEvent(new Event("panier-maj"));
      showToast(`${quantite} unité(s) ajoutée(s) au panier`, "success");
    } catch (err: any) {
      if (!err.response) {
        await ajouterAuPanierHorsLigne(produit.id, produit.nom, produit.prix, quantite);
        showToast(`Réseau injoignable — ${quantite} unité(s) en attente de synchronisation`, "info");
        return;
      }
      showToast(err.response?.data?.error || "Erreur lors de l'ajout au panier.", "error");
    } finally {
      setAjoutEnCours(false);
    }
  };

  /* ─── Loading ─── */
    if (loading) {
    return <ProduitSkeleton />;
  }

  if (notFound || !produit) {
    return (
      <div className="h-screen flex flex-col items-center justify-center gap-4 px-6 text-center bg-white dark:bg-[#050e0c]">
        <Package size={40} className="text-gray-300 dark:text-gray-700" />
        <p className="text-base font-bold text-gray-700 dark:text-gray-200">Produit introuvable</p>
        <p className="text-sm text-gray-400 max-w-xs">Ce produit n'existe plus ou a été retiré du catalogue.</p>
        <button
          onClick={() => router.push("/catalogue")}
          className="mt-2 h-11 px-6 rounded-2xl bg-emerald-600 text-white font-semibold text-sm border-none active:scale-95 transition-transform"
        >
          Retour au catalogue
        </button>
      </div>
    );
  }

  const enRupture = produit.quantite <= 0;

  return (
    <div className={`max-w-md mx-auto min-h-screen bg-white dark:bg-[#050e0c] ${!isStaff ? "pb-32" : "pb-10"}`}>
      {/* ═══ HEADER ═══ */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: EASE }}
        className="sticky top-0 z-30 flex items-center justify-between px-4 py-3 bg-white/80 dark:bg-[#050e0c]/80 backdrop-blur-xl"
      >
        <button
          onClick={() => router.back()}
          aria-label="Retour"
          className="h-10 w-10 flex items-center justify-center rounded-full bg-gray-100 dark:bg-white/5 text-gray-700 dark:text-gray-200 border-none active:scale-90 transition-transform"
        >
          <ArrowLeft size={20} />
        </button>
        <div className="flex items-center gap-2">
          {!isStaff && (
            <motion.button
              whileTap={{ scale: 0.85 }}
              onClick={toggleFavori}
              aria-label={estFavori ? "Retirer des favoris" : "Ajouter aux favoris"}
              className="h-10 w-10 flex items-center justify-center rounded-full bg-gray-100 dark:bg-white/5 border-none active:scale-90 transition-transform"
            >
              <Heart
                size={19}
                className={estFavori ? "fill-red-500 text-red-500" : "text-gray-700 dark:text-gray-200"}
              />
            </motion.button>
          )}
          <motion.button
            whileTap={{ scale: 0.85 }}
            onClick={partager}
            aria-label="Partager"
            className="h-10 w-10 flex items-center justify-center rounded-full bg-gray-100 dark:bg-white/5 text-gray-700 dark:text-gray-200 border-none active:scale-90 transition-transform"
          >
            <Share2 size={18} />
          </motion.button>
        </div>
      </motion.div>

      {/* ═══ IMAGE — réduite, max-h contrôlé ═══ */}
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, ease: EASE }}
        className="px-4 pt-2"
      >
        <div className="relative w-full aspect-[4/3] max-h-[280px] rounded-3xl overflow-hidden bg-gray-100 dark:bg-gray-800 ring-1 ring-black/5 dark:ring-white/5">
          {produit.image ? (
            <img src={produit.image} alt={produit.nom} className="w-full h-full object-contain" />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Pill size={48} className="text-gray-300 dark:text-gray-600" />
            </div>
          )}
          {/* Badge ordonnance sur l'image */}
          {produit.ordonnance_obligatoire && (
            <span className="absolute top-3 left-3 px-2.5 py-1 rounded-full bg-amber-500 text-white text-[10px] font-bold uppercase tracking-wide shadow-sm">
              Ordonnance requise
            </span>
          )}
          {/* Badge stock */}
          <span
            className={`absolute top-3 right-3 flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide shadow-sm ${
              enRupture
                ? "bg-red-500 text-white"
                : "bg-emerald-500 text-white"
            }`}
          >
            <span className={`w-1.5 h-1.5 rounded-full bg-white`} />
            {enRupture ? "Rupture" : "En stock"}
          </span>
        </div>
      </motion.div>

      {/* ═══ INFOS ═══ */}
      <div className="px-4 pt-5">
        {/* Labo */}
        <motion.p
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: EASE, delay: 0.05 }}
          className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wide"
        >
          {produit.laboratoire || "Pharmacie+"}
        </motion.p>

        {/* Nom */}
        <motion.h1
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: EASE, delay: 0.1 }}
          className="mt-1 text-[22px] font-bold text-gray-900 dark:text-gray-100 leading-tight"
        >
          {produit.nom}
        </motion.h1>

        {/* Prix + quantité */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: EASE, delay: 0.15 }}
          className="flex items-center justify-between mt-4"
        >
          <div className="flex items-baseline gap-1">
            <Prix montant={produit.prix} className="text-2xl font-bold text-gray-900 dark:text-gray-100" />
            <span className="text-sm text-gray-400">/ unité</span>
          </div>

          {!isStaff && (
            <div className="flex items-center gap-1 bg-gray-100 dark:bg-white/5 rounded-2xl p-1">
              <button
                onClick={() => modifierQuantite(-1)}
                disabled={quantite <= 1}
                className="h-9 w-9 flex items-center justify-center rounded-xl bg-white dark:bg-white/10 text-gray-700 dark:text-gray-200 border-none active:scale-90 transition-transform disabled:opacity-30"
              >
                <Minus size={14} />
              </button>
              <span className="w-8 text-center text-sm font-bold text-gray-900 dark:text-gray-100 tabular-nums">
                {quantite}
              </span>
              <button
                onClick={() => modifierQuantite(1)}
                disabled={quantite >= produit.quantite}
                className="h-9 w-9 flex items-center justify-center rounded-xl bg-white dark:bg-white/10 text-gray-700 dark:text-gray-200 border-none active:scale-90 transition-transform disabled:opacity-30"
              >
                <Plus size={14} />
              </button>
            </div>
          )}
        </motion.div>

        {/* Catégorie */}
        {produit.categorie_display && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: EASE, delay: 0.2 }}
            className="mt-3"
          >
            <Link
              href={`/catalogue?cat=${encodeURIComponent(produit.categorie)}`}
              className="inline-flex items-center gap-1 text-xs font-medium text-gray-400 hover:text-emerald-600 dark:hover:text-emerald-400 no-underline transition-colors"
            >
              {produit.categorie_display} <ChevronRight size={12} />
            </Link>
          </motion.div>
        )}

        {/* Description */}
        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: EASE, delay: 0.25 }}
          className="mt-6"
        >
          <h2 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
            Description
          </h2>
          <div className="rounded-2xl bg-gray-50 dark:bg-white/[0.03] p-4 ring-1 ring-black/5 dark:ring-white/5">
            <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
              {produit.description || "Aucune information complémentaire renseignée pour ce produit."}
            </p>
          </div>
        </motion.section>

        {/* Info stock détaillée */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: EASE, delay: 0.3 }}
          className="mt-3 flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400"
        >
          <CheckCircle2 size={14} className={enRupture ? "text-red-400" : "text-emerald-500"} />
          {enRupture
            ? "Produit temporairement indisponible"
            : `${produit.quantite} unité${produit.quantite > 1 ? "s" : ""} disponible${produit.quantite > 1 ? "s" : ""}`}
        </motion.div>

        {/* Bloc admin */}
        {isAdmin && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: EASE, delay: 0.35 }}
            className="mt-6"
          >
            <BlocAdmin produit={produit} />
          </motion.div>
        )}

        {/* Produits similaires */}
        {similaires && similaires.length > 0 && (
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: EASE, delay: 0.4 }}
            className="mt-8 mb-4"
          >
            <h2 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
              Produits similaires
            </h2>
            <div className="flex gap-3 overflow-x-auto snap-x snap-mandatory [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden pb-2 -mx-4 px-4">
              {similaires.map((p, i) => (
                <motion.div
                  key={p.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.45 + i * 0.05, duration: 0.4, ease: EASE }}
                  className="shrink-0 w-[156px] snap-start"
                >
                  <Link
                    href={`/produit/${p.id}`}
                    className="block bg-white dark:bg-gray-900 rounded-[20px] border border-black/5 dark:border-white/5 overflow-hidden shadow-sm active:scale-[0.98] transition-transform no-underline"
                  >
                    <div className="relative aspect-square bg-gray-100 dark:bg-gray-800">
                      {p.image ? (
                        <img src={p.image} alt={p.nom} className="w-full h-full object-cover" loading="lazy" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Pill size={28} className="text-gray-300 dark:text-gray-600" />
                        </div>
                      )}
                      <span
                        className={`absolute top-2 right-2 w-2.5 h-2.5 rounded-full border-2 border-white dark:border-gray-900 shadow-sm ${
                          p.quantite > 0 ? "bg-emerald-500" : "bg-red-500"
                        }`}
                      />
                    </div>
                    <div className="p-3">
                      <p className="text-[13px] font-semibold text-gray-900 dark:text-gray-100 line-clamp-2 leading-snug min-h-[2.4em]">
                        {p.nom}
                      </p>
                      <p className="text-[11px] text-gray-400 mt-0.5 truncate">
                        {p.categorie_display || p.laboratoire}
                      </p>
                      <Prix montant={p.prix} className="mt-1.5 text-sm font-bold text-gray-900 dark:text-gray-100" />
                    </div>
                  </Link>
                </motion.div>
              ))}
            </div>
          </motion.section>
        )}
      </div>

      {/* ═══ CTA FIXE EN BAS ═══ */}
      {!isStaff && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: EASE, delay: 0.3 }}
          className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-[#050e0c]/95 backdrop-blur-xl border-t border-black/5 dark:border-white/5 px-4 pt-3"
          style={{ paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom))" }}
        >
          <div className="max-w-md mx-auto flex items-center gap-3">
            {/* Quantité compacte (optionnel, si tu préfères la laisser ici plutôt qu'en haut) */}
            {/* Pour l'instant on garde juste le CTA pleine largeur */}
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={handleAddToCart}
              disabled={enRupture || ajoutEnCours}
              className="flex-1 h-[52px] rounded-2xl bg-emerald-600 text-white font-bold text-sm flex items-center justify-center gap-2 border-none active:bg-emerald-700 transition-colors disabled:opacity-30 disabled:grayscale shadow-sm shadow-emerald-900/10"
            >
              {ajoutEnCours ? (
                <Loader2 size={18} className="animate-spin" />
              ) : (
                <>
                  <ShoppingCart size={18} />
                  {enRupture ? "Rupture de stock" : `Ajouter · ${quantite} au panier`}
                </>
              )}
            </motion.button>
          </div>
        </motion.div>
      )}

      <ToastContainer toasts={toasts} />
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   BLOC ADMIN — INCHANGÉ (juste intégration visuelle)
   ═══════════════════════════════════════════════════════════════ */
function BlocAdmin({ produit }: { produit: ProduitDetail }) {
  const [historiqueOuvert, setHistoriqueOuvert] = useState(false);
  return (
    <div className="p-4 rounded-2xl bg-gray-50 dark:bg-white/[0.03] ring-1 ring-black/5 dark:ring-white/5">
      <div className="flex items-center gap-2 mb-3">
        <ShieldAlert size={14} className="text-gray-400" />
        <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wide">Administration</p>
      </div>
      <div className="space-y-2.5">
        <DetailRow label="Référence" value={produit.identifiant} />
        {produit.prix_achat != null && <DetailRow label="Prix d'achat" value={<Prix montant={produit.prix_achat} />} />}
        <DetailRow label="Seuil d'alerte" value={`${produit.seuil_alerte} unités`} />
        {produit.date_expiration && (
          <DetailRow label="Péremption" value={new Date(produit.date_expiration).toLocaleDateString("fr-FR")} />
        )}
      </div>
      <button
        onClick={() => setHistoriqueOuvert((v) => !v)}
        className="mt-3 text-xs font-semibold text-emerald-600 dark:text-emerald-400 bg-transparent border-none cursor-pointer p-0"
      >
        {historiqueOuvert ? "Masquer l'historique" : "Voir l'historique"}
      </button>
      {historiqueOuvert && (
        <div className="mt-3">
          <HistoriqueMouvements produitId={produit.id} />
        </div>
      )}
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-black/5 dark:border-white/5 last:border-none">
      <span className="text-[13px] text-gray-400">{label}</span>
      <span className="text-[13px] font-semibold text-gray-700 dark:text-gray-200">{value}</span>
    </div>
  );
}

interface Mouvement {
  id: number;
  type: "entree" | "sortie";
  quantite: number;
  date: string;
  auteur_nom: string;
  note: string | null;
}

function HistoriqueMouvements({ produitId }: { produitId: number }) {
  const [mouvements, setMouvements] = useState<Mouvement[] | null>(null);
  const [erreur, setErreur] = useState(false);

  useEffect(() => {
    let annule = false;
    apiClient
      .get(`/api/produits/${produitId}/historique/`)
      .then((res) => { if (!annule) setMouvements(res.data); })
      .catch(() => { if (!annule) setErreur(true); });
    return () => { annule = true; };
  }, [produitId]);

  if (erreur) return <p className="text-sm text-gray-400 text-center py-6">Historique indisponible.</p>;
  if (mouvements === null) return <div className="flex justify-center py-8"><Loader2 size={20} className="animate-spin text-emerald-500" /></div>;
  if (mouvements.length === 0) return <p className="text-sm text-gray-400 text-center py-6">Aucun mouvement enregistré.</p>;

  return (
    <div className="space-y-1">
      {mouvements.map((m) => {
        const Icon = m.type === "entree" ? ArrowDownCircle : ArrowUpCircle;
        return (
          <div key={m.id} className="flex items-center gap-3 py-2.5 border-b border-black/5 dark:border-white/5 last:border-none">
            <Icon size={18} className={m.type === "entree" ? "text-emerald-500 shrink-0" : "text-amber-500 shrink-0"} />
            <div className="min-w-0 flex-grow">
              <p className="text-[13px] font-semibold text-gray-700 dark:text-gray-200">
                {m.type === "entree" ? "Entrée" : "Sortie"} de {m.quantite} unité{m.quantite > 1 ? "s" : ""}
              </p>
              <p className="text-[11px] text-gray-400 truncate">
                {new Date(m.date).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" })} · {m.auteur_nom}
                {m.note ? ` · ${m.note}` : ""}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}