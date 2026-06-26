"use client";
import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ShieldCheck, Eye, CheckCircle2, XCircle, 
  Phone, Calendar, Hash, FileWarning, Search,
  MessageSquare, Loader2, Wifi, WifiOff
} from 'lucide-react';

// 🌟 CONFIGURATION : Importation de l'apiClient unifié (Gère le tunnel et le JWT pour la caisse)
import apiClient from '../../../lib/apiClient'; // Ajuste le chemin selon l'arborescence (app/caisse/ordonnances)
import { ReconnectingSocket } from '../../../lib/wsClient';

export default function OrdonnancesPage() {
  const [attentes, setAttentes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [rejetId, setRejetId] = useState<number | null>(null);
  const [motifRefus, setMotifRefus] = useState("");
  const [enLigne, setEnLigne] = useState(false);
  const [notification, setNotification] = useState<string | null>(null);
  const socketRef = useRef<ReconnectingSocket | null>(null);

  // 🌟 ÉTAPE 1 : Chargement des ordonnances en attente via apiClient
  const fetchAttentes = async () => {
    try {
      // apiClient ajoute l'URL de base et injecte l'access_token JWT de la caissière automatiquement
      const res = await apiClient.get('/api/ordonnances/');
      setAttentes(res.data);
    } catch (err) {
      console.error("Erreur API lors du chargement des ordonnances:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAttentes();

    // 🔴 TEMPS RÉEL : connexion WebSocket au canal "caisse" de la pharmacie courante.
    // Le backend route automatiquement vers le bon tenant via le domaine de la requête.
    const socket = new ReconnectingSocket('/ws/ordonnances/');
    socketRef.current = socket;

    socket.onOpen(() => setEnLigne(true));
    socket.onClose(() => setEnLigne(false));

    socket.onMessage((data) => {
      if (data.type === 'nouvelle_ordonnance') {
        // Une nouvelle ordonnance vient d'arriver -> on l'ajoute en tête de liste, sans recharger toute la page
        setAttentes((prev) => {
          // Évite les doublons si l'événement arrive alors qu'un fetch manuel vient juste de tourner
          if (prev.some((c) => c.id === data.commande.id)) return prev;
          return [data.commande, ...prev];
        });
        setNotification("📋 Nouvelle ordonnance reçue");
      }

      if (data.type === 'ordonnance_traitee') {
        // 🔴 Ta question initiale : une AUTRE caisse a traité cette ordonnance -> elle disparaît
        // immédiatement de cet écran, sans qu'on ait besoin de cliquer "rafraîchir".
        setAttentes((prev) => prev.filter((c) => c.id !== data.commande_id));
        setNotification(
          data.action === 'approuver'
            ? "✅ Ordonnance traitée par un autre agent"
            : "❌ Ordonnance refusée par un autre agent"
        );
      }
    });

    socket.connect();

    return () => socket.disconnect();
  }, []);

  // Notification discrète auto-masquée après 3 secondes
  useEffect(() => {
    if (!notification) return;
    const timer = setTimeout(() => setNotification(null), 3000);
    return () => clearTimeout(timer);
  }, [notification]);

  // 🌟 ÉTAPE 2 : Actions de Validation ou de Rejet sécurisées par JWT
  const handleDecision = async (commandeId: number, action: 'approuver' | 'rejeter') => {
    try {
      // Aligné sur core/urls.py et protégé par IsAuthenticated + is_staff côté Django
      await apiClient.post(`/api/ordonnances/${commandeId}/`, {
        action: action,
        raison: action === 'rejeter' ? motifRefus : ''
      });
      
      setRejetId(null);
      setMotifRefus("");
      // 🔴 Plus besoin de fetchAttentes() ici : le backend a déjà diffusé un événement
      // ordonnance_traitee qui retire cette carte de la liste localement (cf. socket.onMessage).
      // On retire quand même immédiatement côté local pour une réactivité parfaite, sans
      // attendre l'aller-retour réseau du WebSocket (qui arrivera dans la même fraction de seconde).
      setAttentes((prev) => prev.filter((c) => c.id !== commandeId));
    } catch (err: any) {
      if (err.response?.status === 409) {
        // 🔐 Conflit : un autre agent a traité cette ordonnance entre temps (verrou côté serveur).
        // On retire la carte localement plutôt que d'afficher une alerte bloquante.
        setAttentes((prev) => prev.filter((c) => c.id !== commandeId));
        setNotification("⚠️ Cette ordonnance vient d'être traitée par un collègue");
      } else {
        console.error("Erreur décision ordonnance:", err);
        alert(err.response?.data?.error || "Accès refusé. Vérifiez que vous êtes connecté avec un compte Caisse.");
      }
    }
  };

  if (loading) return (
    <div className="h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
      {/* 🌟 ACCESSIBILITÉ : Ajout de title et aria-label pour éviter l'erreur de build Next.js */}
      <Loader2 className="animate-spin text-blue-600" size={48}  aria-label="Chargement de la file d'attente médicale" />
    </div>
  );

    return (
    <div className="max-w-[1400px] mx-auto pb-20 p-6">

      {/* 🔴 NOTIFICATION TEMPS RÉEL DISCRÈTE */}
      <AnimatePresence>
        {notification && (
          <motion.div
            initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
            className="fixed top-6 right-6 z-50 bg-slate-900 text-white px-6 py-4 rounded-2xl shadow-2xl text-sm font-bold"
          >
            {notification}
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* 🔝 HEADER STRATÉGIQUE */}
      <div className="mb-12 flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
        <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
          <div className="inline-flex items-center gap-2 bg-green-50 dark:bg-green-500/10 text-green-600 dark:text-green-400 px-4 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] mb-3">
            <ShieldCheck size={14} /> Service de Vérification 🛡️
          </div>
          <h2 className="text-5xl font-black text-slate-800 dark:text-white tracking-tighter">
            Contrôle <span className="text-green-600">Médical</span>
          </h2>
          <p className="text-slate-500 dark:text-slate-400 font-medium mt-2 italic flex items-center gap-2">
            Validez les documents pour débloquer les ventes en attente.
            <span className={`inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-widest ${enLigne ? 'text-emerald-500' : 'text-red-400'}`}>
              {enLigne ? <Wifi size={12} /> : <WifiOff size={12} />} {enLigne ? 'Temps réel actif' : 'Reconnexion...'}
            </span>
          </p>
        </motion.div>
        
        <div className="bg-white dark:bg-slate-900 p-6 rounded-[2.5rem] shadow-sm border border-slate-100 dark:border-slate-800 text-right min-w-[200px]">
          <span className="text-slate-400 text-[10px] font-black uppercase tracking-widest block mb-1">Files d'attente</span>
          <h4 className="text-4xl font-black text-green-600">{attentes.length}</h4>
        </div>
      </div>

      {/* 📑 LISTE DES ATTENTES DYNAMIQUE */}
      <div className="space-y-12">
        <AnimatePresence>
          {attentes.map((c) => (
            <motion.div 
              key={c.id} layout initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }}
              className="bg-white dark:bg-slate-900/60 backdrop-blur-xl rounded-[3rem] shadow-2xl border border-slate-100 dark:border-slate-800 overflow-hidden flex flex-col lg:flex-row group transition-all hover:ring-4 hover:ring-green-500/10"
            >
              
              {/* 📸 IMAGE RÉELLE DEPUIS DJANGO MEDIA */}
              <div className="lg:w-1/2 bg-slate-50 dark:bg-slate-950 relative flex items-center justify-center p-10 border-r border-slate-100 dark:border-slate-800">
                <div className="relative overflow-hidden rounded-[2.5rem] shadow-2xl bg-white ring-8 ring-white dark:ring-slate-800 group/img">
                  {/* 🌟 STABLE : Utilisation de l'URL absolue fournie par le Serializer de Django */}
                  {c.ordonnance ? (
                    <img 
                      src={c.ordonnance} 
                      className="max-h-[550px] w-full object-contain transition-transform duration-1000 group-hover/img:scale-110" 
                      alt="Ordonnance du Client"
                    />
                  ) : (
                    <div className="text-7xl p-20">📋</div>
                  )}
                  
                  <div 
                    className="absolute inset-0 bg-slate-950/60 opacity-0 group-hover/img:opacity-100 flex flex-col items-center justify-center transition-all backdrop-blur-sm cursor-pointer" 
                    onClick={() => window.open(c.ordonnance, '_blank')}
                  >
                    <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center text-slate-900 shadow-2xl mb-4">
                      <Search size={28} strokeWidth={3} />
                    </div>
                    <span className="text-white font-black text-xs uppercase tracking-widest">Plein Écran 🔍</span>
                  </div>
                </div>
              </div>

              {/* 📄 CONSOLE DE DÉCISION */}
              <div className="p-12 lg:w-1/2 flex flex-col justify-between">
                <div>
                  <div className="flex justify-between items-start mb-10">
                    <div>
                      <span className="inline-flex items-center gap-2 text-[10px] font-black bg-slate-100 dark:bg-slate-800 text-slate-500 px-4 py-1.5 rounded-xl uppercase tracking-tighter mb-4">
                        <Hash size={12} /> Commande: #FAC-{c.id}
                      </span>
                      <h3 className="text-4xl font-black text-slate-800 dark:text-white tracking-tighter leading-none">
                        {c.client_nom}
                      </h3>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Reçu le</p>
                      {/* 🌟 STABLE : Alignement sur le champ 'date' du serializer Django */}
                      <p className="font-black text-slate-800 dark:text-white text-sm">
                        {c.date ? new Date(c.date).toLocaleDateString() : 'N/A'}
                      </p>
                    </div>
                  </div>

                  {/* RÉCAPITULATIF PANIER RÉEL */}
                  <div className="bg-slate-50 dark:bg-slate-800/50 rounded-[2rem] p-8 mb-10 border border-slate-100 dark:border-slate-700/50">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-6 flex items-center gap-2">
                      <FileWarning size={14} /> Articles dans le panier :
                    </p>
                    <div className="space-y-4">
                      {c.items && c.items.map((item: any, i: number) => (
                        <div key={i} className="flex justify-between items-center text-sm">
                          <span className="font-bold text-slate-700 dark:text-slate-200 uppercase tracking-tight">{item.produit_nom}</span>
                          <span className="bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-400 px-3 py-1 rounded-lg font-black text-[10px]">x{item.quantite}</span>
                        </div>
                      ))}
                    </div>
                    <div className="mt-8 pt-6 border-t border-slate-200 dark:border-slate-700 flex justify-between items-center">
                      <span className="text-[10px] font-black text-slate-400 uppercase">Total Net</span>
                      <span className="text-3xl font-black text-emerald-600">{c.total_general?.toLocaleString()} <small className="text-xs">FCFA</small></span>
                    </div>
                  </div>
                </div>

                {/* ⚡ ACTIONS RÉELLES */}
                <div className="space-y-4">
                  <button 
                    onClick={() => handleDecision(c.id, 'approuver')}
                    title="Valider définitivement l'ordonnance médicale"
                    aria-label="Valider définitivement l'ordonnance médicale"
                    className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-black py-6 rounded-[2rem] shadow-xl flex items-center justify-center gap-3 transition-all border-none cursor-pointer group"
                  >
                    <CheckCircle2 size={24} strokeWidth={3} /> VALIDER LE DOSSIER
                  </button>
                  
                  <button 
                    onClick={() => setRejetId(rejetId === c.id ? null : c.id)}
                    title="Ouvrir le formulaire de signalement d'erreur"
                    aria-label="Ouvrir le formulaire de signalement d'erreur"
                    className="w-full bg-red-50 dark:bg-red-500/10 text-red-500 font-black py-5 rounded-[2rem] border-none hover:bg-red-100 transition-all flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <XCircle size={20} /> SIGNALER UNE ERREUR
                  </button>

                  <AnimatePresence>
                    {rejetId === c.id && (
                      <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                        <div className="mt-4 p-6 bg-red-50 dark:bg-red-950/40 rounded-[2rem] border border-red-100">
                          <label className="text-[10px] font-black text-red-400 uppercase mb-3 block tracking-widest">
                             Motif du rejet (Sera envoyé au client) :
                          </label>
                          <textarea 
                            value={motifRefus}
                            onChange={(e) => setMotifRefus(e.target.value)}
                            rows={3} 
                            className="w-full bg-white dark:bg-slate-900 border-none rounded-2xl p-4 text-sm font-bold outline-none focus:ring-2 focus:ring-red-500 text-slate-800 dark:text-slate-100"
                            placeholder="Ex: Image floue, ordonnance périmée..."
                          />
                          <button 
                            type='button'
                            onClick={() => handleDecision(c.id, 'rejeter')}
                            disabled={!motifRefus.trim()}
                            title="Confirmer le rejet et notifier le client"
                            aria-label="Confirmer le rejet et notifier le client"
                            className="mt-4 w-full bg-red-600 hover:bg-red-500 disabled:bg-slate-200 dark:disabled:bg-slate-800 text-white font-black py-4 rounded-xl text-xs uppercase tracking-widest transition-all border-none cursor-pointer disabled:cursor-not-allowed"
                          >
                            Confirmer le rejet ❌
                          </button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {attentes.length === 0 && !loading && (
        <motion.div 
          initial={{ opacity: 0 }} 
          animate={{ opacity: 1 }} 
          className="text-center py-40 bg-white dark:bg-slate-900 rounded-[4rem] border-4 border-dashed border-slate-100 dark:border-slate-800"
        >
          <div className="bg-white dark:bg-slate-900 rounded-[5rem] py-32 text-center border-4 border-dashed border-slate-100 dark:border-slate-800">
            <div className="text-8xl mb-8  animate-pulse">🎉</div>
            <h4 className="text-3xl font-black text-slate-800 dark:text-white tracking-tighter uppercase mb-2 italic">File d'attente vide</h4>
            <p className="text-slate-400 font-bold uppercase tracking-widest text-xs italic">Toutes les ordonnances de la pharmacie ont été traitées.</p>
          </div>      
        </motion.div>
      )}
    </div>
  );
}
