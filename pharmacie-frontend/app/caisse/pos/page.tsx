"use client";
import { useRouter, useSearchParams } from 'next/navigation';
import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Search, ShoppingCart, Trash2, Plus, Minus, 
  Printer, User, ScanBarcode, CheckCircle2, ChevronRight, Loader2, X, Info
} from 'lucide-react';

// 🌟 CONFIGURATION : Importation de l'apiClient unifié (Gère le tunnel et injecte le JWT Caisse)
import apiClient from '../../../lib/apiClient'; // Ajuste le chemin selon l'arborescence (app/caisse/pos)

interface Produit { id: number; nom: string; prix: number; quantite: number; identifiant?: string; ordonnance_obligatoire?: boolean; }
interface ItemPanier extends Produit { qte: number; }

export default function POSPage() {
  const router = useRouter();
  const [produitsDB, setProduitsDB] = useState<Produit[]>([]);
  const [search, setSearch] = useState("");
  // (searchInput/searching : voir bloc debounce plus bas, valeur instantanée du champ)
  const [panier, setPanier] = useState<ItemPanier[]>([]);
  const [showClientModal, setShowClientModal] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [clientInfos, setClientInfos] = useState({ nom: "", telephone: "", email: "", region: "", ville: "", quartier: "", });
  const [ordonnanceVerifiee, setOrdonnanceVerifiee] = useState(false);
  const [step, setStep] = useState<'cart' | 'success'>('cart');
  const [loading, setLoading] = useState(true);
  const [finalizing, setFinalizing] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // 🔎 DEBOUNCE DE LA RECHERCHE : même pattern que /catalogue (session pagination) -- on
  // n'interroge le serveur que 400ms après la dernière frappe, pas à chaque caractère.
  // searchInput = ce qui s'affiche instantanément dans le champ, search = valeur "validée"
  // qui déclenche réellement l'appel API.
  const [searchInput, setSearchInput] = useState("");
  const [searching, setSearching] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setSearch(searchInput), 400);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // 1. CHARGEMENT INITIAL + RECHERCHE (re-déclenché à chaque frappe validée par le debounce)
  useEffect(() => {
    fetchProduits(search);
  }, [search]);

  // 2. LISTENER SCANNER BARCODE
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

  // 🌟 ÉTAPE 1 : Récupération du catalogue via apiClient, recherche déléguée au serveur
  // (CataloguePagination, core/pagination.py). AVANT : ?page_size=100 chargeait TOUT en
  // mémoire une seule fois puis filtrait côté client -- au-delà de 100 produits (le
  // maximum autorisé par la pagination), la caisse ne pouvait plus vendre certains
  // articles, invisibles car jamais chargés. Désormais, chaque frappe (après debounce)
  // ou scan interroge le serveur avec ?q=, comme /catalogue.
  const fetchProduits = async (q: string = "") => {
    setSearching(true);
    try {
      const res = await apiClient.get('/api/catalogue/', {
        params: { page_size: 30, ...(q.trim() ? { q: q.trim() } : {}) },
      });
      setProduitsDB(res.data.results.produits);
    } catch (err) { 
      console.error("Erreur API Catalogue au comptoir:", err); 
    } finally { 
      setLoading(false);
      setSearching(false);
    }
  };

  // 🎯 Un scan doit trouver le produit peu importe ce qui est actuellement affiché à
  // l'écran (l'ancien code cherchait dans produitsDB, limité aux ~100 premiers produits
  // chargés en mémoire -- un code scanné hors de cette liste ne matchait jamais).
  // On interroge donc le serveur en direct avec le code scanné.
  const handleScan = async (code: string) => {
    const trimmed = code.trim();
    if (!trimmed) return;
    // Coup d'œil rapide dans la liste déjà affichée (évite un aller-retour réseau si le
    // produit est déjà visible), sinon on interroge le serveur par code exact.
    const local = produitsDB.find(prod => prod.identifiant === trimmed || prod.nom.toLowerCase() === trimmed.toLowerCase());
    if (local) { addToCart(local); return; }
    try {
      const res = await apiClient.get('/api/catalogue/', { params: { q: trimmed, page_size: 5 } });
      const resultats: Produit[] = res.data.results.produits;
      const match = resultats.find(p => p.identifiant === trimmed) || resultats.find(p => p.nom.toLowerCase() === trimmed.toLowerCase());
      if (match) addToCart(match);
      else alert(`Aucun produit trouvé pour le code "${trimmed}"`);
    } catch (err) {
      console.error("Erreur recherche scan:", err);
    }
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

  // 🔐 Liste des produits du panier exigeant une ordonnance -- utilisée à la fois pour afficher
  // la case de confirmation et pour bloquer côté UI avant même d'appeler le backend (le backend
  // revérifie de toute façon, c'est juste un confort UX qui évite un aller-retour réseau inutile).
  const produitsNecessitantOrdonnance = panier.filter(item => item.ordonnance_obligatoire);
  const ordonnanceRequise = produitsNecessitantOrdonnance.length > 0;

  // 🌟 ÉTAPE 2 : Encaissement de la Vente Directe Sécurisé par Jeton JWT
  const handleFinalize = async () => {
    if (panier.length === 0) return;
    if (ordonnanceRequise && !ordonnanceVerifiee) return; // Garde-fou supplémentaire côté UI
    setFinalizing(true);
    try {
      const payload = {
        client_infos: clientInfos,
        items: panier.map(i => ({ produit_id: i.id, quantite: i.qte })),
        ordonnance_verifiee_visuellement: ordonnanceVerifiee,
      };
    
      // apiClient injecte automatiquement l'access_token JWT exigé par le guichet Django
      const res = await apiClient.post('/api/vente-directe/', payload);
    
      // 🕒 Petite pause de 500ms pour laisser Django finaliser l'écriture atomique en BDD
      await new Promise(r => setTimeout(r, 500));
    
      setStep('success');
      setShowConfirmModal(false);
      setOrdonnanceVerifiee(false);
      fetchProduits(search); // Rafraîchir les stocks réels, en gardant la recherche en cours
      // Ouverture de la page de facture Next.js locale
      router.push(`/facture?id=${res.data.id}`);
  
    } catch (err: any) {
        alert(err.response?.data?.error || "Erreur lors de la validation de la vente au guichet. Vérifiez les droits caisse.");
    } finally { 
      setFinalizing(false); 
    }
  };

  return (
    <div className="h-screen flex flex-col lg:flex-row gap-4 p-2 lg:p-6 bg-slate-50 dark:bg-black overflow-hidden">
      
      <div className="grow flex flex-col gap-4 overflow-hidden h-full">
        <div className="bg-white dark:bg-slate-900 p-4 lg:p-8 rounded-4xl shadow-sm border border-slate-100 dark:border-slate-800 flex flex-col h-full">
          <div className="flex justify-between items-center mb-6">
             <h2 className="text-2xl lg:text-4xl font-black tracking-tighter dark:text-white uppercase italic">🛒 Point De Vente <span className="text-emerald-500 italic">GUICHET</span></h2>
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
              value={searchInput} onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleScan(searchInput)}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 overflow-y-auto pr-2 scrollbar-hide">
            {searching && (
              <div className="col-span-full flex items-center justify-center py-6 text-slate-400 text-[10px] font-black uppercase tracking-widest gap-2">
                <Loader2 size={14} className="animate-spin" /> Recherche...
              </div>
            )}
            {!searching && produitsDB.length === 0 && (
              <div className="col-span-full flex items-center justify-center py-6 text-slate-400 text-[10px] font-black uppercase tracking-widest">
                Aucun produit trouvé
              </div>
            )}
            {!searching && produitsDB.map((p) => (
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

      <div className="w-full lg:w-100 h-full flex flex-col">
        <div className="bg-slate-950 rounded-[2.5rem] p-6 text-white flex flex-col h-full shadow-2xl relative border border-white/5">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-500">Panier Courant</h3>
            <span className="bg-emerald-500 text-black px-3 py-1 rounded-full text-[10px] font-black">{panier.length}</span>
          </div>

          <div className="grow overflow-y-auto space-y-3 pr-2 scrollbar-hide">
            <AnimatePresence mode="popLayout">
              {panier.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center opacity-20">
                  <ShoppingCart size={48} className="mb-4" />
                  <p className="text-[10px] font-black uppercase tracking-widest">Scanner un produit...</p>
                </div>
              ) : (
                panier.map((item) => (
                  <motion.div key={item.id} layout initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, scale: 0.5 }} className="bg-white/5 p-4 rounded-3xl border border-white/5 flex items-center justify-between">
                    <div className="w-1/2">
                      <p className="text-[10px] font-black uppercase truncate text-slate-200">{item.nom}</p>
                      <p className="text-xs font-black text-emerald-400">{(item.prix * item.qte).toLocaleString()} CFA</p>
                    </div>
                    <div className="flex items-center gap-2 bg-black rounded-lg p-1 border border-white/5">
                      <button aria-label="Retirer un article" onClick={() => updateQte(item.id, -1)} className="p-1 hover:text-emerald-500 border-none bg-transparent cursor-pointer text-white"><Minus size={12}/></button>
                      <span className="text-xs font-black w-4 text-center">{item.qte}</span>
                      <button aria-label="Ajouter un article" onClick={() => updateQte(item.id, 1)} className="p-1 hover:text-emerald-500 border-none bg-transparent cursor-pointer text-white"><Plus size={12}/></button>
                    </div>
                    <button aria-label="Supprimer l'article" onClick={() => setPanier(panier.filter(i => i.id !== item.id))} className="p-2 text-white/20 hover:text-red-500 border-none bg-transparent cursor-pointer"><Trash2 size={14}/></button>
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
              aria-label="Encaisser la transaction"
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
                className="fixed inset-0 bg-slate-900/90 backdrop-blur-md z-100 flex items-center justify-center p-4"
              >
                <motion.div 
                  initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }}
                  className="bg-slate-900 border border-white/10 w-full max-w-lg rounded-[2.5rem] p-6 lg:p-10 flex flex-col max-h-[90vh]"
                >
                  <div className="flex justify-between items-center mb-6">
                    <h3 className="font-black text-white italic tracking-tighter text-xl">COORDONNÉES CLIENT</h3>
                    <X onClick={() => setShowClientModal(false)} className="text-slate-400 cursor-pointer hover:text-white" />
                  </div>

                  <div className="grow overflow-y-auto space-y-5 pr-2 mb-6">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-emerald-500 uppercase ml-4">Nom complet</label>
                      <input type="text" placeholder="Ex: Jean Dupont" className="w-full p-4 bg-white/5 border border-white/10 rounded-2xl text-white outline-none focus:border-emerald-500 transition-colors" value={clientInfos.nom} onChange={e => setClientInfos({...clientInfos, nom: e.target.value})} />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-emerald-500 uppercase ml-4">Téléphone</label>
                      <input type="tel" placeholder="6xx xxx xxx" className="w-full p-4 bg-white/5 border border-white/10 rounded-2xl text-white outline-none focus:border-emerald-500" value={clientInfos.telephone} onChange={e => setClientInfos({...clientInfos, telephone: e.target.value})} />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-emerald-500 uppercase ml-4">Email et Localisation</label>
                      <input 
                        type="email" 
                        placeholder="client@email.com" 
                        className="w-full p-4 bg-white/5 border border-white/10 rounded-2xl text-white outline-none focus:border-emerald-500 transition-colors" 
                        value={clientInfos.email} 
                        onChange={e => setClientInfos({...clientInfos, email: e.target.value})} 
                      />
                    </div>
                    {/* 🌍 GRILLE LOCALISATION : RÉGION & VILLE */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-emerald-500 uppercase ml-4">Région</label>
                        <input 
                          type="text" 
                          placeholder="Ex: Ouest, Centre..." 
                          className="w-full p-4 bg-white/5 border border-white/10 rounded-2xl text-white outline-none focus:border-emerald-500 transition-colors" 
                          value={clientInfos.region} 
                          onChange={e => setClientInfos({...clientInfos, region: e.target.value})} 
                        />
                      </div>
                      
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-emerald-500 uppercase ml-4">Ville</label>
                        <input 
                          type="text" 
                          placeholder="Ex: Bafoussam, Yaoundé..." 
                          className="w-full p-4 bg-white/5 border border-white/10 rounded-2xl text-white outline-none focus:border-emerald-500 transition-colors" 
                          value={clientInfos.ville} 
                          onChange={e => setClientInfos({...clientInfos, ville: e.target.value})} 
                        />
                      </div>
                    </div>

                    {/* 🏡 CHAMP QUARTIER */}
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-emerald-500 uppercase ml-4">Quartier / Adresse descriptive</label>
                      <input 
                        type="text" 
                        placeholder="Ex: Tamdja, face boulangerie..." 
                        className="w-full p-4 bg-white/5 border border-white/10 rounded-2xl text-white outline-none focus:border-emerald-500 transition-colors" 
                        value={clientInfos.quartier} 
                        onChange={e => setClientInfos({...clientInfos, quartier: e.target.value})} 
                      />
                    </div>
                  </div>
                  <button 
                    onClick={() => setShowClientModal(false)}
                    title="Enregistrer les informations du client"
                    aria-label="Enregistrer les informations du client"
                    className="w-full bg-emerald-500 hover:bg-emerald-400 text-black font-black py-4 rounded-xl text-xs uppercase tracking-widest transition-all border-none cursor-pointer"
                  >
                    Enregistrer les Infos
                  </button>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* 🖼️ FENÊTRE DE CONFIRMATION D'ENCAISSEMENT */}
          <AnimatePresence>
            {showConfirmModal && (
              <motion.div 
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} 
                className="fixed inset-0 bg-slate-900/90 backdrop-blur-md z-50 flex items-center justify-center p-4"
              >
                <motion.div 
                  initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }}
                  className="bg-slate-900 border border-white/10 w-full max-w-md rounded-[2.5rem] p-8 text-center"
                >
                  <div className="w-16 h-16 bg-emerald-500/10 text-emerald-500 rounded-full flex items-center justify-center mx-auto mb-6">
                    <Info size={32} />
                  </div>
                  
                  <h3 className="font-black text-white italic tracking-tighter text-2xl uppercase mb-2">Confirmer la vente</h3>
                  <p className="text-slate-400 text-xs mb-8">
                    Le montant total s'élève à <span className="text-emerald-400 font-black">{total.toLocaleString()} CFA</span>. Voulez-vous valider et imprimer le ticket ?
                  </p>

                  {/* 🔐 Confirmation explicite de vérification visuelle d'ordonnance papier,
                      affichée UNIQUEMENT si le panier contient au moins un produit qui l'exige. */}
                  {ordonnanceRequise && (
                    <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 mb-6 text-left">
                      <p className="text-amber-400 text-[11px] font-bold mb-3">
                        ⚠️ Ordonnance requise pour : {produitsNecessitantOrdonnance.map(p => p.nom).join(', ')}
                      </p>
                      <label className="flex items-center gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={ordonnanceVerifiee}
                          onChange={(e) => setOrdonnanceVerifiee(e.target.checked)}
                          className="w-5 h-5 accent-emerald-500 cursor-pointer"
                        />
                        <span className="text-white text-[11px] font-bold">
                          J'ai vérifié l'ordonnance papier du client 👁️
                        </span>
                      </label>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-4">
                    <button 
                      onClick={() => setShowConfirmModal(false)}
                      title="Annuler et retourner au panier"
                      aria-label="Annuler et retourner au panier"
                      className="bg-white/5 hover:bg-white/10 text-white font-black py-4 rounded-xl border border-white/10 cursor-pointer text-xs uppercase tracking-widest transition-all"
                    >
                      Retour
                    </button>
                    <button 
                      disabled={finalizing || (ordonnanceRequise && !ordonnanceVerifiee)}
                      onClick={handleFinalize}
                      title="Valider l'encaissement de la vente"
                      aria-label="Valider l'encaissement de la vente"
                      className="bg-emerald-500 hover:bg-emerald-400 disabled:bg-slate-800 disabled:cursor-not-allowed text-black font-black py-4 rounded-xl cursor-pointer border-none text-xs uppercase tracking-widest transition-all shadow-lg"
                    >
                      {finalizing ? "Validation..." : "Confirmer"}
                    </button>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* 🎉 ÉCRAN DE SUCCÈS RAPIDE (NOTIFICATION) */}
          <AnimatePresence>
            {step === 'success' && (
              <motion.div 
                initial={{ opacity: 0, y: -50 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -50 }}
                className="absolute top-6 left-6 right-6 bg-emerald-500 text-black p-4 rounded-2xl flex items-center justify-between shadow-2xl z-50 border border-emerald-400"
              >
                <div className="flex items-center gap-3">
                  <CheckCircle2 size={20} strokeWidth={3} />
                  <span className="text-xs font-black uppercase tracking-wide">Vente guichet enregistrée avec succès !</span>
                </div>
                <button
                  onClick={() => { setStep('cart'); setPanier([]); setClientInfos({ nom: "", telephone: "", email: "", region: "", ville: "", quartier: "", }); }}
                  title="Nouvelle transaction au comptoir"
                  aria-label="Nouvelle transaction au comptoir"
                  className="bg-black text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider hover:bg-slate-900 border-none cursor-pointer transition-all"
                >
                  Nouveau Client
                </button>
              </motion.div>
            )}
          </AnimatePresence>

        </div>
      </div>
    </div>
  );
}
