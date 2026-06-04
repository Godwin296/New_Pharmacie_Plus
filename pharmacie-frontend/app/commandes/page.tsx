"use client";
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  History, Eye, Download, Globe, Building2, 
  ChevronDown, CheckCircle2, ArrowLeft, Loader2 
} from 'lucide-react';
import Link from 'next/link';

// 🌟 ÉTAPE 1 : Importation de l'apiClient
import apiClient from '../../lib/apiClient'; // Ajustez le chemin selon la structure du dossier app/commandes

export default function MesCommandes() {
  const [commandes, setCommandes] = useState<any[]>([]);
  const [openOrder, setOpenOrder] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // 🌟 ÉTAPE 2 : Récupération de l'historique sur la bonne URL Django
  const fetchHistorique = async () => {
    try {
      // apiClient ajoute l'URL du tunnel, injecte le Token JWT Bearer et cible /api/commandes/ avec son slash final
      const res = await apiClient.get('/api/commandes/');
      setCommandes(res.data);
    } catch (err) {
      console.error("Erreur historique:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistorique();
  }, []);

  if (loading) return (
    <div className="h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 text-emerald-500">
      <Loader2 className="animate-spin" size={48} />
    </div>
  );

      return (
    <div className="max-w-250 mx-auto px-6 py-12">
      
      {/* 🔝 HEADER SAAS */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-12 gap-6">
        <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
          <div className="inline-block bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-4 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] mb-3 italic">
            Transactions Stratégiques
          </div>
          <h2 className="text-5xl font-black text-slate-800 dark:text-white tracking-tighter">
            Mon <span className="text-emerald-500">Historique</span>
          </h2>
          <p className="text-slate-400 font-medium mt-2">Suivi de vos achats et factures certifiées 2026.</p>
        </motion.div>
        
        <Link href="/catalogue" className="no-underline bg-slate-950 dark:bg-white text-white dark:text-slate-950 px-8 py-4 rounded-4xl font-black text-xs uppercase tracking-widest hover:scale-105 transition-all shadow-xl flex items-center gap-2">
          <ArrowLeft size={16} /> Boutique
        </Link>
      </div>

      {/* 📑 LISTE DES COMMANDES DYNAMIQUE */}
      <div className="space-y-6">
        <AnimatePresence>
          {commandes.length > 0 ? (
            commandes.map((cmd, i) => (
              <motion.div
                key={cmd.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}
                className="relative bg-white dark:bg-slate-900/60 backdrop-blur-xl rounded-4xl border border-slate-100 dark:border-slate-800 overflow-hidden group hover:border-emerald-500/50 transition-all shadow-sm hover:shadow-2xl"
              >
                <div className="absolute left-0 top-0 bottom-0 w-2 bg-emerald-500" />
                
                <div className="p-8">
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
                    
                    <div className="md:col-span-4">
                      <div className="flex items-center gap-4 mb-3">
                        {/* 🌟 STABLE : Utilisation sécurisée du champ 'date' renvoyé par votre CommandeSerializer */}
                        <span className="text-xl font-black text-slate-800 dark:text-white tracking-tighter italic">
                          {cmd.date ? new Date(cmd.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' }) : 'N/A'}
                        </span>
                        {cmd.ordonnance ? (
                          <span className="flex items-center gap-1 bg-blue-50 dark:bg-blue-500/10 text-blue-600 px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-tighter border border-blue-100">
                            <Globe size={10} /> Médicalisé
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 bg-amber-50 dark:bg-amber-500/10 text-amber-600 px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-tighter border border-amber-100">
                            <Building2 size={10} /> Libre
                          </span>
                        )}
                      </div>
                      <code className="text-[10px] text-slate-400 bg-slate-50 dark:bg-slate-950 px-3 py-1 rounded-lg font-mono">REF: #{cmd.id}</code>
                    </div>

                    <div className="md:col-span-3">
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1 italic opacity-60">Articles</p>
                      <button 
                        onClick={() => setOpenOrder(openOrder === cmd.id ? null : cmd.id)}
                        className="font-bold text-slate-700 dark:text-slate-200 flex items-center gap-2 hover:text-emerald-500 transition-colors border-none bg-transparent cursor-pointer"
                      >
                        {cmd.items?.length || 0} produit(s) <ChevronDown size={14} className={`transition-transform ${openOrder === cmd.id ? 'rotate-180' : ''}`} />
                      </button>
                    </div>

                    <div className="md:col-span-3">
                      <div className="text-2xl font-black text-emerald-600 tracking-tighter mb-1">
                        {cmd.total_general?.toLocaleString()} <small className="text-[10px]">FCFA</small>
                      </div>
                      <div className="flex items-center gap-2 text-[9px] font-black text-emerald-500/60 uppercase">
                        <CheckCircle2 size={12} strokeWidth={3} /> {cmd.payee ? "Facture Payée" : "En attente"}
                      </div>
                    </div>

                    <div className="md:col-span-2 flex justify-end gap-3">
                      {/* 🌟 STABLE : Le bouton d'œil ouvre et ferme nativement l'accordéon au lieu de tenter d'aller dans l'admin Django */}
                      <button 
                        onClick={() => setOpenOrder(openOrder === cmd.id ? null : cmd.id)}
                        className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all border-none cursor-pointer
                          ${openOrder === cmd.id ? 'bg-emerald-500 text-white' : 'bg-slate-50 dark:bg-slate-800 text-slate-600 hover:bg-emerald-500 hover:text-white'}`}
                        title="Détails de la commande"
                      >
                        <Eye size={20} />
                      </button>
                      
                      {/* 🌟 STABLE : L'URL pointe maintenant vers le préfixe /api/ obligatoire de votre config/urls.py */}
                      <button 
                        onClick={() => window.open(`${apiClient.defaults.baseURL}/api/facture-pdf/${cmd.id}/`, '_blank')}
                        className="w-12 h-12 rounded-2xl bg-red-50 dark:bg-red-900/30 text-red-500 flex items-center justify-center hover:bg-red-600 hover:text-white transition-all border-none cursor-pointer"
                        title="Télécharger la facture PDF"
                      >
                        <Download size={20} />
                      </button>
                    </div>
                  </div>

                  {/* 📂 ACCORDION DYNAMIQUE */}
                  <AnimatePresence>
                    {openOrder === cmd.id && (
                      <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                        <div className="mt-8 pt-6 border-t border-slate-50 dark:border-slate-800 grid grid-cols-1 md:grid-cols-2 gap-4">
                          {cmd.items?.map((it: any, index: number) => (
                            <div key={index} className="flex items-center gap-3 bg-slate-50 dark:bg-slate-800 p-4 rounded-2xl">
                              <div className="w-8 h-8 bg-white dark:bg-slate-900 rounded-lg flex items-center justify-center text-emerald-500 font-black text-[10px] shadow-sm">💊</div>
                              <span className="font-bold text-xs text-slate-600 dark:text-slate-300 uppercase italic">
                                {it.produit_nom} (x{it.quantite})
                              </span>
                            </div>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </motion.div>
            ))
          ) : (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-32 bg-white dark:bg-slate-900 rounded-[4rem] border-4 border-dashed border-slate-100 dark:border-slate-800">
              <div className="text-8xl mb-8 animate-bounce">📂</div>
              <h4 className="text-3xl font-black text-slate-800 dark:text-white tracking-tighter uppercase mb-2 italic">Aucune commande</h4>
              <p className="text-slate-400 font-bold uppercase tracking-widest text-xs italic">Votre historique apparaîtra ici après votre premier achat.</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
