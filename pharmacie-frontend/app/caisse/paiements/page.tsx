"use client";
import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Wallet, Search, CheckCircle2, XCircle, Loader2,
  Wifi, WifiOff, Phone, Hash, PackageCheck, Clock
} from 'lucide-react';

import apiClient from '../../../lib/apiClient';
import Prix from '../../../lib/components/Prix';
import { ReconnectingSocket } from '../../../lib/wsClient';

interface Commande {
  id: number;
  reference: string;
  client_nom: string;
  client_telephone: string;
  moyen_paiement?: string;
  reference_paiement_client?: string;
  total_general: number;
  date: string;
  statut: string;
}

export default function PaiementsPage() {
  const [enAttenteVerification, setEnAttenteVerification] = useState<Commande[]>([]);
  const [aRetirer, setARetirer] = useState<Commande[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [enLigne, setEnLigne] = useState(false);
  const [traitementEnCours, setTraitementEnCours] = useState<number | null>(null);
  const [notification, setNotification] = useState<string | null>(null);
  const socketRef = useRef<ReconnectingSocket | null>(null);

  // 🌟 Chargement initial : les commandes en attente de vérification de paiement viennent
  // du même flux que les ordonnances (statut paiement_a_verifier), donc on les filtre depuis
  // l'historique récent plutôt que de dupliquer une route -- ici on réutilise une approche
  // simple avec deux fetches dédiés et clairs.
  const fetchARetirer = async (query?: string) => {
    try {
      const res = await apiClient.get('/api/commandes-a-retirer/', { params: query ? { q: query } : {} });
      setARetirer(res.data);
    } catch (err) {
      console.error("Erreur chargement commandes à retirer:", err);
    }
  };

  const fetchEnAttenteVerification = async () => {
    try {
      const res = await apiClient.get('/api/paiements-a-verifier/');
      setEnAttenteVerification(res.data);
    } catch (err) {
      console.error("Erreur chargement paiements en attente:", err);
    }
  };

  useEffect(() => {
    Promise.all([fetchARetirer(), fetchEnAttenteVerification()]).finally(() => setLoading(false));

    const socket = new ReconnectingSocket('/ws/ordonnances/');
    socketRef.current = socket;
    socket.onOpen(() => setEnLigne(true));
    socket.onClose(() => setEnLigne(false));

    socket.onMessage((data) => {
      if (data.type === 'nouvelle_demande_paiement') {
        setEnAttenteVerification((prev) => {
          if (prev.some((c) => c.id === data.commande.id)) return prev;
          return [data.commande, ...prev];
        });
        setNotification("💰 Nouvelle référence de paiement à vérifier");
      }
      if (data.type === 'ordonnance_traitee' && data.action === 'paiement_confirme') {
        setEnAttenteVerification((prev) => prev.filter((c) => c.id !== data.commande_id));
        fetchARetirer(search);
        setNotification("✅ Paiement confirmé, commande prête au guichet");
      }
      if (data.type === 'ordonnance_traitee' && data.action === 'retrait_confirme') {
        setARetirer((prev) => prev.filter((c) => c.id !== data.commande_id));
      }
    });

    socket.connect();
    return () => socket.disconnect();
  }, []);

  useEffect(() => {
    if (!notification) return;
    const t = setTimeout(() => setNotification(null), 3000);
    return () => clearTimeout(t);
  }, [notification]);

  useEffect(() => {
    const t = setTimeout(() => fetchARetirer(search), 350);
    return () => clearTimeout(t);
  }, [search]);

  const handleConfirmerPaiement = async (id: number) => {
    setTraitementEnCours(id);
    try {
      await apiClient.post(`/api/commandes/${id}/confirmer-paiement/`);
      setEnAttenteVerification((prev) => prev.filter((c) => c.id !== id));
      fetchARetirer(search);
    } catch (err: any) {
      alert(err.response?.data?.error || "Erreur lors de la confirmation du paiement.");
    } finally {
      setTraitementEnCours(null);
    }
  };

  const handleMarquerRetiree = async (id: number) => {
    setTraitementEnCours(id);
    try {
      await apiClient.post(`/api/commandes/${id}/marquer-retiree/`);
      setARetirer((prev) => prev.filter((c) => c.id !== id));
    } catch (err: any) {
      alert(err.response?.data?.error || "Erreur lors du marquage du retrait.");
    } finally {
      setTraitementEnCours(null);
    }
  };

  if (loading) return (
    <div className="h-screen flex items-center justify-center bg-emerald-50 dark:bg-slate-950">
      <Loader2 className="animate-spin text-emerald-600" size={48} aria-label="Chargement des paiements" />
    </div>
  );

  return (
    <div className="max-w-[1200px] mx-auto pb-20 p-6">

      <AnimatePresence>
        {notification && (
          <motion.div
            initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
            className="fixed top-6 right-6 z-50 bg-slate-900 text-white px-6 py-4 rounded-2xl shadow-2xl text-sm font-bold"
          >
            {notification}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="mb-10 flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
        <div>
          <div className="inline-flex items-center gap-2 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 px-4 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] mb-3">
            <Wallet size={14} /> Caisse
          </div>
          <h2 className="text-4xl font-black text-slate-800 dark:text-white tracking-tighter">
            Paiements &amp; <span className="text-emerald-600">Retraits</span>
          </h2>
          <p className="text-slate-500 dark:text-slate-400 font-medium mt-2 italic flex items-center gap-2 text-sm">
            Vérifiez les paiements mobile money et remettez les commandes au guichet.
            <span className={`inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-widest ${enLigne ? 'text-emerald-500' : 'text-red-400'}`}>
              {enLigne ? <Wifi size={12} /> : <WifiOff size={12} />} {enLigne ? 'Temps réel actif' : 'Reconnexion...'}
            </span>
          </p>
        </div>
      </div>

      {/* 💰 SECTION 1 : Paiements en attente de vérification */}
      <div className="mb-12">
        <h3 className="text-sm font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
          <Clock size={16} className="text-amber-500" /> À vérifier ({enAttenteVerification.length})
        </h3>
        {enAttenteVerification.length === 0 ? (
          <p className="text-slate-400 text-sm italic py-6 text-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800">
            Aucun paiement en attente de vérification.
          </p>
        ) : (
          <div className="space-y-3">
            {enAttenteVerification.map((c) => (
              <motion.div
                key={c.id}
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: -20 }}
                className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-amber-100 dark:border-amber-500/20 flex flex-col md:flex-row md:items-center justify-between gap-4"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-mono text-xs text-slate-400">{c.reference}</span>
                    <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
                      {c.moyen_paiement === 'orange_money' ? '🟠 Orange Money' : c.moyen_paiement === 'mtn_momo' ? '🟡 MTN MoMo' : 'Mobile Money'}
                    </span>
                  </div>
                  <p className="font-bold text-slate-800 dark:text-white">{c.client_nom}</p>
                  <div className="flex items-center gap-4 mt-1 text-[11px] text-slate-400">
                    <span className="flex items-center gap-1"><Phone size={12} /> {c.client_telephone}</span>
                    <span className="flex items-center gap-1 font-mono"><Hash size={12} /> {c.reference_paiement_client}</span>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Prix montant={c.total_general} className="font-black text-emerald-600" />
                  <button
                    disabled={traitementEnCours === c.id}
                    onClick={() => handleConfirmerPaiement(c.id)}
                    className="bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white font-black px-5 py-3 rounded-xl border-none cursor-pointer text-[11px] uppercase tracking-widest flex items-center gap-2"
                  >
                    {traitementEnCours === c.id ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />} Confirmer
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* 📦 SECTION 2 : Commandes payées, prêtes à retirer */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest flex items-center gap-2">
            <PackageCheck size={16} className="text-emerald-500" /> Prêtes au guichet ({aRetirer.length})
          </h3>
        </div>

        <div className="relative mb-4">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher par référence (PHC-2026-...), nom ou téléphone"
            className="w-full pl-12 pr-5 py-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 font-bold text-sm dark:text-white outline-none focus:ring-2 focus:ring-emerald-500"
            aria-label="Rechercher une commande à retirer"
          />
        </div>

        {aRetirer.length === 0 ? (
          <p className="text-slate-400 text-sm italic py-6 text-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800">
            Aucune commande en attente de retrait.
          </p>
        ) : (
          <div className="space-y-3">
            {aRetirer.map((c) => (
              <motion.div
                key={c.id}
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: -20 }}
                className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-emerald-100 dark:border-emerald-500/20 flex flex-col md:flex-row md:items-center justify-between gap-4"
              >
                <div className="flex-1">
                  <span className="font-mono text-xs text-slate-400">{c.reference}</span>
                  <p className="font-bold text-slate-800 dark:text-white">{c.client_nom}</p>
                  <span className="flex items-center gap-1 text-[11px] text-slate-400"><Phone size={12} /> {c.client_telephone}</span>
                </div>
                <div className="flex items-center gap-3">
                  <Prix montant={c.total_general} className="font-black text-emerald-600" />
                  <button
                    disabled={traitementEnCours === c.id}
                    onClick={() => handleMarquerRetiree(c.id)}
                    className="bg-slate-900 hover:bg-emerald-600 disabled:opacity-50 text-white font-black px-5 py-3 rounded-xl border-none cursor-pointer text-[11px] uppercase tracking-widest flex items-center gap-2"
                  >
                    {traitementEnCours === c.id ? <Loader2 size={14} className="animate-spin" /> : <PackageCheck size={14} />} Remis au client
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
