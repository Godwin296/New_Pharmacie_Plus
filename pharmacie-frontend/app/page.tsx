"use client";
import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { LogIn, UserPlus, ShieldCheck, Pill, Truck, Smartphone, ShoppingCart, ClipboardList, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import apiClient from '../lib/apiClient';
import { PharmacyIcon } from '../components/PharmacyIcon';
import { PharmacyBrandName } from '../components/PharmacyBrandName';

// 🎨 REFONTE (01/08, v3 -- retour en arrière assumé sur le v2) : le fond bg-brand-deep
// permanent (v2) créait un déphasage avec le reste de l'app (catalogue, panier... tous en
// thème clair/sombre normal) -- corrigé ici en reprenant le MÊME fond que le reste de
// l'app (var(--color-mist), identique à /login). Les halos "pulsants" (scale+opacity en
// boucle) ont aussi été retirés : la douceur recherchée vient du RYTHME et de l'espace,
// pas d'un effet de respiration animé répété sur chaque écran.
//
// Nouveau : un vrai onboarding en 3 étapes (Suivant/Passer, points de progression) pour un
// VISITEUR qui n'a jamais ouvert l'app -- prépare concrètement à ce qu'il va trouver sur
// CETTE pharmacie, plutôt qu'un simple carrousel de petites phrases qui défilent. Affiché
// une seule fois (mémorisé en local) ; un client déjà connu ou un visiteur qui l'a déjà vu
// passe directement à l'accueil.
const ETAPES_ONBOARDING = [
  {
    icon: Pill,
    titre: "Le catalogue de votre pharmacie",
    texte: "Tous les médicaments disponibles ici, avec leur prix et leur stock à jour en temps réel.",
  },
  {
    icon: Truck,
    titre: "Une commande, suivie de bout en bout",
    texte: "Du panier jusqu'au retrait en pharmacie, sachez toujours où en est votre commande.",
  },
  {
    icon: Smartphone,
    titre: "Un paiement simple et vérifié",
    texte: "Orange Money ou MTN MoMo -- chaque paiement est confirmé directement par l'équipe de la pharmacie.",
  },
];

const CLE_ONBOARDING_VU = 'pharmacie_onboarding_vu';

export default function HomePage() {
  const router = useRouter();
  const [statutSession, setStatutSession] = useState<'verification' | 'visiteur' | 'client'>('verification');
  const [prenomClient, setPrenomClient] = useState<string | null>(null);
  const [onboardingTermine, setOnboardingTermine] = useState(true); // true tant qu'on n'a pas vérifié, pour ne jamais flasher l'onboarding à tort
  const [etape, setEtape] = useState(0);

  useEffect(() => {
    const token = localStorage.getItem('access_token');
    const role = localStorage.getItem('user_role');
    if (!token || !role) {
      setStatutSession('visiteur');
      setOnboardingTermine(!!localStorage.getItem(CLE_ONBOARDING_VU));
      return;
    }

    // Seul le personnel (admin/caissière, qui n'a pas besoin d'un écran d'accueil, juste de
    // son outil de travail) est redirigé automatiquement -- un client a un vrai accueil ici.
    if (role === 'admin') { router.replace('/admin/dashboard'); return; }
    if (role === 'caissiere' || role === 'caissière') { router.replace('/caisse/pos'); return; }

    setStatutSession('client');
    apiClient.get('/api/v1/client/me/')
      .then((res) => setPrenomClient(res.data?.nom?.split(' ')[0] || null))
      .catch(() => {});
  }, [router]);

  const terminerOnboarding = () => {
    localStorage.setItem(CLE_ONBOARDING_VU, '1');
    setOnboardingTermine(true);
  };

  // Rien à afficher pendant la vérification de session -- évite un flash de l'accueil avant
  // la redirection pour un membre du personnel déjà connecté.
  if (statutSession === 'verification') {
    return <div className="min-h-screen bg-[var(--color-mist)] dark:bg-[#050e0c]" />;
  }

  const estClient = statutSession === 'client';

  // 📖 ONBOARDING -- uniquement pour un visiteur qui ne l'a encore jamais vu.
  if (!estClient && !onboardingTermine) {
    const { icon: Icon, titre, texte } = ETAPES_ONBOARDING[etape];
    const derniereEtape = etape === ETAPES_ONBOARDING.length - 1;

    return (
      <div className="relative min-h-screen w-full bg-[var(--color-mist)] dark:bg-[#050e0c] flex flex-col">
        <div className="flex justify-end px-6 pt-6">
          <button
            onClick={terminerOnboarding}
            className="min-h-11 px-4 text-sm font-semibold text-slate-400 dark:text-slate-500 bg-transparent border-none cursor-pointer active:opacity-60 transition-opacity"
          >
            Passer
          </button>
        </div>

        <div className="flex-grow flex flex-col items-center justify-center px-8 text-center">
          <AnimatePresence mode="wait">
            <motion.div
              key={etape}
              initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -24 }}
              transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
              className="w-full max-w-sm"
            >
              <div className="h-24 w-24 mx-auto rounded-[2rem] bg-emerald-50 dark:bg-emerald-500/10 flex items-center justify-center mb-8">
                <Icon size={40} className="text-emerald-500" strokeWidth={1.6} />
              </div>
              <h1 className="font-display text-2xl font-bold text-[var(--color-ink,#0b1220)] dark:text-white tracking-tight leading-snug">
                {titre}
              </h1>
              <p className="text-slate-500 dark:text-slate-400 text-[15px] leading-relaxed mt-3">
                {texte}
              </p>
            </motion.div>
          </AnimatePresence>
        </div>

        <div className="px-8 pb-10">
          <div className="flex justify-center gap-1.5 mb-6">
            {ETAPES_ONBOARDING.map((_, i) => (
              <span key={i} className={`h-1.5 rounded-full transition-all ${i === etape ? 'w-6 bg-emerald-500' : 'w-1.5 bg-slate-200 dark:bg-white/10'}`} />
            ))}
          </div>
          <button
            onClick={() => (derniereEtape ? terminerOnboarding() : setEtape((e) => e + 1))}
            className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-semibold text-sm py-4 rounded-2xl border-none cursor-pointer flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
          >
            {derniereEtape ? 'Découvrir la pharmacie' : 'Suivant'} <ArrowRight size={17} />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen w-full bg-[var(--color-mist)] dark:bg-[#050e0c] overflow-hidden flex flex-col">
      {/* Décor discret et STATIQUE (pas de respiration animée en boucle) -- même halos que
          /login, simplement pour ne pas laisser l'écran totalement plat. */}
      <div className="absolute -top-24 -left-16 w-72 h-72 rounded-full bg-emerald-300/15 dark:bg-emerald-500/10 blur-[90px] pointer-events-none" />
      <div className="absolute top-1/3 -right-20 w-72 h-72 rounded-full bg-blue-300/10 dark:bg-blue-500/10 blur-[90px] pointer-events-none" />

      <div className="relative z-10 flex-grow flex flex-col items-center justify-center px-6 py-16">
        <div className="w-full max-w-md text-center">

          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
            <div className="h-24 w-24 bg-white dark:bg-white/5 rounded-[2rem] flex items-center justify-center shadow-lg shadow-emerald-950/5 dark:shadow-none mx-auto p-4 mb-6">
              <PharmacyIcon className="w-full h-full object-cover" alt="Pharmacie+" />
            </div>

            {/* 👋 Accueil personnel pour un client connu ; promesse de l'app pour un visiteur
                qui a déjà vu l'onboarding -- pas la peine de répéter le nom de la pharmacie,
                déjà lisible juste au-dessus. */}
            <h1 className="font-display text-2xl font-bold text-[var(--color-ink,#0b1220)] dark:text-white tracking-tight">
              {estClient
                ? (prenomClient ? <>Bon retour, {prenomClient}</> : 'Bon retour parmi nous')
                : <>Bienvenue chez <PharmacyBrandName /></>}
            </h1>
            <p className="text-slate-500 dark:text-slate-400 text-sm mt-2">
              {estClient ? 'Heureux de vous revoir.' : 'Votre santé, notre priorité'}
            </p>
          </motion.div>

          {/* 🎯 ACTIONS -- cibles tactiles 44px+, retour au toucher, pas de survol requis.
              Le catalogue est accessible SANS connexion (core/api.py::api_catalogue,
              AllowAny) : c'est donc l'action principale pour tout le monde. */}
          <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15, duration: 0.5 }} className="mt-10 space-y-3">
            <Link
              href="/catalogue"
              className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-semibold text-sm py-4 rounded-2xl no-underline flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
            >
              <Pill size={18} /> Parcourir le catalogue
            </Link>

            {estClient ? (
              <div className="grid grid-cols-2 gap-3">
                <Link href="/panier" className="no-underline bg-white dark:bg-white/[0.04] border border-slate-100 dark:border-white/10 rounded-2xl py-4 flex items-center justify-center gap-2 text-slate-600 dark:text-slate-300 font-semibold text-sm active:scale-[0.98] transition-all">
                  <ShoppingCart size={17} /> Mon panier
                </Link>
                <Link href="/commandes" className="no-underline bg-white dark:bg-white/[0.04] border border-slate-100 dark:border-white/10 rounded-2xl py-4 flex items-center justify-center gap-2 text-slate-600 dark:text-slate-300 font-semibold text-sm active:scale-[0.98] transition-all">
                  <ClipboardList size={17} /> Commandes
                </Link>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <Link
                  href="/login"
                  className="w-full bg-white dark:bg-white/[0.04] hover:bg-slate-50 dark:hover:bg-white/[0.08] text-slate-700 dark:text-white border border-slate-200 dark:border-white/10 font-semibold text-sm py-4 rounded-2xl no-underline flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
                >
                  <LogIn size={17} /> Connexion
                </Link>
                <Link
                  href="/register"
                  className="w-full bg-white dark:bg-white/[0.04] hover:bg-slate-50 dark:hover:bg-white/[0.08] text-slate-700 dark:text-white border border-slate-200 dark:border-white/10 font-semibold text-sm py-4 rounded-2xl no-underline flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
                >
                  <UserPlus size={17} /> Créer un compte
                </Link>
              </div>
            )}
          </motion.div>

          <motion.p
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.35 }}
            className="flex items-center justify-center gap-1.5 text-xs font-medium text-slate-400 dark:text-slate-500 mt-6"
          >
            <ShieldCheck size={14} className="text-emerald-500" /> Vos données sont sécurisées avec nous
          </motion.p>
        </div>
      </div>
    </div>
  );
}
