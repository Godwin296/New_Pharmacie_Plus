"use client";
import React, { useEffect, useState } from 'react';
import { ArrowUpRight, ArrowDownRight, Minus, Loader2, BarChart3, Info } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import apiClient from '../../../lib/apiClient';
import Prix from '../../../lib/components/Prix';

/**
 * 📈 ANALYTICS AVANCÉ (admin) -- alimenté par GET /api/v1/boss/analytics/
 * (voir pharmacie-backend/core/analytics.py pour la définition exacte de chaque indicateur).
 */

interface Bloc { valeur: number; precedent: number; variation_pct: number | null }
interface Analytics {
  periode: { debut: string; fin: string };
  periode_precedente: { debut: string; fin: string };
  ca: Bloc; nb_commandes: Bloc; panier_moyen: Bloc; marge: Bloc;
  taux_marge_pct: number | null;
  couverture_marge_pct: number | null;
  repartition_paiement: { moyen: string; libelle: string; ca: number; nb_commandes: number; part_pct: number }[];
  repartition_categories: { categorie: string; libelle: string; ca: number; quantite: number; part_pct: number }[];
  heures: { par_heure: { heure: number; nb_commandes: number; ca: number }[]; heure_de_pointe: number | null };
  produits_dormants: { id: number; nom: string; quantite: number; valeur_stock: number; cout_connu: boolean }[];
}

const PERIODES = [
  { jours: 7, label: '7 jours' },
  { jours: 30, label: '30 jours' },
  { jours: 90, label: '90 jours' },
];

const iso = (d: Date) => {
  // Date locale (pas toISOString, qui décalerait d'un jour après minuit en UTC+1).
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

const fmtDate = (s: string) => new Date(s + 'T00:00:00').toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });

function Variation({ pct }: { pct: number | null }) {
  if (pct === null) {
    return <span className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-400"><Minus size={12} /> n/a</span>;
  }
  const positif = pct >= 0;
  const Icone = positif ? ArrowUpRight : ArrowDownRight;
  return (
    <span className={`inline-flex items-center gap-1 text-[11px] font-bold ${positif ? 'text-emerald-600' : 'text-red-500'}`}>
      <Icone size={12} /> {positif ? '+' : ''}{pct.toLocaleString('fr-FR')} %
    </span>
  );
}

function CarteKpi({ titre, bloc, format }: { titre: string; bloc: Bloc; format: 'prix' | 'nombre' }) {
  const rendu = (v: number) => format === 'prix' ? <Prix montant={v} /> : <>{Math.round(v).toLocaleString('fr-FR')}</>;
  return (
    <div className="bg-slate-50 dark:bg-slate-900/40 rounded-3xl p-5 border border-slate-100 dark:border-slate-700">
      <p className="text-[10px] uppercase tracking-widest font-bold text-slate-400">{titre}</p>
      <p className="text-2xl font-black text-slate-800 dark:text-white mt-2">{rendu(bloc.valeur)}</p>
      <div className="flex items-center justify-between mt-2">
        <Variation pct={bloc.variation_pct} />
        <span className="text-[10px] text-slate-400">avant : {rendu(bloc.precedent)}</span>
      </div>
    </div>
  );
}

export default function AnalyticsSection() {
  const [jours, setJours] = useState(30);
  const [data, setData] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);

  useEffect(() => {
    let annule = false;
    const charger = async () => {
      setLoading(true);
      setErreur(null);
      const fin = new Date();
      const debut = new Date();
      debut.setDate(fin.getDate() - (jours - 1));
      try {
        const res = await apiClient.get('/api/v1/boss/analytics/', { params: { debut: iso(debut), fin: iso(fin) } });
        if (!annule) setData(res.data);
      } catch (e: any) {
        if (!annule) setErreur(e?.response?.data?.error || "Impossible de charger les analyses.");
      } finally {
        if (!annule) setLoading(false);
      }
    };
    charger();
    return () => { annule = true; };
  }, [jours]);

  const carte = "bg-white dark:bg-slate-800 p-8 rounded-4xl shadow-sm border border-gray-100 dark:border-slate-700";
  const partielle = data?.couverture_marge_pct != null && data.couverture_marge_pct < 100;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h5 className="font-bold text-slate-800 dark:text-white flex items-center gap-2">
          <BarChart3 className="text-emerald-500" /> Analyses avancées
        </h5>
        <div className="flex gap-1 bg-slate-100 dark:bg-slate-900/50 p-1 rounded-2xl">
          {PERIODES.map(p => (
            <button
              key={p.jours}
              onClick={() => setJours(p.jours)}
              className={`px-4 py-1.5 rounded-xl text-xs font-bold transition ${jours === p.jours ? 'bg-white dark:bg-slate-700 text-emerald-600 shadow-sm' : 'text-slate-500'}`}
            >{p.label}</button>
          ))}
        </div>
      </div>

      {loading && !data && (
        <div className={`${carte} flex justify-center py-16`}><Loader2 className="animate-spin text-emerald-500" /></div>
      )}
      {erreur && <div className={`${carte} text-sm font-semibold text-red-500`}>{erreur}</div>}

      {data && (
        <div className={`space-y-6 transition-opacity ${loading ? 'opacity-50' : ''}`}>
          <p className="text-[11px] text-slate-400">
            Du {fmtDate(data.periode.debut)} au {fmtDate(data.periode.fin)} · comparé au {fmtDate(data.periode_precedente.debut)} – {fmtDate(data.periode_precedente.fin)}
          </p>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <CarteKpi titre="Chiffre d'affaires" bloc={data.ca} format="prix" />
            <CarteKpi titre="Commandes" bloc={data.nb_commandes} format="nombre" />
            <CarteKpi titre="Panier moyen" bloc={data.panier_moyen} format="prix" />
            <CarteKpi titre="Marge" bloc={data.marge} format="prix" />
          </div>

          {data.taux_marge_pct !== null && (
            <div className={`flex items-start gap-3 rounded-2xl p-4 text-xs ${partielle ? 'bg-amber-50 dark:bg-amber-900/10 text-amber-800 dark:text-amber-300' : 'bg-emerald-50 dark:bg-emerald-900/10 text-emerald-800 dark:text-emerald-300'}`}>
              <Info size={16} className="shrink-0 mt-0.5" />
              <p>
                Taux de marge : <b>{data.taux_marge_pct.toLocaleString('fr-FR', { maximumFractionDigits: 1 })} %</b>
                {partielle && <> — calculé sur <b>{Math.round(data.couverture_marge_pct!)} %</b> du chiffre d'affaires seulement : le prix d'achat n'est pas renseigné pour les autres produits vendus (ils sont exclus, pas comptés à coût zéro).</>}
              </p>
            </div>
          )}
          {data.taux_marge_pct === null && data.ca.valeur > 0 && (
            <div className="flex items-start gap-3 rounded-2xl p-4 text-xs bg-amber-50 dark:bg-amber-900/10 text-amber-800 dark:text-amber-300">
              <Info size={16} className="shrink-0 mt-0.5" />
              <p>Marge non calculable : aucun produit vendu sur cette période n'a de prix d'achat renseigné.</p>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className={carte}>
              <h6 className="font-bold text-slate-800 dark:text-white mb-5 text-sm">Moyens de paiement</h6>
              {data.repartition_paiement.length === 0 ? <p className="text-xs text-slate-400">Aucune vente sur la période.</p> : (
                <div className="space-y-4">
                  {data.repartition_paiement.map(r => (
                    <div key={r.moyen}>
                      <div className="flex justify-between text-xs mb-1.5">
                        <span className="font-bold text-slate-700 dark:text-slate-200">{r.libelle} <span className="font-normal text-slate-400">· {r.nb_commandes} cmd</span></span>
                        <span className="font-bold"><Prix montant={r.ca} /> <span className="text-slate-400 font-normal">({r.part_pct} %)</span></span>
                      </div>
                      <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden">
                        <div className="h-full rounded-full bg-emerald-500" style={{ width: `${r.part_pct}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className={carte}>
              <h6 className="font-bold text-slate-800 dark:text-white mb-5 text-sm">Ventes par catégorie</h6>
              {data.repartition_categories.length === 0 ? <p className="text-xs text-slate-400">Aucune vente sur la période.</p> : (
                <div className="space-y-4">
                  {data.repartition_categories.slice(0, 6).map(c => (
                    <div key={c.categorie}>
                      <div className="flex justify-between text-xs mb-1.5">
                        <span className="font-bold text-slate-700 dark:text-slate-200">{c.libelle} <span className="font-normal text-slate-400">· {c.quantite} u.</span></span>
                        <span className="font-bold"><Prix montant={c.ca} /> <span className="text-slate-400 font-normal">({c.part_pct} %)</span></span>
                      </div>
                      <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden">
                        <div className="h-full rounded-full bg-sky-500" style={{ width: `${c.part_pct}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className={carte}>
            <div className="flex justify-between items-center mb-5">
              <h6 className="font-bold text-slate-800 dark:text-white text-sm">Heures de pointe</h6>
              {data.heures.heure_de_pointe !== null && (
                <span className="text-xs font-bold text-emerald-600">Pic à {data.heures.heure_de_pointe} h</span>
              )}
            </div>
            <div className="h-48 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.heures.par_heure}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#94a3b822" />
                  <XAxis dataKey="heure" tick={{ fontSize: 10 }} tickFormatter={(h) => `${h}h`} interval={2} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 10 }} width={28} />
                  <Tooltip formatter={(v: any) => [v, 'Commandes']} labelFormatter={(h) => `${h}h – ${Number(h) + 1}h`} />
                  <Bar dataKey="nb_commandes" fill="#10b981" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className={carte}>
            <h6 className="font-bold text-slate-800 dark:text-white mb-1 text-sm">Stock dormant</h6>
            <p className="text-[11px] text-slate-400 mb-4">Produits en stock sans aucune vente sur la période, classés par valeur immobilisée.</p>
            {data.produits_dormants.length === 0 ? <p className="text-xs text-slate-400">Aucun produit dormant.</p> : (
              <div className="divide-y divide-slate-100 dark:divide-slate-700">
                {data.produits_dormants.map(p => (
                  <div key={p.id} className="flex justify-between items-center py-3 text-sm">
                    <span className="font-bold text-slate-700 dark:text-slate-200">{p.nom} <span className="font-normal text-slate-400 text-xs">· {p.quantite} en stock</span></span>
                    <span className="font-bold"><Prix montant={p.valeur_stock} />{!p.cout_connu && <span className="text-[10px] text-slate-400 font-normal"> (au prix de vente)</span>}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
