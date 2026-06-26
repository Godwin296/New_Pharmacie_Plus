"use client";
import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ShoppingCart, FilePlus, ClipboardCheck, 
  AlertTriangle, XCircle, RefreshCw, 
  CreditCard, ChevronLeft, Loader2,
  CheckCircle2 
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

// 🌟 CONFIGURATION : Importation de l'apiClient unifié
import apiClient from '../../lib/apiClient'; // Ajustez le chemin selon votre dossier app/panier
import { ReconnectingSocket } from '../../lib/wsClient';

export default function PanierPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [commande, setCommande] = useState<any>(null);
  const [status, setStatus] = useState<'REFUSED' | 'MISSING_DOC' | 'PENDING_VAL' | 'VALIDATED' | 'PAIEMENT_SOUMIS' | 'PRETE_A_RETIRER' | 'EMPTY'>('EMPTY');
  const socketRef = useRef<ReconnectingSocket | null>(null);

  // 💰 État du modal de paiement manuel
  const [showPaiementModal, setShowPaiementModal] = useState(false);
  const [infosPaiement, setInfosPaiement] = useState<{
    numero_orange_money: string; nom_titulaire_orange_money: string;
    numero_mtn_momo: string; nom_titulaire_mtn_momo: string;
  } | null>(null);
  const [moyenChoisi, setMoyenChoisi] = useState<'orange_money' | 'mtn_momo' | ''>('');
  const [referencePaiement, setReferencePaiement] = useState('');
  const [soumissionLoading, setSoumissionLoading] = useState(false);
  const [erreurPaiement, setErreurPaiement] = useState('');

  // 🌟 RÉCUPÉRATION DU PANIER RÉEL STABILISÉE
  const determinerStatut = (data: any) => {
    if (!data.items || data.items.length === 0) return 'EMPTY';
    if (data.statut === 'payee_a_retirer' || data.statut === 'retiree') return 'PRETE_A_RETIRER';
    if (data.statut === 'paiement_a_verifier') return 'PAIEMENT_SOUMIS';
    if (data.motif_refus) return 'REFUSED';
    if (data.statut === 'attente_validation') return 'PENDING_VAL';
    if (data.items.some((it: any) => it.ordonnance_requise) && !data.ordonnance_valide && !data.ordonnance) return 'MISSING_DOC';
    return 'VALIDATED';
  };

  const fetchPanier = async () => {
    try {
      // apiClient ajoute l'URL du tunnel, injecte le Token Bearer et cible /api/panier/ avec le slash final
      const res = await apiClient.get('/api/panier/');
      const data = res.data;

      if (!data.items || data.items.length === 0) {
        setStatus('EMPTY');
      } else {
        setCommande(data);
        setStatus(determinerStatut(data));
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

  // 🔴 TEMPS RÉEL : dès que la commande a un id (chargée depuis l'API), on se connecte
  // au canal de suivi propre à CETTE commande -> le client voit le statut changer en direct,
  // sans avoir à recharger la page pour savoir si la caisse a traité son ordonnance.
  useEffect(() => {
    if (!commande?.id) return;

    const socket = new ReconnectingSocket(`/ws/commandes/${commande.id}/`);
    socketRef.current = socket;

    socket.onMessage((data) => {
      if (data.type === 'statut_mis_a_jour') {
        setCommande((prev: any) => prev ? {
          ...prev,
          statut: data.statut,
          ordonnance_valide: data.ordonnance_valide,
          motif_refus: data.motif_refus,
        } : prev);
        setStatus(determinerStatut({ ...commande, ...data }));
      }
    });

    socket.connect();
    return () => socket.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [commande?.id]);

  // 💰 Ouverture du modal de paiement : récupère les numéros mobile money propres à CETTE
  // pharmacie (jamais codés en dur -- chaque tenant a configuré les siens dans ses paramètres).
  const ouvrirModalPaiement = async () => {
    setErreurPaiement('');
    try {
      const res = await apiClient.get('/api/infos-paiement/');
      setInfosPaiement(res.data);
      setShowPaiementModal(true);
    } catch (err) {
      setErreurPaiement("Impossible de récupérer les informations de paiement de la pharmacie. Merci de réessayer.");
    }
  };

  // 💰 Soumission de la référence de transaction : la commande passe en "paiement_a_verifier"
  // côté backend -- le stock n'est PAS encore décrémenté, ça n'arrivera qu'après vérification
  // manuelle par la caisse (cf. api_confirmer_paiement, déjà testé de bout en bout).
  const handleSoumettrePaiement = async () => {
    if (!moyenChoisi) {
      setErreurPaiement("Merci de choisir un moyen de paiement.");
      return;
    }
    if (!referencePaiement.trim()) {
      setErreurPaiement("Merci de renseigner la référence de transaction reçue par SMS.");
      return;
    }
    setSoumissionLoading(true);
    setErreurPaiement('');
    try {
      const res = await apiClient.post(`/api/commandes/${commande.id}/soumettre-paiement/`, {
        moyen_paiement: moyenChoisi,
        reference_paiement: referencePaiement.trim(),
      });
      setShowPaiementModal(false);
      setStatus('PAIEMENT_SOUMIS');
      setCommande((prev: any) => ({ ...prev, statut: 'paiement_a_verifier' }));
    } catch (err: any) {
      setErreurPaiement(err.response?.data?.error || "Une erreur est survenue. Merci de réessayer.");
    } finally {
      setSoumissionLoading(false);
    }
  };

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
                        <p className="text-[10px] text-center text-slate-400 font-black uppercase tracking-widest">
                          🔴 Suivi en direct — cette page se mettra à jour automatiquement
                        </p>
                        <button className="w-full bg-slate-200 dark:bg-slate-800 text-slate-400 font-black py-5 rounded-2xl border-none cursor-not-allowed text-[10px] uppercase tracking-widest">Patientez svp...</button>
                      </motion.div>
                    )}

                    {status === 'VALIDATED' && (
                      <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="space-y-4">
                        <div className="bg-emerald-50 dark:bg-emerald-500/10 p-5 rounded-2xl border border-emerald-100 text-emerald-600 flex items-center gap-3 text-xs font-bold"><CheckCircle2 size={18} /> Prêt pour le paiement !</div>
                        <button
                          onClick={ouvrirModalPaiement}
                          className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-black py-6 rounded-[2rem] shadow-2xl transition-all flex items-center justify-center gap-3 border-none cursor-pointer text-sm uppercase tracking-widest"
                        >
                          Confirmer et Payer <CreditCard />
                        </button>
                      </motion.div>
                    )}

                    {status === 'PAIEMENT_SOUMIS' && (
                      <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="space-y-4">
                        <div className="bg-amber-50 dark:bg-amber-500/10 p-5 rounded-2xl border border-amber-100 text-amber-600 flex items-center gap-3 text-xs font-bold italic">
                          <RefreshCw size={18} className="animate-spin" /> Paiement en cours de vérification par la pharmacie...
                        </div>
                        <p className="text-[10px] text-center text-slate-400 font-black uppercase tracking-widest">
                          🔴 Suivi en direct — vous serez notifié dès confirmation
                        </p>
                      </motion.div>
                    )}

                    {status === 'PRETE_A_RETIRER' && (
                      <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="space-y-4">
                        <div className="bg-emerald-50 dark:bg-emerald-500/10 p-5 rounded-2xl border border-emerald-100 text-emerald-600 flex items-center gap-3 text-xs font-bold">
                          <CheckCircle2 size={18} /> Paiement confirmé ! Votre commande est prête au guichet.
                        </div>
                        {commande?.reference && (
                          <p className="text-center text-[11px] text-slate-400 font-bold">
                            Référence à présenter : <span className="text-slate-700 dark:text-slate-200 font-mono">{commande.reference}</span>
                          </p>
                        )}
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

      {/* 💰 MODAL DE PAIEMENT MANUEL : numéros propres à CETTE pharmacie + saisie de référence */}
      <AnimatePresence>
        {showPaiementModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-100 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}
              className="bg-white dark:bg-slate-900 p-8 rounded-[2rem] max-w-md w-full shadow-2xl"
            >
              <h3 className="font-black text-slate-800 dark:text-white text-xl uppercase tracking-tighter mb-2">
                Paiement mobile money
              </h3>
              <p className="text-slate-400 text-xs mb-6">
                Effectuez votre transfert vers l'un des numéros ci-dessous, puis renseignez la référence reçue par SMS.
              </p>

              {infosPaiement && (
                <div className="space-y-3 mb-6">
                  {infosPaiement.numero_orange_money && (
                    <button
                      onClick={() => setMoyenChoisi('orange_money')}
                      className={`w-full p-4 rounded-2xl border-2 text-left transition-all cursor-pointer ${moyenChoisi === 'orange_money' ? 'border-orange-500 bg-orange-50 dark:bg-orange-500/10' : 'border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800'}`}
                    >
                      <p className="text-[10px] font-black text-orange-500 uppercase tracking-widest mb-1">🟠 Orange Money</p>
                      <p className="font-bold text-slate-800 dark:text-white">{infosPaiement.numero_orange_money}</p>
                      {infosPaiement.nom_titulaire_orange_money && (
                        <p className="text-[11px] text-slate-400">{infosPaiement.nom_titulaire_orange_money}</p>
                      )}
                    </button>
                  )}
                  {infosPaiement.numero_mtn_momo && (
                    <button
                      onClick={() => setMoyenChoisi('mtn_momo')}
                      className={`w-full p-4 rounded-2xl border-2 text-left transition-all cursor-pointer ${moyenChoisi === 'mtn_momo' ? 'border-yellow-500 bg-yellow-50 dark:bg-yellow-500/10' : 'border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800'}`}
                    >
                      <p className="text-[10px] font-black text-yellow-600 uppercase tracking-widest mb-1">🟡 MTN MoMo</p>
                      <p className="font-bold text-slate-800 dark:text-white">{infosPaiement.numero_mtn_momo}</p>
                      {infosPaiement.nom_titulaire_mtn_momo && (
                        <p className="text-[11px] text-slate-400">{infosPaiement.nom_titulaire_mtn_momo}</p>
                      )}
                    </button>
                  )}
                  {!infosPaiement.numero_orange_money && !infosPaiement.numero_mtn_momo && (
                    <p className="text-amber-600 text-xs font-bold text-center py-4">
                      Cette pharmacie n'a pas encore configuré de moyen de paiement mobile money.
                    </p>
                  )}
                </div>
              )}

              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">
                Référence de transaction (reçue par SMS)
              </label>
              <input
                type="text"
                value={referencePaiement}
                onChange={(e) => setReferencePaiement(e.target.value)}
                placeholder="Ex: MP240615.1234.A56789"
                className="w-full p-4 rounded-2xl bg-slate-50 dark:bg-slate-800 border-none outline-none font-bold text-sm dark:text-white mb-4"
              />

              {erreurPaiement && (
                <p className="text-red-500 text-xs font-bold mb-4 text-center">{erreurPaiement}</p>
              )}

              <div className="grid grid-cols-2 gap-4">
                <button
                  onClick={() => { setShowPaiementModal(false); setErreurPaiement(''); }}
                  className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-black py-4 rounded-xl border-none cursor-pointer text-xs uppercase tracking-widest"
                >
                  Annuler
                </button>
                <button
                  disabled={soumissionLoading}
                  onClick={handleSoumettrePaiement}
                  className="bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white font-black py-4 rounded-xl border-none cursor-pointer text-xs uppercase tracking-widest"
                >
                  {soumissionLoading ? "Envoi..." : "Confirmer"}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
