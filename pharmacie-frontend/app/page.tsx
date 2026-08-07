"use client";
import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import {
  LogIn, UserPlus, Pill, MapPin, Phone, PackageCheck, Loader2, ArrowRight,
  Search, Mic, ScanLine, Heart, ChevronRight, FileText, Truck, Sparkles,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import apiClient from '../lib/apiClient';
import { useConfigPharmacie } from '../lib/context/ConfigPharmacieContext';
import Prix from '../lib/components/Prix';
import { useToast, ToastContainer } from '../lib/hooks/useToast';
import { iconePourCategorie, CATEGORIES_ACCUEIL } from '../lib/categorieIcons';

// 🎨 REFONTE (30/07, v5) : v4 gardait les conventions déjà en place dans le reste de l'app
// (cartes blanches sobres, icônes toutes de la même teinte) plutôt que de vraiment reprendre
// la STRUCTURE VISUELLE de la référence fournie (bannière illustrée avec CTA, grille de
// catégories colorée façon icônes pastel, cartes produit à grande image + cœur superposé).
// v5 colle beaucoup plus fidèlement à cette structure, avec la palette de la marque à la
// place du turquoise du modèle -- et corrige deux régressions signalées : la transcription
// vocale ne s'affichait pas en direct dans la barre, et les liens "Voir tout" n'amenaient
// nulle part de spécifique (catalogue générique, sans même ouvrir les filtres).

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

  const [recherche, setRecherche] = useState('');
  const [ecouteVocale, setEcouteVocale] = useState(false);
  const [vocalSupporte, setVocalSupporte] = useState(false);
  const recognitionRef = useRef<any>(null);

  const [populaires, setPopulaires] = useState<ProduitLeger[]>([]);
  const [favorisIds, setFavorisIds] = useState<Set<number>>(new Set());
  const [favorisProduits, setFavorisProduits] = useState<ProduitLeger[]>([]);
  const [chargementProduits, setChargementProduits] = useState(true);

  useEffect(() => {
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

    apiClient.get('/api/favoris/')
      .then((res) => {
        const liste = res.data || [];
        setFavorisIds(new Set(liste.map((f: any) => f.produit.id)));
        setFavorisProduits(liste.slice(0, 6).map((f: any) => f.produit));
      })
      .catch(() => {});
  }, [router]);

  useEffect(() => {
    apiClient.get('/api/catalogue/?page_size=6')
      .then((res) => setPopulaires(res.data?.produits || []))
      .catch(() => {})
      .finally(() => setChargementProduits(false));
  }, []);

  // 🎙️ (30/07, corrigé) interimResults=true + mise à jour de `recherche` sur CHAQUE
  // résultat (intermédiaire ou final) -- avant, seul le résultat final déclenchait une
  // redirection immédiate, donc rien ne s'affichait dans la barre pendant que la personne
  // parlait. Désormais le texte se construit en direct sous les yeux, comme sur un vrai
  // clavier vocal, et la redirection n'a lieu qu'une fois la reconnaissance terminée
  // (silence détecté -> onend).
  const lancerRechercheVocale = () => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return;
    const recognition = new SR();
    recognition.lang = 'fr-FR';
    recognition.interimResults = true;
    recognition.continuous = true;
    recognition.onstart = () => { setEcouteVocale(true); setRecherche(''); };
    recognition.onresult = (e: any) => {
      let texte = '';
      for (let i = 0; i < e.results.length; i++) texte += e.results[i][0].transcript;
      setRecherche(texte);
    };
    recognition.onerror = () => { setEcouteVocale(false); showToast("Recherche vocale interrompue, réessayez", "error"); };
    recognition.onend = () => {
      setEcouteVocale(false);
      setRecherche((texteFinal) => {
        if (texteFinal.trim()) router.push(`/catalogue?q=${encodeURIComponent(texteFinal.trim())}`);
        return texteFinal;
      });
    };
    recognitionRef.current = recognition;
    recognition.start();
  };

  const arreterRechercheVocale = () => recognitionRef.current?.stop();

  const soumettreRecherche = (e: React.FormEvent) => {
    e.preventDefault();
    if (recherche.trim()) router.push(`/catalogue?q=${encodeURIComponent(recherche.trim())}`);
  };

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
      <div className="flex-grow flex flex-col items-center px-5 sm:px-6 pt-5 pb-12">
        <div className="w-full max-w-md">

          {/* 📍 Pastille de localisation -- compacte, en haut, comme la référence (au lieu
              d'une grande carte). Le téléphone reste une action directe (tel:) à côté. */}
          {(config?.adresse || config?.telephone) && (
            <motion.div
              initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}
              className="flex items-center justify-between gap-3 mb-4"
            >
              {config?.adresse && (
                <span className="inline-flex items-center gap-1.5 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 text-[11px] font-semibold px-3 py-1.5 rounded-full truncate">
                  <MapPin size={12} className="shrink-0" /> <span className="truncate">{config.adresse}</span>
                </span>
              )}
              {config?.telephone && (
                <a href={`tel:${config.telephone}`} className="shrink-0 h-8 w-8 rounded-full bg-white dark:bg-white/[0.06] border border-slate-100 dark:border-white/10 flex items-center justify-center text-emerald-500 no-underline">
                  <Phone size={13} />
                </a>
              )}
            </motion.div>
          )}

          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.02 }} className="mb-4">
            <h1 className="font-display text-2xl font-bold text-slate-800 dark:text-white tracking-tight">
              {estClient
                ? (prenomClient ? <>Bon retour, {prenomClient} 👋</> : 'Bon retour parmi nous 👋')
                : 'Bienvenue'}
            </h1>
          </motion.div>

          {/* 🔎 Recherche + 🎙️ vocale (transcription en direct) + 📷 scan */}
          <motion.form
            onSubmit={soumettreRecherche}
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.04 }}
            className="flex gap-2 mb-5"
          >
            <div className="relative flex-grow">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input
                value={recherche}
                onChange={(e) => setRecherche(e.target.value)}
                type="text"
                placeholder={ecouteVocale ? "Je vous écoute…" : "Rechercher un médicament…"}
                className="w-full pl-11 pr-4 py-3.5 rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/[0.04] text-slate-800 dark:text-white text-sm font-medium focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-400 outline-none transition-all"
              />
            </div>
            {vocalSupporte && (
              <button
                type="button"
                onClick={ecouteVocale ? arreterRechercheVocale : lancerRechercheVocale}
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

          {/* 🧾 Statut RÉEL de la dernière commande -- reste prioritaire s'il y en a une */}
          {estClient && chargementCommande && (
            <div className="flex justify-center py-6"><Loader2 size={20} className="animate-spin text-emerald-500" /></div>
          )}
          {estClient && !chargementCommande && derniereCommande && statutInfo && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.06 }}>
              <Link
                href={derniereCommande.statut === 'en_cours' ? '/panier' : '/commandes'}
                className="flex items-center gap-3.5 bg-white dark:bg-white/[0.04] border border-slate-100 dark:border-white/10 rounded-[24px] p-4 mb-5 no-underline transition-colors active:scale-[0.99]"
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

          {/* 🎁 BANNIÈRE -- même rôle structurel que 'Order Medicine' de la référence
              (illustration + accroche + CTA), mais avec une vraie fonctionnalité du produit
              (l'upload d'ordonnance) plutôt qu'une promesse de réduction inventée. */}
          <motion.div
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }}
            className="relative overflow-hidden rounded-[28px] bg-gradient-to-br from-emerald-500 to-emerald-700 p-5 mb-6"
          >
            <div className="absolute -right-6 -bottom-8 h-32 w-32 rounded-full bg-white/10" />
            <div className="absolute right-8 top-4 h-16 w-16 rounded-2xl bg-white/10 flex items-center justify-center rotate-12">
              <Truck size={28} className="text-white/70" />
            </div>
            <div className="relative max-w-[70%]">
              <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-emerald-100 mb-2">
                <Sparkles size={11} /> Sans vous déplacer
              </span>
              <h3 className="font-display text-lg font-bold text-white leading-snug mb-1.5">
                Envoyez votre ordonnance
              </h3>
              <p className="text-emerald-50/80 text-[12px] leading-snug mb-3">
                Dites-nous ce qu&apos;il vous faut, on prépare votre commande.
              </p>
              <Link
                href="/catalogue"
                className="inline-flex items-center gap-1.5 bg-white text-emerald-700 text-[12px] font-bold px-4 py-2.5 rounded-xl no-underline"
              >
                <FileText size={13} /> Commander
              </Link>
            </div>
          </motion.div>

          {/* 🏷️ Catégories -- grille colorée (une teinte par catégorie), fidèle à la
              référence. 'Voir tout' ouvre directement les filtres du catalogue au lieu
              d'atterrir sur une vue générique qu'il faut re-filtrer soi-même. */}
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-display text-sm font-bold text-slate-800 dark:text-white">Catégories</h2>
              <Link href="/catalogue?filtres=1" className="text-[12px] font-semibold text-emerald-600 dark:text-emerald-400 no-underline flex items-center gap-0.5">
                Voir tout <ChevronRight size={13} />
              </Link>
            </div>
            <div className="grid grid-cols-4 gap-2.5">
              {CATEGORIES_ACCUEIL.map((cat) => {
                const Icon = iconePourCategorie(cat.code);
                return (
                  <Link key={cat.code} href={`/catalogue?cat=${cat.code}`} className="flex flex-col items-center gap-2 no-underline group">
                    <div className={`h-14 w-14 rounded-2xl ${cat.bg} flex items-center justify-center ${cat.fg} group-active:scale-90 transition-transform`}>
                      <Icon size={22} />
                    </div>
                    <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400 text-center leading-tight">{cat.label}</span>
                  </Link>
                );
              })}
            </div>
          </motion.div>

          {/* ❤️ Favoris */}
          {estClient && favorisProduits.length > 0 && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.13 }} className="mb-6">
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-display text-sm font-bold text-slate-800 dark:text-white flex items-center gap-1.5">
                  <Heart size={14} className="fill-red-500 text-red-500" /> Vos favoris
                </h2>
              </div>
              <div className="flex gap-3 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-none">
                {favorisProduits.map((p) => (
                  <ProduitCarte key={p.id} produit={p} favori onBascule={basculerFavori} />
                ))}
              </div>
            </motion.div>
          )}

          {/* 🛍️ Produits populaires -- 'Voir tout' mène au catalogue complet (déjà la vue
              'tous les produits' triés), pas de destination plus spécifique à construire ici. */}
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

          {!estClient && (
            <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="grid grid-cols-2 gap-3">
              <Link href="/login" className="w-full bg-white dark:bg-white/[0.04] hover:bg-slate-50 text-slate-700 dark:text-slate-200 border border-slate-100 dark:border-white/10 font-semibold text-sm py-4 rounded-2xl no-underline flex items-center justify-center gap-2 transition-colors active:scale-[0.98]">
                <LogIn size={17} /> Connexion
              </Link>
              <Link href="/register" className="w-full bg-white dark:bg-white/[0.04] hover:bg-slate-50 text-slate-700 dark:text-slate-200 border border-slate-100 dark:border-white/10 font-semibold text-sm py-4 rounded-2xl no-underline flex items-center justify-center gap-2 transition-colors active:scale-[0.98]">
                <UserPlus size={17} /> Créer un compte
              </Link>
            </motion.div>
          )}
        </div>
      </div>
      <ToastContainer toasts={toasts} />
    </div>
  );
}

function ProduitCarte({ produit, favori, onBascule }: { produit: ProduitLeger; favori: boolean; onBascule: (p: ProduitLeger) => void }) {
  return (
    <Link
      href={`/produit/${produit.id}`}
      className="shrink-0 w-36 bg-white dark:bg-white/[0.04] border border-slate-100 dark:border-white/10 rounded-2xl p-2.5 no-underline relative"
    >
      <button
        onClick={(e) => { e.preventDefault(); onBascule(produit); }}
        aria-label={favori ? "Retirer des favoris" : "Ajouter aux favoris"}
        className="absolute top-4 right-4 z-10 h-7 w-7 rounded-full bg-white/90 dark:bg-slate-900/90 shadow flex items-center justify-center border-none cursor-pointer"
      >
        <Heart size={13} className={favori ? "fill-red-500 text-red-500" : "text-slate-300"} />
      </button>
      {/* 🖼️ Grande zone image (proportion proche de la référence) -- repli icône Pill tant
          qu'aucune photo n'est chargée pour ce produit. */}
      <div className="h-24 w-full rounded-xl bg-emerald-50 dark:bg-emerald-500/10 flex items-center justify-center mb-2 overflow-hidden">
        {produit.image ? (
          <img src={produit.image} alt={produit.nom} loading="lazy" className="w-full h-full object-cover" />
        ) : (
          <Pill size={26} className="text-emerald-300 dark:text-emerald-700" />
        )}
      </div>
      <p className="text-[12px] font-semibold text-slate-700 dark:text-slate-200 truncate">{produit.nom}</p>
      <Prix montant={produit.prix} className="text-[12px] font-bold text-emerald-600 dark:text-emerald-400" />
    </Link>
  );
}
