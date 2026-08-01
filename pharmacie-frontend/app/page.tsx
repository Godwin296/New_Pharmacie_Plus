"use client";
import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { LogIn, UserPlus, ShieldCheck, Pill, Truck, Smartphone, ShoppingCart, ClipboardList } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import apiClient from '../lib/apiClient';
import { PharmacyIcon } from '../components/PharmacyIcon';
import { PharmacyBrandName } from '../components/PharmacyBrandName';
import { PulseLine } from '../components/PulseLine';

// 🎨 REFONTE (01/08, v2) : la version précédente traitait cet écran comme un mini-dashboard
// client (cartes de statistiques -- nombre de commandes, montant dépensé). Ce n'est pas ce
// qu'est cette page : `/` est le PREMIER CONTACT de quiconque arrive sur le sous-domaine
// d'UNE pharmacie précise (dupont.localhost, martin.localhost...) -- visiteur anonyme ou
// client déjà connecté. C'est une vitrine d'accueil pour CETTE pharmacie, pas un tableau de
// bord personnel (ça, c'est le rôle de /profil et /commandes). Reconstruit sur le même
// langage visuel immersif que le hero du site marketing (pharmacie-marketing/components/Hero.tsx)
// -- fond bg-brand-deep, halos, tracé ECG, révélation du titre mot par mot -- pour que la
// transition site vitrine -> app ne se voie pas, plutôt que le fond clair "écran de
// paramètres" qu'avait la version précédente.
const messages = [
  { icon: Pill, texte: "Commandez vos médicaments en ligne, retirez en pharmacie" },
  { icon: Truck, texte: "Suivez votre commande en temps réel, du panier au retrait" },
  { icon: Smartphone, texte: "Payez par Orange Money ou MTN MoMo, vérifié par la pharmacie" },
];

export default function HomePage() {
  const router = useRouter();
  const [statutSession, setStatutSession] = useState<'verification' | 'visiteur' | 'client'>('verification');
  const [prenomClient, setPrenomClient] = useState<string | null>(null);
  const [messageIndex, setMessageIndex] = useState(0);

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
  }, [router]);

  useEffect(() => {
    const timer = setInterval(() => setMessageIndex((i) => (i + 1) % messages.length), 3800);
    return () => clearInterval(timer);
  }, []);

  // Rien à afficher pendant la vérification de session -- évite un flash de l'accueil avant
  // la redirection pour un membre du personnel déjà connecté.
  if (statutSession === 'verification') {
    return <div className="min-h-screen bg-brand-deep" />;
  }

  const MessageIcon = messages[messageIndex].icon;
  const estClient = statutSession === 'client';

  return (
    <div className="relative min-h-screen w-full bg-brand-deep overflow-hidden flex flex-col">
      {/* 🌿 Même langage visuel que le hero du site marketing : halos flous + tracé ECG
          discret en fond -- une pharmacie n'est pas une app générique, ce motif le rappelle
          sans être appuyé. */}
      <motion.div
        aria-hidden
        animate={{ opacity: [0.5, 0.75, 0.5] }}
        transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
        className="pointer-events-none absolute -top-32 left-1/2 h-[420px] w-[420px] -translate-x-1/2 rounded-full bg-emerald-500/25 blur-[100px]"
      />
      <div className="pointer-events-none absolute top-1/3 -right-24 h-[340px] w-[340px] rounded-full bg-blue-500/15 blur-[100px]" />
      <div className="pointer-events-none absolute left-0 right-0 top-[22%] opacity-40">
        <PulseLine className="w-full h-16" stroke="#67d29e" width={480} height={80} />
      </div>

      <div className="relative z-10 flex-grow flex flex-col items-center justify-center px-6 py-16">
        <div className="w-full max-w-md text-center">

          {/* 🟢 Badge de confiance discret -- vrai (l'app tourne bel et bien), pas un chiffre
              inventé. Reprend le motif du site marketing (point qui pulse + libellé). */}
          <motion.span
            initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-[11px] font-mono uppercase tracking-[0.15em] text-emerald-300 mb-8"
          >
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
            </span>
            Pharmacie en ligne
          </motion.span>

          <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            <div className="relative inline-block mb-6">
              <motion.div
                animate={{ scale: [1, 1.1, 1], opacity: [0.35, 0.55, 0.35] }}
                transition={{ duration: 3.2, repeat: Infinity, ease: 'easeInOut' }}
                className="absolute inset-0 bg-emerald-400/40 rounded-[2rem] blur-xl"
              />
              <div className="relative h-24 w-24 bg-white rounded-[2rem] flex items-center justify-center shadow-2xl shadow-black/20 mx-auto p-4">
                <PharmacyIcon className="w-full h-full object-cover" alt="Pharmacie+" />
              </div>
            </div>

            {/* 👋 Pour un client connu : accueil personnel en guise de titre. Pour un
                visiteur : la promesse de l'app, pas juste le nom déjà lisible sur le logo
                juste au-dessus -- éviter la répétition inutile. */}
            <h1 className="font-display text-3xl font-bold text-white tracking-tight leading-tight">
              {estClient
                ? (prenomClient ? <>Bon retour, {prenomClient}</> : 'Bon retour parmi nous')
                : <>Vos médicaments,<br />à portée de main</>}
            </h1>
            <p className="text-white/50 text-sm mt-2 flex items-center justify-center gap-1.5">
              <PharmacyBrandName /> · Votre santé, notre priorité
            </p>
          </motion.div>

          {/* 💬 Message tournant -- 3 capacités réelles de l'app, pas des slogans creux */}
          <motion.div
            initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
            className="bg-white/[0.06] border border-white/10 rounded-[28px] p-6 mt-8 backdrop-blur-sm min-h-[104px] flex items-center"
          >
            <AnimatePresence mode="wait">
              <motion.div
                key={messageIndex}
                initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }}
                transition={{ duration: 0.35 }}
                className="flex items-center gap-4 text-left"
              >
                <div className="h-11 w-11 shrink-0 rounded-2xl bg-emerald-400/15 flex items-center justify-center text-emerald-300">
                  <MessageIcon size={20} />
                </div>
                <p className="text-sm font-medium text-white/80 leading-snug">
                  {messages[messageIndex].texte}
                </p>
              </motion.div>
            </AnimatePresence>
          </motion.div>

          <div className="flex justify-center gap-1.5 mt-4">
            {messages.map((_, i) => (
              <span key={i} className={`h-1.5 rounded-full transition-all ${i === messageIndex ? 'w-5 bg-emerald-400' : 'w-1.5 bg-white/20'}`} />
            ))}
          </div>

          {/* 🎯 ACTIONS -- cibles tactiles 44px+, retour au toucher, pas de survol requis.
              Le catalogue est accessible SANS connexion (core/api.py::api_catalogue,
              AllowAny) : c'est donc l'action principale pour tout le monde, visiteur ou
              client -- la vraie porte d'entrée, pas la connexion. */}
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="mt-8 space-y-3">
            <Link
              href="/catalogue"
              className="w-full bg-emerald-500 hover:bg-emerald-400 text-white font-semibold text-sm py-4 rounded-2xl no-underline flex items-center justify-center gap-2 transition-all active:scale-[0.98] shadow-[0_0_30px_-6px_rgba(16,185,129,0.5)]"
            >
              <Pill size={18} /> Parcourir le catalogue
            </Link>

            {estClient ? (
              <div className="grid grid-cols-2 gap-3">
                <Link href="/panier" className="no-underline bg-white/[0.06] border border-white/10 rounded-2xl py-4 flex items-center justify-center gap-2 text-white/80 font-semibold text-sm active:scale-[0.98] transition-all">
                  <ShoppingCart size={17} /> Mon panier
                </Link>
                <Link href="/commandes" className="no-underline bg-white/[0.06] border border-white/10 rounded-2xl py-4 flex items-center justify-center gap-2 text-white/80 font-semibold text-sm active:scale-[0.98] transition-all">
                  <ClipboardList size={17} /> Commandes
                </Link>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <Link
                  href="/login"
                  className="w-full bg-white/[0.06] hover:bg-white/[0.1] text-white border border-white/10 font-semibold text-sm py-4 rounded-2xl no-underline flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
                >
                  <LogIn size={17} /> Connexion
                </Link>
                <Link
                  href="/register"
                  className="w-full bg-white/[0.06] hover:bg-white/[0.1] text-white border border-white/10 font-semibold text-sm py-4 rounded-2xl no-underline flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
                >
                  <UserPlus size={17} /> Créer un compte
                </Link>
              </div>
            )}
          </motion.div>

          <motion.p
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.45 }}
            className="flex items-center justify-center gap-1.5 text-xs font-medium text-white/40 mt-6"
          >
            <ShieldCheck size={14} className="text-emerald-400" /> Vos données sont sécurisées avec nous
          </motion.p>
        </div>
      </div>
    </div>
  );
}
