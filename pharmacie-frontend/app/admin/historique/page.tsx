"use client";
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Search, FileDown, Eye, Calendar, 
  Receipt, Wallet, Filter, Loader2, Printer 
} from 'lucide-react';

// 🌟 CONFIGURATION : Importation de l'apiClient unifié (Gère l'URL brute et injecte le JWT pour le Staff)
import apiClient from '../../../lib/apiClient';
import Prix from '../../../lib/components/Prix';
import router, { useRouter } from 'next/navigation';

export default function HistoriqueVentes() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [ventes, setVentes] = useState<any[]>([]);
  const [query, setQuery] = useState("");
  const [filterOrdonnance, setFilterOrdonnance] = useState<'all' | 'valid' | 'none'>('all');

  // 🌟 ÉTAPE 1 : Récupération des archives sécurisée (Correction définitive du 403)
  useEffect(() => {
    const fetchArchives = async () => {
      try {
        // apiClient ajoute automatiquement l'adresse de votre tunnel et injecte le Token JWT de la caisse/admin
        const response = await apiClient.get('/api/archives/');
        setVentes(response.data);
      } catch (err) {
        console.error("Problème d'authentification ou de réseau sur les archives :", err);
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

  // 🖨️ ÉTAPE 2 : Alignement précis de l'URL du ticket de caisse selon core/urls.py
  const handleViewDetails = (id: string) => {
     // Utilise l'URL de base dynamique du client pour ouvrir le ticket au guichet avec son slash final
     router.push(`/facture?id=${id}`);
  };

    return (
    <div className="max-w-350 mx-auto space-y-8 p-4">
      
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
          { label: "Volume de Ventes", valRaw: ventes.length, estPrix: false, icon: <Receipt />, color: "blue" },
          { label: "Chiffre d'Affaires Global", valRaw: caGlobal, estPrix: true, icon: <Wallet />, color: "emerald" },
        ].map((kpi, i) => (
          <motion.div key={i} whileHover={{ y: -5 }}
            className={`bg-white dark:bg-slate-900 p-8 rounded-4xl shadow-sm border-l-12 ${kpi.color === 'blue' ? 'border-blue-500' : 'border-emerald-500'} flex justify-between items-center`}
          >
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">{kpi.label}</p>
              <h2 className={`text-4xl font-black ${kpi.color === 'blue' ? 'text-blue-600' : 'text-emerald-600'}`}>
                {kpi.estPrix ? <Prix montant={kpi.valRaw} /> : kpi.valRaw}
              </h2>
            </div>
            <div className="text-4xl opacity-20 dark:text-white">{kpi.icon}</div>
          </motion.div>
        ))}
      </div>

      {/* 🔎 RECHERCHE & FILTRES */}
      <div className="bg-white dark:bg-slate-900 p-6 rounded-4xl shadow-sm border border-slate-100 dark:border-slate-800 flex flex-col md:flex-row gap-4 items-center">
        <div className="grow relative w-full">
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
      <div className="bg-white dark:bg-slate-900 rounded-4xl border border-slate-100 dark:border-slate-800 overflow-hidden shadow-2xl">
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
                      <Prix montant={v.total_general ?? 0} />
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
                        {/* 🌟 ACCESSIBILITÉ & STABLE : Redirection vers la facture universelle .tsx avec attribut title */}
                        <button 
                          title="Consulter les détails de la facture"
                          aria-label="Voir les détails" 
                          onClick={() => handleViewDetails(v.id)} 
                          className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-900/30 text-blue-600 flex items-center justify-center hover:bg-blue-600 hover:text-white transition-all cursor-pointer border-none"
                        >
                          <Eye size={18} />
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
