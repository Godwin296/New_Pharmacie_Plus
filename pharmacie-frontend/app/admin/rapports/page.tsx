"use client";
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  FileText, BarChart3, TrendingUp, Receipt, 
  Scale, Trophy, AlertCircle, Loader2, Search, Printer, Download, ChevronDown 
} from 'lucide-react';
import Link from 'next/link';
import axios from 'axios';

// --- IMPORTATIONS DES COMPOSANTS D'IMPRESSION ---
import FinancialReport from './print/page'; 
import StockAlertReport from '../stocks/alertes/page.tsx'; 

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://mw69zhwz-8000.uks1.devtunnels.ms';

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

  useEffect(() => {
    const fetchStats = async () => {
      setLoading(true);
      try {
        const savedCurrency = localStorage.getItem('app_currency') || 'FCFA';
        setCurrency(savedCurrency);
        const res = await axios.get(`${API_URL}/api/boss-dashboard/`, { withCredentials: true });
        setData(res.data);
      } catch (err) {
        console.error("Erreur Dashboard:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, [periode]);

  // 🚀 LOGIQUE D'IMPRESSION CIBLÉE
  const handlePrint = (type: 'financier' | 'stock') => {
    setActiveMenu(null);
    setPrintType(type); // Définit quel composant monter
    setTimeout(() => {
      window.print();
      setPrintType(null); // Démonte après l'impression
    }, 600);
  };

  

  return (
    <div className="max-w-[1400px] mx-auto space-y-8 p-4">
      
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
              className="bg-slate-900 dark:bg-slate-800 text-white px-6 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:scale-105 transition-all flex items-center gap-2 border-none cursor-pointer"
            >
              <FileText size={16} className="text-emerald-400" /> Export Financier <ChevronDown size={14} />
            </button>
            <AnimatePresence>
              {activeMenu === 'fin' && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} 
                  className="absolute right-0 mt-3 w-56 bg-white dark:bg-slate-800 shadow-2xl rounded-2xl overflow-hidden z-50 border border-slate-100 dark:border-slate-700">
                  <button onClick={() => handlePrint('financier')} className="w-full flex items-center gap-3 px-5 py-4 text-[10px] font-black uppercase hover:bg-emerald-500 hover:text-white transition-all text-slate-600 dark:text-slate-200 border-none bg-transparent cursor-pointer">
                    <Printer size={16} /> Lancer l'impression
                  </button>
                  <a 
                    href={`${API_URL}/api/export-pdf/financier/`} 
                    onClick={(e) => {
                      // On laisse le comportement par défaut du lien <a>
                      // mais on s'assure que le menu se ferme après le clic
                      setActiveMenu(null);
                    }}
                    download="Audit_Financier.pdf" 
                    className="w-full flex items-center gap-3 px-5 py-4 text-[10px] font-black uppercase hover:bg-emerald-500 hover:text-white transition-all text-slate-600 dark:text-slate-200 no-underline cursor-pointer"
                  >
                    <Download size={16} /> Télécharger le PDF
                  </a>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* MENU ÉTAT DES STOCKS */}
          <div className="relative">
            <button 
              onClick={() => setActiveMenu(activeMenu === 'stock' ? null : 'stock')}
              className="bg-red-500 text-white px-6 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:scale-105 transition-all flex items-center gap-2 border-none cursor-pointer"
            >
              <BarChart3 size={16} /> État des Stocks <ChevronDown size={14} />
            </button>
            <AnimatePresence>
              {activeMenu === 'stock' && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} 
                  className="absolute right-0 mt-3 w-56 bg-white dark:bg-slate-800 shadow-2xl rounded-2xl overflow-hidden z-50 border border-slate-100 dark:border-slate-700">
                  <button onClick={() => handlePrint('stock')} className="w-full flex items-center gap-3 px-5 py-4 text-[10px] font-black uppercase hover:bg-red-500 hover:text-white transition-all text-slate-600 dark:text-slate-200 border-none bg-transparent cursor-pointer">
                    <Printer size={16} /> Lancer l'impression
                  </button>
                  <a 
                    href={`${API_URL}/api/export-pdf/stocks/`} 
                    onClick={(e) => {
                      // Ferme le menu après le clic pour une expérience fluide
                      setActiveMenu(null);
                    }}
                    download="Etat_Critique_Stocks.pdf" 
                    className="w-full flex items-center gap-3 px-5 py-4 text-[10px] font-black uppercase hover:bg-red-500 hover:text-white transition-all text-slate-600 dark:text-slate-200 no-underline cursor-pointer"
                  >
                    <Download size={16} /> Télécharger le PDF
                  </a>
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
          { label: "Moyenne / Vente", val: convert(data?.ca_total / (data?.nb_ventes || 1)), unit: currency, icon: <Scale />, color: "purple", emoji: "⚖️" },
        ].map((card, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}
            className={`bg-white dark:bg-slate-900 p-8 rounded-[3rem] shadow-sm border-b-[8px] ${card.color === 'emerald' ? 'border-emerald-500' : card.color === 'red' ? 'border-red-500' : 'border-purple-500'} group hover:-translate-y-2 transition-all`}
          >
            <div className="text-4xl mb-4">{card.emoji}</div>
            <h6 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">{card.label}</h6>
            <h2 className="text-3xl font-black text-slate-800 dark:text-white flex items-baseline gap-2">
              {card.val} <span className="text-xs text-slate-400 font-bold uppercase">{card.unit}</span>
            </h2>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 no-print">
        {/* 🏆 CLASSEMENT MÉDICAMENTS */}
        <motion.div className="bg-white dark:bg-slate-900 p-10 rounded-[3rem] shadow-sm border border-slate-100 dark:border-slate-800 flex flex-col h-[600px]">
          <div className="flex justify-between items-center mb-8">
            <h5 className="font-black text-slate-800 dark:text-white flex items-center gap-3 text-lg italic uppercase tracking-tighter">
              <Trophy className="text-yellow-500" size={24} /> Performance Produits
            </h5>
            <div className="relative">
               <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
               <input 
                 type="text" placeholder="Filtrer..." 
                 className="pl-8 pr-4 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border-none text-[10px] font-bold outline-none focus:ring-2 focus:ring-emerald-500/20"
                 onChange={(e) => setSearchTerm(e.target.value)}
               />
            </div>
          </div>

          <div className="flex-grow overflow-y-auto pr-2 space-y-3 custom-scrollbar">
            {data?.produits_expirant_bientot?.filter((p:any) => p.nom.toLowerCase().includes(searchTerm.toLowerCase())).map((item: any, index: number) => (
              <div key={index} className="flex justify-between items-center p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-transparent hover:border-emerald-500/30 transition-all group">
                <div className="flex items-center gap-4">
                  <span className={`w-8 h-8 rounded-lg flex items-center justify-center font-black text-[10px] ${index < 3 ? 'bg-yellow-400 text-white shadow-lg shadow-yellow-400/20' : 'bg-slate-200 dark:bg-slate-700 text-slate-500'}`}>
                    #{index + 1}
                  </span>
                  <div>
                    <div className="font-black text-slate-700 dark:text-slate-200 uppercase text-[10px] tracking-tight">{item.nom}</div>
                    <div className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">{item.laboratoire}</div>
                  </div>
                </div>
                <div className="text-right text-emerald-600 dark:text-emerald-400 font-black text-xs">
                  {item.quantite} <small className="opacity-50">UNITÉS</small>
                </div>
              </div>
            ))}
          </div>
        </motion.div>

        {/* 🚨 ALERTES CRITIQUES */}
        <motion.div className="bg-white dark:bg-slate-900 p-10 rounded-[3rem] shadow-sm border-t-[12px] border-red-500 border border-slate-100 dark:border-slate-800">
          <div className="flex justify-between items-center mb-8">
            <h5 className="font-black text-red-600 flex items-center gap-3 text-lg uppercase tracking-tighter">
              <AlertCircle size={24} /> Urgences Stocks
            </h5>
            <Link href="/admin/stock/alertes" className="text-[10px] font-black text-slate-400 hover:text-red-500 uppercase tracking-widest no-underline border-b border-slate-200">Détails 🔗</Link>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {data?.produits_expirant_bientot?.slice(0, 4).map((p: any, i: number) => (
              <div key={i} className="p-6 bg-red-50/50 dark:bg-red-500/5 rounded-[2rem] text-center border border-red-100 dark:border-red-500/10 group hover:bg-red-600 transition-all duration-300">
                <div className="text-[10px] font-black text-red-400 group-hover:text-white/80 uppercase mb-2 truncate px-2">{p.nom}</div>
                <div className="text-4xl font-black text-red-600 group-hover:text-white transition-colors">{p.quantite}</div>
                <div className="text-[8px] font-black text-red-400 group-hover:text-white/60 uppercase tracking-[0.2em] mt-2 italic">Alerte Seuil</div>
              </div>
            ))}
          </div>
        </motion.div>
      </div>

      {/* --- ZONE D'IMPRESSION CONDITIONNELLE --- */}
      {printType === 'financier' && (
        <div className="fixed inset-0 bg-white z-[9999] print:block hidden overflow-visible">
          <FinancialReport />
        </div>
      )}
      
      {printType === 'stock' && (
        <div className="fixed inset-0 bg-white z-[9999] print:block hidden overflow-visible">
          <StockAlertReport />
        </div>
      )}

      {/* STYLE CHIRURGICAL POUR L'IMPRESSION PARFAITE */}
      <style jsx global>{`
        @media print {
          * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .no-print, nav, header, aside, button { display: none !important; }
          body, html { 
            background: white !important; 
            margin: 0 !important; 
            padding: 0 !important;
          }
          .print\:block { display: block !important; }
        }
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
      `}</style>
    </div>
  );
}
