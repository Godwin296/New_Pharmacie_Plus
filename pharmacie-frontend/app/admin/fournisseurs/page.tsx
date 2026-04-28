"use client";
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Building2, Phone, Mail, MapPin, Search, 
  Plus, Trash2, ShieldCheck, User, Loader2, X, MessageCircle 
} from 'lucide-react';
import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://mw69zhwz-8000.uks1.devtunnels.ms';

interface Fournisseur {
  id: number;
  nom: string;
  telephone: string;
  email: string;
  adresse: string;
  manager: string;
}

export default function FournisseursPage() {
  const [fournisseurs, setFournisseurs] = useState<Fournisseur[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  const [formData, setFormData] = useState({
    nom: '',
    telephone: '',
    email: '',
    adresse: '',
    manager: ''
  });

  useEffect(() => {
    fetchFournisseurs();
  }, []);

  const fetchFournisseurs = async () => {
    try {
      const res = await axios.get(`${API_URL}/api/fournisseurs/`);
      setFournisseurs(res.data);
    } catch (error) {
      console.error("Erreur chargement fournisseurs:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      // Note: Ton backend attend 'contact_personne', j'adapte ici l'envoi pour correspondre au model.py
      const payload = {
        nom: formData.nom,
        telephone: formData.telephone,
        email: formData.email,
        adresse: formData.adresse,
        contact_personne: formData.manager 
      };
      
      const res = await axios.post(`${API_URL}/api/fournisseurs/`, payload);
      setFournisseurs([res.data, ...fournisseurs]);
      setIsModalOpen(false);
      setFormData({ nom: '', telephone: '', email: '', adresse: '', manager: '' });
    } catch (error) {
      alert("Erreur lors de l'enregistrement. Vérifiez la connexion au serveur.");
    }
  };

  const handleDelete = async (id: number) => {
    if (confirm("⚠️ Supprimer ce partenaire ? Cette action est irréversible.")) {
      try {
        await axios.delete(`${API_URL}/api/fournisseurs/${id}/`);
        setFournisseurs(fournisseurs.filter(f => f.id !== id));
      } catch (error) {
        alert("Erreur lors de la suppression.");
      }
    }
  };

  const filteredVendors = fournisseurs.filter(f => 
    f.nom.toLowerCase().includes(search.toLowerCase()) || 
    (f.manager && f.manager.toLowerCase().includes(search.toLowerCase()))
  );

  

  return (
    <div className="max-w-[1600px] mx-auto space-y-10 relative p-4">
      
      {/* HEADER */}
      <div className="flex flex-col lg:flex-row justify-between items-center gap-6">
        <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
          <div className="inline-flex items-center gap-2 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 px-4 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest mb-3">
            <ShieldCheck size={14} /> Réseau de Confiance
          </div>
          <h2 className="text-4xl font-black text-slate-800 dark:text-white tracking-tighter">
            Gestion des <span className="text-emerald-500">Flux Fournisseurs</span>
          </h2>
        </motion.div>

        <button 
          onClick={() => setIsModalOpen(true)}
          className="bg-emerald-500 hover:bg-emerald-600 text-white px-8 py-4 rounded-2xl font-bold shadow-lg shadow-emerald-500/20 transition-all hover:scale-105 flex items-center gap-2 border-none cursor-pointer"
        >
          <Plus size={20} strokeWidth={3} /> NOUVEAU PARTENAIRE
        </button>
      </div>

      {/* SEARCH BAR */}
      <div className="relative group">
        <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400" size={24} />
        <input 
          type="text" 
          placeholder="Rechercher un partenaire par nom ou manager..."
          className="w-full pl-16 pr-8 py-5 rounded-[22px] border-none bg-white dark:bg-slate-900 focus:ring-2 ring-emerald-500/20 outline-none transition-all shadow-sm dark:text-white"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* LISTE DES CARTES */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8 pb-20">
        <AnimatePresence>
          {filteredVendors.map((f) => (
            <motion.div
              key={f.id}
              layout
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-white dark:bg-slate-900 p-8 rounded-[32px] border border-slate-100 dark:border-slate-800 shadow-sm hover:border-emerald-500/50 transition-all group"
            >
               <div className="flex justify-between items-start mb-6">
                 <div className="w-14 h-14 bg-slate-50 dark:bg-slate-800 rounded-2xl flex items-center justify-center text-emerald-600 group-hover:bg-emerald-500 group-hover:text-white transition-colors">
                   <Building2 size={28} />
                 </div>
                 <div className="flex gap-2">
                   <button onClick={() => handleDelete(f.id)} className="p-2 text-slate-300 hover:text-red-500 transition-colors bg-transparent border-none cursor-pointer">
                     <Trash2 size={18} />
                   </button>
                 </div>
               </div>

               <h4 className="text-xl font-black text-slate-800 dark:text-white mb-1 uppercase">{f.nom}</h4>
               <p className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest mb-6 flex items-center gap-2">
                 <User size={12} /> {f.manager}
               </p>

               <div className="space-y-3 mb-8">
                 <div className="flex items-center gap-3 text-sm text-slate-500">
                   <MapPin size={16} className="text-slate-300" /> {f.adresse || "Lieu non précisé"}
                 </div>
               </div>

               {/* BOUTONS DE CONTACT DIRECT */}
               <div className="grid grid-cols-3 gap-2">
                <a href={`tel:${f.telephone}`} className="flex flex-col items-center gap-2 p-3 rounded-2xl bg-slate-50 dark:bg-slate-800 hover:bg-blue-50 dark:hover:bg-blue-900/20 text-blue-600 transition-all no-underline">
                  <Phone size={18} /> <span className="text-[8px] font-black uppercase tracking-tighter">Appel</span>
                </a>
                <a href={`mailto:${f.email}`} className="flex flex-col items-center gap-2 p-3 rounded-2xl bg-slate-50 dark:bg-slate-800 hover:bg-purple-50 dark:hover:bg-purple-900/20 text-purple-600 transition-all no-underline">
                  <Mail size={18} /> <span className="text-[8px] font-black uppercase tracking-tighter">Email</span>
                </a>
                <a href={`https://wa.me{f.telephone.replace(/\s+/g, '')}`} target="_blank" rel="noreferrer" className="flex flex-col items-center gap-2 p-3 rounded-2xl bg-slate-50 dark:bg-slate-800 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 text-emerald-600 transition-all no-underline">
                  <MessageCircle size={18} /> <span className="text-[8px] font-black uppercase tracking-tighter">WhatsApp</span>
                </a>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* 🖼️ MODAL D'AJOUT */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsModalOpen(false)} className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" />
            
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative bg-white dark:bg-slate-900 w-full max-w-lg rounded-[32px] shadow-2xl overflow-hidden"
            >
              <div className="p-8 border-b border-slate-50 dark:border-slate-800 flex justify-between items-center bg-emerald-500 text-white">
                <h3 className="text-xl font-black italic">Nouveau Partenaire</h3>
                <button onClick={() => setIsModalOpen(false)} className="bg-transparent border-none text-white cursor-pointer"><X /></button>
              </div>

              <form onSubmit={handleSubmit} className="p-8 space-y-5">
                <div>
                  <label className="text-[10px] font-bold uppercase text-slate-400 ml-2">Nom de l'entreprise</label>
                  <input required className="w-full p-4 mt-1 bg-slate-50 dark:bg-slate-800 rounded-2xl outline-none focus:ring-2 ring-emerald-500 border-none dark:text-white" 
                    value={formData.nom} onChange={e => setFormData({...formData, nom: e.target.value})} />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-bold uppercase text-slate-400 ml-2">Téléphone</label>
                    <input required className="w-full p-4 mt-1 bg-slate-50 dark:bg-slate-800 rounded-2xl outline-none border-none dark:text-white" 
                      value={formData.telephone} onChange={e => setFormData({...formData, telephone: e.target.value})} />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold uppercase text-slate-400 ml-2">Manager</label>
                    <input required className="w-full p-4 mt-1 bg-slate-50 dark:bg-slate-800 rounded-2xl outline-none border-none dark:text-white" 
                      value={formData.manager} onChange={e => setFormData({...formData, manager: e.target.value})} />
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-bold uppercase text-slate-400 ml-2">Email Professionnel</label>
                  <input type="email" className="w-full p-4 mt-1 bg-slate-50 dark:bg-slate-800 rounded-2xl outline-none border-none dark:text-white" 
                    value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} />
                </div>

                <div>
                  <label className="text-[10px] font-bold uppercase text-slate-400 ml-2">Adresse / Localisation</label>
                  <input className="w-full p-4 mt-1 bg-slate-50 dark:bg-slate-800 rounded-2xl outline-none border-none dark:text-white" 
                    value={formData.adresse} onChange={e => setFormData({...formData, adresse: e.target.value})} />
                </div>

                <button type="submit" className="w-full py-5 bg-emerald-500 text-white rounded-2xl font-black shadow-lg shadow-emerald-500/30 hover:bg-emerald-600 transition-all border-none cursor-pointer">
                  VALIDER L'ENREGISTREMENT
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
