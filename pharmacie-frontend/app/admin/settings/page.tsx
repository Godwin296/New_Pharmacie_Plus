"use client";
import React, { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Settings, Image as ImageIcon, MapPin, 
  Globe, Building2, Phone, Mail,
  MessageSquare, Save, Loader2 
} from 'lucide-react';
import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://mw69zhwz-8000.uks1.devtunnels.ms';

export default function SettingsPage() {
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // 1. Initialisation avec les noms exacts du Model Django
  const [config, setConfig] = useState({
    nom: '',
    telephone: '',
    email_contact: '', // 👈 Nouveau
    adresse: '',
    message_remerciement: '', // 👈 Harmonisé avec le backend
    devise_preferee: 'FCFA',
    langue_preferee: 'fr'
  });

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const res = await axios.get(`${API_URL}/api/infos-pharmacie/`);
        const data = res.data;
        
        // 2. Mapping des données reçues de l'API vers notre State
        setConfig({
          nom: data.nom || '',
          telephone: data.telephone || '',
          email_contact: data.email_contact || '',
          adresse: data.adresse || '',
          message_remerciement: data.message_remerciement || '',
          devise_preferee: data.devise_preferee || 'FCFA',
          langue_preferee: data.langue_preferee || 'fr'
        });
        
        if (data.logo) setLogoPreview(data.logo);
      } catch (err) {
        console.error("Erreur chargement config:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchConfig();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    
    // 3. Préparation dynamique du FormData
    const formData = new FormData();
    formData.append('nom', config.nom);
    formData.append('telephone', config.telephone);
    formData.append('email_contact', config.email_contact);
    formData.append('adresse', config.adresse);
    formData.append('message_remerciement', config.message_remerciement);
    formData.append('langue_preferee', config.langue_preferee);
    formData.append('devise_preferee', config.devise_preferee);
    
    if (logoFile) {
      formData.append('logo', logoFile);
    }

    try {
      await axios.post(`${API_URL}/api/update-config/`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        withCredentials: true 
      });
      
      alert("Configuration mise à jour avec succès ! ✅");
    } catch (err) {
      console.error(err);
      alert("Erreur lors de la sauvegarde.");
    } finally {
      setSaving(false);
    }
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setLogoFile(file);
      const reader = new FileReader();
      reader.onload = (event) => setLogoPreview(event.target?.result as string);
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="max-w-[1100px] mx-auto pb-20 p-4">
      
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="flex justify-between items-end mb-10">
        <div>
          <div className="inline-flex items-center gap-2 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-4 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] mb-3">
            <Settings size={14} /> System Control
          </div>
          <h2 className="text-5xl font-black text-slate-800 dark:text-white tracking-tighter italic">
            Paramètres de <span className="text-emerald-500">l'Empire</span> ⚙️
          </h2>
        </div>
      </motion.div>

      <form onSubmit={handleSave} className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* COLONNE GAUCHE */}
        <div className="lg:col-span-4 space-y-8">
          <motion.div whileHover={{ y: -5 }} className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] shadow-sm border border-slate-100 dark:border-slate-800">
            <h5 className="font-bold text-slate-800 dark:text-white mb-6 flex items-center gap-2 text-sm uppercase tracking-widest">
              <ImageIcon size={18} className="text-emerald-500" /> Logo
            </h5>
            <div className="border-3 border-dashed border-slate-100 dark:border-slate-800 rounded-[2rem] p-6 text-center group hover:border-emerald-500/50 transition-colors">
              <div className="relative w-32 h-32 mx-auto mb-6">
                <img src={logoPreview || "/static/logo.png"} alt="Logo" className="w-full h-full rounded-3xl object-cover shadow-2xl bg-white" />
              </div>
              <input type="file" ref={fileInputRef} onChange={handleImageChange} className="hidden" accept="image/*" />
              <button type="button" onClick={() => fileInputRef.current?.click()} className="bg-slate-900 dark:bg-slate-800 text-white text-[10px] font-black px-6 py-3 rounded-2xl hover:bg-emerald-600 transition-all uppercase tracking-tighter cursor-pointer border-none">
                Changer le Logo
              </button>
            </div>
          </motion.div>

          <motion.div whileHover={{ y: -5 }} className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] shadow-sm border border-slate-100 dark:border-slate-800">
            <h5 className="font-bold text-slate-800 dark:text-white mb-6 flex items-center gap-2 text-sm uppercase tracking-widest">
              <Globe size={18} className="text-blue-500" /> Régional
            </h5>
            <div className="space-y-5">
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Langue</label>
                <select 
                  value={config.langue_preferee}
                  onChange={(e) => setConfig({...config, langue_preferee: e.target.value})}
                  className="w-full p-4 rounded-2xl bg-slate-50 dark:bg-slate-800 border-none outline-none font-bold text-sm dark:text-white"
                >
                  <option value="fr">🇫🇷 Français</option>
                  <option value="en">🇺🇸 English</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Devise</label>
                <select 
                  value={config.devise_preferee}
                  onChange={(e) => setConfig({...config, devise_preferee: e.target.value})}
                  className="w-full p-4 rounded-2xl bg-slate-50 dark:bg-slate-800 border-none outline-none font-bold text-sm dark:text-white"
                >
                  <option value="FCFA">Franc CFA (XAF)</option>
                  <option value="EUR">Euro (€)</option>
                  <option value="USD">Dollar ($)</option>
                </select>
              </div>
            </div>
          </motion.div>
        </div>

        {/* COLONNE DROITE */}
        <div className="lg:col-span-8">
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="bg-white dark:bg-slate-900 p-10 rounded-[3rem] shadow-sm border border-slate-100 dark:border-slate-800 h-full">
            <h5 className="font-bold text-slate-800 dark:text-white mb-10 flex items-center gap-3 text-lg text-emerald-500">
              <Building2 size={24} /> Informations de l'Établissement
            </h5>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="md:col-span-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 block">Nom de la Pharmacie</label>
                <input 
                  type="text" 
                  value={config.nom}
                  onChange={(e) => setConfig({...config, nom: e.target.value})}
                  className="w-full p-5 rounded-2xl bg-slate-50 dark:bg-slate-800 border-none focus:ring-2 focus:ring-emerald-500 font-bold dark:text-white outline-none" 
                />
              </div>

              {/* 📧 CHAMP E-MAIL AJOUTÉ */}
              <div className="md:col-span-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 block">Email de Contact</label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                  <input 
                    type="email" 
                    value={config.email_contact}
                    onChange={(e) => setConfig({...config, email_contact: e.target.value})}
                    placeholder="exemple@pharmacie.com"
                    className="w-full pl-12 pr-5 py-5 rounded-2xl bg-slate-50 dark:bg-slate-800 border-none font-bold dark:text-white outline-none" 
                  />
                </div>
              </div>
              
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 block">Téléphone Officiel</label>
                <div className="relative">
                  <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                  <input 
                    type="text" 
                    value={config.telephone}
                    onChange={(e) => setConfig({...config, telephone: e.target.value})}
                    className="w-full pl-12 pr-5 py-5 rounded-2xl bg-slate-50 dark:bg-slate-800 border-none font-bold dark:text-white outline-none" 
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 block">Adresse Physique</label>
                <div className="relative">
                  <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                  <input 
                    type="text" 
                    value={config.adresse}
                    onChange={(e) => setConfig({...config, adresse: e.target.value})}
                    className="w-full pl-12 pr-5 py-5 rounded-2xl bg-slate-50 dark:bg-slate-800 border-none font-bold dark:text-white outline-none" 
                  />
                </div>
              </div>

              <div className="md:col-span-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 block">Message de courtoisie</label>
                <div className="relative">
                  <MessageSquare className="absolute left-4 top-5 text-slate-300" size={18} />
                  <textarea 
                    rows={4} 
                    value={config.message_remerciement}
                    onChange={(e) => setConfig({...config, message_remerciement: e.target.value})}
                    className="w-full pl-12 pr-5 py-5 rounded-2xl bg-slate-50 dark:bg-slate-800 border-none font-bold dark:text-white outline-none" 
                  />
                </div>
              </div>
            </div>
            
            <div className="mt-12 pt-10 border-t border-slate-50 dark:border-slate-800">
              <button 
                type="submit" 
                disabled={saving}
                className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-black py-6 rounded-[2rem] shadow-2xl transition-all flex items-center justify-center gap-3 border-none cursor-pointer"
              >
                {saving ? <Loader2 className="animate-spin" size={24}/> : <Save size={24}/>} 
                SAUVEGARDER LA CONFIGURATION
              </button>
            </div>
          </motion.div>
        </div>
      </form>
    </div>
  );
}