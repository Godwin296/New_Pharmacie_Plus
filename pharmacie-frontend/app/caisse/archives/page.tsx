"use client";
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  History, Search, FileText, Printer, 
  Calendar, Eye, ShieldCheck,
  Download
} from 'lucide-react';
import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://mw69zhwz-8000.uks1.devtunnels.ms';

export default function ArchivesPage() {
  const [archives, setArchives] = useState([]);
  const [filter, setFilter] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchArchives = async () => {
      try {
        const res = await axios.get(`${API_URL}/api/archives/`, { 
          withCredentials: true // 👈 Obligatoire pour la session Staff
        });
        setArchives(res.data);
      } catch (err) { 
        console.error("Erreur 403 ou 404 archives:", err); 
      } finally { 
        setLoading(false); 
      }
    };
    fetchArchives();
  }, []);

  return (
    <div className="max-w-7xl mx-auto p-8 min-h-screen">
      <div className="mb-12 flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
        <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
          <div className="inline-flex items-center gap-2 bg-emerald-500/10 text-emerald-600 px-4 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] mb-3">
            <History size={14} /> Registre Légal ⚖️
          </div>
          <h2 className="text-5xl font-black text-slate-800 dark:text-white tracking-tighter">
            Archives <span className="text-emerald-500">90 Jours</span>
          </h2>
          <p className="text-slate-500 font-medium mt-2 italic">Consultation des preuves d'achat et documents médicaux.</p>
        </motion.div>

        <div className="relative group w-full md:w-96">
          <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
          <input 
            type="text" 
            placeholder="Nom client ou N° Facture..."
            className="w-full pl-14 pr-6 py-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 font-bold outline-none focus:ring-4 focus:ring-emerald-500/10 transition-all shadow-sm"
            onChange={(e) => setFilter(e.target.value)}
          />
        </div>
      </div>

      <div className="space-y-4">
        
        
        <AnimatePresence>
          {archives
            .filter((a:any) => (a.client_nom || "").toLowerCase().includes(filter.toLowerCase()) || a.id.toString().includes(filter))
            .map((arc: any) => (
            <motion.div 
              key={arc.id} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="bg-white dark:bg-slate-900/40 backdrop-blur-md p-6 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 flex justify-between items-center group transition-all"
            >
              <div className="flex items-center gap-6 w-full">
                <div className="w-16 h-16 bg-slate-50 dark:bg-slate-800 rounded-[1.5rem] flex items-center justify-center text-slate-400 group-hover:text-emerald-500 transition-all">
                  {arc.ordonnance ? <ShieldCheck size={28} /> : <FileText size={28} />}
                </div>
                
                <div className="flex-grow">
                  <div className="flex items-center gap-3">
                    <span className="text-[10px] font-black bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-lg text-slate-500 uppercase tracking-tighter">#FAC-{arc.id}</span>
                    {arc.ordonnance && <span className="text-[9px] font-black text-blue-500 uppercase tracking-tighter border border-blue-500/30 px-2 py-0.5 rounded-md italic">Médical</span>}
                  </div>
                  <h4 className="font-black text-xl text-slate-800 dark:text-white mt-1 uppercase italic">{arc.client_nom || "Client Guichet"}</h4>
                  <div className="flex gap-6 mt-2">
                    <p className="text-[10px] font-black text-slate-400 uppercase flex items-center gap-2"><Calendar size={12}/> {new Date(arc.date).toLocaleDateString()}</p>
                    <p className="text-[10px] font-black text-emerald-600 uppercase">Total: {arc.total_general?.toLocaleString()} FCFA</p>
                  </div>
                </div>

                <div className="flex gap-2">
                  {/* Ton bouton Printer (Garde ton code actuel) */}
                  <button 
                    onClick={() => window.open(`/facture?id=${arc.id}`, '_blank')}
                    className="p-4 bg-slate-100 dark:bg-slate-800 text-slate-500 rounded-2xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-all border-none cursor-pointer"
                  >
                    <Printer size={20} />
                  </button>

                  {/* Nouveau bouton Download (Téléchargement Direct) */}
                  <button 
                    onClick={() => {
                    // On crée un lien invisible pour forcer le téléchargement
                    const link = document.createElement('a');
                    // VERIFIE BIEN SI TU AS BESOIN DU /api/ ICI SELON TON URLCONF
                    link.href = `${API_URL}/api/facture-pdf/${arc.id}/`; 
                    link.setAttribute('download', `Facture_${arc.id}.pdf`);
                    document.body.appendChild(link);
                    link.click();
                    link.remove();
                  }}
                    className="p-4 bg-emerald-500/10 text-emerald-600 rounded-2xl hover:bg-emerald-500 hover:text-white transition-all border-none cursor-pointer"
                  >
                    <Download size={20} />
                  </button>
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {!loading && archives.length === 0 && (
          <div className="text-center py-40 bg-slate-100/50 dark:bg-slate-900/20 rounded-[4rem] border-2 border-dashed border-slate-200 dark:border-slate-800">
            <History size={48} className="mx-auto mb-4 text-slate-300" />
            <p className="font-black text-slate-400 uppercase tracking-widest text-[10px]">Aucun enregistrement trouvé.</p>
          </div>
        )}
      </div>
    </div>
  );
}
