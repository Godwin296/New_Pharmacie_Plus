"use client";
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  FileText, BarChart3, TrendingUp, Receipt, 
  Scale, Trophy, AlertCircle, Loader2, Search, Printer, Download, ChevronDown 
} from 'lucide-react';
import Link from 'next/link';
import StockAlertReport from '../stocks/alertes/page';
import FinancialReport from './print/page'; 

// 🌟 CONFIGURATION : Importation de l'apiClient unifié
import apiClient from '../../../lib/apiClient'; 

export default function ReportsDashboard() {
  const [loading, setLoading] = useState(true);
  const [periode, setPeriode] = useState('mensuelle');
  const [data, setData] = useState<any>(null);
  const [currency, setCurrency] = useState('FCFA');
  const [searchTerm, setSearchTerm] = useState('');

  // States pour les menus et le déclenchement de l'impression
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const [printType, setPrintType] = useState<'financier' | 'stock' | null>(null);

  const convert = (amount: number) => {
    if (!amount) return "0";
    if (currency === 'EUR') return (amount / 655.957).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2});
    if (currency === 'USD') return (amount / 600).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2});
    return amount.toLocaleString();
  };

  // 🌟 ÉTAPE 1 : Récupération des KPI du Boss sécurisée
  useEffect(() => {
    const fetchStats = async () => {
      setLoading(true);
      try {
        const savedCurrency = localStorage.getItem('app_currency') || 'FCFA';
        setCurrency(savedCurrency);
        
        // apiClient injecte automatiquement l'access_token de l'administrateur
        const res = await apiClient.get('/api/boss-dashboard/');
        setData(res.data);
      } catch (err) {
        console.error("Erreur de droits ou de réseau sur le Dashboard des Rapports:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, [periode]);

  // 🚀 LOGIQUE D'IMPRESSION CIBLÉE
  const handlePrint = (type: 'financier' | 'stock') => {
    setActiveMenu(null);
    setPrintType(type); 
    setTimeout(() => {
      window.print();
      setTimeout(() => {
        setPrintType(null);
      }, 500);
    }, 150)
  };

  // 🌟 ÉTAPE 2 : Téléchargement authentifié du rapport PDF (Évite le document blanc/bloqué)
  const handleDownloadReport = async (endpoint: string, filename: string) => {
    try {
      setActiveMenu(null);
      // Appel sécurisé par Blob avec injection du Token JWT
      const response = await apiClient.get(`/api/export-pdf/${endpoint}/`, {
        responseType: 'blob'
      });
      
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${filename}.pdf`);
      document.body.appendChild(link);
      link.click();
      
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      alert("Erreur lors de l'authentification ou de l'extraction du rapport PDF.");
    }
  };
  if (loading) {
      return (
        <div className="h-96 flex flex-col items-center justify-center text-emerald-600">
          <Loader2 className="w-12 h-12 animate-spin mb-4"  aria-label="Synchronisation des KPI système" />
          <p className="font-bold animate-pulse">Synchronisation de la page...</p>
        </div>
      );
  }

  return (
    <div className="max-w-350 mx-auto space-y-8 p-4">
      
      {/* 🔝 HEADER & EXPORTS */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 no-print">
        <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
          <h2 className="text-4xl font-black text-slate-800 dark:text-white tracking-tighter mb-2">
            📈 Audit de <span className="text-emerald-500">l'Empire</span>
          </h2>
          <p className="text-slate-500 dark:text-slate-400 font-medium italic">Données consolidées en {currency}.</p>
        </motion.div>
        
        <div className="flex flex-wrap gap-3">
          {/* MENU EXPORT FINANCIER */}
          <div className="relative">
            <button 
              onClick={() => setActiveMenu(activeMenu === 'fin' ? null : 'fin')}
              title="Ouvrir le menu d'export financier"
              aria-label="Ouvrir le menu d'export financier"
              className="bg-slate-900 dark:bg-slate-800 text-white px-6 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:scale-105 transition-all flex items-center gap-2 border-none cursor-pointer"
            >
              <FileText size={16} className="text-emerald-400" /> Export Financier <ChevronDown size={14} />
            </button>
            <AnimatePresence>
              {activeMenu === 'fin' && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} 
                  className="absolute right-0 mt-3 w-56 bg-white dark:bg-slate-800 shadow-2xl rounded-2xl overflow-hidden z-50 border border-slate-100 dark:border-slate-700">
                  <button 
                    onClick={() => handlePrint('financier')} 
                    title="Imprimer le bilan sur papier ou PDF virtuel"
                    aria-label="Lancer l'impression"
                    className="w-full flex items-center gap-3 px-5 py-4 text-[10px] font-black uppercase hover:bg-emerald-500 hover:text-white transition-all text-slate-600 dark:text-slate-200 border-none bg-transparent cursor-pointer"
                  >
                    <Printer size={16} /> Lancer l'impression
                  </button>
                  <button 
                    onClick={() => handleDownloadReport('financier', 'Audit_Financier')}
                    title="Télécharger le rapport certifié"
                    aria-label="Télécharger le PDF"
                    className="w-full flex items-center gap-3 px-5 py-4 text-[10px] font-black uppercase hover:bg-emerald-500 hover:text-white transition-all text-slate-600 dark:text-slate-200 border-none bg-transparent text-left cursor-pointer"
                  >
                    <Download size={16} /> Télécharger le PDF
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          {/* MENU ÉTAT DES STOCKS */}
          <div className="relative">
            <button 
              onClick={() => setActiveMenu(activeMenu === 'stock' ? null : 'stock')}
              title="Ouvrir le menu de l'état des stocks"
              aria-label="Ouvrir le menu de l'état des stocks"
              className="bg-red-500 text-white px-6 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:scale-105 transition-all flex items-center gap-2 border-none cursor-pointer"
            >
              <BarChart3 size={16} /> État des Stocks <ChevronDown size={14} />
            </button>
            <AnimatePresence>
              {activeMenu === 'stock' && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} 
                  className="absolute right-0 mt-3 w-56 bg-white dark:bg-slate-800 shadow-2xl rounded-2xl overflow-hidden z-50 border border-slate-100 dark:border-slate-700">
                  <button 
                    onClick={() => handlePrint('stock')} 
                    title="Imprimer le bilan des stocks physiques officiels"
                    aria-label="Lancer l'impression des stocks"
                    className="w-full flex items-center gap-3 px-5 py-4 text-[10px] font-black uppercase hover:bg-red-500 hover:text-white transition-all text-slate-600 dark:text-slate-200 border-none bg-transparent cursor-pointer"
                  >
                    <Printer size={16} /> Lancer l'impression
                  </button>
                  <button 
                    onClick={() => handleDownloadReport('stocks', 'Etat_Critique_Stocks')}
                    title="Télécharger l'état certifié des ruptures"
                    aria-label="Télécharger le PDF des stocks"
                    className="w-full flex items-center gap-3 px-5 py-4 text-[10px] font-black uppercase hover:bg-red-500 hover:text-white transition-all text-slate-600 dark:text-slate-200 border-none bg-transparent text-left cursor-pointer"
                  >
                    <Download size={16} /> Télécharger le PDF
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* 💰 STATS FINANCIÈRES DYNAMIQUES */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 no-print">
        {[
          { label: "Chiffre d'Affaires", val: convert(data?.ca_total), unit: currency, icon: <TrendingUp />, color: "emerald", emoji: "💰" },
          { label: "Alertes Stocks", val: data?.nb_produits_critiques, unit: "Produits", icon: <AlertCircle />, color: "red", emoji: "🚨" },
          { label: "Moyenne / Vente", val: convert(data?.ca_total / (data?.ventes_recentes?.length || 1)), unit: currency, icon: <Scale />, color: "purple", emoji: "⚖️" },
        ].map((card, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}
            className={`bg-white dark:bg-slate-900 p-8 rounded-[3rem] shadow-sm border-b-8 ${card.color === 'emerald' ? 'border-emerald-500' : card.color === 'red' ? 'border-red-500' : 'border-purple-500'} group hover:-translate-y-2 transition-all`}
          >
            <div className="text-4xl mb-4">{card.emoji}</div>
            <h6 className="text-[10px] font-black text-slate-400 tracking-widest mb-2 uppercase">{card.label}</h6>
            <h2 className="text-3xl font-black text-slate-800 dark:text-white flex items-baseline gap-2 tracking-tighter">
              {card.val} <span className="text-xs text-slate-400 font-bold uppercase">{card.unit}</span>
            </h2>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 no-print">
        {/* 🏆 CLASSEMENT MÉDICAMENTS (RACCORDÉ AU BACKEND DJANGO) */}
        <motion.div className="bg-white dark:bg-slate-900 p-10 rounded-[3rem] shadow-sm border border-slate-100 dark:border-slate-800 flex flex-col h-150">
          <div className="flex justify-between items-center mb-8">
            <h5 className="font-black text-slate-800 dark:text-white flex items-center gap-3 text-lg italic uppercase tracking-tighter">
              <Trophy className="text-yellow-500" size={24} /> Performance Produits
            </h5>
            <div className="relative">
               <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
               <input 
                 type="text" placeholder="Filtrer..." 
                 className="pl-8 pr-4 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border-none text-[10px] font-bold outline-none focus:ring-2 focus:ring-emerald-500/20 dark:text-white"
                 value={searchTerm}
                 onChange={(e) => setSearchTerm(e.target.value)}
               />
            </div>
          </div>

          <div className="grow overflow-y-auto pr-2 space-y-3 custom-scrollbar">
            {/* 🌟 STABLE : On boucle désormais sur la clé de classement réel top_produits_vendus calculée par Django */}
            {data?.top_produits_vendus?.filter((p: any) => p.nom.toLowerCase().includes(searchTerm.toLowerCase())).map((item: any, index: number) => (
              <div key={item.id || index} className="flex justify-between items-center p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-transparent hover:border-emerald-500/30 transition-all group">
                <div className="flex items-center gap-4">
                  <span className={`w-8 h-8 rounded-lg flex items-center justify-center font-black text-[10px] ${index < 3 ? 'bg-yellow-400 text-white shadow-lg shadow-yellow-400/20' : 'bg-slate-200 dark:bg-slate-700 text-slate-500'}`}>
                    #{index + 1}
                  </span>
                  <div>
                    <div className="font-black text-slate-700 dark:text-slate-200 uppercase text-[10px] tracking-tight">{item.nom}</div>
                    <div className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">Officine Certifiée</div>
                  </div>
                </div>
                <div className="text-right text-emerald-600 dark:text-emerald-400 font-black text-xs">
                  {item.quantite_vendue} <small className="opacity-50">BOÎTES</small>
                </div>
              </div>
            ))}
            {(!data?.top_produits_vendus || data.top_produits_vendus.length === 0) && (
              <div className="text-center text-xs text-slate-400 italic py-10">Aucune vente enregistrée pour le moment.</div>
            )}
          </div>
        </motion.div>

        {/* 🚨 ALERTES CRITIQUES */}
        <motion.div className="bg-white dark:bg-slate-900 p-10 rounded-[3rem] shadow-sm border-t-12 border-red-500 border dark:border-slate-800 flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-center mb-8">
              <h5 className="font-black text-red-600 flex items-center gap-3 text-lg uppercase tracking-tighter">
                <AlertCircle size={24} /> Urgences Stocks
              </h5>
              {/* 🌟 STABLE : Correction du chemin d'URL vers /admin/stocks/alertes avec un 's' pour éliminer le 404 */}
              <Link 
                href="/admin/stocks/alertes" 
                title="Consulter le rapport d'alertes étendu"
                aria-label="Détails"
                className="text-slate-400 hover:text-red-500 uppercase tracking-widest text-[10px] font-black no-underline border-b border-slate-200 dark:border-slate-700"
              >
                Détails 🔗
              </Link>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {data?.produits_expirant_bientot?.slice(0, 4).map((p: any, i: number) => (
                <div key={i} className="p-6 bg-red-50/50 dark:bg-red-500/5 rounded-4xl text-center border border-red-100 dark:border-red-500/10 transition-all duration-300">
                  <div className="text-[10px] font-black text-red-400 uppercase mb-2 truncate px-2">{p.nom}</div>
                  <div className="text-4xl font-black text-red-600 dark:text-red-400">{p.quantite || 0}</div>
                  <div className="text-[8px] font-black text-red-400 uppercase tracking-[0.2em] mt-2 italic">Proche Expir</div>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      </div>

      {/* --- ZONE D'IMPRESSION CONDITIONNELLE (GARDÉE À 100% INTACTE) --- */}
      {printType === 'financier' && (
        <div className="fixed inset-0 bg-white z-9999 print:block hidden overflow-visible">
          <FinancialReport />
        </div>
      )}
      
      {printType === 'stock' && (
        <div className="fixed inset-0 bg-white z-9999 print:block hidden overflow-visible">
          <StockAlertReport />
        </div>
      )}
    </div>
  );
}
