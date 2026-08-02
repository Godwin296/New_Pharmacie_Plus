"use client";
import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  LogIn, UserPlus, ShieldCheck, Pill, ShoppingCart, ClipboardList,
  MapPin, Phone, PackageCheck, Clock, Loader2, ArrowRight,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import apiClient from '../lib/apiClient';
import { useConfigPharmacie } from '../lib/context/ConfigPharmacieContext';
import Prix from '../lib/components/Prix';

// 🎨 REFONTE (30/07, v3) : la v2 avait recopié quasi telle quelle le Hero du site
// marketing (fond bg-brand-deep, halos, tracé ECG, carrousel de slogans génériques) sur
// l'écran d'accueil RÉEL de l'app. Deux problèmes concrets remontés : (1) rupture visuelle
// brutale en quittant cet écran sombre pour le catalogue, clair, comme tout le reste de
// l'app -- exactement le problème qu'on avait corrigé partout ailleurs ; (2) aucune
// information réellement propre au sous-domaine visité : les 3 slogans tournants
// ("Suivez votre commande en temps réel"...) sont identiques pour dupont.localhost et
// martin.localhost, donc ne montrent rien de spécifique à CETTE pharmacie.
//
// v3 : thème clair (cohérent avec catalogue/panier/produit), et deux informations
// réellement propres au tenant, déjà chargées sans appel réseau supplémentaire :
// - adresse + téléphone (PharmacieConfig, déjà en cache Redis 1h via ConfigPharmacieContext)
// - pour un client connecté, sa VRAIE dernière commande (statut réel), pas un texte générique

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

export default function HomePage() {
  const router = useRouter();
  const { config } = useConfigPharmacie();
  const [statutSession, setStatutSession] = useState<'verification' | 'visiteur' | 'client'>('verification');
  const [prenomClient, setPrenomClient] = useState<string | null>(null);
  const [derniereCommande, setDerniereCommande] = useState<DerniereCommande | null>(null);
  const [chargementCommande, setChargementCommande] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('access_token');
    const role = localStorage.getItem('user_role');
    if (!token || !role) { setStatutSession('visiteur'); return; }

    // Seul le personnel (admin/caissière, qui n'a pas besoin d'un écran d'accueil, juste de
    // son outil de travail) est redirigé automatiquement -- un client a un vrai accueil ici.
    if (role === 'admin') { router.replace('/admin/dashboard'); return; }
    if (role === 'caissiere' || role === 'caissière') { router.replace('/caisse/pos'); return; }

    setStatutSession('client');
    apiClient.get('/api/v1/client/me/')
      .then((res) => setPrenomClient(res.data?.nom?.split(' ')[0] || null))
      .catch(() => {});

    // 📦 Une seule requête, réutilise /api/commandes/ (déjà consommé par /commandes,
    // aucune nouvelle route) -- la première entrée est la plus récente (order by -date
    // côté backend), qu'elle soit encore un panier en cours ou déjà traitée.
    setChargementCommande(true);
    apiClient.get('/api/commandes/')
      .then((res) => {
        const liste: DerniereCommande[] = res.data || [];
        const derniere = liste.find((c) => c.items && c.items.length > 0);
        setDerniereCommande(derniere || null);
      })
      .catch(() => {})
      .finally(() => setChargementCommande(false));
  }, [router]);

  // Rien à afficher pendant la vérification de session -- évite un flash de l'accueil avant
  // la redirection pour un membre du personnel déjà connecté.
  if (statutSession === 'verification') {
    return <div className="min-h-screen bg-slate-50 dark:bg-[#050e0c]" />;
  }

  const estClient = statutSession === 'client';
  const statutInfo = derniereCommande ? STATUT_INFO[derniereCommande.statut] : null;

  return (
    <div className="min-h-screen w-full bg-slate-50 dark:bg-[#050e0c] flex flex-col">
      <div className="flex-grow flex flex-col items-center px-6 pt-6 pb-12">
        <div className="w-full max-w-md">

          {/* 👋 Salutation -- le logo/nom/tagline sont déjà dans le bandeau partagé
              au-dessus (désormais visible sur cette page, cf. isSpecialRoute), pas besoin
              de les répéter ici. */}
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

          {/* 📍 Carte pharmacie -- adresse + téléphone RÉELS de ce tenant précis, jamais
              montrés nulle part ailleurs dans l'app jusqu'ici. Numéro directement appelable
              (tel:), pas juste un texte affiché. */}
          {(config?.adresse || config?.telephone) && (
            <motion.div
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
              className="bg-white dark:bg-white/[0.04] border border-slate-100 dark:border-white/10 rounded-[24px] p-5 mb-4 space-y-2.5"
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

          {/* 🧾 Statut RÉEL de la dernière commande du client -- pas un carrousel de slogans.
              N'apparaît que s'il y a réellement quelque chose à montrer. */}
          {estClient && chargementCommande && (
            <div className="flex justify-center py-6">
              <Loader2 size={20} className="animate-spin text-emerald-500" />
            </div>
          )}
          {estClient && !chargementCommande && derniereCommande && statutInfo && (
            <motion.div
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
            >
              <Link
                href={derniereCommande.statut === 'en_cours' ? '/panier' : '/commandes'}
                className="flex items-center gap-3.5 bg-white dark:bg-white/[0.04] border border-slate-100 dark:border-white/10 rounded-[24px] p-5 mb-6 no-underline transition-colors active:scale-[0.99]"
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

          {/* 🎯 ACTIONS -- cibles tactiles 44px+, retour au toucher. Le catalogue est
              accessible SANS connexion (core/api.py::api_catalogue, AllowAny) : c'est donc
              la vraie porte d'entrée pour tout le monde, visiteur ou client. */}
          <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className={`space-y-3 ${(config?.adresse || config?.telephone) ? '' : 'mt-2'}`}>
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
                <Link
                  href="/login"
                  className="w-full bg-white dark:bg-white/[0.04] hover:bg-slate-50 text-slate-700 dark:text-slate-200 border border-slate-100 dark:border-white/10 font-semibold text-sm py-4 rounded-2xl no-underline flex items-center justify-center gap-2 transition-colors active:scale-[0.98]"
                >
                  <LogIn size={17} /> Connexion
                </Link>
                <Link
                  href="/register"
                  className="w-full bg-white dark:bg-white/[0.04] hover:bg-slate-50 text-slate-700 dark:text-slate-200 border border-slate-100 dark:border-white/10 font-semibold text-sm py-4 rounded-2xl no-underline flex items-center justify-center gap-2 transition-colors active:scale-[0.98]"
                >
                  <UserPlus size={17} /> Créer un compte
                </Link>
              </div>
            )}
          </motion.div>

          <motion.p
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}
            className="flex items-center justify-center gap-1.5 text-xs font-medium text-slate-400 mt-6"
          >
            <ShieldCheck size={14} className="text-emerald-500" /> Vos données sont sécurisées avec nous
          </motion.p>
        </div>
      </div>
    </div>
  );
}
