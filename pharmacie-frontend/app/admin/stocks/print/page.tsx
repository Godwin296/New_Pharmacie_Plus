"use client";
import React, { useState, useEffect } from 'react';
import { Printer, Box, AlertTriangle, ShieldCheck, Loader2 } from 'lucide-react';
import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://mw69zhwz-8000.uks1.devtunnels.ms';

export default function StockPrintPage() {
  const [loading, setLoading] = useState(true);
  const [produits, setProduits] = useState<any[]>([]);
  const [config, setConfig] = useState<any>(null);
  const [printDate, setPrintDate] = useState("");

  useEffect(() => {
    const loadData = async () => {
      try {
        // 1. Date et heure fixes au moment du chargement
        const now = new Date();
        setPrintDate(now.toLocaleDateString('fr-FR') + " à " + now.toLocaleTimeString('fr-FR'));

        // 2. Appels API
        const [resStock, resConfig] = await Promise.all([
          axios.get(`${API_URL}/api/catalogue/`, { withCredentials: true }),
          axios.get(`${API_URL}/api/infos-pharmacie/`, { withCredentials: true })
        ]);
        
        setProduits(resStock.data.produits || []);
        setConfig(resConfig.data);
      } catch (err: any) {
        console.error("Erreur de chargement des données d'impression");
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  if (loading) return (
    <div className="h-screen flex flex-col items-center justify-center text-emerald-600 bg-white">
      <Loader2 className="animate-spin mb-4" size={48} />
      <span className="font-black uppercase text-[10px] tracking-widest italic">Initialisation du document certifié...</span>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-100 py-10 print:p-0 print:bg-white">
      
      <button 
        onClick={() => window.print()}
        className="fixed top-6 right-6 z-50 bg-emerald-600 text-white px-8 py-4 rounded-full font-black shadow-2xl no-print border-none cursor-pointer hover:scale-105 transition-all"
      >
        <Printer size={20} className="mr-2" /> IMPRIMER MAINTENANT
      </button>

      <div className="mx-auto w-[21cm] min-h-[29.7cm] bg-white p-[1.5cm] shadow-2xl print:shadow-none print:w-full text-slate-900">
        
        {/* HEADER : LOGO & INFOS DYNAMIQUES */}
        <div className="border-b-[6px] border-slate-900 pb-8 mb-10 flex justify-between items-start">
          <div className="flex gap-4 items-center">
            {/* Affichage du logo ou d'un bloc par défaut si absent */}
            {config?.logo ? (
              <img src={config.logo} alt="Logo" className="w-16 h-16 rounded-xl object-cover border border-slate-100" />
            ) : (
              <div className="w-16 h-16 bg-slate-900 rounded-xl flex items-center justify-center font-black text-2xl text-white">P+</div>
            )}
            <div>
              <h1 className="text-2xl font-black uppercase tracking-tighter">{config?.nom || "PHARMACIE PLUS +"}</h1>
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest italic">Inventaire Physique Stratégique 🛰️</p>
            </div>
          </div>
          <div className="text-right">
            <h2 className="text-2xl font-black text-slate-900 tracking-tighter uppercase italic">État du Stock</h2>
            <p className="text-[9px] font-bold text-slate-400 uppercase">Généré le {printDate}</p>
          </div>
        </div>

        {/* RÉSUMÉ RAPIDE */}
        <div className="grid grid-cols-2 gap-4 mb-10">
          <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 text-center">
            <span className="text-[9px] font-black text-slate-400 uppercase block mb-1">Total Références</span>
            <span className="text-2xl font-black">{produits.length} Médicaments</span>
          </div>
          <div className="bg-red-50 p-6 rounded-2xl border border-red-100 text-center">
            <span className="text-[9px] font-black text-red-400 uppercase block mb-1">Articles en Alerte</span>
            <span className="text-2xl font-black text-red-600">
                {produits.filter(p => p.quantite <= (p.seuil_alerte || 10)).length}
            </span>
          </div>
        </div>

        {/* TABLEAU PROFESSIONNEL */}
        <table className="w-full text-left border-collapse border border-slate-200">
          <thead>
            <tr className="bg-slate-900 text-white text-[10px] font-black uppercase">
              <th className="p-4 border-r border-white/10">Réf.</th>
              <th className="p-4 border-r border-white/10">Désignation</th>
              <th className="p-4 border-r border-white/10">Catégorie</th>
              <th className="p-4 text-center border-r border-white/10">Stock</th>
              <th className="p-4 text-right">Observation</th>
            </tr>
          </thead>
          <tbody className="text-[11px]">
            {produits.map((p, i) => (
              <tr key={i} className={`border-b border-slate-100 ${i % 2 === 0 ? 'bg-white' : 'bg-slate-50/30'}`}>
                <td className="p-4 font-mono text-slate-400 text-[9px] border-r">#PH-{p.id}</td>
                <td className="p-4 font-black uppercase border-r">{p.nom}</td>
                <td className="p-4 text-slate-500 italic border-r">{p.categorie}</td>
                <td className={`p-4 text-center font-black border-r ${p.quantite <= (p.seuil_alerte || 10) ? 'text-red-600' : ''}`}>
                  {p.quantite}
                </td>
                <td className="p-4 text-right text-[9px] font-black uppercase text-slate-400">
                  {p.quantite <= (p.seuil_alerte || 10) ? "⚠️ RÉAPPRO" : "✅ OK"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* FOOTER AVEC INFOS DYNAMIQUES */}
        <div className="mt-16 pt-8 border-t-2 border-dashed border-slate-200 text-center space-y-3">
          <div className="flex items-center justify-center gap-2 text-slate-900 font-black text-[10px] uppercase tracking-widest">
            <ShieldCheck size={14} /> Certifié par le système Pharmacie+
          </div>
          <p className="text-[10px] text-slate-500 font-bold uppercase leading-relaxed tracking-tighter">
            {config?.adresse || "ADRESSE NON CONFIGURÉE"} | Tel: {config?.telephone || "NUMÉRO NON CONFIGURÉ"} <br />
            <span className="italic opacity-60">" {config?.message_merci || "Votre santé, notre priorité."} "</span>
          </p>
          <div className="pt-10 flex justify-between px-10 text-[9px] font-black uppercase text-slate-400 italic">
            <span>Visa de la Direction</span>
            <span>Signature du Responsable</span>
          </div>
        </div>
      </div>

      <style jsx global>{`
        @media print {
          body { background: white !important; }
          .no-print { display: none !important; }
          @page { size: A4; margin: 1cm; }
        }
      `}</style>
    </div>
  );
}
