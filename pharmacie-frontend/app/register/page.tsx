"use client";
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { User, UserCheck, Phone, Key, ArrowRightCircle, LogIn, Loader2 } from 'lucide-react';
import Link from 'next/link';
import apiClient from '../../lib/apiClient';
import { useRouter } from 'next/navigation';
import { PharmacyIcon } from '../../components/PharmacyIcon';


export default function RegisterPage() {
  const router = useRouter();

  // --- LOGIQUE D'ÉTAT ---
  // 🌍 CompteClient (marketplace globale) s'identifie par email, pas par un nom
  // d'utilisateur choisi -- voir clients_publics/models.py.
  const [formData, setFormData] = useState({
    email: '',
    nom: '',
    telephone: '',
    password: ''
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // --- GESTION DES SAISIES ---
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  // --- ENVOI AU BACKEND ---
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // 1. Création du compte client global (CompteClient, schéma public)
      const res = await apiClient.post(`/api/client/register/`, formData);
      
      if (res.status === 201) {
        
        // 2. 🛰️ STRATÉGIE AUTO-LOGIN : On connecte automatiquement le client dans la foulée
        try {
          const loginRes = await apiClient.post(`/api/client/login/`, {
            email: formData.email,
            password: formData.password,
          });

          if (loginRes.status === 200) {
            // Stockage impératif des jetons de sécurité JWT pour Next.js
            localStorage.setItem('access_token', loginRes.data.access);
            localStorage.setItem('refresh_token', loginRes.data.refresh);
            
            // Profil utilisateur
            localStorage.setItem('user_role', 'client');
            localStorage.setItem('username', loginRes.data.nom);
            localStorage.setItem('display_name', loginRes.data.nom);
            
            // Redirection fluide et synchronisée vers le catalogue
            window.location.href = '/';
          }
        } catch (loginErr) {
          // Si l'auto-login échoue exceptionnellement, on redirige vers le login manuel
          window.location.href = '/login';
        }
      }
    } catch (err: any) {
      // 🕵️ DÉCODAGE DES ERREURS VALIDATEURS : Gère les dictionnaires d'erreurs DRF
      const backendErrors = err.response?.data;
      if (backendErrors && typeof backendErrors === 'object') {
        // Si Django renvoie une erreur sur un champ spécifique (ex: password ou telephone)
        const premierChamp = Object.keys(backendErrors)[0];
        const messageErreur = backendErrors[premierChamp];
        setError(`${premierChamp.toUpperCase()} : ${Array.isArray(messageErreur) ? messageErreur[0] : messageErreur}`);
      } else {
        setError(backendErrors?.error || "Une erreur est survenue lors de l'inscription.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen w-full flex items-center justify-center overflow-hidden bg-[radial-gradient(circle_at_center,_#1a4d2e_0%,_#0a1f13_100%)]">
      
      <motion.div 
        animate={{ y: [0, -1000] }}
        transition={{ duration: 100, repeat: Infinity, ease: "linear" }}
        className="absolute inset-0 opacity-10 pointer-events-none"
        style={{ backgroundImage: 'radial-gradient(white 1px, transparent 1px)', backgroundSize: '50px 50px' }}
      />

      <div className="relative z-10 w-full max-w-lg px-6 py-12">
        
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-10">
          <div className="h-24 w-24 bg-white rounded-[2rem] flex items-center justify-center shadow-2xl relative border-2 border-emerald-400 mx-auto p-4">
            {/* 🔧 FIX LOGO (bug remonté en test, session du 19/07) : même correctif que
                app/layout.tsx, app/admin/layout.tsx et app/login/page.tsx. */}
            <PharmacyIcon className="w-full h-full object-contain" alt="Pharmacie+" />
          </div>
          <h1 className="text-5xl font-black text-white tracking-tighter italic uppercase mt-4">Pharmacie +</h1>
          <p className="text-emerald-400 text-[10px] font-black uppercase tracking-[0.4em] mt-3">Ouverture de Dossier Client 🛰️</p>
        </motion.div>

        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-[3rem] p-10 shadow-2xl">
          
          <AnimatePresence>
            {error && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} className="mb-6 p-4 bg-red-500/20 border border-red-500/50 rounded-2xl text-red-200 text-[10px] font-black uppercase text-center">
                {error}
              </motion.div>
            )}
          </AnimatePresence>

          <form className="space-y-6" onSubmit={handleSubmit}>
            
            <div className="relative group">
              <User className="absolute left-5 top-1/2 -translate-y-1/2 text-white/30 group-focus-within:text-emerald-400" size={20} />
              <input required name="email" type="email" placeholder="Adresse email" value={formData.email} onChange={handleChange} className="w-full bg-white/5 border border-white/10 rounded-2xl py-5 pl-14 pr-6 text-white font-bold focus:outline-none focus:border-emerald-500 transition-all shadow-inner"/>
            </div>

            <div className="relative group">
              <UserCheck className="absolute left-5 top-1/2 -translate-y-1/2 text-white/30 group-focus-within:text-emerald-400" size={20} />
              <input required name="nom" type="text" placeholder="Nom complet" value={formData.nom} onChange={handleChange} className="w-full bg-white/5 border border-white/10 rounded-2xl py-5 pl-14 pr-6 text-white font-bold focus:outline-none focus:border-emerald-500 transition-all shadow-inner"/>
            </div>

            <div className="relative group">
              <Phone className="absolute left-5 top-1/2 -translate-y-1/2 text-white/30 group-focus-within:text-emerald-400" size={20} />
              <input required name="telephone" type="tel" placeholder="Numéro de téléphone" value={formData.telephone} onChange={handleChange} className="w-full bg-white/5 border border-white/10 rounded-2xl py-5 pl-14 pr-6 text-white font-bold focus:outline-none focus:border-emerald-500 transition-all shadow-inner"/>
            </div>

            <div className="relative group">
              <Key className="absolute left-5 top-1/2 -translate-y-1/2 text-white/30 group-focus-within:text-emerald-400" size={20} />
              <input required name="password" type="password" placeholder="Mot de passe" value={formData.password} onChange={handleChange} className="w-full bg-white/5 border border-white/10 rounded-2xl py-5 pl-14 pr-6 text-white font-bold focus:outline-none focus:border-emerald-500 transition-all shadow-inner"/>
            </div>

            <div className="pt-6">
              <motion.button 
                type="submit"
                disabled={loading}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-black py-6 rounded-[2rem] shadow-2xl flex justify-between items-center px-12 transition-all border-none cursor-pointer group disabled:opacity-50"
              >
                <span className="text-xs uppercase tracking-[0.2em]">
                  {loading ? "Traitement en cours..." : "Créer mon compte"}
                </span>
                {loading ? <Loader2 className="animate-spin" /> : <ArrowRightCircle className="group-hover:translate-x-2 transition-transform" />}
              </motion.button>
            </div>
          </form>

          <div className="mt-10 text-center border-t border-white/10 pt-8">
            <Link href="/login" className="inline-flex items-center gap-2 text-emerald-400 font-black no-underline uppercase tracking-[0.2em] text-[10px] hover:text-white transition-all">
              <LogIn size={14} /> Retour au Portail de connexion 🛰️
            </Link>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
