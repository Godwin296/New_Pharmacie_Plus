"use client";
import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ShoppingCart, FilePlus, ClipboardCheck,
  AlertTriangle, XCircle, RefreshCw,
  CreditCard, ChevronLeft, Loader2,
  CheckCircle2, Minus, Plus, Trash2
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

// 🌟 CONFIGURATION : Importation de l'apiClient unifié
import apiClient from '../../lib/apiClient';
import { ReconnectingSocket } from '../../lib/wsClient';
import Prix from '../../lib/components/Prix';
import { useOfflinePanier } from '../../lib/hooks/useOfflinePanier';
import { supprimerDeFileAttente } from '../../lib/offline/panierQueue';
import { WifiOff, RotateCw } from 'lucide-react';
import { useToast, ToastContainer } from '../../lib/hooks/useToast';

export default function PanierPage() {
  const router = useRouter();
  const { toasts, showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [commande, setCommande] = useState<any>(null);
  const [status, setStatus] = useState<'REFUSED' | 'MISSING_DOC' | 'PENDING_VAL' | 'VALIDATED' | 'PAIEMENT_SOUMIS' | 'PRETE_A_RETIRER' | 'EMPTY'>('EMPTY');
  const socketRef = useRef<ReconnectingSocket | null>(null);
  // 🆕 (30/07) items dont une modification de quantité/suppression est en cours -- désactive
  // leurs boutons le temps de la requête, pour éviter un double-clic qui déclenche 2 appels.
  const [itemsEnCours, setItemsEnCours] = useState<Set<number>>(new Set());

  const { file: fileAttente, isOnline, syncing, synchroniser, rafraichirFile } = useOfflinePanier();
  const syncingPrecedent = useRef(false);
  useEffect(() => {
    if (syncingPrecedent.current && !syncing) {
      fetchPanier();
    }
    syncingPrecedent.current = syncing;
  }, [syncing]);

  const [showPaiementModal, setShowPaiementModal] = useState(false);
  const [infosPaiement, setInfosPaiement] = useState<{
    numero_orange_money: string; nom_titulaire_orange_money: string;
    numero_mtn_momo: string; nom_titulaire_mtn_momo: string;
  } | null>(null);
  const [moyenChoisi, setMoyenChoisi] = useState<'orange_money' | 'mtn_momo' | ''>('');
  const [referencePaiement, setReferencePaiement] = useState('');
  const [soumissionLoading, setSoumissionLoading] = useState(false);
  const [erreurPaiement, setErreurPaiement] = useState('');

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
      const res = await apiClient.get('/api/panier/');
      const data = res.data;
      if (!data.items || data.items.length === 0) {
        setStatus('EMPTY');
        setCommande(null);
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

  // 🆕 (30/07) MODIFIER LA QUANTITÉ D'UN ARTICLE -- endpoint backend créé pour l'occasion
  // (PATCH /api/panier/item/<id>/) : jusqu'ici il n'existait qu'un ajout/incrément, aucun
  // moyen de corriger ou diminuer une quantité sans vider tout le panier.
  const modifierQuantite = async (item: any, delta: number) => {
    const nouvelleQte = item.quantite + delta;
    if (nouvelleQte <= 0) {
      retirerItem(item);
      return;
    }
    setItemsEnCours((prev) => new Set(prev).add(item.id));
    try {
      const res = await apiClient.patch(`/api/panier/item/${item.id}/`, { quantite: nouvelleQte });
      setCommande(res.data);
      setStatus(determinerStatut(res.data));
    } catch (err: any) {
      showToast(err.response?.data?.error || "Impossible de modifier la quantité", "error");
    } finally {
      setItemsEnCours((prev) => { const next = new Set(prev); next.delete(item.id); return next; });
    }
  };

  // 🆕 (30/07) RETIRER UN ARTICLE -- DELETE /api/panier/item/<id>/
  const retirerItem = async (item: any) => {
    setItemsEnCours((prev) => new Set(prev).add(item.id));
    try {
      const res = await apiClient.delete(`/api/panier/item/${item.id}/`);
      if (!res.data.items || res.data.items.length === 0) {
        setStatus('EMPTY');
        setCommande(null);
      } else {
        setCommande(res.data);
        setStatus(determinerStatut(res.data));
      }
      showToast(`${item.produit_nom} retiré du panier`, "info");
    } catch (err: any) {
      showToast(err.response?.data?.error || "Impossible de retirer cet article", "error");
    } finally {
      setItemsEnCours((prev) => { const next = new Set(prev); next.delete(item.id); return next; });
    }
  };

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
      await apiClient.post(`/api/commandes/${commande.id}/soumettre-paiement/`, {
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

  const panierModifiable = status === 'VALIDATED' || status === 'MISSING_DOC' || status === 'REFUSED';

  if (loading) return (
    <div className="h-screen flex flex-col items-center justify-center gap-3 bg-slate-50 dark:bg-[#050e0c]">
      <Loader2 className="animate-spin text-emerald-500" size={40} />
      <p className="font-display text-sm font-medium text-slate-400">Chargement du panier…</p>
    </div>
  );

  return (
    <div className="max-w-[950px] mx-auto px-5 sm:px-6 py-8 sm:py-12 pb-28">

      <div className="flex items-center gap-3.5 mb-8">
        <div className="w-12 h-12 bg-emerald-500 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-emerald-500/20">
          <ShoppingCart size={22} />
        </div>
        <div>
          <h2 className="font-display text-2xl font-bold text-slate-800 dark:text-white">Mon panier</h2>
          {commande?.items?.length > 0 && (
            <p className="text-[13px] text-slate-400">{commande.items.length} article{commande.items.length > 1 ? 's' : ''}</p>
          )}
        </div>
      </div>

      {/* 🚀 MODE OFFLINE : items ajoutés sans réseau, en attente de synchronisation */}
      {fileAttente.length > 0 && (
        <div className="mb-6 bg-amber-50 dark:bg-amber-500/10 rounded-[24px] border border-amber-200 dark:border-amber-500/20 p-5">
          <div className="flex items-center justify-between mb-3 flex-wrap gap-3">
            <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
              <WifiOff size={16} />
              <span className="font-semibold text-[13px]">
                {fileAttente.length} article{fileAttente.length > 1 ? 's' : ''} en attente de synchronisation
              </span>
            </div>
            <button
              onClick={synchroniser}
              disabled={syncing || !isOnline}
              className="flex items-center gap-1.5 bg-amber-500 hover:bg-amber-600 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold text-[12px] px-3.5 py-2 rounded-xl border-none cursor-pointer transition-colors"
            >
              <RotateCw size={13} className={syncing ? "animate-spin" : ""} />
              {syncing ? "Synchronisation…" : isOnline ? "Synchroniser" : "Hors-ligne"}
            </button>
          </div>
          <div className="space-y-2">
            {fileAttente.map((item) => (
              <div key={item.localId} className="flex items-center justify-between bg-white/60 dark:bg-white/[0.04] rounded-xl px-4 py-2.5">
                <div>
                  <p className="font-semibold text-sm text-slate-800 dark:text-white">{item.nom} <span className="text-slate-400 font-normal">× {item.quantite}</span></p>
                  {item.statut === 'erreur' && (
                    <p className="text-[12px] text-red-500 font-medium mt-0.5">{item.erreur || "Échec de la synchronisation"}</p>
                  )}
                  {item.statut === 'en_cours' && (
                    <p className="text-[12px] text-amber-500 font-medium mt-0.5">Synchronisation en cours…</p>
                  )}
                </div>
                {item.statut === 'erreur' && (
                  <button
                    onClick={async () => { await supprimerDeFileAttente(item.localId); rafraichirFile(); }}
                    className="text-[12px] font-semibold text-red-500 hover:text-red-600 bg-transparent border-none cursor-pointer"
                  >
                    Retirer
                  </button>
                )}
              </div>
            ))}
          </div>
          {!isOnline && (
            <p className="mt-3 text-[12px] text-amber-600 dark:text-amber-400">
              Toujours hors-ligne : la synchronisation reprendra automatiquement dès que la connexion reviendra.
            </p>
          )}
        </div>
      )}

      <div className="bg-white dark:bg-white/[0.04] rounded-[28px] shadow-sm border border-slate-100 dark:border-white/10 overflow-hidden">

        {status !== 'EMPTY' ? (
          <>
            <div className="p-2">
              {commande?.items.map((item: any, i: number) => {
                const enCours = itemsEnCours.has(item.id);
                return (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                    key={item.id}
                    className="flex items-center gap-4 p-4 sm:p-5 border-b border-slate-50 dark:border-white/[0.06] last:border-none"
                  >
                    <div className="w-12 h-12 shrink-0 rounded-2xl bg-emerald-50 dark:bg-emerald-500/10 flex items-center justify-center">
                      <ShoppingCart size={18} className="text-emerald-300 dark:text-emerald-600" />
                    </div>

                    <div className="min-w-0 flex-grow">
                      <h6 className="font-semibold text-slate-800 dark:text-white text-sm truncate">{item.produit_nom}</h6>
                      <Prix montant={item.prix_unitaire} className="text-[12px] text-slate-400" /> <span className="text-[12px] text-slate-400">/ unité</span>
                    </div>

                    {/* 🆕 Stepper quantité -- remplace l'ancien affichage figé "Qté : X" */}
                    {panierModifiable ? (
                      <div className="flex items-center gap-1 bg-slate-50 dark:bg-white/[0.04] rounded-full p-1 shrink-0">
                        <button
                          onClick={() => modifierQuantite(item, -1)}
                          disabled={enCours}
                          aria-label="Diminuer la quantité"
                          className="h-8 w-8 flex items-center justify-center rounded-full bg-white dark:bg-white/[0.06] text-slate-500 dark:text-slate-300 border-none cursor-pointer disabled:opacity-40 active:scale-90 transition-transform"
                        >
                          <Minus size={13} />
                        </button>
                        <span className="w-7 text-center text-sm font-semibold text-slate-700 dark:text-white">{item.quantite}</span>
                        <button
                          onClick={() => modifierQuantite(item, 1)}
                          disabled={enCours}
                          aria-label="Augmenter la quantité"
                          className="h-8 w-8 flex items-center justify-center rounded-full bg-white dark:bg-white/[0.06] text-slate-500 dark:text-slate-300 border-none cursor-pointer disabled:opacity-40 active:scale-90 transition-transform"
                        >
                          <Plus size={13} />
                        </button>
                      </div>
                    ) : (
                      <span className="text-[12px] font-medium text-slate-400 shrink-0 bg-slate-50 dark:bg-white/[0.04] px-3 py-1.5 rounded-full">
                        × {item.quantite}
                      </span>
                    )}

                    <div className="text-sm font-bold text-slate-800 dark:text-white w-20 text-right shrink-0">
                      <Prix montant={item.total_item} />
                    </div>

                    {/* 🆕 Retirer l'article -- désactivé une fois la commande soumise en paiement */}
                    {panierModifiable && (
                      <button
                        onClick={() => retirerItem(item)}
                        disabled={enCours}
                        aria-label={`Retirer ${item.produit_nom}`}
                        className="h-10 w-10 flex items-center justify-center rounded-full text-slate-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 border-none cursor-pointer disabled:opacity-40 transition-colors shrink-0"
                      >
                        {enCours ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}
                      </button>
                    )}
                  </motion.div>
                );
              })}
            </div>

            {panierModifiable && (
              <div className="px-5 pb-4">
                <Link href="/catalogue" className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-emerald-600 dark:text-emerald-400 no-underline">
                  <ChevronLeft size={14} /> Continuer mes achats
                </Link>
              </div>
            )}

            <div className="bg-slate-50 dark:bg-white/[0.02] p-6 sm:p-8 border-t border-slate-100 dark:border-white/10">
              <div className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-8">

                <div>
                  <p className="text-[12px] font-semibold text-slate-400 mb-1">Total de votre commande</p>
                  <Prix montant={commande?.total_general} className="text-3xl font-display font-bold text-emerald-600 dark:text-emerald-400" />
                </div>

                <div className="w-full lg:w-96 space-y-3">
                  <AnimatePresence mode="wait">

                    {status === 'REFUSED' && (
                      <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} className="space-y-3">
                        <div className="bg-red-50 dark:bg-red-500/10 p-4 rounded-2xl border border-red-100 dark:border-red-500/20 text-red-600 dark:text-red-400">
                          <div className="flex items-center gap-2 mb-1.5 font-semibold text-[13px]"><XCircle size={14} /> Document refusé</div>
                          <p className="text-[12px]">{commande.motif_refus}</p>
                        </div>
                        <button onClick={() => router.push(`/ordonnance/upload?id=${commande.id}`)} className="w-full bg-red-600 hover:bg-red-700 text-white font-semibold py-3.5 rounded-2xl shadow-md flex items-center justify-center gap-2 border-none cursor-pointer text-sm transition-colors">
                          <RefreshCw size={15} /> Renvoyer l&apos;ordonnance
                        </button>
                      </motion.div>
                    )}

                    {status === 'MISSING_DOC' && (
                      <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} className="space-y-3">
                        <div className="bg-amber-50 dark:bg-amber-500/10 p-4 rounded-2xl border border-amber-100 dark:border-amber-500/20 text-amber-700 dark:text-amber-400 flex items-center gap-2.5 text-[13px] font-medium"><AlertTriangle size={16} /> Une ordonnance est requise pour ce panier.</div>
                        <button onClick={() => router.push(`/ordonnance/upload?id=${commande.id}`)} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3.5 rounded-2xl shadow-md flex items-center justify-center gap-2 border-none cursor-pointer text-sm transition-colors">
                          <FilePlus size={15} /> Joindre l&apos;ordonnance
                        </button>
                      </motion.div>
                    )}

                    {status === 'PENDING_VAL' && (
                      <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} className="space-y-3">
                        <div className="bg-blue-50 dark:bg-blue-500/10 p-4 rounded-2xl border border-blue-100 dark:border-blue-500/20 text-blue-600 dark:text-blue-400 flex items-center gap-2.5 text-[13px] font-medium">
                          <RefreshCw size={16} className="animate-spin" /> Vérification par la pharmacie…
                        </div>
                        <p className="text-[11px] text-center text-slate-400">
                          Suivi en direct — cette page se met à jour automatiquement
                        </p>
                        <button disabled className="w-full bg-slate-100 dark:bg-white/[0.04] text-slate-400 font-semibold py-3.5 rounded-2xl border-none cursor-not-allowed text-sm">Patientez…</button>
                      </motion.div>
                    )}

                    {status === 'VALIDATED' && (
                      <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} className="space-y-3">
                        <div className="bg-emerald-50 dark:bg-emerald-500/10 p-4 rounded-2xl border border-emerald-100 dark:border-emerald-500/20 text-emerald-700 dark:text-emerald-400 flex items-center gap-2.5 text-[13px] font-medium"><CheckCircle2 size={16} /> Prêt pour le paiement</div>
                        <button
                          onClick={ouvrirModalPaiement}
                          className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-semibold py-4 rounded-2xl shadow-lg shadow-emerald-500/20 transition-colors flex items-center justify-center gap-2 border-none cursor-pointer text-sm"
                        >
                          Confirmer et payer <CreditCard size={16} />
                        </button>
                      </motion.div>
                    )}

                    {status === 'PAIEMENT_SOUMIS' && (
                      <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} className="space-y-3">
                        <div className="bg-amber-50 dark:bg-amber-500/10 p-4 rounded-2xl border border-amber-100 dark:border-amber-500/20 text-amber-700 dark:text-amber-400 flex items-center gap-2.5 text-[13px] font-medium">
                          <RefreshCw size={16} className="animate-spin" /> Paiement en cours de vérification…
                        </div>
                        <p className="text-[11px] text-center text-slate-400">
                          Suivi en direct — vous serez notifié dès confirmation
                        </p>
                      </motion.div>
                    )}

                    {status === 'PRETE_A_RETIRER' && (
                      <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} className="space-y-3">
                        <div className="bg-emerald-50 dark:bg-emerald-500/10 p-4 rounded-2xl border border-emerald-100 dark:border-emerald-500/20 text-emerald-700 dark:text-emerald-400 flex items-center gap-2.5 text-[13px] font-medium">
                          <CheckCircle2 size={16} /> Paiement confirmé — votre commande est prête au guichet.
                        </div>
                        {commande?.reference && (
                          <p className="text-center text-[12px] text-slate-400">
                            Référence à présenter : <span className="text-slate-700 dark:text-slate-200 font-mono font-semibold">{commande.reference}</span>
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
          <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
            <div className="h-16 w-16 rounded-full bg-slate-50 dark:bg-white/[0.04] flex items-center justify-center mb-5">
              <ShoppingCart size={28} className="text-slate-300 dark:text-slate-600" />
            </div>
            <h4 className="font-display text-lg font-bold text-slate-700 dark:text-white">Votre panier est vide</h4>
            <p className="text-[13px] text-slate-400 mt-1 mb-6">Parcourez le catalogue pour trouver ce dont vous avez besoin.</p>
            <Link href="/catalogue" className="bg-emerald-500 hover:bg-emerald-600 text-white px-6 py-3.5 rounded-2xl font-semibold text-sm shadow-lg shadow-emerald-500/20 no-underline inline-flex items-center gap-2 transition-colors">
              Voir le catalogue <ChevronLeft size={16} className="rotate-180" />
            </Link>
          </div>
        )}
      </div>

      {/* 💰 MODAL DE PAIEMENT MANUEL */}
      <AnimatePresence>
        {showPaiementModal && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-end sm:items-center justify-center">
            <motion.div
              initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              className="bg-white dark:bg-[#0b1a16] p-6 sm:p-8 rounded-t-[28px] sm:rounded-[28px] max-w-md w-full sm:mb-4 shadow-2xl"
            >
              <h3 className="font-display font-bold text-slate-800 dark:text-white text-lg mb-1.5">
                Paiement Mobile Money
              </h3>
              <p className="text-slate-400 text-[13px] mb-5">
                Effectuez votre transfert vers l&apos;un des numéros ci-dessous, puis renseignez la référence reçue par SMS.
              </p>

              {infosPaiement && (
                <div className="space-y-2.5 mb-5">
                  {infosPaiement.numero_orange_money && (
                    <button
                      onClick={() => setMoyenChoisi('orange_money')}
                      className={`w-full p-4 rounded-2xl border-2 text-left transition-all cursor-pointer ${moyenChoisi === 'orange_money' ? 'border-orange-500 bg-orange-50 dark:bg-orange-500/10' : 'border-slate-100 dark:border-white/10 bg-slate-50 dark:bg-white/[0.04]'}`}
                    >
                      <p className="text-[11px] font-semibold text-orange-500 mb-1">Orange Money</p>
                      <p className="font-semibold text-slate-800 dark:text-white">{infosPaiement.numero_orange_money}</p>
                      {infosPaiement.nom_titulaire_orange_money && (
                        <p className="text-[12px] text-slate-400">{infosPaiement.nom_titulaire_orange_money}</p>
                      )}
                    </button>
                  )}
                  {infosPaiement.numero_mtn_momo && (
                    <button
                      onClick={() => setMoyenChoisi('mtn_momo')}
                      className={`w-full p-4 rounded-2xl border-2 text-left transition-all cursor-pointer ${moyenChoisi === 'mtn_momo' ? 'border-yellow-500 bg-yellow-50 dark:bg-yellow-500/10' : 'border-slate-100 dark:border-white/10 bg-slate-50 dark:bg-white/[0.04]'}`}
                    >
                      <p className="text-[11px] font-semibold text-yellow-600 mb-1">MTN MoMo</p>
                      <p className="font-semibold text-slate-800 dark:text-white">{infosPaiement.numero_mtn_momo}</p>
                      {infosPaiement.nom_titulaire_mtn_momo && (
                        <p className="text-[12px] text-slate-400">{infosPaiement.nom_titulaire_mtn_momo}</p>
                      )}
                    </button>
                  )}
                  {!infosPaiement.numero_orange_money && !infosPaiement.numero_mtn_momo && (
                    <p className="text-amber-600 text-[13px] font-medium text-center py-4">
                      Cette pharmacie n&apos;a pas encore configuré de moyen de paiement mobile money.
                    </p>
                  )}
                </div>
              )}

              <label className="text-[12px] font-semibold text-slate-500 dark:text-slate-400 mb-1.5 block">
                Référence de transaction (reçue par SMS)
              </label>
              <input
                type="text"
                value={referencePaiement}
                onChange={(e) => setReferencePaiement(e.target.value)}
                placeholder="Ex : MP240615.1234.A56789"
                className="w-full p-3.5 rounded-2xl bg-slate-50 dark:bg-white/[0.04] border border-slate-200 dark:border-white/10 outline-none font-medium text-sm dark:text-white mb-4 focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-400 transition-all"
              />

              {erreurPaiement && (
                <p className="text-red-500 text-[13px] font-medium mb-4 text-center">{erreurPaiement}</p>
              )}

              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => { setShowPaiementModal(false); setErreurPaiement(''); }}
                  className="bg-slate-100 dark:bg-white/[0.06] text-slate-600 dark:text-slate-300 font-semibold py-3.5 rounded-2xl border-none cursor-pointer text-sm"
                >
                  Annuler
                </button>
                <button
                  disabled={soumissionLoading}
                  onClick={handleSoumettrePaiement}
                  className="bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white font-semibold py-3.5 rounded-2xl border-none cursor-pointer text-sm transition-colors"
                >
                  {soumissionLoading ? "Envoi…" : "Confirmer"}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <ToastContainer toasts={toasts} />
    </div>
  );
}
