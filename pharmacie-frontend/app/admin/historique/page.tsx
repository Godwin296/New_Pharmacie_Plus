"use client";
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Search, FileDown, Eye, Calendar, 
  Receipt, Wallet, Filter, Loader2, Printer 
} from 'lucide-react';
import axios from 'axios';

// Utilisation de l'URL brute pour éviter les soucis de variables d'environnement sur mobile
const API_URL = 'https://mw69zhwz-8000.uks1.devtunnels.ms';

export default function HistoriqueVentes() {
  const [loading, setLoading] = useState(true);
  const [ventes, setVentes] = useState<any[]>([]);
  const [query, setQuery] = useState("");
  const [filterOrdonnance, setFilterOrdonnance] = useState<'all' | 'valid' | 'none'>('all');

  // 🔄 Chargement des données (Correction du 403 et synchronisation)
    useEffect(() => {
    const fetchArchives = async () => {
      try {
        const response = await fetch(`${API_URL}/api/archives/`, {
          method: 'GET',
          // On ne met aucun header, rien du tout, pour un GET brut
        });

        if (response.ok) {
          const data = await response.json();
          setVentes(data);
        } else {
          console.error("Le serveur refuse toujours (403).");
        }
      } catch (err) {
        console.error("Problème de réseau.");
      } finally {
        setLoading(false);
      }
    };
    fetchArchives();
  }, []);


  // 📊 Calculs dynamiques pour les KPIs
  const caGlobal = ventes.reduce((acc, curr) => acc + (parseFloat(curr.total_general) || 0), 0);

  // 🔍 Logique de filtrage
  const filteredVentes = ventes.filter(v => {
    const searchLower = query.toLowerCase();
    const matchesSearch = v.id.toString().includes(searchLower) || 
                         (v.client_nom && v.client_nom.toLowerCase().includes(searchLower));
    
    const matchesFilter = filterOrdonnance === 'all' 
      ? true 
      : filterOrdonnance === 'valid' ? v.ordonnance_valide : !v.ordonnance_valide;
      
    return matchesSearch && matchesFilter;
  });

  // 🖨️ Fonctions d'action
  const handleViewDetails = (id: string) => {
     // Utilisation de l'URL Backend pour la facture
     window.open(`${API_URL}/api/ticket-caisse/${id}/`, '_blank');
  };

  return (
    <div className="max-w-[1400px] mx-auto space-y-8 p-4">
      
      {/* 🔝 TITRE */}
      <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
        <h2 className="text-4xl font-black text-slate-800 dark:text-white tracking-tighter mb-2 italic">
          📜 Registre des <span className="text-emerald-500">Transactions</span>
        </h2>
        <p className="text-slate-500 dark:text-slate-400 font-medium">Archive certifiée de l'activité commerciale.</p>
      </motion.div>

      {/* 📊 KPI DYNAMIQUES */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {[
          { label: "Volume de Ventes", val: ventes.length, icon: <Receipt />, color: "blue" },
          { label: "Chiffre d'Affaires Global", val: caGlobal.toLocaleString(), unit: "FCFA", icon: <Wallet />, color: "emerald" },
        ].map((kpi, i) => (
          <motion.div key={i} whileHover={{ y: -5 }}
            className={`bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] shadow-sm border-l-[12px] ${kpi.color === 'blue' ? 'border-blue-500' : 'border-emerald-500'} flex justify-between items-center`}
          >
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">{kpi.label}</p>
              <h2 className={`text-4xl font-black ${kpi.color === 'blue' ? 'text-blue-600' : 'text-emerald-600'}`}>
                {kpi.val} <small className="text-xs text-slate-400 font-bold">{kpi.unit || ''}</small>
              </h2>
            </div>
            <div className="text-4xl opacity-20 dark:text-white">{kpi.icon}</div>
          </motion.div>
        ))}
      </div>

      {/* 🔎 RECHERCHE & FILTRES */}
      <div className="bg-white dark:bg-slate-900 p-6 rounded-[2rem] shadow-sm border border-slate-100 dark:border-slate-800 flex flex-col md:flex-row gap-4 items-center">
        <div className="flex-grow relative w-full">
          <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
          <input 
            type="text" placeholder="Rechercher par ID ou nom client..."
            className="w-full pl-14 pr-6 py-4 rounded-2xl bg-slate-50 dark:bg-slate-800 border-none outline-none focus:ring-2 focus:ring-emerald-500/20 text-sm transition-all dark:text-white"
            value={query} onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <div className="flex gap-2 p-1 bg-slate-100 dark:bg-slate-800 rounded-2xl">
          {['all', 'valid', 'none'].map((f) => (
            <button key={f} onClick={() => setFilterOrdonnance(f as any)}
              className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all border-none cursor-pointer ${
                filterOrdonnance === f ? 'bg-white dark:bg-slate-700 shadow-sm text-emerald-600' : 'text-slate-400 bg-transparent'
              }`}
            >
              {f === 'all' ? 'Tous' : f === 'valid' ? 'Ordonnance' : 'Libre'}
            </button>
          ))}
        </div>
      </div>

      {/* 🧾 TABLEAU */}
      <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 overflow-hidden shadow-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-separate border-spacing-0">
            <thead className="bg-slate-50/50 dark:bg-slate-800/50 text-[10px] font-black text-slate-400 uppercase tracking-widest">
              <tr>
                <th className="px-8 py-5">ID Transaction</th>
                <th className="px-8 py-5">Date</th>
                <th className="px-8 py-5">Client</th>
                <th className="px-8 py-5">Montant</th>
                <th className="px-8 py-5 text-center">🛡️ Statut</th>
                <th className="px-8 py-5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
              <AnimatePresence>
                {filteredVentes.map((v) => (
                  <motion.tr key={v.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    className="group hover:bg-emerald-50/30 dark:hover:bg-emerald-500/5 transition-colors"
                  >
                    <td className="px-8 py-6 font-mono font-black text-blue-600 dark:text-blue-400">#{v.id}</td>
                    <td className="px-8 py-6">
                       <span className="font-bold text-slate-700 dark:text-slate-200 text-sm">
                        {v.date ? new Date(v.date).toLocaleDateString() : '---'}
                       </span>
                    </td>
                    <td className="px-8 py-6 text-[10px] font-black text-slate-500 uppercase tracking-tighter">
                      {v.client_nom || "Client Guichet"}
                    </td>
                    <td className="px-8 py-6 font-black text-slate-800 dark:text-white text-base">
                      {v.total_general ? parseFloat(v.total_general).toLocaleString() : '0'} <small className="text-[10px] text-slate-400">FCFA</small>
                    </td>
                    <td className="px-8 py-6">
                      {v.ordonnance_valide ? (
                        <div className="flex items-center justify-center gap-2 bg-emerald-50 dark:bg-emerald-500/10 px-3 py-1.5 rounded-xl border border-emerald-100 dark:border-emerald-500/20">
                          <span className="text-[9px] font-black text-emerald-600 uppercase">Certifiée</span>
                        </div>
                      ) : (
                        <div className="text-center text-[9px] font-bold text-slate-400 uppercase">Vente Libre</div>
                      )}
                    </td>
                    <td className="px-8 py-6 text-right">
                      <div className="flex justify-end gap-2">
                        <button onClick={() => handleViewDetails(v.id)} className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-900/30 text-blue-600 flex items-center justify-center hover:bg-blue-600 hover:text-white transition-all cursor-pointer border-none">
                          <Eye size={18} />
                        </button>
                        <button onClick={() => window.open(`${API_URL}/api/ticket-caisse/${v.id}/`, '_blank')} className="w-10 h-10 rounded-xl bg-red-50 dark:bg-red-900/30 text-red-600 flex items-center justify-center hover:bg-red-600 hover:text-white transition-all cursor-pointer border-none">
                          <Printer size={18} />
                        </button>
                      </div>
                    </td>
                  </motion.tr>
                ))}
              </AnimatePresence>
            </tbody>
          </table>
          {filteredVentes.length === 0 && (
              <div className="p-20 text-center text-slate-400 italic">Aucune transaction trouvée dans les archives.</div>
          )}
        </div>
      </div>
    </div>
  );
}
