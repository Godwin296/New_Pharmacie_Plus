"use client";
import React, { useState, useEffect, type ReactNode } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  ArrowLeft, Pill, ShoppingCart, Plus, Minus, Loader2,
  ShieldAlert, Package, Tag, Wallet, Boxes, ArrowDownCircle, ArrowUpCircle,
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
  const [onglet, setOnglet] = useState<"informations" | "details" | "historique">("informations");

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
      <div className="sticky top-0 z-30 flex items-center px-4 py-3 bg-white/80 dark:bg-[#050e0c]/80 backdrop-blur-md">
        <button
          onClick={() => router.back()}
          aria-label="Retour"
          className="h-11 w-11 flex items-center justify-center rounded-full bg-slate-100 dark:bg-white/[0.06] text-slate-700 dark:text-slate-200 border-none cursor-pointer active:scale-90 transition-transform"
        >
          <ArrowLeft size={20} />
        </button>
        <h1 className="flex-grow text-center font-display text-sm font-bold text-slate-800 dark:text-white truncate px-3">
          {produit.nom}
        </h1>
        <div className="h-11 w-11" /> {/* espaceur : garde le titre centré */}
      </div>

      <div className="px-4">
        {/* 🖼️ Image produit */}
        <motion.div
          initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
          className="w-full aspect-square bg-emerald-50 dark:bg-emerald-500/10 rounded-[28px] flex items-center justify-center overflow-hidden mb-5"
        >
          {produit.image ? (
            <img src={produit.image} alt={produit.nom} className="w-full h-full object-cover" />
          ) : (
            <Pill size={64} className="text-emerald-300 dark:text-emerald-700" />
          )}
        </motion.div>

        {/* 🏷️ Catégorie -- jamais affichée à l'utilisateur jusqu'ici (seul le laboratoire
            l'était), alors que c'est l'information la plus rapide pour confirmer qu'on
            regarde le bon type de produit avant même de lire le nom. */}
        {produit.categorie_display && (
          <span className="inline-block mb-2.5 text-[11px] font-semibold px-2.5 py-1 rounded-full bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400">
            {produit.categorie_display}
          </span>
        )}

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
        {produit.laboratoire && (
          <p className="text-sm text-slate-400 mb-3">{produit.laboratoire}</p>
        )}

        {produit.ordonnance_obligatoire && (
          <div className="flex items-center gap-2 mb-4 px-3 py-2 rounded-2xl bg-amber-50 dark:bg-amber-950/20 text-amber-700 dark:text-amber-400">
            <ShieldAlert size={16} className="shrink-0" />
            <p className="text-xs font-medium">Ordonnance médicale requise pour ce produit</p>
          </div>
        )}

        <Prix montant={produit.prix} className="font-display text-2xl font-bold text-emerald-600 dark:text-emerald-400 block mb-5" />

        {/* 📊 GRILLE DE STATS -- fidèle à la maquette (Stock actuel / Prix d'achat /
            Prix de vente / Catégorie). Pour un client, "Prix d'achat" n'existe pas dans la
            réponse (retiré côté serializer, cf. `prix_achat?`) donc la grille passe
            naturellement à 2 cellules au lieu de forcer un "--" vide -- et "Prix de vente"
            n'a pas d'intérêt à être répété ici pour un client puisqu'il est déjà affiché en
            grand juste au-dessus ; pour un admin en revanche, l'avoir côte à côte avec le
            prix d'achat permet de visualiser la marge d'un coup d'œil, d'où sa présence
            uniquement dans ce cas. */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          <StatCell icon={Boxes} label="Stock actuel" value={`${produit.quantite} unités`} />
          {isAdmin && produit.prix_achat != null && (
            <StatCell icon={Wallet} label="Prix d'achat" value={<Prix montant={produit.prix_achat} />} />
          )}
          {isAdmin && (
            <StatCell icon={Tag} label="Prix de vente" value={<Prix montant={produit.prix} />} />
          )}
          <StatCell icon={Package} label="Catégorie" value={produit.categorie_display || "—"} />
        </div>

        {/* 📑 ONGLETS -- Informations / Détails / (Historique, admin uniquement) */}
        <div className="flex gap-5 border-b border-slate-100 dark:border-white/10 mb-4">
          {(["informations", "details", ...(isAdmin ? ["historique"] as const : [])] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setOnglet(tab)}
              className={`relative pb-3 text-[13px] font-semibold border-none bg-transparent cursor-pointer transition-colors ${
                onglet === tab ? "text-emerald-600 dark:text-emerald-400" : "text-slate-400"
              }`}
            >
              {tab === "informations" ? "Informations" : tab === "details" ? "Détails" : "Historique"}
              {onglet === tab && (
                <motion.div layoutId="onglet-actif" className="absolute -bottom-px left-0 right-0 h-[2px] bg-emerald-500 rounded-full" />
              )}
            </button>
          ))}
        </div>

        <div className="mb-8 min-h-[80px]">
          {onglet === "informations" && (
            <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
              {produit.description || "Aucune information complémentaire renseignée pour ce produit."}
            </p>
          )}

          {onglet === "details" && (
            <div className="space-y-3">
              <DetailRow label="Laboratoire" value={produit.laboratoire || "Générique"} />
              <DetailRow label="Référence" value={produit.identifiant} />
              {isAdmin && <DetailRow label="Seuil d'alerte" value={`${produit.seuil_alerte} unités`} />}
              {isAdmin && produit.date_expiration && (
                <DetailRow label="Péremption" value={new Date(produit.date_expiration).toLocaleDateString("fr-FR")} />
              )}
            </div>
          )}

          {onglet === "historique" && isAdmin && (
            <HistoriqueMouvements produitId={produit.id} />
          )}
        </div>
      </div>

      {/* 🧾 Barre d'action fixe en bas -- zone accessible au pouce, cohérent avec la
          bottom nav déjà en place ailleurs dans l'app. */}
      <div
        className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-[#050e0c]/95 backdrop-blur-md border-t border-slate-100 dark:border-white/10 px-4 pt-3"
        style={{ paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom))" }}
      >
        <div className="max-w-md md:max-w-2xl mx-auto flex items-center gap-3">
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-white/[0.06] rounded-2xl p-1">
            <button
              onClick={() => modifierQuantite(-1)}
              disabled={quantite <= 1}
              aria-label="Diminuer la quantité"
              className="h-11 w-11 flex items-center justify-center rounded-xl bg-white dark:bg-white/[0.08] text-slate-600 dark:text-slate-300 border-none cursor-pointer active:scale-90 transition-transform disabled:opacity-30"
            >
              <Minus size={16} />
            </button>
            <span className="w-9 text-center font-display text-sm font-bold text-slate-800 dark:text-white">{quantite}</span>
            <button
              onClick={() => modifierQuantite(1)}
              disabled={quantite >= produit.quantite}
              aria-label="Augmenter la quantité"
              className="h-11 w-11 flex items-center justify-center rounded-xl bg-white dark:bg-white/[0.08] text-slate-600 dark:text-slate-300 border-none cursor-pointer active:scale-90 transition-transform disabled:opacity-30"
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

// 🧩 Cellule de la grille de stats (Stock actuel / Prix d'achat / Prix de vente / Catégorie)
function StatCell({ icon: Icon, label, value }: { icon: any; label: string; value: ReactNode }) {
  return (
    <div className="flex items-start gap-2.5 p-3.5 rounded-2xl bg-slate-50 dark:bg-white/[0.04] border border-slate-100 dark:border-white/10">
      <Icon size={16} className="text-emerald-500 mt-0.5 shrink-0" />
      <div className="min-w-0">
        <p className="text-[10px] text-slate-400">{label}</p>
        <p className="text-sm font-semibold text-slate-700 dark:text-slate-200 truncate">{value}</p>
      </div>
    </div>
  );
}

// 🧩 Ligne simple de l'onglet "Détails"
function DetailRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-slate-50 dark:border-white/[0.06] last:border-none">
      <span className="text-[13px] text-slate-400">{label}</span>
      <span className="text-[13px] font-semibold text-slate-700 dark:text-slate-200">{value}</span>
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

// 🆕 (30/07) Onglet "Historique" -- fetch PARESSEUX : n'appelle le backend que si l'admin
// ouvre réellement cet onglet (pas au chargement de la page), cohérent avec l'objectif de
// ne pas taper la base pour rien à chaque action. Résultat déjà mis en cache 30s côté
// backend (voir api_produit_historique) en plus de ça.
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

  if (erreur) {
    return <p className="text-sm text-slate-400 text-center py-6">Historique indisponible pour le moment.</p>;
  }
  if (mouvements === null) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 size={20} className="animate-spin text-emerald-500" />
      </div>
    );
  }
  if (mouvements.length === 0) {
    return <p className="text-sm text-slate-400 text-center py-6">Aucun mouvement enregistré pour ce produit.</p>;
  }

  return (
    <div className="space-y-1">
      {mouvements.map((m) => {
        const Icon = m.type === "entree" ? ArrowDownCircle : ArrowUpCircle;
        return (
          <div key={m.id} className="flex items-center gap-3 py-2.5 border-b border-slate-50 dark:border-white/[0.06] last:border-none">
            <Icon size={18} className={m.type === "entree" ? "text-emerald-500 shrink-0" : "text-amber-500 shrink-0"} />
            <div className="min-w-0 flex-grow">
              <p className="text-[13px] font-semibold text-slate-700 dark:text-slate-200">
                {m.type === "entree" ? "Entrée" : "Sortie"} de {m.quantite} unité{m.quantite > 1 ? "s" : ""}
              </p>
              <p className="text-[11px] text-slate-400 truncate">
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
