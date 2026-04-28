"use client";
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ShoppingCart, FilePlus, ClipboardCheck, 
  AlertTriangle, XCircle, RefreshCw, 
  CreditCard, ChevronLeft, Loader2,
  CheckCircle2 // Ajouté pour corriger le statut VALIDATED
} from 'lucide-react';
import Link from 'next/link';
import axios from 'axios';
import { useRouter } from 'next/navigation';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://mw69zhwz-8000.uks1.devtunnels.ms';

export default function PanierPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [commande, setCommande] = useState<any>(null);
  const [status, setStatus] = useState<'REFUSED' | 'MISSING_DOC' | 'PENDING_VAL' | 'VALIDATED' | 'EMPTY'>('EMPTY');

  // 1. RÉCUPÉRATION DU PANIER RÉEL 🛰️
  const fetchPanier = async () => {
    try {
      const res = await axios.get(`${API_URL}/api/panier/`, { withCredentials: true });
      const data = res.data;
      
      if (!data.items || data.items.length === 0) {
        setStatus('EMPTY');
      } else {
        setCommande(data);
        // LOGIQUE DE DÉTERMINATION DU STATUT 🧠
        if (data.motif_refus) setStatus('REFUSED');
        else if (data.ordonnance_valide) setStatus('VALIDATED');
        else if (data.statut === 'attente_validation') setStatus('PENDING_VAL');
        else if (data.items.some((it: any) => it.ordonnance_requise) && !data.ordonnance) setStatus('MISSING_DOC');
        else setStatus('VALIDATED'); // Si rien n'est requis, c'est validé par défaut
      }
    } catch (err) {
      console.error("Erreur panier:", err);
      setStatus('EMPTY');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPanier();
  }, []);

  if (loading) return (
    <div className="h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 text-emerald-500">
      <Loader2 className="animate-spin" size={48} />
    </div>
  );

  return (
    <div className="max-w-[950px] mx-auto px-6 py-12">
      
      <div className="flex items-center gap-4 mb-10">
        <div className="w-14 h-14 bg-emerald-500 rounded-2xl flex items-center justify-center text-white shadow-xl shadow-emerald-500/20">
          <ShoppingCart size={28} strokeWidth={2.5} />
        </div>
        <h2 className="text-4xl font-black text-slate-800 dark:text-white tracking-tighter italic uppercase">Mon Panier</h2>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-2xl border border-slate-100 dark:border-slate-800 overflow-hidden">
        
        {status !== 'EMPTY' ? (
          <>
            <div className="p-2">
              {commande?.items.map((item: any, i: number) => (
                <motion.div 
                  initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.1 }}
                  key={item.id} 
                  className="flex flex-col md:flex-row justify-between items-center p-8 border-b border-slate-50 dark:border-slate-800 last:border-none group hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-all"
                >
                  <div className="flex-1 text-center md:text-left mb-4 md:mb-0">
                    <h6 className="font-black text-slate-800 dark:text-white text-xl tracking-tight uppercase italic group-hover:text-emerald-500 transition-colors">{item.produit_nom}</h6>
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">{item.prix_unitaire?.toLocaleString()} FCFA / UNITÉ</span>
                  </div>
                  <div className="bg-slate-100 dark:bg-slate-800 px-6 py-2 rounded-xl font-black text-[10px] text-slate-500 uppercase tracking-widest border border-slate-200 dark:border-slate-700">
                    Qté : {item.quantite}
                  </div>
                  <div className="md:ml-12 text-2xl font-black text-slate-800 dark:text-white tracking-tighter">
                    {item.total_item?.toLocaleString()} <small className="text-[10px]">CFA</small>
                  </div>
                </motion.div>
              ))}
            </div>

            <div className="bg-slate-50 dark:bg-slate-950/50 p-10 border-t border-slate-100 dark:border-slate-800">
              <div className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-10">
                
                <div className="space-y-2">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] italic underline underline-offset-8 decoration-emerald-500">Total de votre commande</p>
                  <div className="text-5xl font-black text-emerald-500 tracking-tighter">
                    {commande?.total_general?.toLocaleString()} <small className="text-sm font-bold text-slate-400">FCFA</small>
                  </div>
                </div>

                <div className="w-full lg:w-96 space-y-4">
                  <AnimatePresence mode="wait">
                    
                    {status === 'REFUSED' && (
                      <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="space-y-4">
                        <div className="bg-red-50 dark:bg-red-500/10 p-5 rounded-2xl border border-red-100 dark:border-red-900/20 text-red-600">
                          <div className="flex items-center gap-2 mb-2 font-black uppercase text-[10px] tracking-widest"><XCircle size={14} /> Document Refusé</div>
                          <p className="text-xs italic font-medium">"{commande.motif_refus}"</p>
                        </div>
                        <button onClick={() => router.push(`/ordonnance/upload?id=${commande.id}`)} className="w-full bg-red-600 text-white font-black py-5 rounded-2xl shadow-xl flex items-center justify-center gap-3 border-none cursor-pointer text-xs uppercase tracking-widest">
                          <RefreshCw size={18} /> Renvoyer l'Ordonnance
                        </button>
                      </motion.div>
                    )}

                    {status === 'MISSING_DOC' && (
                      <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="space-y-4">
                        <div className="bg-amber-50 dark:bg-amber-500/10 p-5 rounded-2xl border border-amber-100 text-amber-600 flex items-center gap-3 text-xs font-bold"><AlertTriangle size={18} /> Une ordonnance est requise.</div>
                        <button onClick={() => router.push(`/ordonnance/upload?id=${commande.id}`)} className="w-full bg-blue-600 text-white font-black py-5 rounded-2xl shadow-xl flex items-center justify-center gap-3 border-none cursor-pointer text-xs uppercase tracking-widest">
                          <FilePlus size={18} /> Joindre l'Ordonnance
                        </button>
                      </motion.div>
                    )}

                    {status === 'PENDING_VAL' && (
                      <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="space-y-4">
                        <div className="bg-blue-50 dark:bg-blue-500/10 p-5 rounded-2xl border border-blue-100 text-blue-600 flex items-center gap-3 text-xs font-bold italic">
                          <RefreshCw size={18} className="animate-spin" /> Vérification par la pharmacie...
                        </div>
                        <button className="w-full bg-slate-200 dark:bg-slate-800 text-slate-400 font-black py-5 rounded-2xl border-none cursor-not-allowed text-[10px] uppercase tracking-widest">Patientez svp...</button>
                      </motion.div>
                    )}

                    {status === 'VALIDATED' && (
                      <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="space-y-4">
                        <div className="bg-emerald-50 dark:bg-emerald-500/10 p-5 rounded-2xl border border-emerald-100 text-emerald-600 flex items-center gap-3 text-xs font-bold"><CheckCircle2 size={18} /> Prêt pour le paiement !</div>
                        <button className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-black py-6 rounded-[2rem] shadow-2xl transition-all flex items-center justify-center gap-3 border-none cursor-pointer text-sm uppercase tracking-widest">
                          Confirmer et Payer <CreditCard />
                        </button>
                      </motion.div>
                    )}

                  </AnimatePresence>
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="text-center py-32">
            <div className="text-8xl mb-8 animate-bounce">🛒</div>
            <h4 className="text-2xl font-black text-slate-300 uppercase tracking-widest italic">Votre panier est vide</h4>
            <Link href="/catalogue" className="mt-8 bg-emerald-500 text-white px-12 py-5 rounded-[2rem] font-black uppercase text-xs tracking-widest shadow-xl no-underline inline-flex items-center gap-3 hover:scale-105 transition-all">
              <ChevronLeft size={18} /> Voir le catalogue
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
