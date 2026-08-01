"use client";
import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  ArrowLeft, Pill, ShoppingCart, Plus, Minus, Loader2,
  ShieldAlert, Package, Tag, Layers, Wallet, Boxes,
} from "lucide-react";

import apiClient from "../../../lib/apiClient";
import Prix from "../../../lib/components/Prix";
import { useToast, ToastContainer } from "../../../lib/hooks/useToast";
import { ajouterAuPanierHorsLigne } from "../../../lib/offline/panierQueue";

interface ProduitDetail {
  id: number;
  identifiant: string;
  nom: string;
  prix: number;
  prix_achat?: number | null; // 🔐 présent seulement si l'appelant est admin (voir serializers.py)
  categorie: string;
  quantite: number;
  seuil_alerte: number;
  laboratoire: string;
  description: string;
  ordonnance_obligatoire: boolean;
  date_expiration?: string | null;
  statut_stock_label: string;
  image?: string | null;
}

/**
 * 🆕 ÉCRAN DÉTAIL PRODUIT (refonte UI/UX, 30/07) -- n'existait pas du tout jusqu'ici,
 * cf. docs/UIUX_REFONTE_GUIDE.md. Reproduit le niveau de référence établi par
 * app/catalogue/page.tsx : toast partagé, cibles tactiles 44px, retour tactile
 * (active:scale), bottom sheet plutôt que popup centrée, mobile-first strict.
 *
 * Accessible par URL directe (pas seulement depuis le catalogue) -- d'où le fetch
 * autonome via /api/produits/<id>/ (nouvel endpoint, voir core/api.py::api_produit_detail)
 * plutôt que de dépendre de données déjà en mémoire côté catalogue.
 */
export default function ProduitDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { toasts, showToast } = useToast();

  const produitId = params?.id as string;

  const [produit, setProduit] = useState<ProduitDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [quantite, setQuantite] = useState(1);
  const [ajoutEnCours, setAjoutEnCours] = useState(false);

  useEffect(() => {
    setIsAdmin(typeof window !== "undefined" && localStorage.getItem("user_role") === "admin");
  }, []);

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

  const modifierQuantite = (delta: number) => {
    if (!produit) return;
    setQuantite((q) => Math.max(1, Math.min(produit.quantite, q + delta)));
  };

  // Même logique que app/catalogue/page.tsx::handleAddToCart (mode hors-ligne inclus) --
  // dupliquée ici plutôt que partagée pour l'instant, le catalogue ayant sa propre liste
  // de produits en mémoire alors que cette page part d'un fetch unique. À factoriser si un
  // 3e écran a besoin de la même logique.
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

  if (loading) {
    return (
      <div className="h-screen flex flex-col items-center justify-center gap-3">
        <Loader2 className="animate-spin text-emerald-500" size={40} />
        <p className="font-display text-sm font-medium text-slate-400">Chargement du produit…</p>
      </div>
    );
  }

  if (notFound || !produit) {
    return (
      <div className="h-screen flex flex-col items-center justify-center gap-4 px-6 text-center">
        <Package size={40} className="text-slate-300 dark:text-slate-700" />
        <p className="font-display text-base font-bold text-slate-700 dark:text-slate-200">Produit introuvable</p>
        <p className="text-sm text-slate-400 max-w-xs">
          Ce produit n'existe plus ou a été retiré du catalogue par la pharmacie.
        </p>
        <button
          onClick={() => router.push("/catalogue")}
          className="mt-2 h-11 px-6 rounded-2xl bg-emerald-500 text-white font-semibold text-sm border-none cursor-pointer active:scale-95 transition-transform"
        >
          Retour au catalogue
        </button>
      </div>
    );
  }

  const enRupture = produit.quantite <= 0;
  const stockFaible = !enRupture && produit.quantite <= produit.seuil_alerte;

  return (
    <div className="max-w-md md:max-w-2xl mx-auto min-h-screen pb-32">
      {/* 🔝 En-tête : flèche retour seule -- pas de bouton favori/partage qui ne ferait
          rien (aucun backend derrière), cf. règle "aucun bouton qui a l'air interactif
          mais ne fait rien". */}
      <div className="sticky top-0 z-30 flex items-center px-4 py-3 bg-white/80 dark:bg-slate-950/80 backdrop-blur-md">
        <button
          onClick={() => router.back()}
          aria-label="Retour"
          className="h-11 w-11 flex items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-none cursor-pointer active:scale-90 transition-transform"
        >
          <ArrowLeft size={20} />
        </button>
        <h1 className="flex-grow text-center font-display text-sm font-bold text-slate-800 dark:text-white truncate px-3">
          Détail du produit
        </h1>
        <div className="h-11 w-11" /> {/* espaceur : garde le titre centré */}
      </div>

      <div className="px-4">
        {/* 🖼️ Image produit */}
        <motion.div
          initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
          className="w-full aspect-square bg-emerald-50 dark:bg-slate-900 rounded-[28px] flex items-center justify-center overflow-hidden mb-5"
        >
          {produit.image ? (
            <img src={produit.image} alt={produit.nom} className="w-full h-full object-cover" />
          ) : (
            <Pill size={64} className="text-emerald-300 dark:text-emerald-700" />
          )}
        </motion.div>

        {/* 🏷️ Nom, laboratoire, badge stock */}
        <div className="flex items-start justify-between gap-3 mb-1">
          <h2 className="font-display text-xl font-bold text-slate-800 dark:text-white leading-tight">{produit.nom}</h2>
          <span
            className={`shrink-0 text-[10px] font-semibold px-2.5 py-1 rounded-full ${
              enRupture
                ? "bg-red-50 text-red-500 dark:bg-red-900/20"
                : stockFaible
                ? "bg-amber-50 text-amber-600 dark:bg-amber-900/20"
                : "bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30"
            }`}
          >
            {enRupture ? "Rupture" : stockFaible ? "Stock faible" : "En stock"}
          </span>
        </div>
        <p className="text-sm text-slate-400 mb-3">
          {produit.laboratoire || "Générique"}
        </p>

        {produit.ordonnance_obligatoire && (
          <div className="flex items-center gap-2 mb-4 px-3 py-2 rounded-2xl bg-amber-50 dark:bg-amber-950/20 text-amber-700 dark:text-amber-400">
            <ShieldAlert size={16} className="shrink-0" />
            <p className="text-xs font-medium">Ordonnance médicale requise pour ce produit</p>
          </div>
        )}

        <Prix montant={produit.prix} className="font-display text-2xl font-bold text-emerald-600 dark:text-emerald-400 block mb-5" />

        {/* 📄 Description */}
        {produit.description && (
          <div className="mb-5">
            <h3 className="font-display text-sm font-bold text-slate-800 dark:text-white mb-2">Informations</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">{produit.description}</p>
          </div>
        )}

        {/* 🔐 Bloc réservé à l'admin -- prix d'achat (marge), stock exact, péremption.
            `produit.prix_achat` n'existe dans la réponse QUE si le serializer a jugé
            l'appelant admin (voir core/serializers.py) ; `isAdmin` (déclaratif, basé sur
            le rôle stocké en local) sert seulement à décider d'afficher ce bloc, la vraie
            barrière de sécurité reste côté backend. */}
        {isAdmin && (
          <div className="mb-6 p-4 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800">
            <h3 className="font-display text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-3">
              Informations de gestion
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-start gap-2">
                <Boxes size={16} className="text-slate-400 mt-0.5 shrink-0" />
                <div>
                  <p className="text-[10px] text-slate-400">Stock actuel</p>
                  <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">{produit.quantite} unités</p>
                </div>
              </div>
              {produit.prix_achat != null && (
                <div className="flex items-start gap-2">
                  <Wallet size={16} className="text-slate-400 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-[10px] text-slate-400">Prix d'achat</p>
                    <Prix montant={produit.prix_achat} className="text-sm font-semibold text-slate-700 dark:text-slate-200" />
                  </div>
                </div>
              )}
              <div className="flex items-start gap-2">
                <Tag size={16} className="text-slate-400 mt-0.5 shrink-0" />
                <div>
                  <p className="text-[10px] text-slate-400">Référence</p>
                  <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">{produit.identifiant}</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <Layers size={16} className="text-slate-400 mt-0.5 shrink-0" />
                <div>
                  <p className="text-[10px] text-slate-400">Seuil d'alerte</p>
                  <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">{produit.seuil_alerte} unités</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 🧾 Barre d'action fixe en bas -- zone accessible au pouce, cohérent avec la
          bottom nav déjà en place ailleurs dans l'app. */}
      <div
        className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-slate-950/95 backdrop-blur-md border-t border-slate-100 dark:border-slate-800 px-4 pt-3"
        style={{ paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom))" }}
      >
        <div className="max-w-md md:max-w-2xl mx-auto flex items-center gap-3">
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 rounded-2xl p-1">
            <button
              onClick={() => modifierQuantite(-1)}
              disabled={quantite <= 1}
              aria-label="Diminuer la quantité"
              className="h-11 w-11 flex items-center justify-center rounded-xl bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-none cursor-pointer active:scale-90 transition-transform disabled:opacity-30"
            >
              <Minus size={16} />
            </button>
            <span className="w-9 text-center font-display text-sm font-bold text-slate-800 dark:text-white">{quantite}</span>
            <button
              onClick={() => modifierQuantite(1)}
              disabled={quantite >= produit.quantite}
              aria-label="Augmenter la quantité"
              className="h-11 w-11 flex items-center justify-center rounded-xl bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-none cursor-pointer active:scale-90 transition-transform disabled:opacity-30"
            >
              <Plus size={16} />
            </button>
          </div>

          <button
            onClick={handleAddToCart}
            disabled={enRupture || ajoutEnCours}
            className="flex-grow h-[52px] rounded-2xl bg-emerald-500 text-white font-display font-semibold text-sm flex items-center justify-center gap-2 border-none cursor-pointer active:scale-[0.98] transition-transform disabled:opacity-30 disabled:grayscale"
          >
            {ajoutEnCours ? (
              <Loader2 size={18} className="animate-spin" />
            ) : (
              <>
                <ShoppingCart size={18} />
                {enRupture ? "Rupture de stock" : "Ajouter au panier"}
              </>
            )}
          </button>
        </div>
      </div>

      <ToastContainer toasts={toasts} />
    </div>
  );
}
