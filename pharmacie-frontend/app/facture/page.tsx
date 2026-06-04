"use client";
import React, { useState, useEffect, Suspense } from 'react';
import { motion } from 'framer-motion';
import {
  Printer, CheckCircle2, AlertCircle,
  ArrowLeft, Loader2, ShieldCheck
} from 'lucide-react';
import { useSearchParams } from 'next/navigation';

// 🌟 CONFIGURATION : Importation de l'apiClient unifié
import apiClient from '../../lib/apiClient'; // Ajustez le chemin selon votre dossier app/facture

function FactureContent() {
  const searchParams = useSearchParams();
  const factureId = searchParams.get('id');
  const [data, setData] = useState<any>(null);
  const [config, setConfig] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadFacture = async () => {
      if (!factureId) return;
      try {
        // 🌟 STABLE : apiClient injecte automatiquement l'access_token JWT requis par Django
        const [resFacture, resConfig] = await Promise.all([
          apiClient.get('/api/panier/', {
            params: { id: factureId }
          }),
          apiClient.get('/api/infos-pharmacie/')
        ]);
     
        const facture = Array.isArray(resFacture.data)
          ? resFacture.data.find((f: any) => f.id.toString() === factureId.toString())
          : resFacture.data;

        if (facture && facture.id) {
          setData(facture);
        }
        setConfig(resConfig.data);
      } catch (err) {
        console.error("Erreur chargement facture:", err);
      } finally {
        setLoading(false);
      }
    };
    loadFacture();
  }, [factureId]);

  if (loading) return (
    <div className="h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 text-emerald-500">
      <Loader2 className="animate-spin" size={48}  aria-label="Génération de la facture" />
    </div>
  );
 
  if (!data) return <div className="text-center py-20 font-black uppercase text-red-500 italic">Facture #{factureId} introuvable 🛰️</div>;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 py-12 px-6 print:p-0 print:bg-white print:block">
      
      {/* 🛠️ ACTIONS */}
      <div className="max-w-212.5 mx-auto mb-8 flex justify-between items-center no-print">
        <button onClick={() => window.history.back()} className="flex items-center gap-2 text-slate-500 hover:text-emerald-500 font-bold text-xs transition-all uppercase tracking-widest bg-transparent border-none cursor-pointer">
          <ArrowLeft size={16} /> Retour
        </button>
        <button onClick={() => window.print()} className="bg-emerald-500 text-slate-950 px-8 py-4 rounded-2xl font-black text-xs hover:scale-105 transition-all shadow-xl border-none cursor-pointer flex items-center gap-2 uppercase tracking-tighter">
          <Printer size={18} /> Imprimer le Ticket
        </button>
      </div>

      {/* Wrapper de centrage pour l'impression */}
      <div className="print-wrapper">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
          className="invoice-container max-w-212.5 mx-auto bg-white dark:bg-slate-900 p-10 md:p-16 rounded-[3rem] shadow-2xl border border-slate-100 dark:border-slate-800 print:shadow-none print:border-none print:m-0 print:p-4 print:w-[80mm]"
        >
          {/* 🔝 EN-TÊTE */}
          <div className="flex flex-col md:flex-row justify-between items-start border-b-2 border-slate-50 dark:border-slate-800 pb-10 mb-10 gap-8">
            <div className="flex items-center gap-6">
              {config?.logo ? (
                <img src={config.logo} alt="Logo" className="w-20 h-20 object-contain rounded-2xl" />
              ) : (
                <div className="w-20 h-20 bg-emerald-500 rounded-2xl flex items-center justify-center text-white text-3xl font-black italic">P+</div>
              )}
              <div>
                <h1 className="text-3xl font-black tracking-tighter text-slate-800 dark:text-white uppercase italic leading-none print:text-xl">{config?.nom || "PHARMACIE +"}</h1>
                <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mt-2">{config?.adresse}</p>
                <p className="text-[10px] text-emerald-500 font-black uppercase tracking-widest">{config?.telephone}</p>
              </div>
            </div>
            <div className="text-right flex flex-col items-end print:hidden">
              <div className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest mb-4 flex items-center gap-2
                ${data.payee ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>
                {data.payee ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
                {data.payee ? 'Payée' : 'En Attente'}
              </div>
              <p className="text-[9px] font-black text-slate-400 uppercase mb-1">RÉFÉRENCE</p>
              <p className="font-mono font-bold text-slate-800 dark:text-white text-sm bg-slate-50 dark:bg-slate-800 px-3 py-1 rounded-lg">
                #FAC-{data.id}
              </p>
            </div>
          </div>

          {/* 👤 INFOS CLIENT */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 bg-slate-50 dark:bg-slate-950 p-8 rounded-[2.5rem] mb-12 border border-slate-100 dark:border-slate-800 print:mb-6 print:p-4 print:rounded-2xl">
            <div>
              <span className="text-[9px] font-black text-slate-400 uppercase block mb-2 underline decoration-emerald-500">Patient / Client</span>
              <h4 className="text-xl font-black text-slate-800 dark:text-white uppercase italic tracking-tighter print:text-sm">
                {data.client_nom || "Client au Guichet"}
              </h4>
              <p className="text-[10px] font-bold text-slate-400 uppercase mt-1">
                {data.type_vente === 'guichet' ? 'Vente Directe (Comptoir)' : 'Commande en Ligne'}
              </p>
            </div>
            <div className="md:text-right">
              <span className="text-[9px] font-black text-slate-400 uppercase block mb-2">Émis le</span>
              <h4 className="text-lg font-black text-slate-800 dark:text-white uppercase tracking-tighter print:text-xs">
                {new Date(data.date).toLocaleDateString('fr-FR')}
              </h4>
              <p className="text-[11px] text-slate-500 font-bold uppercase italic tracking-widest">
                RÉF: #FAC-{data.id}
              </p>
            </div>
          </div>

          {/* 🛒 ARTICLES */}
          <div className="overflow-x-auto mb-12 print:mb-6">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 dark:border-slate-800">
                  <th className="py-6 px-4 print:py-2">Désignation</th>
                  <th className="py-6 px-4 text-center print:py-2">Qté</th>
                  <th className="py-6 px-4 text-right print:py-2 print:hidden">P.U</th>
                  <th className="py-6 px-4 text-right print:py-2">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                {data.items?.map((item: any, i: number) => (
                  <tr key={i}>
                    <td className="py-6 px-4 print:py-2">
                      <div className="font-black text-slate-800 dark:text-white text-sm uppercase italic print:text-[10px]">{item.produit_nom}</div>
                    </td>
                    <td className="py-6 px-4 text-center font-black text-slate-500 text-sm print:py-2 print:text-[10px]">x{item.quantite}</td>
                    <td className="py-6 px-4 text-right font-bold text-slate-600 dark:text-slate-400 text-sm print:hidden">{parseFloat(item.prix_unitaire).toLocaleString()}</td>
                    <td className="py-6 px-4 text-right font-black text-slate-800 dark:text-white text-base print:py-2 print:text-[10px]">
                      {parseFloat(item.total_item).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* 💰 TOTAL GLOBAL */}
          <div className="flex justify-end mb-16 px-4 print:mb-6">
            <div className="w-full md:w-80 pt-6 border-t-4 border-emerald-500/20 flex justify-between items-end text-4xl font-black text-emerald-600 dark:text-emerald-400 print:text-xl print:pt-2">
                <span className="tracking-tighter italic">TOTAL</span>
                <span className="tracking-tighter">
                  {parseFloat(data.total_general).toLocaleString()}
                  <small className="text-xs font-bold text-slate-400 ml-2">CFA</small>
                </span>
            </div>
          </div>

          {/* 🛰️ FOOTER & QR CODE */}
          <div className="flex flex-col md:flex-row justify-between items-center gap-12 border-t-2 border-slate-50 dark:border-slate-800 pt-12 print:pt-4 print:gap-4">
            <div className="max-w-md text-center md:text-left">
              <h5 className="text-[10px] font-black text-slate-800 dark:text-white mb-3 uppercase tracking-widest flex items-center justify-center md:justify-start gap-2">
                <ShieldCheck size={14} className="text-emerald-500" /> Note Pharmaceutique
              </h5>
              <p className="text-xs text-slate-500 italic leading-relaxed font-medium print:text-[8px]">
                {config?.message_remerciement || "Merci de votre confiance. Respectez les doses."}
              </p>
            </div>
  
            <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-3xl border border-slate-100 dark:border-slate-700 flex flex-col items-center print:p-2 print:rounded-xl">
              <div className="w-28 h-28 bg-white rounded-2xl flex items-center justify-center border border-dashed border-slate-200 overflow-hidden print:w-20 print:h-20">
                {data?.qr_code ? (
                  <img
                    src={data.qr_code}
                    alt="QR Code"
                    className="w-24 h-24 object-contain print:w-16 print:h-16"
                  />
                ) : (
                  <div className="text-[10px] text-slate-400 font-bold text-center p-2">QR</div>
                )}
              </div>
              <span className="text-[7px] font-black text-slate-400 uppercase block mt-3 tracking-widest">
                Certification PHARMACIE +
              </span>
            </div>
          </div>
        </motion.div>
      </div>

      <style jsx global>{`
        @media print {
          /* Cacher tout sauf le wrapper */
          nav, footer, .no-print, aside { display: none !important; }
          
          @page {
            size: 80mm auto;
            margin: 0 !important;
          }

          body {
            margin: 0 !important;
            padding: 0 !important;
            background: white !important;
          }

          /* Le secret du centrage : Flexbox sur le wrapper print */
          .print-wrapper {
            display: flex !important;
            justify-content: center !important;
            align-items: flex-start !important;
            width: 80mm !important;
            margin: 0 auto !important;
          }

          .invoice-container {
            width: 80mm !important;
            max-width: 80mm !important;
            margin: 0 auto !important;
            padding: 5mm !important;
            border-radius: 0 !important; /* Pour le ticket de caisse, on aplatit */
            box-shadow: none !important;
            border: none !important;
            background: white !important;
          }

          /* On force le rendu des couleurs Tailwind même en impression */
          * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            color: black !important;
          }

          /* On réduit les espaces trop grands du design desktop */
          .pb-10, .mb-10, .mb-12, .mb-16 { margin-bottom: 4mm !important; padding-bottom: 4mm !important; }
          .p-8, .p-10, .md\:p-16 { padding: 2mm !important; }
          
          /* Forcer la visibilité du logo */
          img { max-width: 15mm !important; }
        }
      `}</style>
    </div>
  );
}

export default function FacturePage() {
  return (
    <Suspense fallback={<div className="h-screen flex items-center justify-center"><Loader2 className="animate-spin text-emerald-500" /></div>}>
      <FactureContent />
    </Suspense>
  );
}