"use client";
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, Users, Mail, Phone, KeyRound, Loader2, CheckCircle2, AlertTriangle, X
} from 'lucide-react';

import apiClient from '../../../lib/apiClient';

interface ClientRow {
  id: number;
  nom: string;
  identifiant: string;
  telephone: string;
  email: string | null;
  username: string;
  is_active: boolean;
}

export default function AdminClientsPage() {
  const [loading, setLoading] = useState(true);
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [query, setQuery] = useState("");
  const [resettingId, setResettingId] = useState<number | null>(null);
  const [confirmId, setConfirmId] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const fetchClients = async () => {
    setLoading(true);
    try {
      const res = await apiClient.get('/api/admin/clients/');
      setClients(res.data);
    } catch (err) {
      console.error("Erreur de chargement des clients :", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchClients(); }, []);

  const filtered = clients.filter(c =>
    c.nom.toLowerCase().includes(query.toLowerCase()) ||
    c.identifiant.toLowerCase().includes(query.toLowerCase()) ||
    (c.telephone || "").includes(query)
  );

  const handleResetPassword = async (client: ClientRow) => {
    setResettingId(client.id);
    setFeedback(null);
    try {
      const res = await apiClient.post(`/api/admin/clients/${client.id}/reset-password/`);
      setFeedback({ type: 'success', message: res.data.message || "Nouveau mot de passe envoyé." });
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err.response?.data?.error || "Erreur lors de la réinitialisation du mot de passe.",
      });
    } finally {
      setResettingId(null);
      setConfirmId(null);
    }
  };

  return (
    <div className="max-w-350 mx-auto space-y-8 p-4">
      <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
        <h2 className="text-4xl font-black text-slate-800 dark:text-white tracking-tighter mb-2 italic">
          👤 Gestion des <span className="text-emerald-500">Clients</span>
        </h2>
        <p className="text-slate-500 dark:text-slate-400 font-medium">
          Comptes clients en ligne (application mobile/web). Réinitialisez un mot de passe oublié
          et il est envoyé automatiquement par email au client.
        </p>
      </motion.div>

      {feedback && (
        <motion.div
          initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
          className={`p-5 rounded-3xl flex items-center gap-3 font-bold text-sm ${
            feedback.type === 'success'
              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20'
              : 'bg-red-50 text-red-700 border border-red-200 dark:bg-red-500/10 dark:text-red-400 dark:border-red-500/20'
          }`}
        >
          {feedback.type === 'success' ? <CheckCircle2 size={20} /> : <AlertTriangle size={20} />}
          {feedback.message}
          <button onClick={() => setFeedback(null)} className="ml-auto bg-transparent border-none cursor-pointer opacity-60 hover:opacity-100">
            <X size={16} />
          </button>
        </motion.div>
      )}

      <div className="bg-white dark:bg-slate-900 p-6 rounded-4xl shadow-sm border border-slate-100 dark:border-slate-800">
        <div className="relative w-full mb-6">
          <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
          <input
            type="text" placeholder="Rechercher par nom, ID ou téléphone..."
            className="w-full pl-14 pr-6 py-4 rounded-2xl bg-slate-50 dark:bg-slate-800 border-none outline-none focus:ring-2 focus:ring-emerald-500/20 text-sm transition-all dark:text-white"
            value={query} onChange={(e) => setQuery(e.target.value)}
          />
        </div>

        {loading ? (
          <div className="py-20 flex items-center justify-center text-emerald-500">
            <Loader2 className="animate-spin" size={32} />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-separate border-spacing-0">
              <thead className="bg-slate-50/50 dark:bg-slate-800/50 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                <tr>
                  <th className="px-6 py-4">Client</th>
                  <th className="px-6 py-4">Identifiant</th>
                  <th className="px-6 py-4">Contact</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                <AnimatePresence>
                  {filtered.map((c) => (
                    <motion.tr key={c.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                      className="hover:bg-emerald-50/30 dark:hover:bg-emerald-500/5 transition-colors"
                    >
                      <td className="px-6 py-5">
                        <p className="font-black text-slate-800 dark:text-white text-sm">{c.nom}</p>
                        <p className="text-[10px] text-slate-400 font-bold uppercase">@{c.username}</p>
                      </td>
                      <td className="px-6 py-5 font-mono text-xs text-slate-500">{c.identifiant}</td>
                      <td className="px-6 py-5">
                        <div className="flex flex-col gap-1 text-[11px] font-bold text-slate-500">
                          <span className="flex items-center gap-2"><Phone size={12} /> {c.telephone || "—"}</span>
                          <span className="flex items-center gap-2">
                            <Mail size={12} /> {c.email || <span className="italic text-slate-300">Aucun email</span>}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-5 text-right">
                        {confirmId === c.id ? (
                          <div className="flex items-center justify-end gap-2">
                            <span className="text-[10px] font-black text-slate-400 uppercase mr-1">Confirmer ?</span>
                            <button
                              disabled={resettingId === c.id || !c.email}
                              onClick={() => handleResetPassword(c)}
                              className="px-3 py-2 rounded-xl bg-emerald-500 text-black text-[10px] font-black uppercase border-none cursor-pointer disabled:opacity-40"
                            >
                              {resettingId === c.id ? "..." : "Oui, envoyer"}
                            </button>
                            <button
                              onClick={() => setConfirmId(null)}
                              className="px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 text-[10px] font-black uppercase border-none cursor-pointer"
                            >
                              Annuler
                            </button>
                          </div>
                        ) : (
                          <button
                            title={c.email ? "Générer un nouveau mot de passe et l'envoyer par email" : "Ce client n'a pas d'email enregistré"}
                            disabled={!c.email}
                            onClick={() => setConfirmId(c.id)}
                            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-50 dark:bg-blue-900/30 text-blue-600 text-[10px] font-black uppercase border-none cursor-pointer hover:bg-blue-600 hover:text-white transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                          >
                            <KeyRound size={14} /> Réinitialiser & envoyer
                          </button>
                        )}
                      </td>
                    </motion.tr>
                  ))}
                </AnimatePresence>
              </tbody>
            </table>
            {filtered.length === 0 && (
              <div className="p-16 text-center text-slate-400 italic flex flex-col items-center gap-3">
                <Users size={32} className="opacity-30" />
                Aucun client trouvé.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
