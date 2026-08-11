"use client";
import React, { useState, useEffect, type ReactNode } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowLeft, Heart, Share2, Pill, ShoppingCart, Plus, Minus, Loader2,
  ShieldAlert, Package, ArrowDownCircle, ArrowUpCircle, ChevronRight,
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

interface ProduitSimilaire {
  id: number;
  nom: string;
  prix: number;
  laboratoire: string;
  categorie_display?: string;
  image?: string | null;
  quantite: number;
}

/**
 * 🆕 ÉCRAN DÉTAIL PRODUIT (31/07) -- reconstruit pour suivre fidèlement une référence
 * e-commerce fournie (photo pleine largeur, nom, marque, badges, prix, sélecteur de
 * quantité, CTA panier pleine largeur, section "produits similaires"). Deux écarts
 * assumés par rapport à la référence :
 * 1. Une seule photo (pas de carrousel) -- Produit.image est un champ unique côté
 *    modèle, aucune galerie n'existe.
 * 2. Pas de note en étoiles -- aucun système d'avis/notation n'existe en base (vérifié :
 *    seul Favori existe, pas de modèle Avis/Note). Afficher des étoiles fixes ou
 *    inventées aurait été une fausse donnée ; remplacé par le badge de stock réel, au
 *    même endroit visuel.
 * Favoris et partage sont RÉELS (pas des boutons qui ont l'air interactifs mais ne font
 * rien) : favoris via l'API déjà existante (Favori, core/models.py), partage via l'API
 * native du navigateur (déclenche le vrai partage système sur mobile).
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
  const [isStaff, setIsStaff] = useState(false);
  const [quantite, setQuantite] = useState(1);
  const [ajoutEnCours, setAjoutEnCours] = useState(false);
  const [estFavori, setEstFavori] = useState(false);
  const [favoriEnCours, setFavoriEnCours] = useState(false);
  const [similaires, setSimilaires] = useState<ProduitSimilaire[] | null>(null);

  useEffect(() => {
    const role = typeof window !== "undefined" ? localStorage.getItem("user_role") : null;
    setIsAdmin(role === "admin");
    setIsStaff(role === "admin" || role === "caissiere");
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

  // 🩷 État "favori" -- réutilise GET /api/favoris/ (liste déjà existante) plutôt que
  // d'ajouter un champ est_favori à l'endpoint détail : ce dernier est mis en cache
  // côté backend (cache_set, 60s) et partagé entre TOUS les clients -- y embarquer une
  // donnée propre à l'utilisateur connecté y aurait mélangé les favoris d'un client avec
  // ceux d'un autre. Un appel séparé, jamais mis en cache, reste correct.
  useEffect(() => {
    if (isStaff || !produitId) return; // le personnel n'a pas de favoris
    apiClient
      .get("/api/favoris/")
      .then((res) => {
        const favoris = res.data as { produit: { id: number } }[];
        setEstFavori(favoris.some((f) => f.produit.id === Number(produitId)));
      })
      .catch(() => {}); // pas grave si ça échoue (ex: visiteur non connecté) -- reste "non favori"
  }, [produitId, isStaff]);

  const toggleFavori = async () => {
    if (!produit || favoriEnCours) return;
    setFavoriEnCours(true);
    const etatPrecedent = estFavori;
    setEstFavori(!etatPrecedent); // optimiste : réactif au doigt, corrigé si l'appel échoue
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

  // 📤 Partage RÉEL : déclenche la feuille de partage native (mobile), ou copie le lien
  // en repli (desktop, navigateurs sans navigator.share) -- jamais un bouton qui ne fait
  // rien au clic.
  const partager = async () => {
    if (!produit) return;
    const url = typeof window !== "undefined" ? window.location.href : "";
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title: produit.nom, text: `${produit.nom} — ${produit.laboratoire || "Pharmacie+"}`, url });
      } catch {
        // AbortError si l'utilisateur ferme la feuille de partage -- pas une vraie erreur
      }
    } else if (typeof navigator !== "undefined" && navigator.clipboard) {
      await navigator.clipboard.writeText(url);
      showToast("Lien copié dans le presse-papiers", "success");
    }
  };

  // Produits similaires -- même catégorie, produit courant exclu. Chargé une fois le
  // produit connu (a besoin de sa catégorie), silencieusement (section simplement
  // masquée en cas d'échec, pas de toast pour une info secondaire).
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

  return (
    <div className={`max-w-md md:max-w-2xl mx-auto min-h-screen ${!isStaff ? "pb-32" : "pb-10"}`}>
      {/* 🔝 En-tête : retour à gauche, favori + partage à droite (RÉELS, cf. docstring) */}
      <div className="sticky top-0 z-30 flex items-center justify-between px-4 py-3 bg-white/80 dark:bg-[#050e0c]/80 backdrop-blur-md">
        <button
          onClick={() => router.back()}
          aria-label="Retour"
          className="h-11 w-11 flex items-center justify-center rounded-full bg-slate-100 dark:bg-white/[0.06] text-slate-700 dark:text-slate-200 border-none cursor-pointer active:scale-90 transition-transform"
        >
          <ArrowLeft size={20} />
        </button>
        <div className="flex items-center gap-2">
          {!isStaff && (
            <button
              onClick={toggleFavori}
              aria-label={estFavori ? "Retirer des favoris" : "Ajouter aux favoris"}
              aria-pressed={estFavori}
              className="h-11 w-11 flex items-center justify-center rounded-full bg-slate-100 dark:bg-white/[0.06] border-none cursor-pointer active:scale-90 transition-transform"
            >
              <Heart size={19} className={estFavori ? "fill-red-500 text-red-500" : "text-slate-700 dark:text-slate-200"} />
            </button>
          )}
          <button
            onClick={partager}
            aria-label="Partager ce produit"
            className="h-11 w-11 flex items-center justify-center rounded-full bg-slate-100 dark:bg-white/[0.06] text-slate-700 dark:text-slate-200 border-none cursor-pointer active:scale-90 transition-transform"
          >
            <Share2 size={18} />
          </button>
        </div>
      </div>

      <div className="px-4">
        {/* 🖼️ Photo unique (pas de carrousel, cf. docstring) */}
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

        {/* Nom */}
        <h1 className="font-display text-xl font-bold text-slate-800 dark:text-white leading-snug">
          {produit.nom}
        </h1>

        {/* Marque (laboratoire) + badge de stock à la place d'une note en étoiles
            (inexistante, cf. docstring) */}
        <div className="flex items-center justify-between mt-1.5">
          <span className="text-sm text-emerald-600 dark:text-emerald-400 font-medium">
            {produit.laboratoire || "Générique"}
          </span>
          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${enRupture ? "bg-red-50 text-red-500 dark:bg-red-900/20" : "bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30"}`}>
            {enRupture ? "Rupture de stock" : `En stock · ${produit.quantite}`}
          </span>
        </div>

        {produit.ordonnance_obligatoire && (
          <div className="flex items-center gap-1.5 mt-3 text-xs font-semibold px-3 py-1.5 rounded-full bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400 w-fit">
            <ShieldAlert size={13} /> Ordonnance requise
          </div>
        )}

        {/* Prix */}
        <div className="flex items-baseline gap-1.5 mt-4">
          <Prix montant={produit.prix} className="font-display text-2xl font-bold text-slate-800 dark:text-white" />
          <span className="text-sm text-slate-400">/ unité</span>
        </div>

        {/* Catégorie -- lien réel vers le catalogue filtré, pas un texte statique */}
        {produit.categorie_display && (
          <Link
            href={`/catalogue?cat=${encodeURIComponent(produit.categorie)}`}
            className="inline-flex items-center gap-1 mt-2 text-xs font-medium text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 no-underline transition-colors"
          >
            {produit.categorie_display} <ChevronRight size={13} />
          </Link>
        )}

        {/* Sélecteur de quantité -- visible seulement pour un client (le personnel n'a pas
            de panier) */}
        {!isStaff && (
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-white/[0.06] rounded-2xl p-1 w-fit mt-5">
            <button
              onClick={() => modifierQuantite(-1)}
              disabled={quantite <= 1}
              aria-label="Diminuer la quantité"
              className="h-11 w-11 flex items-center justify-center rounded-xl bg-white dark:bg-white/[0.08] text-slate-600 dark:text-slate-300 border-none cursor-pointer active:scale-90 transition-transform disabled:opacity-30"
            >
              <Minus size={16} />
            </button>
            <span className="w-10 text-center font-display text-sm font-bold text-slate-800 dark:text-white">{quantite}</span>
            <button
              onClick={() => modifierQuantite(1)}
              disabled={quantite >= produit.quantite}
              aria-label="Augmenter la quantité"
              className="h-11 w-11 flex items-center justify-center rounded-xl bg-white dark:bg-white/[0.08] text-slate-600 dark:text-slate-300 border-none cursor-pointer active:scale-90 transition-transform disabled:opacity-30"
            >
              <Plus size={16} />
            </button>
          </div>
        )}

        {/* Description */}
        <div className="mt-6">
          <h2 className="font-display text-sm font-bold text-slate-800 dark:text-white mb-2">Description</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
            {produit.description || "Aucune information complémentaire renseignée pour ce produit."}
          </p>
        </div>

        {/* Bloc admin -- retiré de l'ancien système d'onglets, condensé ici : reste utile
            (stock/prix d'achat/référence/historique) sans reproduire la mise en page de la
            référence e-commerce, pensée pour un client, pas pour la gestion interne. */}
        {isAdmin && <BlocAdmin produit={produit} />}

        {/* Produits similaires */}
        {similaires && similaires.length > 0 && (
          <div className="mt-8">
            <h2 className="font-display text-sm font-bold text-slate-800 dark:text-white mb-3">Produits similaires</h2>
            <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4 snap-x snap-mandatory scrollbar-hide">
              {similaires.map((p) => (
                <Link
                  key={p.id}
                  href={`/produit/${p.id}`}
                  className="shrink-0 w-36 snap-start no-underline bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 overflow-hidden active:scale-95 transition-transform"
                >
                  <div className="w-full aspect-square bg-emerald-50 dark:bg-emerald-500/10 flex items-center justify-center overflow-hidden">
                    {p.image ? (
                      <img src={p.image} alt={p.nom} className="w-full h-full object-cover" />
                    ) : (
                      <Pill size={28} className="text-emerald-300 dark:text-emerald-700" />
                    )}
                  </div>
                  <div className="p-2.5">
                    <p className="text-xs font-semibold text-slate-800 dark:text-white truncate">{p.nom}</p>
                    <p className="text-[10px] text-slate-400 truncate mb-1">{p.categorie_display || p.laboratoire}</p>
                    <Prix montant={p.prix} className="text-xs font-bold text-emerald-600 dark:text-emerald-400" />
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 🧾 Barre d'action fixe -- masquée pour le personnel (pas de panier) */}
      {!isStaff && (
        <div
          className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-[#050e0c]/95 backdrop-blur-md border-t border-slate-100 dark:border-white/10 px-4 pt-3"
          style={{ paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom))" }}
        >
          <div className="max-w-md md:max-w-2xl mx-auto">
            <button
              onClick={handleAddToCart}
              disabled={enRupture || ajoutEnCours}
              className="w-full h-[52px] rounded-2xl bg-emerald-500 text-white font-display font-semibold text-sm flex items-center justify-center gap-2 border-none cursor-pointer active:scale-[0.98] transition-transform disabled:opacity-30 disabled:grayscale"
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
      )}

      <ToastContainer toasts={toasts} />
    </div>
  );
}

// 🧩 Bloc d'informations réservé au personnel admin (stock, achat, référence, historique) --
// remplace l'ancien système d'onglets, condensé pour ne pas alourdir la fiche client.
function BlocAdmin({ produit }: { produit: ProduitDetail }) {
  const [historiqueOuvert, setHistoriqueOuvert] = useState(false);
  return (
    <div className="mt-6 p-4 rounded-2xl bg-slate-50 dark:bg-white/[0.04] border border-slate-100 dark:border-white/10">
      <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wide mb-3">Informations internes</p>
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
        {historiqueOuvert ? "Masquer l'historique des mouvements" : "Voir l'historique des mouvements"}
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
    <div className="flex items-center justify-between py-1.5 border-b border-slate-100 dark:border-white/[0.06] last:border-none">
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

// 🆕 Onglet "Historique" (désormais repliable, cf. BlocAdmin) -- fetch PARESSEUX : n'appelle
// le backend que si l'admin ouvre réellement ce panneau, pas au chargement de la page.
// Résultat déjà mis en cache 30s côté backend (voir api_produit_historique) en plus de ça.
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
