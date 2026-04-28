"use client";
import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  Truck, AlertCircle, Zap, ShieldCheck, 
  ChevronRight, ShoppingCart, PlusCircle, CheckCircle2 
} from 'lucide-react';

// Mock Data
const MOCK_ALERTES = [
  { id: 1, nom: "Paracétamol 500mg", quantite: 5, seuil: 20 },
  { id: 2, nom: "Amoxicilline 1g", quantite: 2, seuil: 15 },
  { id: 3, nom: "Vitamine C Effervescent", quantite: 8, seuil: 10 },
];

export default function ReapproPage() {
  const [priority, setPriority] = useState('normale');

  return (
    <div className="max-w-[1600px] mx-auto pb-20">
      
      {/* 🔝 HEADER */}
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-12">
        <div className="inline-block bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-4 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] mb-4">
          Logistique Stratégique 🛰️
        </div>
        <h2 className="text-5xl font-black text-slate-800 dark:text-white tracking-tighter">
          Flux de <span className="text-emerald-500">Réapprovisionnement</span>
        </h2>
        <p className="text-slate-500 dark:text-slate-400 font-medium mt-2 italic">Gestion automatisée des ruptures et commandes partenaires.</p>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* 🚨 ZONE DES ALERTES CRITIQUES (8 COLONNES) */}
        <div className="lg:col-span-8">
          <motion.div 
            initial={{ opacity: 0, x: -20 }} 
            animate={{ opacity: 1, x: 0 }}
            className="bg-white dark:bg-slate-900/60 backdrop-blur-xl p-10 rounded-[2.5rem] shadow-sm border border-slate-100 dark:border-slate-800"
          >
            <div className="flex justify-between items-center mb-10">
              <div>
                <h5 className="text-2xl font-black text-slate-800 dark:text-white mb-1">⚠️ Alertes Critiques</h5>
                <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">{MOCK_ALERTES.length} Produits sous le seuil</p>
              </div>
              <span className="bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400 px-5 py-2 rounded-2xl font-black text-[10px] uppercase tracking-widest border border-red-100 dark:border-red-500/20">
                Action Requise
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-left border-b border-slate-50 dark:border-slate-800">
                    <th className="pb-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Médicament</th>
                    <th className="pb-6 text-center text-[10px] font-black text-slate-400 uppercase tracking-widest">Stock Actuel</th>
                    <th className="pb-6 text-center text-[10px] font-black text-slate-400 uppercase tracking-widest">Seuil Alerte</th>
                    <th className="pb-6 text-right text-[10px] font-black text-slate-400 uppercase tracking-widest">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                  {MOCK_ALERTES.map((p) => (
                    <tr key={p.id} className="group hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-all">
                      <td className="py-6">
                        <div className="flex items-center gap-4">
                          {/* TON ANIMATION PULSE RECRÉÉE EN TAILWIND */}
                          <div className="relative flex h-3 w-3">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-3 w-3 bg-red-600"></span>
                          </div>
                          <span className="font-black text-slate-800 dark:text-slate-200 text-base">{p.nom}</span>
                        </div>
                      </td>
                      <td className="py-6 text-center">
                        <span className="bg-red-50 dark:bg-red-500/10 text-red-600 px-4 py-1.5 rounded-xl font-black text-sm">
                          {p.quantite}
                        </span>
                      </td>
                      <td className="py-6 text-center text-slate-400 font-bold italic text-sm">{p.seuil}</td>
                      <td className="py-6 text-right">
                        <button className="bg-slate-900 dark:bg-slate-700 text-white px-6 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-emerald-600 transition-all transform active:scale-95 flex items-center gap-2 ml-auto border-none cursor-pointer">
                          Commander <PlusCircle size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </motion.div>
        </div>

        {/* 📝 FORMULAIRE BON DE COMMANDE (4 COLONNES - STICKY) */}
        <div className="lg:col-span-4 lg:sticky lg:top-28">
          <motion.div 
            initial={{ opacity: 0, x: 20 }} 
            animate={{ opacity: 1, x: 0 }}
            className="bg-slate-950 p-10 rounded-[3rem] shadow-2xl border-0 relative overflow-hidden group"
          >
            {/* Effet visuel d'arrière-plan */}
            <div className="absolute -top-20 -right-20 w-40 h-40 bg-emerald-500/10 rounded-full blur-3xl group-hover:bg-emerald-500/20 transition-all duration-500" />
            
            <div className="flex items-center gap-4 mb-10">
              <div className="w-12 h-12 bg-emerald-500 rounded-2xl flex items-center justify-center text-white shadow-xl shadow-emerald-500/20">
                <ShoppingCart size={24} strokeWidth={2.5} />
              </div>
              <h5 className="text-2xl font-black tracking-tighter text-white">Nouveau Bon</h5>
            </div>
            
            <form className="space-y-8">
              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-4 block italic">Partenaire Stratégique</label>
                <div className="relative">
                  <Truck className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                  <select className="w-full pl-14 pr-6 py-5 rounded-2xl bg-slate-900 border-2 border-slate-800 text-white font-bold focus:border-emerald-500 transition-all outline-none appearance-none cursor-pointer">
                    <option>PharmaDistrib SARL</option>
                    <option>Medica Global</option>
                  </select>
                </div>
              </div>
              
              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-4 block italic">Niveau d'Urgence</label>
                <div className="grid grid-cols-2 gap-4">
                  {[
                    { id: 'normale', label: 'Normale', color: 'emerald' },
                    { id: 'urgent', label: 'Urgent ⚡', color: 'orange' }
                  ].map((lvl) => (
                    <button
                      key={lvl.id}
                      type="button"
                      onClick={() => setPriority(lvl.id)}
                      className={`py-4 rounded-2xl border-2 font-black text-[10px] uppercase transition-all flex flex-col items-center gap-2 ${
                        priority === lvl.id 
                        ? (lvl.id === 'urgent' ? 'border-orange-500 bg-orange-500/10 text-orange-500 shadow-lg shadow-orange-500/10' : 'border-emerald-500 bg-emerald-500/10 text-emerald-500 shadow-lg shadow-emerald-500/10')
                        : 'border-slate-800 text-slate-500 bg-transparent hover:border-slate-700'
                      }`}
                    >
                      {lvl.id === 'urgent' ? <Zap size={16} /> : <CheckCircle2 size={16} />}
                      {lvl.label}
                    </button>
                  ))}
                </div>
              </div>

              <button className="w-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black py-6 rounded-[2rem] transition-all transform hover:scale-[1.02] shadow-2xl shadow-emerald-500/30 border-none cursor-pointer flex items-center justify-center gap-3 group text-sm uppercase tracking-widest">
                GÉNÉRER LE BON NUMÉRIQUE
              </button>
            </form>

            <div className="mt-10 pt-8 border-t border-white/5 flex gap-4 items-start">
              <ShieldCheck className="text-emerald-500 shrink-0" size={20} />
              <p className="text-[9px] font-bold text-slate-500 uppercase leading-relaxed tracking-wider">
                Certification : Le bon sera horodaté et transmis instantanément via le canal partenaire sécurisé.
              </p>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
