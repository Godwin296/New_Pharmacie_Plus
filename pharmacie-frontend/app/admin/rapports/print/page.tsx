"use client";
import React, { useState, useEffect } from 'react';
import { 
  TrendingUp, ShoppingBag, Scale, 
  ShieldCheck, Loader2, Printer 
} from 'lucide-react';

// 🌟 CONFIGURATION : Importation de l'apiClient unifié (Gère l'URL et injecte le JWT de l'Admin)
import apiClient from '../../../../lib/apiClient'; // Ajustez le nombre de '../' selon l'arborescence exacte admin/rapports/print

export default function FinancialReport() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [config, setConfig] = useState<any>(null);
  const [currency, setCurrency] = useState('FCFA');

  // Logique de Conversion 💱
  const convert = (amount: number) => {
    if (!amount) return "0";
    if (currency === 'EUR') return (amount / 655.957).toLocaleString(undefined, {minimumFractionDigits: 2});
    if (currency === 'USD') return (amount / 600).toLocaleString(undefined, {minimumFractionDigits: 2});
    return amount.toLocaleString();
  };

  // 🌟 ÉTAPE 1 : Récupération parallèle et sécurisée des rapports et de la configuration de l'officine
  useEffect(() => {
    const loadAllData = async () => {
      try {
        setCurrency(localStorage.getItem('app_currency') || 'FCFA');
        
        // apiClient injecte de lui-même l'access_token JWT et ajoute les slashs requis par Django
        const [resStats, resConfig] = await Promise.all([
          apiClient.get('/api/boss-dashboard/'),
          apiClient.get('/api/infos-pharmacie/')
        ]);
        
        setData(resStats.data);
        setConfig(resConfig.data);
        if (resStats.data && resConfig.data) {
          setTimeout(() => {
            window.print();
          }, 300);
        }

      } catch (err) {
        console.error("Erreur lors de la génération réseau de l'impression financière:", err);
      } finally {
        setLoading(false);
      }
    };
    loadAllData();
  }, []);

  if (loading) return (
    <div className="h-screen flex flex-col items-center justify-center text-emerald-600 bg-white">
      {/* 🌟 ACCESSIBILITÉ : Intégration préventive des attributs d'accessibilité exigés par Next.js */}
      <Loader2 className="animate-spin mb-4" size={48}  aria-label="Génération du rapport financier imprimable" />
      <span className="font-black uppercase text-[10px] tracking-widest">Préparation du document certifié...</span>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-100 py-10 print:p-0 print:bg-white transition-colors">
      
      {/* 🛠️ BOUTON D'IMPRESSION (Masqué au print) */}
      <button 
        onClick={() => window.print()}
        className="fixed top-6 right-6 z-50 bg-emerald-600 hover:bg-emerald-700 text-white px-8 py-4 rounded-full font-black shadow-2xl transition-all hover:scale-105 flex items-center gap-3 no-print border-none cursor-pointer"
      >
        <Printer size={20} strokeWidth={3} /> LANCER L'IMPRESSION
      </button>

      {/* 📄 FORMAT A4 DYNAMIQUE */}
      <div className="mx-auto w-[21cm] min-h-[29.7cm] bg-white p-[2cm] shadow-2xl print:shadow-none print:w-full print:p-0 text-slate-900 flex flex-col">
        
        {/* HEADER DYNAMIQUE (Settings) */}
        <div className="border-b-[6px] border-emerald-600 pb-8 mb-12 flex justify-between items-start">
          <div className="flex gap-6 items-center">
            {config?.logo ? (
              <img src={config.logo} alt="Logo" className="w-20 h-20 rounded-2xl object-cover border border-slate-100" />
            ) : (
              <div className="w-16 h-16 bg-emerald-600 rounded-xl flex items-center justify-center font-black text-2xl text-white">P+</div>
            )}
            <div>
              <div className="bg-slate-900 text-white px-3 py-1 rounded text-[8px] font-black uppercase tracking-widest mb-2 inline-block">
                Document Officiel 🛰️
              </div>
              <h1 className="text-xl font-black text-slate-800 uppercase tracking-tighter">{config?.nom || "PHARMACIE +"}</h1>
              <p className="text-[9px] font-bold text-slate-400 uppercase italic">Système d'Audit Centralisé</p>
            </div>
          </div>
          
          <div className="text-right">
            <h2 className="text-3xl font-black text-emerald-600 tracking-tighter mb-1 uppercase italic">Audit Financier</h2>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              Généré le {new Date().toLocaleDateString('fr-FR')} à {new Date().toLocaleTimeString('fr-FR', {hour: '2-digit', minute: '2-digit'})}
            </p>
          </div>
        </div>

        {/* 📊 KPI GRID DYNAMIQUE */}
        <div className="grid grid-cols-3 gap-6 mb-12">
          {[
            { label: "RECETTES TOTALES", val: convert(data?.ca_total), icon: <TrendingUp size={16}/> },
            { label: "VOLUME VENTES", val: data?.ventes_recentes?.length || 0, icon: <ShoppingBag size={16}/> },
            { label: "PANIER MOYEN", val: convert(data?.ca_total / (data?.ventes_recentes?.length || 1)), icon: <Scale size={16}/> },
          ].map((kpi, i) => (
            <div key={i} className="bg-slate-50 p-6 rounded-4xl text-center flex flex-col items-center">
              <span className="text-emerald-600 mb-2">{kpi.icon}</span>
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">{kpi.label}</span>
              <b className="text-xl font-black text-slate-800">{kpi.val} <small className="text-[10px] opacity-50">{currency}</small></b>
            </div>
          ))}
        </div>

        {/* 🏆 PERFORMANCE TABLE DYNAMIQUE */}
        <div className="grow">
          <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest mb-6 flex items-center gap-3 italic">
            <span className="w-1.5 h-6 bg-emerald-600 rounded-full"></span>
            Performance des Stocks & Produits
          </h3>
          
          <table className="w-full text-left border-collapse overflow-hidden rounded-2xl">
            <thead>
              <tr className="bg-slate-900 text-[10px] font-black text-white uppercase tracking-widest">
                <th className="p-5">Rang</th>
                <th className="p-5">Médicament</th>
                <th className="p-5">Laboratoire</th>
                <th className="p-5 text-right">Stock</th>
              </tr>
            </thead>
            <tbody className="text-sm">
              {data?.produits_expirant_bientot?.slice(0, 10).map((p: any, index: number) => (
                <tr key={index} className="border-b border-slate-100">
                  <td className="p-5 font-mono text-slate-400">#0{index + 1}</td>
                  <td className="p-5 font-black text-slate-800 uppercase text-xs">{p.nom}</td>
                  <td className="p-5 text-slate-500 font-bold italic text-xs uppercase">{p.laboratoire || 'Générique'}</td>
                  <td className="p-5 text-right font-black text-emerald-600">{p.quantite} <small className="text-[8px] text-slate-400">UNITÉS</small></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* FOOTER STANDARDISÉ */}
        <div className="mt-12 pt-10 border-t-2 border-dashed border-slate-200 text-center space-y-4">
          <div className="flex items-center justify-center gap-2 text-emerald-600 font-black text-[10px] uppercase tracking-[0.2em]">
            <ShieldCheck size={14} /> Rapport Financier Certifié par Pharmacie+
          </div>
          <p className="text-[10px] text-slate-500 font-bold uppercase tracking-tighter leading-relaxed">
            {config?.adresse || "ADRESSE NON CONFIGURÉE"} | Tel: {config?.telephone || "N/A"} <br />
            <span className="text-emerald-500 italic mt-2 block">"{config?.message_remerciement || "Merci de votre confiance."}"</span>
          </p>
  
          <div className="pt-12 flex justify-between px-16 text-[9px] font-black uppercase text-slate-400 italic">
            <div className="flex flex-col items-center gap-16">
              <span>Visa de la Direction</span>
              <div className="w-32 h-px bg-slate-200"></div>
            </div>
            <div className="flex flex-col items-center gap-16">
              <span>Signature de l'Auditeur</span>
              <div className="w-32 h-px bg-slate-200"></div>
            </div>
          </div>
        </div>

        <style jsx global>{`
          @media print {
            body { background: white !important; padding: 0 !important; }
            .no-print { display: none !important; }
            @page { size: A4; margin: 1cm; }
          }
        `}</style>
      </div>
    </div>
  );
}
