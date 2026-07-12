"use client";
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  TrendingUp, AlertTriangle, PackageCheck, Search, Loader2,
  ChevronDown, ChevronUp, Info
} from 'lucide-react';

import apiClient from '../../../lib/apiClient';

interface Prediction {
  produit_id: number;
  produit_identifiant: string;
  produit_nom: string;
  consommation_moy_7j: number;
  consommation_moy_30j: number;
  tendance_jour: number;
  consommation_prevue_lead_time: number;
  lead_time_jours: number;
  stock_securite: number;
  point_de_commande: number;
  stock_actuel: number;
  quantite_a_commander: number;
  jours_avant_rupture: number | null;
  fiabilite: string;
  nb_jours_historique: number;
}

const FIABILITE_STYLE: Record<string, string> = {
  haute: "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400",
  moyenne: "bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400",
  basse: "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400",
};

export default function PredictionsStockPage() {
  const [loading, setLoading] = useState(true);
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [query, setQuery] = useState("");
  const [alerteUniquement, setAlerteUniquement] = useState(true);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [leadTime, setLeadTime] = useState(7);

  const fetchPredictions = async () => {
    setLoading(true);
    try {
      const res = await apiClient.get('/api/predictions-stock/', {
        params: {
          alerte_uniquement: alerteUniquement ? 1 : 0,
          lead_time_jours: leadTime,
        },
      });
      setPredictions(res.data.predictions || []);
    } catch (err) {
      console.error("Erreur de chargement des prédictions :", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchPredictions(); }, [alerteUniquement, leadTime]);

  const filtered = predictions.filter(p =>
    p.produit_nom.toLowerCase().includes(query.toLowerCase()) ||
    p.produit_identifiant.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div className="max-w-350 mx-auto space-y-8 p-4">
      <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
        <h2 className="text-4xl font-black text-slate-800 dark:text-white tracking-tighter mb-2 italic">
          📊 Prédiction de <span className="text-emerald-500">Réapprovisionnement</span>
        </h2>
        <p className="text-slate-500 dark:text-slate-400 font-medium max-w-2xl">
          Estimation statistique (moyenne mobile, tendance, marge de sécurité) — <strong>pas d'IA générative</strong> —
          basée sur l'historique réel des sorties de stock de chaque produit.
        </p>
      </motion.div>

      <div className="bg-white dark:bg-slate-900 p-6 rounded-4xl shadow-sm border border-slate-100 dark:border-slate-800 flex flex-col md:flex-row gap-4 items-center">
        <div className="grow relative w-full">
          <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
          <input
            type="text" placeholder="Rechercher un produit..."
            className="w-full pl-14 pr-6 py-4 rounded-2xl bg-slate-50 dark:bg-slate-800 border-none outline-none focus:ring-2 focus:ring-emerald-500/20 text-sm transition-all dark:text-white"
            value={query} onChange={(e) => setQuery(e.target.value)}
          />
        </div>

        <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800 rounded-2xl px-4 py-3">
          <label className="text-[10px] font-black text-slate-400 uppercase whitespace-nowrap">Délai livraison (j)</label>
          <input
            type="number" min={0} max={60}
            value={leadTime}
            onChange={(e) => setLeadTime(Math.max(0, parseInt(e.target.value) || 0))}
            className="w-16 bg-transparent border-none outline-none font-black text-slate-700 dark:text-white text-sm"
          />
        </div>

        <button
          onClick={() => setAlerteUniquement(!alerteUniquement)}
          className={`px-4 py-3 rounded-2xl text-[10px] font-black uppercase transition-all border-none cursor-pointer whitespace-nowrap ${
            alerteUniquement ? 'bg-emerald-500 text-black' : 'bg-slate-100 dark:bg-slate-800 text-slate-400'
          }`}
        >
          {alerteUniquement ? "⚠️ Alertes uniquement" : "Tous les produits"}
        </button>
      </div>

      {loading ? (
        <div className="py-24 flex items-center justify-center text-emerald-500">
          <Loader2 className="animate-spin" size={32} />
        </div>
      ) : filtered.length === 0 ? (
        <div className="p-20 text-center text-slate-400 italic bg-white dark:bg-slate-900 rounded-4xl border border-dashed border-slate-200 dark:border-slate-800 flex flex-col items-center gap-3">
          <PackageCheck size={40} className="opacity-30" />
          {alerteUniquement
            ? "Aucun produit à surveiller pour le moment : les stocks couvrent le délai de livraison."
            : "Aucun produit trouvé."}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((p) => {
            const urgent = p.jours_avant_rupture !== null && p.jours_avant_rupture <= p.lead_time_jours;
            const expanded = expandedId === p.produit_id;
            return (
              <motion.div
                key={p.produit_id} layout
                className={`bg-white dark:bg-slate-900 rounded-3xl border overflow-hidden transition-all ${
                  urgent ? 'border-red-200 dark:border-red-500/30' : 'border-slate-100 dark:border-slate-800'
                }`}
              >
                <button
                  onClick={() => setExpandedId(expanded ? null : p.produit_id)}
                  className="w-full flex items-center gap-4 p-5 bg-transparent border-none cursor-pointer text-left"
                >
                  <div className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 ${
                    urgent ? 'bg-red-50 text-red-500 dark:bg-red-500/10' : 'bg-emerald-50 text-emerald-500 dark:bg-emerald-500/10'
                  }`}>
                    {urgent ? <AlertTriangle size={18} /> : <TrendingUp size={18} />}
                  </div>

                  <div className="grow">
                    <p className="font-black text-slate-800 dark:text-white text-sm">{p.produit_nom}</p>
                    <p className="text-[10px] text-slate-400 font-bold uppercase font-mono">{p.produit_identifiant}</p>
                  </div>

                  <div className="hidden sm:flex flex-col items-end mr-4">
                    <span className="text-[9px] font-black text-slate-400 uppercase">Stock actuel</span>
                    <span className="font-black text-slate-700 dark:text-white">{p.stock_actuel}</span>
                  </div>

                  <div className="hidden sm:flex flex-col items-end mr-4">
                    <span className="text-[9px] font-black text-slate-400 uppercase">Rupture prévue</span>
                    <span className={`font-black ${urgent ? 'text-red-500' : 'text-slate-700 dark:text-white'}`}>
                      {p.jours_avant_rupture === null ? "—" : `${p.jours_avant_rupture} j`}
                    </span>
                  </div>

                  <div className="flex flex-col items-end mr-2">
                    <span className="text-[9px] font-black text-slate-400 uppercase">À commander</span>
                    <span className={`font-black ${p.quantite_a_commander > 0 ? 'text-emerald-500' : 'text-slate-400'}`}>
                      {p.quantite_a_commander > 0 ? `+${p.quantite_a_commander}` : "0"}
                    </span>
                  </div>

                  {expanded ? <ChevronUp size={18} className="text-slate-400" /> : <ChevronDown size={18} className="text-slate-400" />}
                </button>

                <AnimatePresence>
                  {expanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                      className="border-t border-slate-100 dark:border-slate-800 px-5 py-5 bg-slate-50/50 dark:bg-slate-800/30"
                    >
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <Detail label="Conso. moy. 7j" value={`${p.consommation_moy_7j} /j`} />
                        <Detail label="Conso. moy. 30j" value={`${p.consommation_moy_30j} /j`} />
                        <Detail label="Tendance" value={`${p.tendance_jour > 0 ? '+' : ''}${p.tendance_jour} /j`} />
                        <Detail label="Conso. prévue (délai)" value={`${p.consommation_prevue_lead_time}`} />
                        <Detail label="Stock de sécurité" value={`${p.stock_securite}`} />
                        <Detail label="Point de commande" value={`${p.point_de_commande}`} />
                        <Detail label="Historique analysé" value={`${p.nb_jours_historique} j`} />
                        <div>
                          <p className="text-[9px] font-black text-slate-400 uppercase mb-1">Fiabilité</p>
                          <span className={`inline-block px-2 py-1 rounded-lg text-[10px] font-black uppercase ${FIABILITE_STYLE[p.fiabilite] || FIABILITE_STYLE.basse}`}>
                            {p.fiabilite}
                          </span>
                        </div>
                      </div>
                      {p.fiabilite === 'basse' && (
                        <div className="mt-4 flex items-start gap-2 text-[11px] text-slate-400 italic">
                          <Info size={14} className="shrink-0 mt-0.5" />
                          Historique de ventes encore limité pour ce produit — cette estimation est
                          indicative, à recouper avec votre expérience du terrain.
                        </div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[9px] font-black text-slate-400 uppercase mb-1">{label}</p>
      <p className="font-black text-slate-700 dark:text-white">{value}</p>
    </div>
  );
}
