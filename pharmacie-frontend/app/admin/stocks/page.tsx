"use client";
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  PackageSearch, AlertCircle, TrendingUp, Printer, 
  ChevronRight, Filter, Search, Loader2, X, Check, Download
} from 'lucide-react';
import axios from 'axios';
import Link from 'next/link';
// IMPORT DU COMPOSANT DE PRINT POUR L'INCLURE DANS LA PAGE
import StockPrintPage from './print/page'; 

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://mw69zhwz-8000.uks1.devtunnels.ms';

export default function InventoryPage() {
  const [produits, setProduits] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [currency, setCurrency] = useState('FCFA');
  const [selectedProduct, setSelectedProduct] = useState<any>(null);

  const fetchInventory = async () => {
    try {
      setCurrency(localStorage.getItem('app_currency') || 'FCFA');
      const res = await axios.get(`${API_URL}/api/catalogue/`, { withCredentials: true });
      setProduits(res.data.produits || []);
    } catch (err) {
      console.error("Erreur inventaire:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchInventory(); }, []);

  const handleQuickUpdate = async (id: number, newQty: number) => {
    try {
      await axios.post(`${API_URL}/api/boss/update-stock/${id}/`, { quantite: newQty }, { withCredentials: true });
      fetchInventory();
      setSelectedProduct(null);
    } catch (err) {
      alert("Erreur de mise à jour");
    }
  };

  const convert = (amount: number) => {
    if (!amount) return "0";
    if (currency === 'EUR') return (amount / 655.957).toLocaleString(undefined, {minimumFractionDigits: 2});
    if (currency === 'USD') return (amount / 600).toLocaleString(undefined, {minimumFractionDigits: 2});
    return amount.toLocaleString();
  };

  const filteredProduits = produits.filter(p => 
    p.nom.toLowerCase().includes(searchTerm.toLowerCase()) || 
    p.categorie?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const nbCritiques = produits.filter(p => p.quantite <= (p.seuil_alerte || 10)).length;
  const valeurTotale = produits.reduce((acc, p) => acc + (p.prix * p.quantite), 0);


  return (
    <div className="max-w-[1600px] mx-auto pb-20">
      
      {/* --- CONTENU VISIBLE (TABLEAU DE GESTION) --- */}
      <div className="no-print">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-10 gap-6">
          <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}>
            <div className="inline-block bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-4 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] mb-3">
              Strategic Logistics 🛰️
            </div>
            <h2 className="text-5xl font-black text-slate-800 dark:text-white tracking-tighter italic">
              Inventaire <span className="text-emerald-500">Global</span>
            </h2>
          </motion.div>

          <div className="bg-white dark:bg-slate-900 p-6 rounded-[2rem] border border-slate-100 dark:border-slate-800 shadow-sm flex items-center gap-6">
            <div className="text-right border-r pr-6 border-slate-100 dark:border-slate-800">
              <span className="text-slate-400 text-[10px] font-black uppercase tracking-widest block mb-1 italic">Valeur en {currency}</span>
              <h4 className="text-3xl font-black text-emerald-600">
                {convert(valeurTotale)} <small className="text-xs">{currency}</small>
              </h4>
            </div>
            <div className="flex flex-col items-center">
              <span className="text-slate-400 text-[10px] font-black uppercase tracking-widest mb-1">Alertes</span>
              <div className="w-10 h-10 bg-red-500 text-white rounded-full flex items-center justify-center font-black animate-pulse shadow-lg shadow-red-500/20">
                {nbCritiques}
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-col md:flex-row gap-4 mb-8">
          <div className="relative flex-grow group">
            <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
            <input 
              type="text" placeholder="Recherche rapide médicament..."
              className="w-full pl-16 pr-8 py-5 rounded-3xl border-none bg-white dark:bg-slate-900 shadow-sm font-bold text-sm outline-none focus:ring-2 focus:ring-emerald-500/20"
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900/40 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full border-separate border-spacing-0">
              <thead>
                <tr className="bg-slate-900 text-white">
                  <th className="px-8 py-6 text-left text-[10px] font-black uppercase tracking-widest">Médicament</th>
                  <th className="px-8 py-6 text-left text-[10px] font-black uppercase tracking-widest">Catégorie</th>
                  <th className="px-8 py-6 text-center text-[10px] font-black uppercase tracking-widest">Quantité</th>
                  <th className="px-8 py-6 text-center text-[10px] font-black uppercase tracking-widest">Valeur</th>
                  <th className="px-8 py-6 text-right text-[10px] font-black uppercase tracking-widest">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                {filteredProduits.map((p, i) => (
                  <tr key={p.id} className="group hover:bg-emerald-50/30 dark:hover:bg-slate-800/30 transition-all">
                    <td className="px-8 py-6">
                      <span className="font-black text-slate-800 dark:text-white text-base block uppercase tracking-tight">{p.nom}</span>
                      <span className="text-[9px] text-slate-400 font-bold italic">{p.laboratoire || 'Générique'}</span>
                    </td>
                    <td className="px-8 py-6">
                      <span className="px-3 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-500 text-[9px] font-black uppercase">
                        {p.categorie}
                      </span>
                    </td>
                    <td className="px-8 py-6 text-center italic">
                      <div className={`text-xl font-black ${p.quantite <= (p.seuil_alerte || 10) ? 'text-red-500' : 'text-slate-800 dark:text-slate-200'}`}>
                        {p.quantite}
                      </div>
                    </td>
                    <td className="px-8 py-6 text-center font-black text-emerald-600">
                      {convert(p.prix * p.quantite)} <small className="text-[9px] opacity-60">{currency}</small>
                    </td>
                    <td className="px-8 py-6 text-right">
                      <button onClick={() => setSelectedProduct(p)} className="p-3 rounded-xl bg-emerald-500 text-white hover:bg-emerald-600 transition-all border-none cursor-pointer shadow-lg shadow-emerald-500/20"><TrendingUp size={16} /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="mt-12 flex flex-col items-center gap-4">
          <div className="flex bg-slate-900 rounded-[2rem] overflow-hidden shadow-2xl">
            <button 
              onClick={() => window.print()}
              className="bg-transparent text-white px-10 py-5 font-black text-xs uppercase tracking-widest border-none cursor-pointer hover:bg-emerald-600 transition-all flex items-center gap-3"
            >
              <Printer size={20} /> Imprimer l'état
            </button>
            <a 
              href={`${API_URL}/api/export-pdf/rapport-stock/`} 
              download="Inventaire_Stock.pdf"
              className="bg-white/10 text-white px-10 py-5 font-black text-xs uppercase tracking-widest flex items-center gap-3 no-underline border-l border-white/10 hover:bg-emerald-600 transition-all cursor-pointer"
            >
              <Download size={20} /> Télécharger
            </a>
          </div>
          <p className="text-slate-400 text-[9px] font-bold uppercase tracking-widest italic text-center">
            Aperçu Windows direct sans quitter le dashboard 🛰️
          </p>
        </div>
      </div>

      {/* --- MODALE RÉAPPRO --- */}
      <AnimatePresence>
        {selectedProduct && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md no-print">
            <motion.div initial={{scale: 0.9}} animate={{scale: 1}} className="bg-white dark:bg-slate-900 p-10 rounded-[3rem] w-full max-w-md shadow-2xl">
              <h3 className="text-xl font-black mb-6 uppercase italic text-emerald-500 text-center">Mise à jour Stock</h3>
              <p className="text-sm font-bold text-slate-400 mb-8 uppercase tracking-widest text-center">{selectedProduct.nom}</p>
              <input type="number" defaultValue={selectedProduct.quantite} id="new_qty" className="w-full p-6 rounded-2xl bg-slate-50 dark:bg-slate-800 border-none font-black text-3xl text-center mb-8 outline-none focus:ring-4 focus:ring-emerald-500/20" />
              <div className="grid grid-cols-2 gap-4">
                <button onClick={() => setSelectedProduct(null)} className="p-5 rounded-2xl bg-slate-100 font-bold border-none cursor-pointer">Annuler</button>
                <button onClick={() => handleQuickUpdate(selectedProduct.id, Number((document.getElementById('new_qty') as HTMLInputElement).value))} className="p-5 rounded-2xl bg-emerald-500 text-white font-black border-none cursor-pointer">Confirmer</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* --- COMPOSANT D'IMPRESSION (INVISIBLE À L'ÉCRAN, VISIBLE À L'IMPRIMANTE) --- */}
      <div className="hidden print:block">
        <StockPrintPage />
      </div>

      <style jsx global>{`
        @media screen {
          .print-only { display: none; }
        }
        @media print {
          /* 1. FORCE LA COULEUR 🎨 */
          * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            color-adjust: exact !important;
          }

          /* 2. SUPPRIME LA PAGE VIDE 📄 */
          .no-print { 
            display: none !important; 
            height: 0 !important; 
            overflow: hidden !important; 
          }
    
          /* 3. POSITIONNE LE RAPPORT PRO COMME SEUL ÉLÉMENT */
          body, html { 
            background: white !important; 
            margin: 0 !important; 
            padding: 0 !important;
          }

          .hidden.print\:block { 
            display: block !important; 
            position: absolute; 
            top: 0; 
            left: 0; 
            width: 100%;
            z-index: 9999;
          }

          @page { 
            size: A4; 
            margin: 0; /* On gère les marges dans le composant print */
          }
        }
      `}</style>
    </div>
  );
}
