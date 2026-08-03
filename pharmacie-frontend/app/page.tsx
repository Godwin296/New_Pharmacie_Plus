"use client";
import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LogIn, UserPlus, ShieldCheck, Pill, ShoppingCart, ClipboardList,
  MapPin, Phone, PackageCheck, Loader2, ArrowRight, Search, Mic,
  ScanLine, Heart, ChevronRight,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import apiClient from '../lib/apiClient';
import { useConfigPharmacie } from '../lib/context/ConfigPharmacieContext';
import Prix from '../lib/components/Prix';
import { useToast, ToastContainer } from '../lib/hooks/useToast';
import { iconePourCategorie, CATEGORIES_ACCUEIL } from '../lib/categorieIcons';

// 🎨 REFONTE (30/07, v4) : v3 avait déjà réglé la rupture visuelle (thème clair) et
// affichait déjà de l'info propre au tenant (adresse/téléphone, dernière commande réelle).
// v4 ajoute ce qui manquait pour se rapprocher de la référence fournie (appli de livraison
// de médicaments) : recherche (+ vocale, best-effort), catégories en icônes (en attendant
// de vraies photos), favoris (nouveau modèle Favori créé pour l'occasion, cf. backend), et
// une section "Produits populaires" -- volontairement PAS appelée "Recommandé pour vous" :
// il n'y a aucune personnalisation réelle derrière (pas d'historique d'achat croisé, pas de
// ML), l'étiqueter comme tel aurait été trompeur. Les favoris, eux, sont une vraie donnée
// personnelle, donc peuvent légitimement porter un intitulé personnel.

const STATUT_INFO: Record<string, { label: string; couleur: string }> = {
  en_cours: { label: 'Panier en cours', couleur: 'text-blue-600 dark:text-blue-400' },
  attente_validation: { label: 'Ordonnance en vérification', couleur: 'text-amber-600 dark:text-amber-400' },
  paiement_a_verifier: { label: 'Paiement en cours de vérification', couleur: 'text-amber-600 dark:text-amber-400' },
  payee_a_retirer: { label: 'Prête à retirer au guichet', couleur: 'text-emerald-600 dark:text-emerald-400' },
  retiree: { label: 'Retirée', couleur: 'text-slate-500' },
  payee: { label: 'Payée', couleur: 'text-emerald-600 dark:text-emerald-400' },
  annulee: { label: 'Annulée', couleur: 'text-red-500' },
};

interface DerniereCommande {
  id: number;
  statut: string;
  total_general: number;
  items: { id: number }[];
}

interface ProduitLeger {
  id: number;
  nom: string;
  prix: number;
  image?: string;
  categorie: string;
}

export default function HomePage() {
  const router = useRouter();
  const { config } = useConfigPharmacie();
  const { toasts, showToast } = useToast();
  const [statutSession, setStatutSession] = useState<'verification' | 'visiteur' | 'client'>('verification');
  const [prenomClient, setPrenomClient] = useState<string | null>(null);
  const [derniereCommande, setDerniereCommande] = useState<DerniereCommande | null>(null);
  const [chargementCommande, setChargementCommande] = useState(false);

  // 🔎 Recherche + 🎙️ vocale
  const [recherche, setRecherche] = useState('');
  const [ecouteVocale, setEcouteVocale] = useState(false);
  const [vocalSupporte, setVocalSupporte] = useState(false);
  const recognitionRef = useRef<any>(null);

  // 🛍️ Populaires + ❤️ Favoris
  const [populaires, setPopulaires] = useState<ProduitLeger[]>([]);
  const [favorisIds, setFavorisIds] = useState<Set<number>>(new Set());
  const [favorisProduits, setFavorisProduits] = useState<ProduitLeger[]>([]);
  const [chargementProduits, setChargementProduits] = useState(true);

  useEffect(() => {
    // 🎙️ La reconnaissance vocale (Web Speech API) n'est PAS supportée partout (Safari/iOS
    // historiquement capricieux, certains navigateurs Android alternatifs...) -- on ne montre
    // le bouton micro QUE si l'API existe réellement dans ce navigateur, pour ne jamais
    // afficher une icône cliquable qui ne ferait rien.
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    setVocalSupporte(!!SR);
  }, []);

  useEffect(() => {
    const token = localStorage.getItem('access_token');
    const role = localStorage.getItem('user_role');
    if (!token || !role) { setStatutSession('visiteur'); return; }

    if (role === 'admin') { router.replace('/admin/dashboard'); return; }
    if (role === 'caissiere' || role === 'caissière') { router.replace('/caisse/pos'); return; }

    setStatutSession('client');
    apiClient.get('/api/v1/client/me/')
      .then((res) => setPrenomClient(res.data?.nom?.split(' ')[0] || null))
      .catch(() => {});

    setChargementCommande(true);
    apiClient.get('/api/commandes/')
      .then((res) => {
        const liste: DerniereCommande[] = res.data || [];
        setDerniereCommande(liste.find((c) => c.items && c.items.length > 0) || null);
      })
      .catch(() => {})
      .finally(() => setChargementCommande(false));

    // ❤️ Favoris -- un seul appel, jamais répété ailleurs sur cette page
    apiClient.get('/api/favoris/')
      .then((res) => {
        const liste = res.data || [];
        setFavorisIds(new Set(liste.map((f: any) => f.produit.id)));
        setFavorisProduits(liste.slice(0, 6).map((f: any) => f.produit));
      })
      .catch(() => {});
  }, [router]);

  useEffect(() => {
    // 🛍️ Un seul appel, réutilise le catalogue public déjà mis en cache 60s côté backend
    // (aucune nouvelle route) -- 6 produits suffisent pour un aperçu, "Voir tout" renvoie
    // vers le vrai catalogue paginé.
    apiClient.get('/api/catalogue/?page_size=6')
      .then((res) => setPopulaires(res.data?.produits || []))
      .catch(() => {})
      .finally(() => setChargementProduits(false));
  }, []);

  const lancerRechercheVocale = () => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return;
    const recognition = new SR();
    recognition.lang = 'fr-FR';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.onstart = () => setEcouteVocale(true);
    recognition.onresult = (e: any) => {
      const texte = e.results?.[0]?.[0]?.transcript;
      if (texte) router.push(`/catalogue?q=${encodeURIComponent(texte)}`);
    };
    recognition.onerror = () => { setEcouteVocale(false); showToast("Recherche vocale interrompue, réessayez", "error"); };
    recognition.onend = () => setEcouteVocale(false);
    recognitionRef.current = recognition;
    recognition.start();
  };

  const soumettreRecherche = (e: React.FormEvent) => {
    e.preventDefault();
    if (recherche.trim()) router.push(`/catalogue?q=${encodeURIComponent(recherche.trim())}`);
  };

  // ❤️ Bascule favori -- optimiste (change l'affichage avant la réponse serveur), revert
  // silencieux en cas d'échec réseau plutôt que de bloquer l'utilisateur sur un cœur figé.
  const basculerFavori = async (produit: ProduitLeger) => {
    const etaitFavori = favorisIds.has(produit.id);
    setFavorisIds((prev) => {
      const next = new Set(prev);
      etaitFavori ? next.delete(produit.id) : next.add(produit.id);
      return next;
    });
    try {
      await apiClient.post(`/api/favoris/${produit.id}/`);
    } catch {
      setFavorisIds((prev) => {
        const next = new Set(prev);
        etaitFavori ? next.add(produit.id) : next.delete(produit.id);
        return next;
      });
      showToast("Impossible de mettre à jour vos favoris", "error");
    }
  };

  if (statutSession === 'verification') {
    return <div className="min-h-screen bg-slate-50 dark:bg-[#050e0c]" />;
  }

  const estClient = statutSession === 'client';
  const statutInfo = derniereCommande ? STATUT_INFO[derniereCommande.statut] : null;

  return (
    <div className="min-h-screen w-full bg-slate-50 dark:bg-[#050e0c] flex flex-col">
      <div className="flex-grow flex flex-col items-center px-5 sm:px-6 pt-6 pb-12">
        <div className="w-full max-w-md">

          {/* 👋 Salutation -- logo/nom/tagline déjà dans le bandeau partagé au-dessus */}
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="mb-5">
            <h1 className="font-display text-2xl font-bold text-slate-800 dark:text-white tracking-tight">
              {estClient
                ? (prenomClient ? <>Bon retour, {prenomClient} 👋</> : 'Bon retour parmi nous 👋')
                : 'Bienvenue'}
            </h1>
            <p className="text-slate-400 text-sm mt-1">
              {estClient ? 'Voici ce qui vous attend aujourd\u2019hui.' : 'Découvrez ce que propose cette pharmacie en ligne.'}
            </p>
          </motion.div>

          {/* 🔎 Recherche + 🎙️ vocale + 📷 scan */}
          <motion.form
            onSubmit={soumettreRecherche}
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.03 }}
            className="flex gap-2 mb-5"
          >
            <div className="relative flex-grow">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input
                value={recherche}
                onChange={(e) => setRecherche(e.target.value)}
                type="text"
                placeholder="Rechercher un médicament…"
                className="w-full pl-11 pr-4 py-3.5 rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/[0.04] text-slate-800 dark:text-white text-sm font-medium focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-400 outline-none transition-all"
              />
            </div>
            {vocalSupporte && (
              <button
                type="button"
                onClick={lancerRechercheVocale}
                aria-label="Recherche vocale"
                className={`shrink-0 h-[52px] w-[52px] rounded-2xl flex items-center justify-center border-none cursor-pointer transition-colors ${
                  ecouteVocale ? "bg-red-500 text-white animate-pulse" : "bg-white dark:bg-white/[0.04] border border-slate-200 dark:border-white/10 text-slate-500"
                }`}
              >
                <Mic size={18} />
              </button>
            )}
            <button
              type="button"
              onClick={() => showToast("Scan de code-barres bientôt disponible", "info")}
              aria-label="Scanner un code-barres (bientôt disponible)"
              className="shrink-0 h-[52px] w-[52px] rounded-2xl flex items-center justify-center bg-emerald-500 hover:bg-emerald-600 text-white border-none cursor-pointer transition-colors"
            >
              <ScanLine size={18} />
            </button>
          </motion.form>

          {/* 📍 Carte pharmacie -- adresse + téléphone RÉELS de ce tenant précis */}
          {(config?.adresse || config?.telephone) && (
            <motion.div
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
              className="bg-white dark:bg-white/[0.04] border border-slate-100 dark:border-white/10 rounded-[24px] p-5 mb-5 space-y-2.5"
            >
              {config?.adresse && (
                <div className="flex items-start gap-2.5">
                  <MapPin size={16} className="text-emerald-500 mt-0.5 shrink-0" />
                  <p className="text-[13px] text-slate-600 dark:text-slate-300 leading-snug">{config.adresse}</p>
                </div>
              )}
              {config?.telephone && (
                <a href={`tel:${config.telephone}`} className="flex items-center gap-2.5 no-underline">
                  <Phone size={16} className="text-emerald-500 shrink-0" />
                  <span className="text-[13px] font-semibold text-emerald-600 dark:text-emerald-400">{config.telephone}</span>
                </a>
              )}
            </motion.div>
          )}

          {/* 🧾 Statut RÉEL de la dernière commande */}
          {estClient && chargementCommande && (
            <div className="flex justify-center py-6"><Loader2 size={20} className="animate-spin text-emerald-500" /></div>
          )}
          {estClient && !chargementCommande && derniereCommande && statutInfo && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }}>
              <Link
                href={derniereCommande.statut === 'en_cours' ? '/panier' : '/commandes'}
                className="flex items-center gap-3.5 bg-white dark:bg-white/[0.04] border border-slate-100 dark:border-white/10 rounded-[24px] p-5 mb-5 no-underline transition-colors active:scale-[0.99]"
              >
                <div className="h-11 w-11 shrink-0 rounded-2xl bg-emerald-50 dark:bg-emerald-500/10 flex items-center justify-center">
                  <PackageCheck size={20} className="text-emerald-500" />
                </div>
                <div className="min-w-0 flex-grow">
                  <p className={`text-[12px] font-semibold ${statutInfo.couleur}`}>{statutInfo.label}</p>
                  <p className="text-sm font-semibold text-slate-700 dark:text-slate-200 truncate">
                    Commande #{derniereCommande.id} · <Prix montant={derniereCommande.total_general} />
                  </p>
                </div>
                <ArrowRight size={16} className="text-slate-300 shrink-0" />
              </Link>
            </motion.div>
          )}

          {/* 🏷️ Catégories -- icônes en attendant les photos prévues par tenant */}
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-display text-sm font-bold text-slate-800 dark:text-white">Catégories</h2>
              <Link href="/catalogue" className="text-[12px] font-semibold text-emerald-600 dark:text-emerald-400 no-underline flex items-center gap-0.5">
                Voir tout <ChevronRight size={13} />
              </Link>
            </div>
            <div className="grid grid-cols-4 gap-2.5">
              {CATEGORIES_ACCUEIL.map((code) => {
                const Icon = iconePourCategorie(code);
                return (
                  <Link
                    key={code}
                    href={`/catalogue?cat=${code}`}
                    className="flex flex-col items-center gap-2 no-underline group"
                  >
                    <div className="h-14 w-14 rounded-2xl bg-white dark:bg-white/[0.04] border border-slate-100 dark:border-white/10 flex items-center justify-center text-emerald-500 group-active:scale-90 transition-transform">
                      <Icon size={22} />
                    </div>
                    <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400 text-center leading-tight">
                      {code === 'antalgique' ? 'Douleur' : code === 'antibiotique' ? 'Infections' : code === 'vitamine' ? 'Vitamines' : 'Allergies'}
                    </span>
                  </Link>
                );
              })}
            </div>
          </motion.div>

          {/* ❤️ Favoris -- vraie donnée personnelle, n'apparaît que si le client en a */}
          {estClient && favorisProduits.length > 0 && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.13 }} className="mb-6">
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-display text-sm font-bold text-slate-800 dark:text-white">Vos favoris</h2>
              </div>
              <div className="flex gap-3 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-none">
                {favorisProduits.map((p) => (
                  <ProduitCarte key={p.id} produit={p} favori onBascule={basculerFavori} />
                ))}
              </div>
            </motion.div>
          )}

          {/* 🛍️ Produits populaires -- PAS "recommandé pour vous" : aucune personnalisation
              réelle derrière (voir commentaire en tête de fichier). */}
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.16 }} className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-display text-sm font-bold text-slate-800 dark:text-white">Produits populaires</h2>
              <Link href="/catalogue" className="text-[12px] font-semibold text-emerald-600 dark:text-emerald-400 no-underline flex items-center gap-0.5">
                Voir tout <ChevronRight size={13} />
              </Link>
            </div>
            {chargementProduits ? (
              <div className="flex justify-center py-8"><Loader2 size={20} className="animate-spin text-emerald-500" /></div>
            ) : (
              <div className="flex gap-3 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-none">
                {populaires.map((p) => (
                  <ProduitCarte
                    key={p.id}
                    produit={p}
                    favori={favorisIds.has(p.id)}
                    onBascule={estClient ? basculerFavori : () => router.push('/login')}
                  />
                ))}
              </div>
            )}
          </motion.div>

          {/* 🎯 ACTIONS */}
          <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="space-y-3">
            <Link
              href="/catalogue"
              className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-semibold text-sm py-4 rounded-2xl no-underline flex items-center justify-center gap-2 transition-colors active:scale-[0.98] shadow-lg shadow-emerald-500/20"
            >
              <Pill size={18} /> Parcourir le catalogue
            </Link>

            {estClient ? (
              <div className="grid grid-cols-2 gap-3">
                <Link href="/panier" className="no-underline bg-white dark:bg-white/[0.04] border border-slate-100 dark:border-white/10 rounded-2xl py-4 flex items-center justify-center gap-2 text-slate-700 dark:text-slate-200 font-semibold text-sm active:scale-[0.98] transition-transform">
                  <ShoppingCart size={17} /> Mon panier
                </Link>
                <Link href="/commandes" className="no-underline bg-white dark:bg-white/[0.04] border border-slate-100 dark:border-white/10 rounded-2xl py-4 flex items-center justify-center gap-2 text-slate-700 dark:text-slate-200 font-semibold text-sm active:scale-[0.98] transition-transform">
                  <ClipboardList size={17} /> Commandes
                </Link>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <Link href="/login" className="w-full bg-white dark:bg-white/[0.04] hover:bg-slate-50 text-slate-700 dark:text-slate-200 border border-slate-100 dark:border-white/10 font-semibold text-sm py-4 rounded-2xl no-underline flex items-center justify-center gap-2 transition-colors active:scale-[0.98]">
                  <LogIn size={17} /> Connexion
                </Link>
                <Link href="/register" className="w-full bg-white dark:bg-white/[0.04] hover:bg-slate-50 text-slate-700 dark:text-slate-200 border border-slate-100 dark:border-white/10 font-semibold text-sm py-4 rounded-2xl no-underline flex items-center justify-center gap-2 transition-colors active:scale-[0.98]">
                  <UserPlus size={17} /> Créer un compte
                </Link>
              </div>
            )}
          </motion.div>

          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }} className="flex items-center justify-center gap-1.5 text-xs font-medium text-slate-400 mt-6">
            <ShieldCheck size={14} className="text-emerald-500" /> Vos données sont sécurisées avec nous
          </motion.p>
        </div>
      </div>
      <ToastContainer toasts={toasts} />
    </div>
  );
}

// 🧩 Carte produit compacte (favoris + populaires) -- cœur cliquable, redirige vers /login
// si un visiteur (non connecté) essaie de favoriser sans compte, plutôt qu'un appel API
// voué à échouer silencieusement.
function ProduitCarte({ produit, favori, onBascule }: { produit: ProduitLeger; favori: boolean; onBascule: (p: ProduitLeger) => void }) {
  return (
    <Link
      href={`/produit/${produit.id}`}
      className="shrink-0 w-32 bg-white dark:bg-white/[0.04] border border-slate-100 dark:border-white/10 rounded-2xl p-2.5 no-underline relative"
    >
      <button
        onClick={(e) => { e.preventDefault(); onBascule(produit); }}
        aria-label={favori ? "Retirer des favoris" : "Ajouter aux favoris"}
        className="absolute top-2 right-2 z-10 h-7 w-7 rounded-full bg-white/90 dark:bg-slate-900/90 shadow flex items-center justify-center border-none cursor-pointer"
      >
        <Heart size={13} className={favori ? "fill-red-500 text-red-500" : "text-slate-300"} />
      </button>
      <div className="h-20 w-full rounded-xl bg-emerald-50 dark:bg-emerald-500/10 flex items-center justify-center mb-2 overflow-hidden">
        {produit.image ? (
          <img src={produit.image} alt={produit.nom} loading="lazy" className="w-full h-full object-cover" />
        ) : (
          <Pill size={22} className="text-emerald-300 dark:text-emerald-700" />
        )}
      </div>
      <p className="text-[12px] font-semibold text-slate-700 dark:text-slate-200 truncate">{produit.nom}</p>
      <Prix montant={produit.prix} className="text-[12px] font-bold text-emerald-600 dark:text-emerald-400" />
    </Link>
  );
}
