"use client";
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  History, X, CheckCircle2, Clock, XCircle, ArrowLeft, Loader2, Package, Store, Hash,
} from 'lucide-react';
import Link from 'next/link';
import apiClient from '../../lib/apiClient';
import Prix from '../../lib/components/Prix';
import { useConfigPharmacie } from '../../lib/context/ConfigPharmacieContext';
import { useToast, ToastContainer } from '../../lib/hooks/useToast';

// 📱 REFONTE MOBILE (01/08) : l'ancienne page utilisait de grosses cartes "SaaS desktop"
// (grille multi-colonnes, accordéon interne) et un bouton de téléchargement de facture
// cassé (window.open() sur une route protégée par JWT -- l'en-tête Authorization ne part
// jamais avec window.open(), d'où l'échec systématique constaté). Décision : retirer ce
// bouton (et toute la logique backend dédiée côté client, voir core/views.py::
// export_facture_pdf) plutôt que le réparer, et reconstruire la page entière sur le même
// pattern que le catalogue -- lignes compactes tapables, détails dans une feuille modale
// mobile (pas un accordéon qui pousse le contenu).
type ItemCommande = { id: number; produit_nom: string; quantite: number; prix_unitaire: number; total_item: number };
type Commande = {
  id: number; statut: string; date: string; payee: boolean;
  total_general: number; items: ItemCommande[];
};

const STATUT_STYLES: Record<string, { label: string; icon: typeof CheckCircle2; classe: string }> = {
  payee: { label: 'Payée', icon: CheckCircle2, classe: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-900/30' },
  payee_a_retirer: { label: 'Prête à retirer', icon: CheckCircle2, classe: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-900/30' },
  retiree: { label: 'Retirée', icon: CheckCircle2, classe: 'text-slate-500 bg-slate-100 dark:bg-white/[0.06]' },
  attente_validation: { label: "En attente de validation", icon: Clock, classe: 'text-amber-600 bg-amber-50 dark:bg-amber-900/20' },
  paiement_a_verifier: { label: 'Paiement à vérifier', icon: Clock, classe: 'text-amber-600 bg-amber-50 dark:bg-amber-900/20' },
  en_cours: { label: 'En cours', icon: Clock, classe: 'text-blue-600 bg-blue-50 dark:bg-blue-900/20' },
  annulee: { label: 'Annulée', icon: XCircle, classe: 'text-red-500 bg-red-50 dark:bg-red-900/20' },
  refusee: { label: 'Refusée', icon: XCircle, classe: 'text-red-500 bg-red-50 dark:bg-red-900/20' },
};
const styleStatut = (s: string) => STATUT_STYLES[s] || { label: s, icon: Clock, classe: 'text-slate-500 bg-slate-100 dark:bg-white/[0.06]' };

export default function MesCommandes() {
  const [commandes, setCommandes] = useState<Commande[]>([]);
  const [loading, setLoading] = useState(true);
  const [commandeOuverte, setCommandeOuverte] = useState<Commande | null>(null);
  const { config } = useConfigPharmacie();
  const { toasts, showToast } = useToast();

  useEffect(() => {
    apiClient.get('/api/commandes/')
      .then((res) => setCommandes(res.data))
      .catch(() => showToast("Impossible de charger vos commandes.", "error"))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-[var(--color-mist)] dark:bg-[#050e0c] text-emerald-500">
        <Loader2 className="animate-spin" size={40} />
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto px-4 py-6 min-h-screen">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/" className="min-h-11 min-w-11 flex items-center justify-center rounded-xl bg-white dark:bg-white/[0.04] border border-slate-100 dark:border-white/10 text-slate-500 no-underline active:scale-90 transition-transform">
          <ArrowLeft size={18} />
        </Link>
        <div>
          <h1 className="font-display text-lg font-bold text-slate-900 dark:text-white">Mes commandes</h1>
          <p className="text-xs text-slate-400">{commandes.length} commande{commandes.length > 1 ? 's' : ''}</p>
        </div>
      </div>

      {commandes.length === 0 ? (
        <div className="flex flex-col items-center justify-center text-slate-300 dark:text-slate-700 gap-3 py-24">
          <History size={32} className="opacity-40" />
          <p className="text-xs font-semibold uppercase tracking-wide">Aucune commande pour l'instant</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {commandes.map((cmd) => {
            const { label, icon: Icon, classe } = styleStatut(cmd.statut);
            return (
              <motion.div
                key={cmd.id} layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                onClick={() => setCommandeOuverte(cmd)}
                className="bg-white dark:bg-white/[0.04] rounded-[20px] p-3 border border-slate-100 dark:border-white/10 flex items-center gap-3 active:scale-[0.99] transition-transform cursor-pointer"
              >
                <div className={`w-12 h-12 shrink-0 rounded-2xl flex items-center justify-center ${classe}`}>
                  <Icon size={20} />
                </div>
                <div className="min-w-0 flex-grow">
                  <h3 className="text-sm font-semibold text-slate-800 dark:text-white">Commande #{cmd.id}</h3>
                  <p className="text-[11px] text-slate-400 truncate">
                    {cmd.items?.length || 0} article{(cmd.items?.length || 0) > 1 ? 's' : ''} · {new Date(cmd.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                  </p>
                  <span className={`inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full mt-1 ${classe}`}>{label}</span>
                </div>
                <div className="text-right shrink-0">
                  <Prix montant={cmd.total_general} className="text-sm font-bold text-emerald-600" />
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* 📄 Feuille modale mobile (bottom sheet), pas une popup centrée façon desktop --
          mêmes conventions que le menu (app/layout.tsx) : glisse depuis le bas, poignée de
          glissement, fermeture au swipe. */}
      <AnimatePresence>
        {commandeOuverte && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setCommandeOuverte(null)}
              className="fixed inset-0 z-[60] bg-slate-950/50 backdrop-blur-sm"
            />
            <motion.div
              drag="y"
              dragConstraints={{ top: 0, bottom: 0 }}
              dragElastic={{ top: 0, bottom: 0.5 }}
              onDragEnd={(_e, info) => { if (info.offset.y > 100 || info.velocity.y > 500) setCommandeOuverte(null); }}
              initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 32, stiffness: 320 }}
              className="fixed bottom-0 left-0 right-0 z-[70] max-h-[85vh] bg-white dark:bg-[#0b1a16] rounded-t-[2rem] shadow-2xl flex flex-col"
            >
              <div className="flex justify-center pt-3 pb-1 shrink-0">
                <div className="w-10 h-1.5 rounded-full bg-slate-200 dark:bg-white/15" />
              </div>

              <div className="px-6 pb-4 pt-2 flex justify-between items-center border-b dark:border-white/10 shrink-0">
                <div>
                  <h3 className="font-display text-lg font-bold text-slate-900 dark:text-white">Commande #{commandeOuverte.id}</h3>
                  <p className="text-xs text-slate-400 flex items-center gap-1.5 mt-0.5">
                    <Store size={12} /> {config?.nom || 'Pharmacie'}
                  </p>
                </div>
                <button onClick={() => setCommandeOuverte(null)} className="min-h-11 min-w-11 flex items-center justify-center rounded-xl bg-slate-100 dark:bg-white/[0.06] border-none text-slate-500 active:scale-90 cursor-pointer transition-all">
                  <X size={18} />
                </button>
              </div>

              <div className="flex-grow overflow-y-auto p-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
                {(() => {
                  const { label, icon: Icon, classe } = styleStatut(commandeOuverte.statut);
                  return (
                    <div className={`flex items-center gap-2 text-sm font-semibold px-4 py-3 rounded-2xl mb-5 ${classe}`}>
                      <Icon size={18} /> {label}
                    </div>
                  );
                })()}

                <div className="flex items-center gap-2 text-xs text-slate-400 mb-4">
                  <Hash size={13} /> Référence interne #{commandeOuverte.id}
                  <span className="opacity-40">·</span>
                  {new Date(commandeOuverte.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </div>

                <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-2">Articles</p>
                <div className="space-y-2 mb-5">
                  {commandeOuverte.items?.map((it) => (
                    <div key={it.id} className="flex items-center gap-3 bg-slate-50 dark:bg-white/[0.03] rounded-2xl p-3">
                      <div className="w-9 h-9 shrink-0 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 flex items-center justify-center text-emerald-500">
                        <Package size={16} />
                      </div>
                      <div className="min-w-0 flex-grow">
                        <p className="text-sm font-medium text-slate-700 dark:text-slate-200 truncate">{it.produit_nom}</p>
                        <p className="text-[11px] text-slate-400">{it.quantite} × <Prix montant={it.prix_unitaire} className="text-[11px]" /></p>
                      </div>
                      <Prix montant={it.total_item} className="text-sm font-semibold text-slate-700 dark:text-slate-200 shrink-0" />
                    </div>
                  ))}
                </div>

                <div className="flex items-center justify-between pt-4 border-t dark:border-white/10">
                  <span className="font-display text-base font-bold text-slate-900 dark:text-white">Total</span>
                  <Prix montant={commandeOuverte.total_general} className="text-xl font-bold text-emerald-600" />
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <ToastContainer toasts={toasts} />
    </div>
  );
}
