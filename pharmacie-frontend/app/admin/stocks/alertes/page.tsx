"use client";
import React, { useState, useEffect } from 'react';
import { CalendarClock, ShieldAlert, Printer, ChevronLeft, Loader2 } from 'lucide-react';
import Link from 'next/link';
import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://mw69zhwz-8000.uks1.devtunnels.ms';

export default function StockAlertReport() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [config, setConfig] = useState<any>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // On récupère les données de stock et la config de la pharmacie (Logo, Nom)
        const [resDashboard, resConfig] = await Promise.all([
          axios.get(`${API_URL}/api/boss-dashboard/`, { withCredentials: true }),
          axios.get(`${API_URL}/api/infos-pharmacie/`)
        ]);
        setData(resDashboard.data);
        setConfig(resConfig.data);
      } catch (err) {
        console.error("Erreur de chargement des alertes:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  if (loading) return (
    <div className="h-screen flex flex-col items-center justify-center text-red-500 gap-4">
      <Loader2 className="animate-spin" size={48} />
      <span className="font-black uppercase text-[10px] tracking-widest">Génération du rapport critique...</span>
    </div>
  );

  const formatDate = (dateStr: string) => {
    if (!dateStr) return "N/A";
    return new Date(dateStr).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 py-10 print:p-0 print:bg-white">
      
      {/* 🛠️ NAVIGATION & PRINT BAR */}
      <div className="max-w-[21cm] mx-auto mb-6 flex justify-between items-center no-print px-4">
        <Link href="/admin/rapports" className="flex items-center gap-2 text-slate-500 hover:text-slate-800 font-bold text-sm transition-all no-underline">
          <ChevronLeft size={18} /> Retour Rapports
        </Link>
        <button 
          onClick={() => window.print()}
          className="bg-red-600 hover:bg-red-700 text-white px-8 py-3 rounded-2xl font-black shadow-xl shadow-red-500/20 transition-all hover:scale-105 flex items-center gap-3 border-none cursor-pointer text-xs"
        >
          <Printer size={18} /> IMPRIMER L'ÉTAT CRITIQUE
        </button>
      </div>

      {/* 📄 LE DOCUMENT A4 */}
      <div className="mx-auto w-[21cm] min-h-[29.7cm] bg-white p-[1.5cm] shadow-2xl print:shadow-none print:w-full print:p-4 text-slate-900 border-t-[12px] border-red-600 flex flex-col">
        
        {/* HEADER DYNAMIQUE AVEC LOGO */}
        <div className="flex justify-between items-start mb-12 border-b-2 border-slate-100 pb-8">
          <div className="flex items-center gap-4">
            {config?.logo ? (
              <img src={config.logo} alt="Logo" className="w-20 h-20 object-contain rounded-xl" />
            ) : (
              <div className="w-16 h-16 bg-red-600 text-white rounded-2xl flex items-center justify-center shadow-lg">
                <ShieldAlert size={35} />
              </div>
            )}
            <div>
              <h1 className="text-2xl font-black tracking-tighter leading-none uppercase">
                {config?.nom || "PHARMACIE +"}
              </h1>
              <p className="text-[10px] font-black text-red-600 uppercase tracking-[0.2em] mt-2">📦 État des Stocks & Risques</p>
              <p className="text-[9px] text-slate-400 font-bold max-w-[300px] mt-1">{config?.adresse}</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-[10px] font-bold text-slate-400 uppercase">Émis le</p>
            <p className="text-sm font-black">{new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
          </div>
        </div>

        {/* 📉 RÉSUMÉ ANALYTIQUE DYNAMIQUE */}
        <div className="grid grid-cols-3 gap-4 mb-12">
          {[
            { label: "Total Produits", val: data?.nb_produits || 0, color: "slate" },
            { label: "Alertes Seuil", val: data?.nb_produits_critiques || 0, color: "red", icon: "⚠️" },
            { label: "Expirations (60j)", val: data?.produits_expirant_bientot?.length || 0, color: "red", icon: "⌛" },
          ].map((item, i) => (
            <div key={i} className="bg-slate-50 p-5 rounded-2xl border border-slate-100 text-center">
              <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest block mb-2">{item.label}</span>
              <span className={`text-lg font-black ${item.color === 'red' ? 'text-red-600' : 'text-slate-800'}`}>
                {item.icon} {item.val}
              </span>
            </div>
          ))}
        </div>

        {/* 🚨 TABLEAU DES ALERTES DE PÉREMPTION DYNAMIQUE */}
        <div className="mb-10 flex-grow">
          <h3 className="text-sm font-black text-red-600 uppercase tracking-widest mb-6 flex items-center gap-2">
            <CalendarClock size={20} /> Médicaments critiques (Péremption & Seuil)
          </h3>
          
          <div className="overflow-hidden rounded-2xl border-2 border-red-50">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-red-600 text-[10px] font-black text-white uppercase tracking-widest">
                  <th className="p-4">Médicament</th>
                  <th className="p-4">Laboratoire</th>
                  <th className="p-4 text-center">Date Expiration</th>
                  <th className="p-4 text-center">Quantité</th>
                </tr>
              </thead>
              <tbody className="text-sm">
                {data?.produits_expirant_bientot?.length > 0 ? (
                  data.produits_expirant_bientot.map((item: any, i: number) => (
                    <tr key={i} className="border-b border-red-50 bg-red-50/30">
                      <td className="p-4">
                        <b className="text-slate-800 uppercase text-xs">{item.nom}</b>
                      </td>
                      <td className="p-4 text-slate-500 font-bold text-xs uppercase">{item.laboratoire || 'N/A'}</td>
                      <td className="p-4 text-center font-mono font-black text-red-600">
                        {formatDate(item.date_expiration)}
                      </td>
                      <td className="p-4 text-center">
                        <span className="bg-red-600 text-white px-3 py-1 rounded-full font-black text-xs">
                          {item.quantite}
                        </span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} className="p-10 text-center text-slate-400 font-bold italic">
                      Aucune alerte critique à signaler pour le moment.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* ℹ️ NOTE DE BAS DE PAGE */}
        <div className="mt-auto pt-10 border-t border-slate-100 text-center">
          <p className="text-[10px] text-slate-400 font-bold italic leading-relaxed uppercase tracking-tighter">
            {config?.message_remerciement || "Note stratégique : Veuillez procéder au retrait immédiat ou à la promotion des lots concernés."}
          </p>
          <p className="text-[8px] text-slate-300 font-black mt-4 uppercase">Document généré par le système de gestion de l'Empire v1.0</p>
        </div>
      </div>

      <style jsx global>{`
        @media print {
          body { background: white !important; padding: 0 !important; }
          .no-print { display: none !important; }
          @page { size: A4; margin: 0; }
        }
      `}</style>
    </div>
  );
}
