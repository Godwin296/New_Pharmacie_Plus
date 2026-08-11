"use client";
import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  History, X, CheckCircle2, Clock, XCircle, ArrowLeft, Loader2, Package, Store, Hash,
} from "lucide-react";
import Link from "next/link";
import apiClient from "../../lib/apiClient";
import Prix from "../../lib/components/Prix";
import { useConfigPharmacie } from "../../lib/context/ConfigPharmacieContext";
import { useToast, ToastContainer } from "../../lib/hooks/useToast";

/* ═══════════════════════════════════════════════════════════════
   TYPES — INCHANGÉS
   ═══════════════════════════════════════════════════════════════ */
type ItemCommande = {
  id: number;
  produit_nom: string;
  quantite: number;
  prix_unitaire: number;
  total_item: number;
};

type Commande = {
  id: number;
  statut: string;
  date: string;
  payee: boolean;
  total_general: number;
  items: ItemCommande[];
};

const STATUT_STYLES: Record<string, { label: string; icon: typeof CheckCircle2; classe: string; dot: string }> = {
  payee: {
    label: "Payée",
    icon: CheckCircle2,
    classe: "text-emerald-700 bg-emerald-50 dark:bg-emerald-900/20 dark:text-emerald-400",
    dot: "bg-emerald-500",
  },
  payee_a_retirer: {
    label: "Prête à retirer",
    icon: CheckCircle2,
    classe: "text-emerald-700 bg-emerald-50 dark:bg-emerald-900/20 dark:text-emerald-400",
    dot: "bg-emerald-500",
  },
  retiree: {
    label: "Retirée",
    icon: CheckCircle2,
    classe: "text-gray-600 bg-gray-100 dark:bg-white/[0.05] dark:text-gray-400",
    dot: "bg-gray-400",
  },
  attente_validation: {
    label: "En attente",
    icon: Clock,
    classe: "text-amber-700 bg-amber-50 dark:bg-amber-900/20 dark:text-amber-400",
    dot: "bg-amber-500",
  },
  paiement_a_verifier: {
    label: "Paiement à vérifier",
    icon: Clock,
    classe: "text-amber-700 bg-amber-50 dark:bg-amber-900/20 dark:text-amber-400",
    dot: "bg-amber-500",
  },
  en_cours: {
    label: "En cours",
    icon: Clock,
    classe: "text-sky-700 bg-sky-50 dark:bg-sky-900/20 dark:text-sky-400",
    dot: "bg-sky-500",
  },
  annulee: {
    label: "Annulée",
    icon: XCircle,
    classe: "text-red-700 bg-red-50 dark:bg-red-900/20 dark:text-red-400",
    dot: "bg-red-500",
  },
  refusee: {
    label: "Refusée",
    icon: XCircle,
    classe: "text-red-700 bg-red-50 dark:bg-red-900/20 dark:text-red-400",
    dot: "bg-red-500",
  },
};

const styleStatut = (s: string) =>
  STATUT_STYLES[s] || {
    label: s,
    icon: Clock,
    classe: "text-gray-600 bg-gray-100 dark:bg-white/[0.05] dark:text-gray-400",
    dot: "bg-gray-400",
  };

const EASE = [0.22, 1, 0.36, 1] as const;

/* ═══════════════════════════════════════════════════════════════
   SKELETON
   ═══════════════════════════════════════════════════════════════ */
function CommandesSkeleton() {
  const shimmer = "animate-pulse bg-gray-200 dark:bg-gray-800";
  return (
    <div className="max-w-md mx-auto min-h-screen bg-white dark:bg-[#050e0c] px-4 pt-6 pb-28 space-y-4">
      <div className={`h-7 w-40 rounded-lg ${shimmer}`} />
      <div className={`h-4 w-24 rounded ${shimmer}`} />
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3">
          <div className={`h-12 w-12 rounded-2xl ${shimmer} flex-shrink-0`} />
          <div className="flex-1 space-y-2">
            <div className={`h-4 w-3/4 rounded ${shimmer}`} />
            <div className={`h-3 w-1/2 rounded ${shimmer}`} />
          </div>
          <div className={`h-5 w-16 rounded ${shimmer}`} />
        </div>
      ))}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   PAGE PRINCIPALE
   ═══════════════════════════════════════════════════════════════ */
export default function MesCommandes() {
  const [commandes, setCommandes] = useState<Commande[]>([]);
  const [loading, setLoading] = useState(true);
  const [commandeOuverte, setCommandeOuverte] = useState<Commande | null>(null);
  const { config } = useConfigPharmacie();
  const { toasts, showToast } = useToast();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    apiClient
      .get("/api/commandes/")
      .then((res) => setCommandes(res.data))
      .catch(() => showToast("Impossible de charger vos commandes.", "error"))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading) return <CommandesSkeleton />;

  return (
    <main className="max-w-md mx-auto min-h-screen bg-white dark:bg-[#050e0c] px-4 pt-6 pb-28">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: EASE }}
        className="flex items-center gap-3 mb-6"
      >
        <Link
          href="/"
          className="h-10 w-10 flex items-center justify-center rounded-full bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-gray-300 border-none no-underline active:scale-90 transition-transform"
        >
          <ArrowLeft size={18} />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">
            Mes commandes
          </h1>
          <p className="text-xs text-gray-400 font-medium">
            {commandes.length} commande{commandes.length > 1 ? "s" : ""}
          </p>
        </div>
      </motion.div>

      {/* Liste */}
      {commandes.length === 0 ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex flex-col items-center justify-center text-gray-300 dark:text-gray-700 gap-3 py-24"
        >
          <History size={32} className="opacity-40" />
          <p className="text-sm font-medium text-gray-400">
            Aucune commande pour l'instant
          </p>
        </motion.div>
      ) : (
        <div className="space-y-3">
          {commandes.map((cmd, i) => {
            const { label, icon: Icon, classe, dot } = styleStatut(cmd.statut);
            return (
              <motion.button
                key={cmd.id}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, ease: EASE, delay: Math.min(i * 0.05, 0.3) }}
                onClick={() => setCommandeOuverte(cmd)}
                className="w-full flex items-center gap-3 p-3 rounded-2xl bg-white dark:bg-gray-900 border border-black/5 dark:border-white/5 shadow-sm active:scale-[0.98] transition-transform text-left"
                style={{ background: "none", border: "none" }}
              >
                <div
                  className={`w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0 ${classe}`}
                >
                  <Icon size={18} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                      Commande #{cmd.id}
                    </h3>
                    <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />
                  </div>
                  <p className="text-[11px] text-gray-400 mt-0.5">
                    {cmd.items?.length || 0} article{(cmd.items?.length || 0) > 1 ? "s" : ""} ·{" "}
                    {new Date(cmd.date).toLocaleDateString("fr-FR", {
                      day: "numeric",
                      month: "short",
                    })}
                  </p>
                  <span
                    className={`inline-block mt-1.5 text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full ${classe}`}
                  >
                    {label}
                  </span>
                </div>
                <div className="text-right flex-shrink-0">
                  <Prix
                    montant={cmd.total_general}
                    className="text-sm font-bold text-emerald-600 dark:text-emerald-400"
                  />
                </div>
              </motion.button>
            );
          })}
        </div>
      )}

      {/* Bottom sheet commande — PORTÉ SUR document.body */}
      {mounted &&
        createPortal(
          <AnimatePresence>
            {commandeOuverte && (
              <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center">
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onClick={() => setCommandeOuverte(null)}
                  className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                />
                <motion.div
                  drag="y"
                  dragConstraints={{ top: 0, bottom: 0 }}
                  dragElastic={{ top: 0, bottom: 0.5 }}
                  onDragEnd={(_e, info) => {
                    if (info.offset.y > 100 || info.velocity.y > 500)
                      setCommandeOuverte(null);
                  }}
                  initial={{ y: "100%" }}
                  animate={{ y: 0 }}
                  exit={{ y: "100%" }}
                  transition={{ type: "spring", damping: 32, stiffness: 320 }}
                  className="relative w-full sm:max-w-md bg-white dark:bg-[#0b1a16] rounded-t-[28px] sm:rounded-[28px] shadow-2xl overflow-hidden border border-black/5 dark:border-white/5 max-h-[85vh] flex flex-col"
                >
                  {/* Poignée */}
                  <div className="flex justify-center pt-3 pb-1 shrink-0">
                    <div className="w-10 h-1.5 rounded-full bg-gray-200 dark:bg-white/20" />
                  </div>

                  {/* Header sheet */}
                  <div className="px-6 pb-4 pt-2 flex justify-between items-center border-b border-black/5 dark:border-white/5 shrink-0">
                    <div>
                      <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                        Commande #{commandeOuverte.id}
                      </h3>
                      <p className="text-xs text-gray-400 flex items-center gap-1.5 mt-0.5">
                        <Store size={12} /> {config?.nom || "Pharmacie"}
                      </p>
                    </div>
                    <button
                      onClick={() => setCommandeOuverte(null)}
                      className="h-9 w-9 flex items-center justify-center rounded-full bg-gray-100 dark:bg-white/5 text-gray-500 border-none active:scale-90 transition-transform"
                    >
                      <X size={18} />
                    </button>
                  </div>

                  {/* Contenu scrollable */}
                  <div
                    className="flex-grow overflow-y-auto p-6"
                    style={{ paddingBottom: "calc(1.5rem + env(safe-area-inset-bottom))" }}
                  >
                    {(() => {
                      const { label, icon: Icon, classe } = styleStatut(commandeOuverte.statut);
                      return (
                        <div
                          className={`flex items-center gap-2 text-sm font-bold px-4 py-3 rounded-2xl mb-5 ${classe}`}
                        >
                          <Icon size={18} /> {label}
                        </div>
                      );
                    })()}

                    <div className="flex items-center gap-2 text-xs text-gray-400 mb-5">
                      <Hash size={13} /> Référence interne #{commandeOuverte.id}
                      <span className="opacity-40">·</span>
                      {new Date(commandeOuverte.date).toLocaleDateString("fr-FR", {
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </div>

                    <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
                      Articles
                    </p>
                    <div className="space-y-2 mb-6">
                      {commandeOuverte.items?.map((it) => (
                        <div
                          key={it.id}
                          className="flex items-center gap-3 bg-gray-50 dark:bg-white/[0.03] rounded-2xl p-3 border border-black/5 dark:border-white/5"
                        >
                          <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 flex items-center justify-center text-emerald-600 dark:text-emerald-400 flex-shrink-0">
                            <Package size={16} />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">
                              {it.produit_nom}
                            </p>
                            <p className="text-[11px] text-gray-400">
                              {it.quantite} ×{" "}
                              <Prix montant={it.prix_unitaire} className="text-[11px]" />
                            </p>
                          </div>
                          <Prix
                            montant={it.total_item}
                            className="text-sm font-semibold text-gray-800 dark:text-gray-200 flex-shrink-0"
                          />
                        </div>
                      ))}
                    </div>

                    <div className="flex items-center justify-between pt-4 border-t border-black/5 dark:border-white/5">
                      <span className="text-base font-bold text-gray-900 dark:text-white">
                        Total
                      </span>
                      <Prix
                        montant={commandeOuverte.total_general}
                        className="text-xl font-bold text-emerald-600 dark:text-emerald-400"
                      />
                    </div>
                  </div>
                </motion.div>
              </div>
            )}
          </AnimatePresence>,
          document.body
        )}

      <ToastContainer toasts={toasts} />
    </main>
  );
}