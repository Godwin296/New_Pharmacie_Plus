"use client";
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  User, Wallet, Shield, AtSign,
  Key, Eye, EyeOff, ArrowRight, Check, ShieldCheck, RadioTower, WifiOff, Users, AlertCircle
} from 'lucide-react';
import Link from 'next/link';
import apiClient from '../../lib/apiClient';
import { PharmacyIcon } from '../../components/PharmacyIcon';

// 🎨 REFONTE UI/UX (30/07) : l'écran précédent (fond "vaisseau spatial" en dégradé radial
// + étoiles qui défilent + majuscules-italique-tracking-large partout + emojis 🛰️🎫🔐✨)
// détonnait complètement avec le reste de la marque -- ni le ton du site marketing, ni les
// maquettes réelles (fond clair, cartes de rôle empilées) n'y ressemblaient. Reconstruit ici
// à partir de la maquette "Bienvenue !" fournie : fond clair, cartes de rôle lisibles au
// pouce, ton posé.
const roles = [
  { id: 'client', label: 'Client', desc: 'Achetez vos médicaments en ligne en toute sécurité', icon: User },
  { id: 'caissiere', label: 'Caisse', desc: 'Gérez les ventes au guichet', icon: Wallet },
  { id: 'admin', label: 'Administrateur', desc: 'Accédez au tableau de bord et à la gestion', icon: Shield },
];

// Badges de confiance -- uniquement des capacités réellement vérifiées dans le code
// (pas de promesse type "Support 24/7" non confirmée côté produit).
const trustBadges = [
  { icon: ShieldCheck, label: 'Sécurisé' },
  { icon: RadioTower, label: 'Synchronisé' },
  { icon: WifiOff, label: 'Hors-ligne' },
  { icon: Users, label: 'Multi-comptes' },
];

export default function LoginPage() {
  const [role, setRole] = useState('client');
  const [showPass, setShowPass] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // --- FONCTION DE CONNEXION SÉCURISÉE AVEC CAPTURE JWT (logique inchangée) ---
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // 🌍 CompteClient (marketplace globale) utilise un endpoint et une identité (email)
      // distincts du personnel -- voir core/authentication.py (ClientJWTAuthentication).
      if (role === 'client') {
        const response = await apiClient.post(`/api/client/login/`, {
          email: username,
          password: password,
        });

        if (response.status === 200) {
          localStorage.setItem('access_token', response.data.access);
          localStorage.setItem('refresh_token', response.data.refresh);
          localStorage.setItem('user_role', 'client');
          localStorage.setItem('username', response.data.nom);
          localStorage.setItem('display_name', response.data.nom);
          window.location.href = '/';
        }
        return;
      }

      const response = await apiClient.post(`/api/login/`, {
        username: username,
        password: password,
        role: role
      });

      if (response.status === 200) {
        // 🔐 CAPTURE DES JETONS JWT REÇUS DU BACKEND DJANGO
        localStorage.setItem('access_token', response.data.access);
        localStorage.setItem('refresh_token', response.data.refresh);
        localStorage.setItem('user_role', response.data.role);
        localStorage.setItem('username', response.data.user);
        localStorage.setItem('display_name', response.data.display_name || response.data.user);

        if (response.data.role === 'admin') {
          window.location.href = '/admin/dashboard';
        } else if (response.data.role === 'caissiere') {
          window.location.href = '/caisse/pos';
        } else {
          window.location.href = '/';
        }
      }
    } catch (err: any) {
      const msg = err.response?.data?.error || "Identifiants invalides ou erreur réseau";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen w-full bg-[var(--color-mist)] dark:bg-[#050e0c] overflow-hidden">
      {/* 🌿 Décor discret -- masses lumineuses très douces, cohérentes avec le reste de
          l'app (émeraude + bleu), sans grille d'étoiles ni gimmick sci-fi. */}
      <div className="absolute -top-24 -left-16 w-72 h-72 rounded-full bg-emerald-300/20 dark:bg-emerald-500/10 blur-[90px] pointer-events-none" />
      <div className="absolute top-1/3 -right-20 w-72 h-72 rounded-full bg-blue-300/15 dark:bg-blue-500/10 blur-[90px] pointer-events-none" />

      <div className="relative z-10 min-h-screen flex flex-col items-center justify-center px-6 py-12">
        <div className="w-full max-w-md">

          {/* 🏥 LOGO & IDENTITÉ */}
          <motion.div
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mb-8"
          >
            <div className="relative inline-block mb-5">
              <motion.div
                animate={{ scale: [1, 1.1, 1], opacity: [0.3, 0.5, 0.3] }}
                transition={{ duration: 3.2, repeat: Infinity, ease: 'easeInOut' }}
                className="absolute inset-0 bg-emerald-400/40 rounded-[1.75rem] blur-xl"
              />
              <div className="relative h-[4.5rem] w-[4.5rem] bg-white rounded-[1.75rem] flex items-center justify-center shadow-lg shadow-emerald-950/10 mx-auto p-3.5">
                <PharmacyIcon className="w-full h-full object-cover" alt="Pharmacie+" />
              </div>
            </div>
            <h1 className="font-display text-2xl font-bold text-[var(--color-ink,#0b1220)] dark:text-white tracking-tight">Bienvenue !</h1>
            <p className="text-slate-500 dark:text-slate-400 text-sm mt-1.5">Connectez-vous pour accéder à votre espace</p>
          </motion.div>

          {/* 🛡️ CARTE */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-white dark:bg-white/[0.04] border border-slate-100 dark:border-white/10 rounded-[28px] p-6 sm:p-8 shadow-xl shadow-slate-900/5"
          >
            {/* AFFICHAGE DES ERREURS BACKEND */}
            <AnimatePresence>
              {error && (
                <motion.div
                  initial={{ opacity: 0, height: 0, marginBottom: 0 }}
                  animate={{ opacity: 1, height: 'auto', marginBottom: 20 }}
                  exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                  className="flex items-center gap-2.5 p-3.5 bg-red-50 dark:bg-red-500/10 border border-red-100 dark:border-red-500/20 rounded-2xl text-red-600 dark:text-red-400 text-[13px] font-medium overflow-hidden"
                >
                  <AlertCircle size={16} className="shrink-0" />
                  {error}
                </motion.div>
              )}
            </AnimatePresence>

            <form className="space-y-6" onSubmit={handleSubmit}>

              {/* 🎭 SÉLECTEUR DE RÔLE -- cartes empilées (pas une grille serrée en 3 colonnes) :
                  plus lisible, cibles tactiles nettement plus grandes, chaque rôle porte sa
                  propre description au lieu d'un simple libellé de 9px. */}
              <div className="space-y-2.5">
                <label className="text-[13px] font-semibold text-slate-500 dark:text-slate-400 block">Choisissez votre espace</label>
                {roles.map((r) => {
                  const Icon = r.icon;
                  const active = role === r.id;
                  return (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => setRole(r.id)}
                      className={`w-full flex items-center gap-3.5 p-3.5 rounded-2xl border text-left transition-all cursor-pointer ${
                        active
                          ? 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-400'
                          : 'bg-slate-50 dark:bg-white/[0.03] border-transparent hover:border-slate-200 dark:hover:border-white/10'
                      }`}
                    >
                      <div className={`h-11 w-11 rounded-2xl flex items-center justify-center shrink-0 transition-colors ${active ? 'bg-emerald-500 text-white' : 'bg-white dark:bg-white/[0.06] text-slate-400'}`}>
                        <Icon size={20} />
                      </div>
                      <div className="min-w-0 flex-grow">
                        <p className={`text-sm font-semibold ${active ? 'text-emerald-700 dark:text-emerald-300' : 'text-slate-700 dark:text-slate-200'}`}>{r.label}</p>
                        <p className="text-[12px] text-slate-400 dark:text-slate-500 truncate">{r.desc}</p>
                      </div>
                      <div className={`h-5 w-5 rounded-full flex items-center justify-center shrink-0 border-2 transition-colors ${active ? 'bg-emerald-500 border-emerald-500' : 'border-slate-300 dark:border-white/20'}`}>
                        {active && <Check size={12} className="text-white" strokeWidth={3} />}
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* 👤 IDENTIFIANT */}
              <div className="relative">
                <AtSign className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 dark:text-slate-600" size={18} />
                <input
                  required
                  type={role === 'client' ? 'email' : 'text'}
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder={role === 'client' ? 'Adresse email' : "Identifiant"}
                  className="w-full bg-slate-50 dark:bg-white/[0.04] border border-slate-200 dark:border-white/10 rounded-2xl py-3.5 pl-12 pr-4 text-slate-800 dark:text-white text-sm font-medium placeholder:text-slate-400 focus:outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-400 transition-all"
                />
              </div>

              {/* 🔑 MOT DE PASSE */}
              <div className="relative">
                <Key className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 dark:text-slate-600" size={18} />
                <input
                  required
                  type={showPass ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Mot de passe"
                  className="w-full bg-slate-50 dark:bg-white/[0.04] border border-slate-200 dark:border-white/10 rounded-2xl py-3.5 pl-12 pr-12 text-slate-800 dark:text-white text-sm font-medium placeholder:text-slate-400 focus:outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-400 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  aria-label={showPass ? "Masquer le mot de passe" : "Afficher le mot de passe"}
                  className="absolute right-1 top-1/2 -translate-y-1/2 h-11 w-11 flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors border-none bg-transparent cursor-pointer"
                >
                  {showPass ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>

              {/* 🚀 BOUTON D'ACCÈS */}
              <motion.button
                type="submit"
                disabled={loading}
                whileTap={{ scale: 0.97 }}
                className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-semibold text-sm py-4 rounded-2xl shadow-lg shadow-emerald-500/20 flex justify-center items-center gap-2 transition-colors border-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? "Connexion en cours…" : "Se connecter"}
                {!loading && <ArrowRight size={17} />}
              </motion.button>
            </form>

            {/* 🏷️ BADGES DE CONFIANCE */}
            <div className="mt-7 pt-6 border-t border-slate-100 dark:border-white/10 grid grid-cols-4 gap-2">
              {trustBadges.map((b) => {
                const Icon = b.icon;
                return (
                  <div key={b.label} className="flex flex-col items-center gap-1.5 text-center">
                    <Icon size={16} className="text-emerald-500" />
                    <span className="text-[10px] font-medium text-slate-400 dark:text-slate-500 leading-tight">{b.label}</span>
                  </div>
                );
              })}
            </div>

            {/* 🔗 INSCRIPTION */}
            <div className="mt-6 text-center">
              <Link href="/register" className="text-slate-500 dark:text-slate-400 hover:text-emerald-600 text-sm font-medium no-underline transition-colors">
                Pas encore de compte ? <span className="font-semibold text-emerald-600 dark:text-emerald-400">S&apos;inscrire</span>
              </Link>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
