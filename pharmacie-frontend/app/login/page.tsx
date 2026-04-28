"use client";
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  User, Wallet, Shield, AtSign, 
  Key, Eye, EyeOff, ArrowRight, Sparkles 
} from 'lucide-react';
import Link from 'next/link';
import axios from 'axios';

// Configuration de l'URL Backend
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://mw69zhwz-8000.uks1.devtunnels.ms';

export default function LoginPage() {
  // --- STATES LOGIQUE ---
  const [role, setRole] = useState('client');
  const [showPass, setShowPass] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const roles = [
    { id: 'client', label: 'Client', icon: <User size={20} /> },
    { id: 'caissiere', label: 'Caisse', icon: <Wallet size={20} /> },
    { id: 'admin', label: 'Admin', icon: <Shield size={20} /> },
  ];

  // --- FONCTION DE CONNEXION MODIFIÉE POUR LE REFRESH DU LAYOUT ---
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await axios.post(`${API_URL}/api/login/`, {
        username: username,
        password: password,
        role: role 
      });

      if (response.status === 200) {
        // Stockage des infos de base
        localStorage.setItem('user_role', response.data.role);
        localStorage.setItem('username', response.data.user);
        
        // EMPLACEMENT MODIFIÉ : Utilisation de window.location pour forcer RootLayout à se mettre à jour
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
    <div className="relative min-h-screen w-full flex items-center justify-center overflow-hidden bg-[radial-gradient(circle_at_center,_#1a4d2e_0%,_#0a1f13_100%)]">
      
      {/* ✨ ÉTOILES ANIMÉES (Framer Motion) */}
      <motion.div 
        animate={{ y: [0, -1000] }}
        transition={{ duration: 120, repeat: Infinity, ease: "linear" }}
        className="absolute inset-0 opacity-10 pointer-events-none"
        style={{ backgroundImage: 'radial-gradient(white 1px, transparent 1px)', backgroundSize: '60px 60px' }}
      />

      <div className="relative z-10 w-full max-w-md px-6">
        
        {/* 🏥 LOGO & IDENTITÉ */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center mb-10"
        >
          <div className="relative inline-block mb-6">
            <div className="absolute inset-0 bg-emerald-500 rounded-full blur-3xl opacity-30 animate-pulse" />
            <div className="h-20 w-20 bg-emerald-600 rounded-full flex items-center justify-center text-white text-3xl font-black shadow-[0_0_30px_rgba(16,185,129,0.4)] relative border-2 border-emerald-400 mx-auto">
              P+
            </div>
          </div>
          <h1 className="text-4xl font-black text-white tracking-tighter italic uppercase">Pharmacie +</h1>
          <p className="text-emerald-400 text-[10px] font-black uppercase tracking-[0.4em] mt-3">Portail d'Accès Sécurisé 🛰️</p>
        </motion.div>

        {/* 🛡️ GLASS CARD */}
        <motion.div 
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-[3rem] p-10 shadow-[0_25px_50px_-12px_rgba(0,0,0,0.5)]"
        >
          <h2 className="text-2xl font-black text-white mb-8 italic tracking-tight">Connexion 🔐</h2>

          {/* AFFICHAGE DES ERREURS BACKEND */}
          <AnimatePresence>
            {error && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="mb-6 p-4 bg-red-500/20 border border-red-500/50 rounded-2xl text-red-200 text-[10px] font-black uppercase tracking-widest text-center"
              >
                {error}
              </motion.div>
            )}
          </AnimatePresence>

          <form className="space-y-6" onSubmit={handleSubmit}>
            
            {/* 🎭 SÉLECTEUR DE RÔLE */}
            <div className="space-y-3">
              <label className="text-[10px] font-black text-white/40 uppercase tracking-widest block ml-2">Choisissez votre accès 🎫</label>
              <div className="grid grid-cols-3 gap-3">
                {roles.map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => setRole(r.id)}
                    className={`flex flex-col items-center justify-center p-4 rounded-2xl border transition-all duration-300 group
                      ${role === r.id 
                        ? 'bg-emerald-500/20 border-emerald-500 text-white scale-105 shadow-[0_0_15px_rgba(16,185,129,0.2)]' 
                        : 'bg-white/5 border-white/10 text-white/40 hover:bg-white/10'}`}
                  >
                    <span className={`mb-2 transition-transform duration-300 ${role === r.id ? 'scale-110' : ''}`}>
                      {r.icon}
                    </span>
                    <span className="text-[9px] font-black uppercase tracking-tighter">{r.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* 👤 IDENTIFIANT */}
            <div className="relative group">
              <AtSign className="absolute left-5 top-1/2 -translate-y-1/2 text-white/20 group-focus-within:text-emerald-400 transition-colors" size={18} />
              <input 
                required
                type="text" 
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Nom d'utilisateur"
                className="w-full bg-white/5 border border-white/10 rounded-2xl py-5 pl-14 pr-6 text-white font-bold placeholder:text-white/20 focus:outline-none focus:border-emerald-500 transition-all shadow-inner"
              />
            </div>

            {/* 🛡️ MOT DE PASSE */}
            <div className="relative group">
              <Key className="absolute left-5 top-1/2 -translate-y-1/2 text-white/20 group-focus-within:text-emerald-400 transition-colors" size={18} />
              <input 
                required
                type={showPass ? "text" : "password"} 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Mot de passe"
                className="w-full bg-white/5 border border-white/10 rounded-2xl py-5 pl-14 pr-14 text-white font-bold placeholder:text-white/20 focus:outline-none focus:border-emerald-500 transition-all shadow-inner"
              />
              <button 
                type="button"
                onClick={() => setShowPass(!showPass)}
                className="absolute right-5 top-1/2 -translate-y-1/2 text-white/20 hover:text-white transition-colors border-none bg-transparent cursor-pointer"
              >
                {showPass ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>

            {/* 🚀 BOUTON D'ACCÈS */}
            <div className="pt-4">
              <motion.button 
                type="submit"
                disabled={loading}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-black py-6 rounded-[2rem] shadow-2xl shadow-emerald-950/50 flex justify-between items-center px-12 transition-all border-none cursor-pointer group disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span className="text-xs uppercase tracking-[0.2em]">
                  {loading ? "Vérification..." : "Accéder au système"}
                </span>
                <ArrowRight className="group-hover:translate-x-2 transition-transform" />
              </motion.button>
            </div>
          </form>

          {/* 🔗 INSCRIPTION */}
          <div className="mt-10 text-center border-t border-white/10 pt-8">
            <Link href="/register" className="text-white/40 hover:text-emerald-400 text-[10px] font-black uppercase tracking-[0.3em] no-underline transition-all flex items-center justify-center gap-2">
              Créer un nouveau profil <Sparkles size={12} />
            </Link>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
