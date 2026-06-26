"use client";
import React, { useState, useRef, Suspense } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ShieldCheck, Send, ImageIcon, FileText, 
  X, ArrowLeft, Loader2 
} from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';

// 🌟 CONFIGURATION : Remplacement de l'axios brut par l'instance apiClient sécurisée
import apiClient from '../../../lib/apiClient'; // Ajustez le chemin selon votre dossier app/ordonnance/upload

function UploadContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const commandeId = searchParams.get('id'); 

  // 🔐 Doit rester identique à TAILLE_MAX_ORDONNANCE_OCTETS dans core/validators.py (backend)
  const TAILLE_MAX_OCTETS = 8 * 1024 * 1024; // 8 Mo
  const TAILLE_MAX_MO = 8;

  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setError('');

    // 🔐 Vérification de taille AVANT tout traitement, alignée sur la limite réelle du backend.
    // On évite ainsi de faire patienter l'utilisateur pour un upload qui sera rejeté de toute
    // façon -- important sur une connexion lente où chaque Mo compte.
    if (selectedFile.size > TAILLE_MAX_OCTETS) {
      const tailleRecueMo = (selectedFile.size / (1024 * 1024)).toFixed(1);
      setError(`Fichier trop volumineux (${tailleRecueMo} Mo). Taille maximale acceptée : ${TAILLE_MAX_MO} Mo.`);
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    // Vérification basique du type côté client (le backend refait une vraie vérification
    // par contenu binaire — ceci n'est qu'un confort UX pour éviter un aller-retour réseau inutile)
    const typesAcceptes = ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf'];
    if (!typesAcceptes.includes(selectedFile.type)) {
      setError("Format non reconnu. Merci d'envoyer une image (JPG/PNG) ou un PDF.");
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    setFile(selectedFile);
    if (selectedFile.type.includes('image')) {
      const reader = new FileReader();
      reader.onloadend = () => setPreview(reader.result as string);
      reader.readAsDataURL(selectedFile);
    } else {
      setPreview(null);
    }
  };

  // 🔐 Annulation explicite et complète : remet le formulaire dans son état initial,
  // y compris l'input file natif (sinon le navigateur garde le fichier sélectionné en mémoire
  // même après avoir vidé le state React, et un re-sélectionnement du même fichier ne
  // redéclencherait pas onChange).
  const handleAnnulerSelection = () => {
    setFile(null);
    setPreview(null);
    setError('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || !commandeId) return;

    setLoading(true);
    setError('');

    const formData = new FormData();
    formData.append('fichier_ordonnance', file);

    try {
      // 🌟 STABLE : Appel sur le bon endpoint Django (path avec commande_id et slash final)
      // apiClient injecte de lui-même le token JWT requis par le décorateur IsAuthenticated
      await apiClient.post(`/api/ordonnances/${commandeId}/`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      
      router.push('/panier');
    } catch (err: any) {
      setError(err.response?.data?.error || "Erreur lors de l'envoi du document.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-[600px] mx-auto px-6 py-12">
      
      {/* 🔝 HEADER */}
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-10">
        <div className="inline-flex items-center gap-2 bg-blue-50 dark:bg-blue-500/10 text-blue-600 px-4 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] mb-4 shadow-sm">
          <ShieldCheck size={14} /> Sécurité Sanitaire 🛡️
        </div>
        <h2 className="text-4xl font-black text-slate-800 dark:text-white tracking-tighter italic">Dépôt d'Ordonnance</h2>
        <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest mt-2">
          {commandeId ? `Commande #${commandeId}` : "Aucune commande sélectionnée"} • Analyse humaine requise
        </p>
      </motion.div>

      {/* 📦 CARD UPLOAD */}
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-white dark:bg-slate-900 rounded-[3rem] p-8 md:p-12 shadow-2xl border border-slate-100 dark:border-slate-800">
        
        {error && <div className="mb-6 p-4 bg-red-500/10 text-red-500 rounded-2xl text-[10px] font-black uppercase text-center border border-red-500/20">{error}</div>}

        <form className="space-y-8" onSubmit={handleSubmit}>
          <div 
            onClick={() => fileInputRef.current?.click()}
            className={`relative border-4 border-dashed rounded-[2.5rem] p-10 text-center transition-all cursor-pointer group ${file ? 'border-emerald-500 bg-emerald-50/10' : 'border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50 hover:border-emerald-500'}`}
          >
            <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept="image/*,.pdf" aria-label='Sélectionner un fichier' />

            <AnimatePresence mode="wait">
              {!file ? (
                <motion.div key="prompt" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4 text-center">
                  <div className="text-6xl group-hover:scale-110 transition-transform">📸</div>
                  <h4 className="text-xl font-black text-slate-800 dark:text-white uppercase tracking-tighter">Prendre en photo</h4>
                  <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">JPG, PNG, PDF (Max {TAILLE_MAX_MO} Mo)</p>
                </motion.div>
              ) : (
                <motion.div key="preview" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="relative">
                  {preview ? (
                    <div className="rounded-2xl overflow-hidden border-4 border-white shadow-2xl">
                      <img src={preview} alt="Aperçu de l'ordonnance sélectionnée" className="max-h-[300px] w-full object-cover" />
                    </div>
                  ) : (
                    <div className="bg-white dark:bg-slate-800 p-10 rounded-2xl flex flex-col items-center gap-4 text-emerald-500">
                      <FileText size={64} />
                      <span className="font-bold text-xs text-slate-500">{file.name}</span>
                    </div>
                  )}
                  
                  {/* 🌟 ACCESSIBILITÉ : Ajout de title et aria-label pour éliminer définitivement l'erreur Element has no title attribute */}
                  <button 
                    onClick={(e) => { e.stopPropagation(); handleAnnulerSelection(); }} 
                    title="Annuler et retirer ce document"
                    aria-label="Annuler et retirer ce document"
                    className="absolute -top-4 -right-4 bg-red-500 text-white p-2 rounded-full shadow-lg border-none cursor-pointer flex items-center justify-center hover:scale-110 transition-transform"
                  >
                    <X size={20} />
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="pt-4">
            <button 
              type="submit"
              disabled={!file || loading}
              title="Soumettre le document de santé pour contrôle"
              aria-label="Soumettre le document de santé pour contrôle"
              className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-200 text-white font-black py-6 rounded-[2rem] shadow-2xl transition-all flex items-center justify-center gap-4 border-none cursor-pointer group"
            >
              <span className="text-sm uppercase tracking-[0.2em]">
                {loading ? "Transmission en cours..." : "Transmettre à la caisse"}
              </span>
              {loading ? <Loader2 className="animate-spin" size={20} /> : <Send size={20} />}
            </button>
          </div>
        </form>

        <div className="mt-8 text-center">
          <Link href="/panier" className="text-slate-400 hover:text-emerald-500 text-[10px] font-black uppercase tracking-widest no-underline transition-colors flex items-center justify-center gap-2">
            <ArrowLeft size={14} /> Annuler et revenir au panier
          </Link>
        </div>
      </motion.div>

      <div className="mt-10 bg-blue-50/50 dark:bg-blue-500/5 p-8 rounded-[2.5rem] border border-blue-100 flex gap-5 items-start">
        <div className="text-3xl animate-bounce">💡</div>
        <div>
          <p className="text-[10px] font-black text-blue-800 uppercase tracking-widest mb-2">Processus 2026</p>
          <p className="text-xs text-blue-700 leading-relaxed italic">
            Votre document apparaîtra instantanément sur la console de la caissière.
          </p>
        </div>
      </div>
    </div>
  );
}

export default function UploadOrdonnance() {
  return (
    <Suspense fallback={<div className="h-screen flex items-center justify-center"><Loader2 className="animate-spin text-emerald-500"  aria-label="Chargement du module d'envoi" /></div>}>
      <UploadContent />
    </Suspense>
  );
}
