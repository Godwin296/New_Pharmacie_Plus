"use client";
import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Search, ShoppingCart, Trash2, Plus, Minus, 
  Printer, User, ScanBarcode, CheckCircle2, ChevronRight, Loader2, X, Info
} from 'lucide-react';
import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://mw69zhwz-8000.uks1.devtunnels.ms';

interface Produit { id: number; nom: string; prix: number; quantite: number; identifiant?: string; }
interface ItemPanier extends Produit { qte: number; }

export default function POSPage() {
  const [produitsDB, setProduitsDB] = useState<Produit[]>([]);
  const [search, setSearch] = useState("");
  const [panier, setPanier] = useState<ItemPanier[]>([]);
  const [showClientModal, setShowClientModal] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [clientInfos, setClientInfos] = useState({ nom: "", telephone: "", email: "" });
  const [step, setStep] = useState<'cart' | 'success'>('cart');
  const [loading, setLoading] = useState(true);
  const [finalizing, setFinalizing] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // 1. CHARGEMENT INITIAL (S'exécute une seule fois pour éviter de saturer le CPU)
  useEffect(() => {
    fetchProduits();
  }, []);

  // 2. LISTENER SCANNER (S'exécute quand le catalogue est prêt)
  useEffect(() => {
    let buffer = "";
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return; 
      if (e.key === 'Enter') {
        if (buffer.length > 3) {
          handleScan(buffer);
          buffer = "";
        }
      } else {
        buffer += e.key;
      }
      setTimeout(() => { buffer = ""; }, 200); 
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [produitsDB]);

  const fetchProduits = async () => {
    try {
      const res = await axios.get(`${API_URL}/api/catalogue/`);
      setProduitsDB(res.data.produits);
    } catch (err) { 
      console.error("Erreur API Catalogue:", err); 
    } finally { 
      setLoading(false); 
    }
  };

  const handleScan = (code: string) => {
    const p = produitsDB.find(prod => prod.identifiant === code || prod.nom.toLowerCase() === code.toLowerCase());
    if (p) addToCart(p);
  };

  const addToCart = (p: Produit) => {
    setPanier(prev => {
      const exist = prev.find(item => item.id === p.id);
      if (exist) {
        if (exist.qte >= p.quantite) { alert("Stock insuffisant !"); return prev; }
        return prev.map(item => item.id === p.id ? { ...item, qte: item.qte + 1 } : item);
      }
      if (p.quantite <= 0) { alert("Rupture !"); return prev; }
      return [...prev, { ...p, qte: 1 }];
    });
  };

  const updateQte = (id: number, delta: number) => {
    setPanier(prev => prev.map(item => {
      if (item.id === id) {
        const source = produitsDB.find(p => p.id === id);
        const newQte = Math.max(1, item.qte + delta);
        return (delta > 0 && source && newQte > source.quantite) ? item : { ...item, qte: newQte };
      }
      return item;
    }));
  };

  const total = panier.reduce((sum, item) => sum + (item.prix * item.qte), 0);

  const handleFinalize = async () => {
    if (panier.length === 0) return;
    setFinalizing(true);
    try {
      const payload = {
        client_infos: clientInfos,
        items: panier.map(i => ({ produit_id: i.id, quantite: i.qte })),
      };
    
      const res = await axios.post(`${API_URL}/api/vente-directe/`, payload, { withCredentials: true });
    
      // 🕒 Petite pause de 500ms pour laisser Django finaliser la transaction
      await new Promise(r => setTimeout(r, 500));
    
      // Ouverture de la facture
      window.open(`/facture?id=${res.data.id}`, "_blank");
    
      setStep('success');
      setShowConfirmModal(false);
      fetchProduits(); 
    } catch (err) {
        alert("Erreur lors de la validation de la vente au guichet.");
    } finally { 
      setFinalizing(false); 
    }
  };


  return (
    <div className="h-screen flex flex-col lg:flex-row gap-4 p-2 lg:p-6 bg-slate-50 dark:bg-black overflow-hidden">
      
      <div className="flex-grow flex flex-col gap-4 overflow-hidden h-full">
        <div className="bg-white dark:bg-slate-900 p-4 lg:p-8 rounded-[2rem] shadow-sm border border-slate-100 dark:border-slate-800 flex flex-col h-full">
          <div className="flex justify-between items-center mb-6">
             <h2 className="text-2xl lg:text-4xl font-black tracking-tighter dark:text-white uppercase italic">🛒 POS <span className="text-emerald-500 italic">PRO</span></h2>
             <button onClick={() => setShowClientModal(true)} className="flex items-center gap-2 bg-emerald-500/10 text-emerald-600 px-4 py-3 rounded-2xl font-black text-[10px] uppercase hover:bg-emerald-500 hover:text-white transition-all border-none cursor-pointer tracking-widest">
               <User size={16} /> {clientInfos.nom || "Infos Client"}
             </button>
          </div>

          <div className="relative mb-6">
            <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
            <input 
              ref={searchInputRef}
              type="text" placeholder="Scanner ou chercher..."
              className="w-full pl-14 pr-6 py-4 rounded-2xl bg-slate-50 dark:bg-slate-800 border-none font-bold outline-none focus:ring-2 focus:ring-emerald-500 dark:text-white"
              value={search} onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleScan(search)}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 overflow-y-auto pr-2 scrollbar-hide">
            {produitsDB.filter(p => p.nom.toLowerCase().includes(search.toLowerCase())).map((p) => (
              <motion.div key={p.id} whileTap={{ scale: 0.95 }} onClick={() => addToCart(p)} className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border-2 border-transparent hover:border-emerald-500 cursor-pointer transition-all group">
                <h4 className="font-bold text-slate-800 dark:text-white text-xs uppercase truncate italic">{p.nom}</h4>
                <div className="flex justify-between items-end mt-2">
                  <span className="text-emerald-500 font-black text-xs">{p.prix.toLocaleString()} CFA</span>
                  <span className={`text-[9px] font-bold ${p.quantite <= 5 ? 'text-red-500' : 'text-slate-400'}`}>Stock: {p.quantite}</span>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>

      <div className="w-full lg:w-[400px] h-full flex flex-col">
        <div className="bg-slate-950 rounded-[2.5rem] p-6 text-white flex flex-col h-full shadow-2xl relative border border-white/5">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-500">Panier Courant</h3>
            <span className="bg-emerald-500 text-black px-3 py-1 rounded-full text-[10px] font-black">{panier.length}</span>
          </div>

          <div className="flex-grow overflow-y-auto space-y-3 pr-2 scrollbar-hide">
            <AnimatePresence mode="popLayout">
              {panier.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center opacity-20">
                  <ShoppingCart size={48} className="mb-4" />
                  <p className="text-[10px] font-black uppercase tracking-widest">Scanner un produit...</p>
                </div>
              ) : (
                panier.map((item) => (
                  <motion.div key={item.id} layout initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, scale: 0.5 }} className="bg-white/5 p-4 rounded-[1.5rem] border border-white/5 flex items-center justify-between">
                    <div className="w-1/2">
                      <p className="text-[10px] font-black uppercase truncate text-slate-200">{item.nom}</p>
                      <p className="text-xs font-black text-emerald-400">{(item.prix * item.qte).toLocaleString()} CFA</p>
                    </div>
                    <div className="flex items-center gap-2 bg-black rounded-lg p-1 border border-white/5">
                      <button onClick={() => updateQte(item.id, -1)} className="p-1 hover:text-emerald-500 border-none bg-transparent cursor-pointer text-white"><Minus size={12}/></button>
                      <span className="text-xs font-black w-4 text-center">{item.qte}</span>
                      <button onClick={() => updateQte(item.id, 1)} className="p-1 hover:text-emerald-500 border-none bg-transparent cursor-pointer text-white"><Plus size={12}/></button>
                    </div>
                    <button onClick={() => setPanier(panier.filter(i => i.id !== item.id))} className="p-2 text-white/20 hover:text-red-500 border-none bg-transparent cursor-pointer"><Trash2 size={14}/></button>
                  </motion.div>
                ))
              )}
            </AnimatePresence>
          </div>

          <div className="mt-6 pt-6 border-t border-white/10">
            <div className="flex justify-between items-center mb-6">
              <span className="text-slate-500 font-black text-[10px] uppercase">Net à payer</span>
              <span className="text-3xl font-black text-emerald-400 tracking-tighter">{total.toLocaleString()} <small className="text-xs font-bold">CFA</small></span>
            </div>
            <button 
              disabled={panier.length === 0 || finalizing}
              onClick={() => setShowConfirmModal(true)}
              className="w-full bg-emerald-500 hover:bg-emerald-400 text-black font-black py-5 rounded-2xl flex justify-between px-8 items-center disabled:opacity-20 cursor-pointer border-none shadow-xl transition-all"
            >
              {finalizing ? "TRAITEMENT..." : "ENCAISSER"} <Printer size={18} />
            </button>
          </div>

          <AnimatePresence>
            {showClientModal && (
              <motion.div 
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} 
                className="fixed inset-0 bg-slate-900/90 backdrop-blur-md z-[100] flex items-center justify-center p-4"
              >
                <motion.div 
                  initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }}
                  className="bg-slate-900 border border-white/10 w-full max-w-lg rounded-[2.5rem] p-6 lg:p-10 flex flex-col max-h-[90vh]"
                >
                  <div className="flex justify-between items-center mb-6">
                    <h3 className="font-black text-white italic tracking-tighter text-xl">COORDONNÉES CLIENT</h3>
                    <X onClick={() => setShowClientModal(false)} className="text-slate-400 cursor-pointer hover:text-white" />
                  </div>

                  <div className="flex-grow overflow-y-auto space-y-5 pr-2 mb-6">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-emerald-500 uppercase ml-4">Nom complet</label>
                      <input type="text" placeholder="Ex: Jean Dupont" className="w-full p-4 bg-white/5 border border-white/10 rounded-2xl text-white outline-none focus:border-emerald-500 transition-colors" value={clientInfos.nom} onChange={e => setClientInfos({...clientInfos, nom: e.target.value})} />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-emerald-500 uppercase ml-4">Téléphone</label>
                      <input type="tel" placeholder="6xx xxx xxx" className="w-full p-4 bg-white/5 border border-white/10 rounded-2xl text-white outline-none focus:border-emerald-500" value={clientInfos.telephone} onChange={e => setClientInfos({...clientInfos, telephone: e.target.value})} />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-emerald-500 uppercase ml-4">Informations / Email</label>
                      <textarea placeholder="Détails complémentaires..." className="w-full p-4 bg-white/5 border border-white/10 rounded-2xl text-white outline-none focus:border-emerald-500 h-24 resize-none" value={clientInfos.email} onChange={e => setClientInfos({...clientInfos, email: e.target.value})} />
                    </div>
                  </div>

                  <button 
                    onClick={() => setShowClientModal(false)} 
                    className="w-full bg-emerald-500 text-black font-black py-5 rounded-2xl border-none cursor-pointer shadow-xl"
                  >
                    ENREGISTRER LES INFOS
                  </button>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {showConfirmModal && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
                <div className="bg-white dark:bg-slate-900 p-8 rounded-[2rem] max-w-sm w-full text-center">
                  <Info size={40} className="text-emerald-500 mx-auto mb-4" />
                  <h3 className="text-xl font-black dark:text-white mb-2">Confirmer ?</h3>
                  <p className="text-slate-500 text-sm mb-6 font-medium tracking-tight">Voulez-vous valider cet encaissement et déduire le stock ?</p>
                  <div className="flex gap-3">
                    <button onClick={() => setShowConfirmModal(false)} className="flex-1 py-4 rounded-xl font-bold bg-slate-100 text-slate-500 border-none cursor-pointer">Annuler</button>
                    <button onClick={handleFinalize} className="flex-1 py-4 rounded-xl font-black bg-emerald-500 text-black border-none cursor-pointer">CONFIRMER</button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {step === 'success' && (
              <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} className="absolute inset-0 bg-emerald-500 z-[60] rounded-[2.5rem] p-8 flex flex-col items-center justify-center text-black text-center">
                <CheckCircle2 size={64} className="mb-4" />
                <h2 className="text-4xl font-black italic mb-6 tracking-tighter leading-none">VENTE<br/>REUSSIE</h2>
                <button onClick={() => {setPanier([]); setStep('cart'); setClientInfos({nom:"", telephone:"", email:""});}} className="w-full bg-black text-white py-4 rounded-xl font-black uppercase text-[10px] tracking-widest border-none cursor-pointer">VENTE SUIVANTE</button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
