"use client";
import React, { useState, useEffect } from 'react';
import { Printer, Loader2, ShieldCheck, Download, ArrowLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';

// 🌟 CONFIGURATION : Importation de l'apiClient unifié
import apiClient from '../../../../lib/apiClient';

export default function StockPrintPage() {
  const router = useRouter(); // 🌟 Initialisation du routeur
  const [loading, setLoading] = useState(true);
  const [produits, setProduits] = useState<any[]>([]);
  const [config, setConfig] = useState<any>(null);
  const [statistiques, setStatistiques] = useState<any>(null); 
  const [printDate, setPrintDate] = useState("");

  useEffect(() => {
    const loadData = async () => {
      try {
        // 1. ⏱️ Formatage complet de la date et de l'heure précise
        const now = new Date();
        const options: Intl.DateTimeFormatOptions = { 
          weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
          hour: '2-digit', minute: '2-digit', second: '2-digit'
        };
        setPrintDate(now.toLocaleDateString('fr-FR', options).replace('à', 'à '));

        // 2. 🚀 APPEL VERS LE BON ENDPOINT SÉCURISÉ REPRIS DE LA VUE DJANGO
        const res = await apiClient.get('/api/inventaire_stock/');
        
        // 3. 🎯 ENREGISTREMENT DES DONNÉES DU BACKEND DANS VOTRE STATE
        setProduits(res.data.produits || []);
        setConfig(res.data.config); 
        setStatistiques(res.data.statistiques); // Récupère les compteurs calculés côté Django
      } catch (err: any) {
        console.error("Erreur de chargement des données d'impression :", err);
        // En cas d'erreur ou d'accès refusé (403), retour fluide à la page principale
        router.push('/admin/stocks');
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [router]);

  // Fonction optionnelle si vous conservez un bouton de retour sur l'interface d'impression HTML
  const handleGoBack = () => {
    router.push('/admin/stocks');
  };

  if (loading) return (
    <div className="h-screen flex flex-col items-center justify-center text-emerald-600 bg-white">
      <Loader2 className="animate-spin mb-4" size={48} aria-label="Génération du rapport de stock imprimable" />
      <span className="font-black uppercase text-[10px] tracking-widest italic">Initialisation du document certifié...</span>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-100 py-10 print:p-0 print:bg-white text-slate-900">
      
      {/* BOUTONS D'ACTIONS */}
      <div className="fixed top-6 right-6 z-50 flex gap-3 no-print">
        <button 
          onClick={() => window.print()}
          title="Lancer l'impression ou l'export PDF système"
          aria-label="Imprimer maintenant"
          className="bg-emerald-600 text-white px-6 py-4 rounded-full font-black shadow-2xl border-none cursor-pointer hover:scale-105 transition-all flex items-center gap-2 text-xs uppercase tracking-wider"
        >
          <Printer size={18} /> IMPRIMER
        </button>
      </div>

      {/* 📄 LA PAGE A4 COMPACTE */}
      <div className="mx-auto w-[21cm] bg-white p-[1.5cm] shadow-2xl print:shadow-none print:w-full flex flex-col justify-start">
        
        <div>
          {/* HEADER : LOGO & INFOS DYNAMIQUES */}
          <div className="border-b-[6px] border-emerald-600 pb-6 mb-8 flex justify-between items-start">
            <div className="flex gap-4 items-center">
              {config?.logo ? (
                <img src={config.logo} alt="Logo de l'officine" className="w-14 h-14 rounded-xl object-cover border border-slate-100" />
              ) : (
                <div className="w-14 h-14 bg-white rounded-xl border border-slate-100 shadow-md flex items-center justify-center p-1.5">
                  <img src="/branding/icon-mark.png" alt="Pharmacie+" className="w-full h-full object-contain" />
                </div>
              )}
              <div>
                <h1 className="text-xl font-black uppercase tracking-tighter text-slate-900">{config?.nom || "PHARMACIE PLUS +"}</h1>
                <p className="text-[9px] font-black text-emerald-500 uppercase tracking-widest italic leading-none mb-1">Inventaire Physique Stratégique 🛰️</p>
                <p className="text-[8px] text-slate-400 font-bold uppercase tracking-tight leading-none">{config?.adresse}</p>
              </div>
            </div>
            <div className="text-right">
              <h2 className="text-xl font-black text-emerald-600 tracking-tighter uppercase italic leading-none mb-1">État du Stock</h2>
              <p className="text-[8px] font-black text-slate-400 uppercase tracking-wide">Fait le <span className="capitalize">{printDate}</span></p>
            </div>
          </div>

          {/* RÉSUMÉ RAPIDE UTILISANT LES STATISTIQUES DU BACKEND */}
          <div className="grid grid-cols-2 gap-4 mb-8">
            <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100 text-center">
              <span className="text-[8px] font-black text-slate-400 uppercase block mb-1">Total Références</span>
              <span className="text-xl font-black">
                {statistiques?.total_med ?? produits.length} Médicaments
              </span>
            </div>
            <div className="bg-red-50 p-5 rounded-2xl border border-red-100 text-center">
              <span className="text-[8px] font-black text-red-400 uppercase block mb-1">Articles en Alerte</span>
              <span className="text-xl font-black text-red-600">
                {statistiques?.stock_faible ?? produits.filter(p => p.quantite <= (p.seuil_alerte || 10)).length}
              </span>
            </div>
          </div>

          {/* TABLEAU VERT ÉMERAUDE */}
          <table className="w-full text-left border-collapse border border-slate-200">
            <thead>
              <tr className="bg-emerald-600 dark:bg-emerald-700 text-white text-[10px] font-black uppercase">
                <th className="p-4 border-r border-emerald-500/20">Réf.</th>
                <th className="p-4 border-r border-emerald-500/20">Désignation</th>
                <th className="p-4 border-r border-emerald-500/20">Catégorie</th>
                <th className="p-4 text-center border-r border-emerald-500/20">Stock</th>
                <th className="p-4 text-right">Observation</th>
              </tr>
            </thead>
            <tbody className="text-[11px]">
              {produits.map((p, i) => (
                <tr key={i} className={`border-b border-slate-100 ${i % 2 === 0 ? 'bg-white' : 'bg-slate-50/30'}`}>
                  <td className="p-4 font-mono text-slate-400 text-[9px] border-r">#PH-{p.id}</td>
                  <td className="p-4 font-black uppercase border-r text-slate-800">{p.nom}</td>
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
        </div>

        {/* LE FOOTER ENCHAÎNÉ */}
        <div className="mt-8 pt-6 text-center space-y-3">
          <div className="flex items-center justify-center gap-2 text-emerald-600 font-black text-[10px] uppercase tracking-wider italic">
            <ShieldCheck size={14} strokeWidth={2.5} /> RAPPORT DE STOCKS CERTIFIÉ PAR {config?.nom || "PHARMACIE+"}
          </div>
          
          <p className="text-[9px] text-slate-500 font-black uppercase tracking-tight leading-relaxed">
            {config?.adresse || "ADRESSE NON CONFIGURÉE"} | Tel: {config?.telephone || "NUMÉRO NON CONFIGURÉ"} <br />
            <span className="text-emerald-500 lowercase italic font-bold text-xs mt-1 block">
              " {config?.message_remerciement || "Merci de votre confiance !"} "
            </span>
          </p>

          <div className="pt-4 grid grid-cols-2 gap-16 px-6 text-[9px] font-black uppercase text-slate-400 tracking-wide">
            <div className="text-left space-y-12">
              <span>VISA DE LA DIRECTION</span>
              <div className="w-full border-b border-slate-200" /> 
            </div>
            <div className="text-right space-y-12">
              <span>SIGNATURE DE L'AUDITEUR</span>
              <div className="w-full border-b border-slate-200" /> 
            </div>
          </div>
        </div>

      </div>

      <style jsx global>{`
        @media print {
          body { background: white !important; }
          .no-print { display: none !important; }
          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          @page { size: A4; margin: 1cm; }
        }
      `}</style>
    </div>
  );
}
