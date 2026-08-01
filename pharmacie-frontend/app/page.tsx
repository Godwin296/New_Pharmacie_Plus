"use client";
import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { LogIn, UserPlus, ShieldCheck, Pill, Truck, Smartphone } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import apiClient from '../lib/apiClient';
import { PharmacyIcon } from '../components/PharmacyIcon';
import { PharmacyBrandName } from '../components/PharmacyBrandName';
import { ThemeToggleButton } from '../components/ThemeToggleButton';

// 🎨 REFONTE UI/UX (30/07) : l'ancien accueil était une page vitrine desktop (nav sticky,
// hero 7xl, grille "avantages", footer trois colonnes) -- hors sujet pour l'écran d'ouverture
// d'une PWA mobile-first, en plus de dupliquer le vrai site vitrine (pharmacie-marketing/).
// Reconstruit à partir de la maquette "Bienvenue sur Pharmacie Plus" : logo, message court,
// deux actions claires. Même langage que /login (déjà refait) -- fond clair, masses
// lumineuses douces, carte du logo avec halo pulsé.
const messages = [
  { icon: Pill, texte: "Commandez vos médicaments en ligne, retirez en pharmacie" },
  { icon: Truck, texte: "Suivez votre commande en temps réel, du panier au retrait" },
  { icon: Smartphone, texte: "Payez par Orange Money ou MTN MoMo, vérifié par la pharmacie" },
];

export default function HomePage() {
  const router = useRouter();
  const [checkingSession, setCheckingSession] = useState(true);
  const [messageIndex, setMessageIndex] = useState(0);

  // 🔀 Un visiteur déjà connecté n'a rien à faire sur un écran "Bienvenue, connectez-vous" --
  // redirection immédiate vers son espace plutôt que de lui remontrer l'accueil à chaque fois.
  useEffect(() => {
    const token = localStorage.getItem('access_token');
    const role = localStorage.getItem('user_role');
    if (!token || !role) { setCheckingSession(false); return; }

    const destinations: Record<string, string> = {
      admin: '/admin/dashboard',
      caissiere: '/caisse/pos',
      client: '/catalogue',
    };
    const cible = destinations[role];
    if (cible) {
      router.replace(cible);
    } else {
      setCheckingSession(false);
    }
  }, [router]);

  useEffect(() => {
    const timer = setInterval(() => setMessageIndex((i) => (i + 1) % messages.length), 3800);
    return () => clearInterval(timer);
  }, []);

  // Rien à afficher pendant la vérification de session -- évite un flash de l'écran de
  // bienvenue avant la redirection pour un visiteur déjà connecté.
  if (checkingSession) {
    return <div className="min-h-screen bg-[var(--color-mist)] dark:bg-[#050e0c]" />;
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
