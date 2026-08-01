"use client";
import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { LogIn, UserPlus, ShieldCheck, Pill, Truck, Smartphone, ShoppingCart, ClipboardList, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import apiClient from '../lib/apiClient';
import Prix from '../lib/components/Prix';
import { PharmacyIcon } from '../components/PharmacyIcon';
import { PharmacyBrandName } from '../components/PharmacyBrandName';
import { ThemeToggleButton } from '../components/ThemeToggleButton';

// 🎨 REFONTE UI/UX (30/07) : l'ancien accueil était une page vitrine desktop (nav sticky,
// hero 7xl, grille "avantages", footer trois colonnes) -- hors sujet pour l'écran d'ouverture
// d'une PWA mobile-first, en plus de dupliquer le vrai site vitrine (pharmacie-marketing/).
// Reconstruit à partir de la maquette "Bienvenue sur Pharmacie Plus".
const messages = [
  { icon: Pill, texte: "Commandez vos médicaments en ligne, retirez en pharmacie" },
  { icon: Truck, texte: "Suivez votre commande en temps réel, du panier au retrait" },
  { icon: Smartphone, texte: "Payez par Orange Money ou MTN MoMo, vérifié par la pharmacie" },
];

interface StatsClient {
  nom: string;
  nb_commandes: number;
  montant_total_depense: number;
}

export default function HomePage() {
  const router = useRouter();
  const [statutSession, setStatutSession] = useState<'verification' | 'visiteur' | 'client'>('verification');
  const [stats, setStats] = useState<StatsClient | null>(null);
  const [messageIndex, setMessageIndex] = useState(0);

  useEffect(() => {
    const token = localStorage.getItem('access_token');
    const role = localStorage.getItem('user_role');
    if (!token || !role) { setStatutSession('visiteur'); return; }

    // 🔧 CORRECTIF (bug remonté en test, 01/08) : un client déjà connecté était renvoyé vers
    // /catalogue -- si le clic sur "Accueil" (bottom nav) venait JUSTEMENT de /catalogue, ça
    // donnait l'impression d'un simple rafraîchissement sans rien faire, pris à raison pour
    // un bug. Un client a maintenant un VRAI accueil ici (salutation + stats + accès rapide),
    // distinct du catalogue -- seul le personnel (admin/caissière, qui n'ont pas besoin d'un
    // écran de bienvenue, juste de leur outil de travail) est encore redirigé automatiquement.
    if (role === 'admin') { router.replace('/admin/dashboard'); return; }
    if (role === 'caissiere' || role === 'caissière') { router.replace('/caisse/pos'); return; }

    setStatutSession('client');
    apiClient.get('/api/v1/client/me/')
      .then((res) => setStats(res.data))
      .catch(() => {});
  }, [router]);

  useEffect(() => {
    const timer = setInterval(() => setMessageIndex((i) => (i + 1) % messages.length), 3800);
    return () => clearInterval(timer);
  }, []);

  // Rien à afficher pendant la vérification de session -- évite un flash de l'écran de
  // bienvenue avant la redirection pour un membre du personnel déjà connecté.
  if (statutSession === 'verification') {
    return <div className="min-h-screen bg-[var(--color-mist)] dark:bg-[#050e0c]" />;
  }

  if (statutSession === 'client') {
    return (
      <div className="relative min-h-screen w-full bg-[var(--color-mist)] dark:bg-[#050e0c] overflow-hidden">
        <div className="absolute -top-24 -left-16 w-72 h-72 rounded-full bg-emerald-300/20 dark:bg-emerald-500/10 blur-[90px] pointer-events-none" />

        <div className="relative z-10 max-w-md md:max-w-2xl mx-auto px-5 pt-8 pb-6">
          {stats ? (
            <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
              <p className="text-slate-500 dark:text-slate-400 text-sm">Bon retour,</p>
              <h1 className="font-display text-2xl font-bold text-[var(--color-ink,#0b1220)] dark:text-white tracking-tight">{stats.nom} 👋</h1>

              <div className="grid grid-cols-2 gap-3 mt-5">
                <div className="bg-white dark:bg-white/[0.04] border border-slate-100 dark:border-white/10 rounded-2xl px-4 py-3">
                  <p className="text-2xl font-bold text-[var(--color-ink,#0b1220)] dark:text-white">{stats.nb_commandes}</p>
                  <p className="text-[11px] font-medium text-slate-400">Commande{stats.nb_commandes > 1 ? 's' : ''} ici</p>
                </div>
                <div className="bg-white dark:bg-white/[0.04] border border-slate-100 dark:border-white/10 rounded-2xl px-4 py-3">
                  <p className="text-2xl font-bold text-[var(--color-ink,#0b1220)] dark:text-white"><Prix montant={stats.montant_total_depense} /></p>
                  <p className="text-[11px] font-medium text-slate-400">Dépensé ici</p>
                </div>
              </div>
            </motion.div>
          ) : (
            <div className="flex items-center gap-2 text-slate-400 text-sm mb-6"><Loader2 size={16} className="animate-spin" /> Chargement...</div>
          )}

          <Link
            href="/catalogue"
            className="block bg-emerald-500 hover:bg-emerald-600 text-white font-semibold text-sm py-4 rounded-2xl no-underline text-center mb-3 transition-all active:scale-[0.98]"
          >
            Parcourir le catalogue
          </Link>

          <div className="grid grid-cols-2 gap-3">
            <Link href="/panier" className="no-underline bg-white dark:bg-white/[0.04] border border-slate-100 dark:border-white/10 rounded-2xl p-4 flex flex-col items-center gap-2">
              <ShoppingCart size={20} className="text-emerald-500" />
              <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">Mon panier</span>
            </Link>
            <Link href="/commandes" className="no-underline bg-white dark:bg-white/[0.04] border border-slate-100 dark:border-white/10 rounded-2xl p-4 flex flex-col items-center gap-2">
              <ClipboardList size={20} className="text-emerald-500" />
              <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">Mes commandes</span>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const MessageIcon = messages[messageIndex].icon;

  return (
    <div className="relative min-h-screen w-full bg-[var(--color-mist)] dark:bg-[#050e0c] overflow-hidden flex flex-col">
      {/* 🌿 Même décor discret que /login -- cohérence visuelle entre les deux premiers
          écrans que voit réellement un nouvel utilisateur. */}
      <div className="absolute -top-24 -left-16 w-72 h-72 rounded-full bg-emerald-300/20 dark:bg-emerald-500/10 blur-[90px] pointer-events-none" />
      <div className="absolute top-1/3 -right-20 w-72 h-72 rounded-full bg-blue-300/15 dark:bg-blue-500/10 blur-[90px] pointer-events-none" />

      <div className="absolute top-5 right-5 z-10">
        <ThemeToggleButton />
      </div>

      <div className="relative z-10 flex-grow flex flex-col items-center justify-center px-6 py-16">
        <div className="w-full max-w-md text-center">

          <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }}>
            <div className="relative inline-block mb-6">
              <motion.div
                animate={{ scale: [1, 1.1, 1], opacity: [0.3, 0.5, 0.3] }}
                transition={{ duration: 3.2, repeat: Infinity, ease: 'easeInOut' }}
                className="absolute inset-0 bg-emerald-400/40 rounded-[2rem] blur-xl"
              />
              <div className="relative h-24 w-24 bg-white rounded-[2rem] flex items-center justify-center shadow-lg shadow-emerald-950/10 mx-auto p-4">
                <PharmacyIcon className="w-full h-full object-cover" alt="Pharmacie+" />
              </div>
            </div>

            <h1 className="font-display text-3xl font-bold text-[var(--color-ink,#0b1220)] dark:text-white tracking-tight">
              <PharmacyBrandName />
            </h1>
            <p className="text-slate-500 dark:text-slate-400 text-sm mt-1.5">Votre santé, notre priorité</p>
          </motion.div>

          {/* 💬 Message tournant -- 3 capacités réelles de l'app, pas des slogans creux */}
          <motion.div
            initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
            className="bg-white dark:bg-white/[0.04] border border-slate-100 dark:border-white/10 rounded-[28px] p-6 mt-10 shadow-xl shadow-slate-900/5 min-h-[104px] flex items-center"
          >
            <AnimatePresence mode="wait">
              <motion.div
                key={messageIndex}
                initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }}
                transition={{ duration: 0.35 }}
                className="flex items-center gap-4 text-left"
              >
                <div className="h-11 w-11 shrink-0 rounded-2xl bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                  <MessageIcon size={20} />
                </div>
                <p className="text-sm font-medium text-slate-600 dark:text-slate-300 leading-snug">
                  {messages[messageIndex].texte}
                </p>
              </motion.div>
            </AnimatePresence>
          </motion.div>

          <div className="flex justify-center gap-1.5 mt-4">
            {messages.map((_, i) => (
              <span key={i} className={`h-1.5 rounded-full transition-all ${i === messageIndex ? 'w-5 bg-emerald-500' : 'w-1.5 bg-emerald-200 dark:bg-emerald-800'}`} />
            ))}
          </div>

          {/* 🎯 ACTIONS -- cibles tactiles 44px+, retour au toucher, pas de survol requis */}
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }} className="mt-10 space-y-3">
            <Link
              href="/login"
              className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-semibold text-sm py-4 rounded-2xl no-underline flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
            >
              <LogIn size={18} /> Se connecter
            </Link>
            <Link
              href="/register"
              className="w-full bg-white dark:bg-white/[0.04] text-slate-700 dark:text-white border border-slate-200 dark:border-white/10 font-semibold text-sm py-4 rounded-2xl no-underline flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
            >
              <UserPlus size={18} /> Créer un compte
            </Link>
          </motion.div>

          <motion.p
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}
            className="flex items-center justify-center gap-1.5 text-xs font-medium text-slate-400 dark:text-slate-500 mt-6"
          >
            <ShieldCheck size={14} className="text-emerald-500" /> Vos données sont sécurisées avec nous
          </motion.p>
        </div>
      </div>
    </div>
  );
}
