"use client";
import React, { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useTheme } from 'next-themes';
import { 
  Settings, Image as ImageIcon, MapPin, 
  Globe, Building2, Phone, Mail,
  MessageSquare, Save, Loader2, Wallet, Sun, Moon, Monitor
} from 'lucide-react';

// 🌟 ÉTAPE 1 : Importation de l'apiClient
import apiClient from '../../../lib/apiClient'; // Ajustez le chemin selon la profondeur du dossier admin/settings

export default function SettingsPage() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [config, setConfig] = useState({
    nom: '',
    telephone: '',
    email_contact: '',
    adresse: '',
    message_remerciement: '',
    devise_preferee: 'FCFA',
    langue_preferee: 'fr',
    // 💰 PAIEMENT MANUEL : numéros propres à CETTE pharmacie (tenant), affichés au client
    // sur la page de paiement -- jamais codés en dur dans l'application.
    numero_orange_money: '',
    nom_titulaire_orange_money: '',
    numero_mtn_momo: '',
    nom_titulaire_mtn_momo: '',
  });

  // 🌟 ÉTAPE 2 : Récupération de la configuration avec apiClient
  useEffect(() => {
    const fetchConfig = async () => {
      try {
        // apiClient injecte automatiquement l'access_token depuis le localStorage
        const res = await apiClient.get('/api/infos-pharmacie/');
        const data = res.data;
        
        setConfig({
          nom: data.nom || '',
          telephone: data.telephone || '',
          email_contact: data.email_contact || '',
          adresse: data.adresse || '',
          message_remerciement: data.message_remerciement || '',
          devise_preferee: data.devise_preferee || 'FCFA',
          langue_preferee: data.langue_preferee || 'fr',
          numero_orange_money: data.numero_orange_money || '',
          nom_titulaire_orange_money: data.nom_titulaire_orange_money || '',
          numero_mtn_momo: data.numero_mtn_momo || '',
          nom_titulaire_mtn_momo: data.nom_titulaire_mtn_momo || '',
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

  // 🌟 ÉTAPE 3 : Sauvegarde de la configuration (Multipart/FormData)
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    
    const formData = new FormData();
    formData.append('nom', config.nom);
    formData.append('telephone', config.telephone);
    formData.append('email_contact', config.email_contact);
    formData.append('adresse', config.adresse);
    formData.append('message_remerciement', config.message_remerciement);
    formData.append('langue_preferee', config.langue_preferee);
    formData.append('devise_preferee', config.devise_preferee);
    formData.append('numero_orange_money', config.numero_orange_money);
    formData.append('nom_titulaire_orange_money', config.nom_titulaire_orange_money);
    formData.append('numero_mtn_momo', config.numero_mtn_momo);
    formData.append('nom_titulaire_mtn_momo', config.nom_titulaire_mtn_momo);
    
    if (logoFile) {
      formData.append('logo', logoFile);
    }

    try {
      // apiClient s'occupe de l'URL absolue, du slash final et de l'en-tête Bearer
      const res = await apiClient.put('/api/update-config/', formData, {
        headers: { 
          'Content-Type': 'multipart/form-data' // Indispensable pour envoyer le fichier Logo
        }
      });
      
      alert("Configuration globale mise à jour avec succès ! ✅");
    } catch (err: any) {
      console.log("--- DEBUG ERREUR ---");
      console.dir(err);

      if (err.response) {
        console.error("Data:", err.response.data);
        alert(`Erreur Backend (${err.response.status}) : ${JSON.stringify(err.response.data)}`);
      } else if (err.request) {
        console.error("Pas de réponse reçue.");
        alert("Le serveur ne répond pas. Vérifiez votre connexion ou le tunnel.");
      } else {
        console.error("Erreur Locale:", err.message);
        alert(`Erreur : ${err.message}`);
      }
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

  if (loading) {
    return (
      <div className="h-96 flex flex-col items-center justify-center text-emerald-600">
        <Loader2 className="w-12 h-12 animate-spin mb-4" />
        <p className="font-bold animate-pulse">Chargement de la console système...</p>
      </div>
    );
  }

  return (
    <div className="max-w-275 mx-auto pb-20 p-4">
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
        <div className="lg:col-span-4 space-y-8">
          <motion.div whileHover={{ y: -5 }} className="bg-white dark:bg-slate-900 p-8 rounded-4xl shadow-sm border border-slate-100 dark:border-slate-800">
            <h5 className="font-bold text-slate-800 dark:text-white mb-6 flex items-center gap-2 text-sm uppercase tracking-widest">
              <ImageIcon size={18} className="text-emerald-500" /> Logo
            </h5>
            <div className="border-3 border-dashed border-slate-100 dark:border-slate-800 rounded-4xl p-6 text-center group hover:border-emerald-500/50 transition-colors">
              <div className="relative w-32 h-32 mx-auto mb-6">
                <img src={logoPreview || "/static/logo.png"} alt="Logo" className="w-full h-full rounded-3xl object-cover shadow-2xl bg-white" />
              </div>
              <input type="file" ref={fileInputRef}  onChange={handleImageChange} className="hidden" accept="image/*" aria-label="Sélectionner un logo" />
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
                  className="w-full p-4 rounded-2xl bg-slate-50 dark:bg-slate-800 border-none outline-none font-bold text-sm dark:text-white cursor-pointer"
                  aria-label="Langue préférée"
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
                  className="w-full p-4 rounded-2xl bg-slate-50 dark:bg-slate-800 border-none outline-none font-bold text-sm dark:text-white cursor-pointer"
                  aria-label="Devise préférée"
                >
                  <option value="FCFA">Franc CFA (XAF)</option>
                  <option value="EUR">Euro (€)</option>
                  <option value="USD">Dollar ($)</option>
                </select>
              </div>
            </div>
          </motion.div>

          {/* 🌗 APPARENCE : préférence de thème, stockée par next-themes (localStorage,
              indépendante de PharmacieConfig -- c'est une préférence de l'appareil/navigateur,
              pas une donnée de la pharmacie, donc pas de bouton "Sauvegarder" ici : le
              changement est appliqué immédiatement au clic. */}
          <motion.div whileHover={{ y: -5 }} className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] shadow-sm border border-slate-100 dark:border-slate-800">
            <h5 className="font-bold text-slate-800 dark:text-white mb-6 flex items-center gap-2 text-sm uppercase tracking-widest">
              <Sun size={18} className="text-amber-500" /> Apparence
            </h5>
            <div className="grid grid-cols-3 gap-3">
              {([
                { value: 'light', label: 'Clair', icon: Sun },
                { value: 'dark', label: 'Sombre', icon: Moon },
                { value: 'system', label: 'Système', icon: Monitor },
              ] as const).map(({ value, label, icon: Icon }) => {
                const isActive = mounted && theme === value;
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setTheme(value)}
                    aria-pressed={isActive}
                    className={`flex flex-col items-center gap-2 p-4 rounded-2xl border-none cursor-pointer transition-all font-bold text-[10px] uppercase tracking-wider ${
                      isActive
                        ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/30'
                        : 'bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'
                    }`}
                  >
                    <Icon size={20} />
                    {label}
                  </button>
                );
              })}
            </div>
          </motion.div>

          {/* 💰 PAIEMENT MANUEL : numéros mobile money propres à CETTE pharmacie */}
          <motion.div whileHover={{ y: -5 }} className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] shadow-sm border border-slate-100 dark:border-slate-800">
            <h5 className="font-bold text-slate-800 dark:text-white mb-2 flex items-center gap-2 text-sm uppercase tracking-widest">
              <Wallet size={18} className="text-orange-500" /> Paiement Mobile Money
            </h5>
            <p className="text-[10px] text-slate-400 font-medium mb-6 italic">
              Ces numéros seront affichés aux clients sur la page de paiement.
            </p>
            <div className="space-y-5">
              <div>
                <label className="text-[10px] font-black text-orange-500 uppercase tracking-widest mb-2 block">🟠 Numéro Orange Money</label>
                <input
                  type="text"
                  value={config.numero_orange_money}
                  onChange={(e) => setConfig({...config, numero_orange_money: e.target.value})}
                  placeholder="+237 6XX XXX XXX"
                  className="w-full p-4 rounded-2xl bg-slate-50 dark:bg-slate-800 border-none outline-none font-bold text-sm dark:text-white"
                  aria-label="Numéro Orange Money"
                />
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Nom du titulaire (Orange Money)</label>
                <input
                  type="text"
                  value={config.nom_titulaire_orange_money}
                  onChange={(e) => setConfig({...config, nom_titulaire_orange_money: e.target.value})}
                  placeholder="Nom affiché lors du transfert"
                  className="w-full p-4 rounded-2xl bg-slate-50 dark:bg-slate-800 border-none outline-none font-bold text-sm dark:text-white"
                  aria-label="Nom du titulaire Orange Money"
                />
              </div>
              <div className="pt-2 border-t border-slate-100 dark:border-slate-800" />
              <div>
                <label className="text-[10px] font-black text-yellow-500 uppercase tracking-widest mb-2 block">🟡 Numéro MTN MoMo</label>
                <input
                  type="text"
                  value={config.numero_mtn_momo}
                  onChange={(e) => setConfig({...config, numero_mtn_momo: e.target.value})}
                  placeholder="+237 6XX XXX XXX"
                  className="w-full p-4 rounded-2xl bg-slate-50 dark:bg-slate-800 border-none outline-none font-bold text-sm dark:text-white"
                  aria-label="Numéro MTN MoMo"
                />
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Nom du titulaire (MTN MoMo)</label>
                <input
                  type="text"
                  value={config.nom_titulaire_mtn_momo}
                  onChange={(e) => setConfig({...config, nom_titulaire_mtn_momo: e.target.value})}
                  placeholder="Nom affiché lors du transfert"
                  className="w-full p-4 rounded-2xl bg-slate-50 dark:bg-slate-800 border-none outline-none font-bold text-sm dark:text-white"
                  aria-label="Nom du titulaire MTN MoMo"
                />
              </div>
            </div>
          </motion.div>
        </div>

        <div className="lg:col-span-8">
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="bg-white dark:bg-slate-900 p-10 rounded-5xl shadow-sm border border-slate-100 dark:border-slate-800 h-full">
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
                  aria-label='Nom de la Pharmacie'
                />
              </div>

              <div className="md:col-span-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 block">Email de Contact</label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                  <input 
                    type="email" 
                    value={config.email_contact}
                    onChange={(e) => setConfig({...config, email_contact: e.target.value})}
                    placeholder="exemple@pharmacie.com"
                    className="w-full pl-12 pr-5 py-5 rounded-2xl bg-slate-50 dark:bg-slate-800 border-none font-bold dark:text-white outline-none focus:ring-2 focus:ring-emerald-500" 
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
                    className="w-full pl-12 pr-5 py-5 rounded-2xl bg-slate-50 dark:bg-slate-800 border-none font-bold dark:text-white outline-none focus:ring-2 focus:ring-emerald-500" 
                    aria-label='Téléphone Officiel'
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
                    className="w-full pl-12 pr-5 py-5 rounded-2xl bg-slate-50 dark:bg-slate-800 border-none font-bold dark:text-white outline-none focus:ring-2 focus:ring-emerald-500" 
                    aria-label='Adresse Physique'
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
                    className="w-full pl-12 pr-5 py-5 rounded-2xl bg-slate-50 dark:bg-slate-800 border-none font-bold dark:text-white outline-none focus:ring-2 focus:ring-emerald-500" 
                    aria-label='Message de courtoisie'
                  />
                </div>
              </div>
            </div>
            
            <div className="mt-12 pt-10 border-t border-slate-50 dark:border-slate-800">
              <button 
                type="submit" 
                disabled={saving}
                className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-black py-6 rounded-4xl shadow-2xl transition-all flex items-center justify-center gap-3 border-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
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