"use client";
import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  User, ShoppingCart, ClipboardList, FileText, Lock, ShieldCheck,
  Loader2, ChevronRight, LogOut, Eye, EyeOff, CheckCircle2
} from 'lucide-react';
import Link from 'next/link';
import apiClient from '../../lib/apiClient';
import Prix from '../../lib/components/Prix';

interface ProfilData {
  email: string;
  nom: string;
  telephone: string | null;
  identifiant: string;
  nb_commandes: number;
  montant_total_depense: number;
}

// 🚀 REFONTE UI/UX (18/07) : page "Mon profil" -- comble le trou identifié dans l'audit
// (aucune zone personnelle pour le client). Mobile-first, calquée sur l'image 4 des
// maquettes fournies -- MAIS avec un principe strict : chaque tuile affichée doit renvoyer
// vers quelque chose de RÉEL. "Points fidélité", "Favoris", "Adresses" et "Support" existent
// dans la maquette mais n'ont aucun modèle de données ni endpoint derrière aujourd'hui --
// plutôt que de les simuler avec des données inventées, elles sont marquées "Bientôt
// disponible" (visibles, désactivées) le temps que ces fonctionnalités soient réellement
// construites.
export default function MonProfil() {
  const [data, setData] = useState<ProfilData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editNom, setEditNom] = useState('');
  const [editTelephone, setEditTelephone] = useState('');
  const [messageProfil, setMessageProfil] = useState<{ type: 'ok' | 'erreur'; texte: string } | null>(null);

  const [afficherMdp, setAfficherMdp] = useState(false);
  const [ancienMdp, setAncienMdp] = useState('');
  const [nouveauMdp, setNouveauMdp] = useState('');
  const [voirMdp, setVoirMdp] = useState(false);
  const [savingMdp, setSavingMdp] = useState(false);
  const [messageMdp, setMessageMdp] = useState<{ type: 'ok' | 'erreur'; texte: string } | null>(null);

  const fetchProfil = async () => {
    try {
      const res = await apiClient.get('/api/v1/client/me/');
      setData(res.data);
      setEditNom(res.data.nom);
      setEditTelephone(res.data.telephone || '');
    } catch (err) {
      console.error('Erreur chargement profil:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchProfil(); }, []);

  const handleEnregistrerProfil = async () => {
    setSaving(true);
    setMessageProfil(null);
    try {
      const res = await apiClient.patch('/api/v1/client/me/', { nom: editNom, telephone: editTelephone });
      setData(res.data);
      setMessageProfil({ type: 'ok', texte: 'Informations mises à jour ✅' });
    } catch (err: any) {
      setMessageProfil({ type: 'erreur', texte: err.response?.data?.error || "Échec de la mise à jour." });
    } finally {
      setSaving(false);
    }
  };

  const handleChangerMdp = async () => {
    setSavingMdp(true);
    setMessageMdp(null);
    try {
      await apiClient.post('/api/v1/client/changer-mot-de-passe/', {
        ancien_mot_de_passe: ancienMdp,
        nouveau_mot_de_passe: nouveauMdp,
      });
      setMessageMdp({ type: 'ok', texte: 'Mot de passe mis à jour ✅' });
      setAncienMdp(''); setNouveauMdp('');
    } catch (err: any) {
      setMessageMdp({ type: 'erreur', texte: err.response?.data?.error || "Échec du changement de mot de passe." });
    } finally {
      setSavingMdp(false);
    }
  };

  const handleDeconnexion = () => {
    localStorage.clear();
    window.location.href = '/login';
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
        <Loader2 className="animate-spin text-emerald-500" size={40} />
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-16">
      <div className="max-w-md md:max-w-2xl mx-auto px-5 pt-6">

        {/* 🟢 BANNIÈRE (mobile-first, largeur pleine, s'élargit simplement sur desktop) */}
        <motion.div
          initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-br from-emerald-600 to-emerald-500 rounded-3xl p-6 text-white relative overflow-hidden"
        >
          <div className="absolute -right-6 -top-6 w-28 h-28 rounded-full bg-white/10" />
          <div className="absolute right-10 bottom-0 w-16 h-16 rounded-full bg-white/10" />
          <div className="relative flex items-center gap-3 mb-5">
            <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center shrink-0">
              <User size={24} />
            </div>
            <div className="min-w-0">
              <p className="text-emerald-50 text-xs font-bold uppercase tracking-wide">Bonjour 👋</p>
              <h1 className="text-lg font-black truncate">{data.nom}</h1>
            </div>
          </div>
          <div className="relative grid grid-cols-2 gap-3">
            <div className="bg-white/15 rounded-2xl px-4 py-3">
              <p className="text-2xl font-black">{data.nb_commandes}</p>
              <p className="text-[11px] font-semibold text-emerald-50">Commande{data.nb_commandes > 1 ? 's' : ''} ici</p>
            </div>
            <div className="bg-white/15 rounded-2xl px-4 py-3">
              <p className="text-2xl font-black"><Prix montant={data.montant_total_depense} /></p>
              <p className="text-[11px] font-semibold text-emerald-50">Dépensé ici</p>
            </div>
          </div>
          <p className="relative text-[10px] text-emerald-50/80 mt-3 italic">
            Ces chiffres concernent uniquement cette pharmacie.
          </p>
        </motion.div>

        {/* 🧭 ESPACE CLIENT — liens réels vers panier/commandes/factures */}
        <div className="grid grid-cols-3 gap-3 mt-5">
          <Link href="/panier" className="no-underline bg-white dark:bg-slate-900 rounded-2xl p-4 flex flex-col items-center gap-2 border border-slate-100 dark:border-slate-800 hover:border-emerald-300 dark:hover:border-emerald-700 transition-colors">
            <ShoppingCart size={20} className="text-emerald-500" />
            <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300 text-center">Mon panier</span>
          </Link>
          <Link href="/commandes" className="no-underline bg-white dark:bg-slate-900 rounded-2xl p-4 flex flex-col items-center gap-2 border border-slate-100 dark:border-slate-800 hover:border-emerald-300 dark:hover:border-emerald-700 transition-colors">
            <ClipboardList size={20} className="text-emerald-500" />
            <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300 text-center">Mes commandes</span>
          </Link>
          <Link href="/commandes" className="no-underline bg-white dark:bg-slate-900 rounded-2xl p-4 flex flex-col items-center gap-2 border border-slate-100 dark:border-slate-800 hover:border-emerald-300 dark:hover:border-emerald-700 transition-colors">
            <FileText size={20} className="text-emerald-500" />
            <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300 text-center">Mes factures</span>
          </Link>
        </div>

        {/* 📝 INFORMATIONS PERSONNELLES */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 mt-5 border border-slate-100 dark:border-slate-800">
          <h2 className="font-black text-sm text-slate-800 dark:text-white uppercase tracking-wide mb-4">Informations personnelles</h2>

          <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wide mb-1.5">Nom complet</label>
          <input
            value={editNom} onChange={(e) => setEditNom(e.target.value)}
            className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm font-medium text-slate-800 dark:text-white mb-4 outline-none focus:border-emerald-400"
          />

          <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wide mb-1.5">Téléphone</label>
          <input
            value={editTelephone} onChange={(e) => setEditTelephone(e.target.value)}
            placeholder="Ex: 690 00 00 00"
            className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm font-medium text-slate-800 dark:text-white mb-4 outline-none focus:border-emerald-400"
          />

          <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wide mb-1.5">Email (identifiant de connexion)</label>
          <div className="w-full bg-slate-100 dark:bg-slate-800/50 rounded-xl px-4 py-3 text-sm font-medium text-slate-400 mb-4">
            {data.email} <span className="text-[10px] italic">— non modifiable</span>
          </div>

          {messageProfil && (
            <p className={`text-xs font-semibold mb-3 ${messageProfil.type === 'ok' ? 'text-emerald-600' : 'text-red-500'}`}>
              {messageProfil.texte}
            </p>
          )}

          <button
            onClick={handleEnregistrerProfil} disabled={saving}
            className="w-full bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white font-black text-xs uppercase tracking-widest py-3.5 rounded-xl border-none cursor-pointer transition-colors"
          >
            {saving ? 'Enregistrement...' : 'Enregistrer'}
          </button>
        </div>

        {/* 🔐 MOT DE PASSE (repliable) */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl mt-5 border border-slate-100 dark:border-slate-800 overflow-hidden">
          <button
            onClick={() => setAfficherMdp(v => !v)}
            className="w-full flex items-center justify-between p-6 bg-transparent border-none cursor-pointer"
          >
            <span className="flex items-center gap-3 font-black text-sm text-slate-800 dark:text-white uppercase tracking-wide">
              <Lock size={18} className="text-emerald-500" /> Mot de passe
            </span>
            <ChevronRight size={18} className={`text-slate-400 transition-transform ${afficherMdp ? 'rotate-90' : ''}`} />
          </button>
          {afficherMdp && (
            <div className="px-6 pb-6">
              <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wide mb-1.5">Mot de passe actuel</label>
              <div className="relative mb-4">
                <input
                  type={voirMdp ? 'text' : 'password'} value={ancienMdp} onChange={(e) => setAncienMdp(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 pr-11 text-sm font-medium text-slate-800 dark:text-white outline-none focus:border-emerald-400"
                />
                <button type="button" onClick={() => setVoirMdp(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 bg-transparent border-none cursor-pointer text-slate-400">
                  {voirMdp ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wide mb-1.5">Nouveau mot de passe (8 caractères min.)</label>
              <input
                type={voirMdp ? 'text' : 'password'} value={nouveauMdp} onChange={(e) => setNouveauMdp(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm font-medium text-slate-800 dark:text-white mb-4 outline-none focus:border-emerald-400"
              />
              {messageMdp && (
                <p className={`text-xs font-semibold mb-3 ${messageMdp.type === 'ok' ? 'text-emerald-600' : 'text-red-500'}`}>
                  {messageMdp.texte}
                </p>
              )}
              <button
                onClick={handleChangerMdp} disabled={savingMdp || !ancienMdp || nouveauMdp.length < 8}
                className="w-full bg-slate-800 dark:bg-white hover:opacity-90 disabled:opacity-40 text-white dark:text-slate-900 font-black text-xs uppercase tracking-widest py-3.5 rounded-xl border-none cursor-pointer transition-opacity"
              >
                {savingMdp ? 'Mise à jour...' : 'Changer le mot de passe'}
              </button>
            </div>
          )}
        </div>

        {/* 🛡️ BANNIÈRE SÉCURITÉ */}
        <div className="bg-emerald-50 dark:bg-emerald-500/10 rounded-3xl p-5 mt-5 flex items-center gap-4">
          <ShieldCheck size={28} className="text-emerald-500 shrink-0" />
          <div>
            <p className="font-black text-xs text-slate-800 dark:text-white uppercase">Paiement vérifié</p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">Chaque paiement mobile money est contrôlé manuellement par la pharmacie avant validation.</p>
          </div>
        </div>

        {/* 🚧 ACCÈS RAPIDE — honnête : seulement ce qui existe vraiment */}
        <div className="grid grid-cols-4 gap-3 mt-5">
          {[
            { label: 'Support', dispo: false },
            { label: 'Adresses', dispo: false },
            { label: 'Favoris', dispo: false },
            { label: 'Paramètres', dispo: false },
          ].map((item) => (
            <div key={item.label} className="bg-slate-100 dark:bg-slate-900 rounded-2xl p-3 flex flex-col items-center gap-1.5 opacity-50 cursor-not-allowed">
              <CheckCircle2 size={16} className="text-slate-400" />
              <span className="text-[10px] font-bold text-slate-400 text-center leading-tight">{item.label}</span>
              <span className="text-[8px] text-slate-400 uppercase tracking-wide">Bientôt</span>
            </div>
          ))}
        </div>

        <button
          onClick={handleDeconnexion}
          className="w-full flex items-center justify-center gap-2 mt-6 py-3.5 rounded-xl border border-red-200 dark:border-red-900/40 bg-transparent text-red-500 font-black text-xs uppercase tracking-widest cursor-pointer hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
        >
          <LogOut size={16} /> Déconnexion
        </button>

      </div>
    </div>
  );
}
