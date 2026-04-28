"use client";
import React, { useEffect, useState, useMemo } from 'react'; // Ajout de useMemo
import { motion, AnimatePresence  } from 'framer-motion';
import { 
  TrendingUp, Loader2, Package, AlertTriangle, Users, 
  CheckCircle2, Clock, Menu, X, LogOut, ShoppingBag, Store, 
  Home, LayoutDashboard, Database, History, Truck, BarChart3, Settings
} from 'lucide-react';
import { 
  XAxis, YAxis, CartesianGrid, 
  Tooltip, ResponsiveContainer, Area, AreaChart 
} from 'recharts';
import { useRouter } from 'next/navigation';

// --- INTERFACES ---
interface DashboardData {
  nb_produits: number;
  ca_total: number;
  nb_produits_critiques: number;
  nb_fournisseurs: number;
  graphique_ventes: { name: string; ventes: number }[];
  produits_expirant_bientot: { id: number; nom: string; date_expiration: string; jours_restants: number }[];
  ventes_recentes: { id: number; client_nom: string; date: string; total_general: number; statut: string }[];
}

export default function DashboardBoss() {
   const [data, setData] = useState<any>(null);
  const [isMounted, setIsMounted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const router = useRouter();

  useEffect(() => {
  const timer = setInterval(() => setCurrentTime(new Date()), 1000);
  return () => clearInterval(timer);
}, []);

  useEffect(() => {
    setIsMounted(true); // Indique que le composant est chargé côté client
    const controller = new AbortController(); // Pour annuler la requête si on quitte la page

    const fetchData = async () => {
      try {
        // CORRECTION URL : /api/boss/dashboard/ (selon ton core/urls.py)
        const response = await fetch('https://mw69zhwz-8000.uks1.devtunnels.ms/api/boss-dashboard/', {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
          },
          signal: controller.signal,
          // Pas de credentials ici si on utilise AllowAny + authentication_classes([]) côté Django
        });

        if (response.ok) {
          const json = await response.json();
          setData(json);
        } else {
          // On capture l'erreur discrètement sans faire saigner la console
          const err = await response.text();
          console.warn("API Dashboard Stats :", response.status);
        }
      } catch (error: any) {
        if (error.name !== 'AbortError') {
          console.error("Erreur réseau Dashboard:", error);
        }
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    return () => controller.abort(); // Nettoyage
  }, []);

  // On mémoïse les données du graph pour éviter les recalculs inutiles
  const graphData = useMemo(() => data?.graphique_ventes || [], [data]);

  const handleNavigation = (path: string) => {
    router.push(path);
  };

  if (loading) {
    return (
      <div className="h-96 flex flex-col items-center justify-center text-emerald-600">
        <Loader2 className="w-12 h-12 animate-spin mb-4" />
        <p className="font-bold animate-pulse">Synchronisation des données...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-10">
      
      {/* 🚀 BANDEAU PRINCIPAL UNIQUE */}
      <div className="flex justify-between items-center bg-white dark:bg-slate-800 p-6 rounded-[2rem] shadow-sm border border-gray-100 dark:border-slate-700">
        <div className="flex items-center gap-4">
          <button onClick={() => setSidebarOpen(true)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition">
            <Menu size={28} className="text-emerald-600" />
          </button>
          <h1 className="font-black text-xl tracking-tighter text-slate-800 dark:text-white uppercase">
            MODE <span className="text-emerald-600">ADMIN</span>
          </h1>
        </div>

        {/* Heure centrée (fixe) */}
        <div className="hidden md:block absolute left-1/2 -translate-x-1/2 text-center">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{currentTime.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
            <p className="text-lg font-black text-emerald-600">{currentTime.toLocaleTimeString('fr-FR')}</p>
        </div>
      </div>

      {/* 🚀 STATS CARDS (Tes stats d'origine) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { title: "Total Produits", val: data?.nb_produits || 0, icon: <Package />, color: "blue", tag: "Inventaire", path: "/admin/stocks" },
          { title: "Revenu Global", val: data?.ca_total?.toLocaleString() || 0, unit: "FCFA", icon: <TrendingUp />, color: "green", tag: "Finance", border: "border-l-4 border-green-500", path: "/admin/historique" },
          { title: "Stock Faible", val: data?.nb_produits_critiques || 0, icon: <AlertTriangle />, color: "orange", tag: "Risques", path: "/admin/stocks" },
          { title: "Fournisseurs", val: data?.nb_fournisseurs || 0, icon: <Users />, color: "purple", tag: "Réseau", path: "/admin/fournisseurs" },
        ].map((item, i) => (
          <div key={i} onClick={() => router.push(item.path)} className={`bg-white dark:bg-slate-800 p-6 rounded-[2rem] shadow-sm border border-gray-100 dark:border-slate-700 cursor-pointer ${item.border || ''}`}>
            <div className="flex justify-between items-start mb-4">
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-xl bg-${item.color}-50 dark:bg-${item.color}-900/30 text-${item.color}-600`}>{item.icon}</div>
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{item.tag}</span>
            </div>
            <h6 className="text-gray-400 dark:text-slate-400 text-sm font-semibold">{item.title}</h6>
            <h3 className={`text-3xl font-bold mt-1 ${item.color === 'green' ? 'text-green-600' : 'text-slate-800 dark:text-white'}`}>
              {item.val} <span className="text-xs font-medium">{item.unit || ''}</span>
            </h3>
          </div>
        ))}
      </div>

      {/* 📊 GRAPHIQUE & ALERTES (Ton design d'origine) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 bg-white dark:bg-slate-800 p-8 rounded-[2rem] shadow-sm border border-gray-100 dark:border-slate-700">
          <h5 className="font-bold text-slate-800 dark:text-white mb-8 flex items-center gap-2"><TrendingUp className="text-emerald-500" /> Performance Hebdomadaire</h5>
          <div className="h-[300px] w-full">
            {isMounted && (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={graphData}>
                  <defs><linearGradient id="colorV" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/><stop offset="95%" stopColor="#10b981" stopOpacity={0}/></linearGradient></defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" opacity={0.1} />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 10}} />
                  <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 10}} />
                  <Tooltip contentStyle={{ borderRadius: '15px', border: 'none', backgroundColor: '#1e293b', color: '#fff' }} />
                  <Area type="monotone" dataKey="ventes" stroke="#10b981" strokeWidth={4} fill="url(#colorV)" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* ⚠️ ALERTES EXPIRATION */}
        <div className="bg-white dark:bg-slate-800 p-8 rounded-[2rem] shadow-sm border-t-8 border-red-500">
          <h5 className="font-bold text-red-600 dark:text-red-400 mb-6 flex items-center gap-2">
            <AlertTriangle size={20} /> Alertes Expiration
          </h5>
          <div className="space-y-4 max-h-[350px] overflow-y-auto pr-2 custom-scrollbar">
            {data?.produits_expirant_bientot?.length ? data.produits_expirant_bientot.map((prod, i) => (
              <div key={i} onClick={() => handleNavigation(`/admin/stock?id=${prod.id}`)} className="flex justify-between items-center p-4 bg-red-50 dark:bg-red-900/10 rounded-2xl border border-red-100 dark:border-red-900/20 cursor-pointer hover:scale-[1.02] transition-transform group">
                <div>
                  <div className="font-bold text-sm text-slate-800 dark:text-slate-200 group-hover:text-red-600 transition-colors">{prod.nom}</div>
                  <div className="text-[10px] text-red-500 font-bold uppercase flex items-center gap-1">
                    <Clock size={10} /> {prod.date_expiration}
                  </div>
                </div>
                <span className="bg-red-500 text-white text-xs font-black px-3 py-1 rounded-full shadow-lg shadow-red-500/30">
                  {prod.jours_restants}j
                </span>
              </div>
            )) : <p className="text-gray-400 text-sm text-center py-4 italic">Le stock est parfaitement sain ! ✅</p>}
          </div>
        </div>
      </div>

       {/* 🧾 TABLEAU DES VENTES RÉCENTES */}
      <div className="bg-white dark:bg-slate-800 p-8 rounded-[2rem] shadow-sm border border-gray-100 dark:border-slate-700">
        <div className="flex justify-between items-center mb-6">
          <h5 className="font-bold text-slate-800 dark:text-white">Ventes Récents</h5>
          <button onClick={() => handleNavigation('/admin/historique')} className="text-[10px] font-bold text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 px-4 py-2 rounded-xl transition uppercase tracking-widest">Voir tout</button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left min-w-[500px]">
            <thead>
              <tr className="text-[10px] uppercase text-gray-400 font-bold tracking-widest border-b border-gray-50 dark:border-slate-700">
                <th className="pb-4">Source</th>
                <th className="pb-4">Client</th>
                <th className="pb-4">Date</th>
                <th className="pb-4">Montant</th>
                <th className="pb-4 text-right">Statut</th>
              </tr>
            </thead>
            <tbody className="text-sm">
              {data?.ventes_recentes?.map((v:any) => (
                <tr key={v.id} className="group border-b border-gray-50 dark:border-slate-800 hover:bg-slate-50/50 dark:hover:bg-slate-700/30 transition cursor-pointer">
                  <td className="py-4">
                    {v.type_vente === 'en_ligne' ? <ShoppingBag size={16} className="text-blue-500" /> : <Store size={16} className="text-purple-500" />}
                  </td>
                  <td className="py-4 font-bold">{v.client_nom || "Client Passage"}</td>
                  <td className="py-4 text-gray-400 font-mono text-xs">{new Date(v.date).toLocaleDateString()}</td>
                  <td className="py-4 font-bold text-emerald-600">{v.total_general.toLocaleString()} <span className="text-[10px]">XAF</span></td>
                  <td className="py-4 text-right">
                    <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-[10px] font-black uppercase bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 tracking-tighter">
                      <CheckCircle2 size={10} /> Confirmé
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      
      {/* 📱 MENU SUPERVISION (Copie exacte de ta liste) */}
      <AnimatePresence>
        {sidebarOpen && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setSidebarOpen(false)} className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50" />
            <motion.div initial={{ x: '-100%' }} animate={{ x: 0 }} exit={{ x: '-100%' }} className="fixed left-0 top-0 h-full w-[300px] bg-white dark:bg-slate-900 z-50 p-8 shadow-2xl">
              <div className="flex justify-between items-center mb-10 pb-4 border-b dark:border-slate-800">
                <span className="font-black text-emerald-600 uppercase tracking-tighter">Supervision</span>
                <button onClick={() => setSidebarOpen(false)}><X size={24} /></button>
              </div>
              <nav className="space-y-1">
                {[
                  { n: 'Accueil Site', p: '/', i: <Home size={18}/> },
                  { n: 'Dashboard', p: '/admin/dashboard', i: <LayoutDashboard size={18}/> },
                  { n: 'Catalogue Global', p: '/catalogue', i: <ShoppingBag size={18}/> },
                  { n: 'Stocks & Alertes', p: '/admin/stocks', i: <Database size={18}/> },
                  { n: 'Historique Ventes', p: '/admin/historique', i: <History size={18}/> },
                  { n: 'Fournisseurs', p: '/admin/fournisseurs', i: <Truck size={18}/> },
                  { n: 'Rapports & Stats', p: '/admin/rapports', i: <BarChart3 size={18}/> },
                  { n: 'Paramètres', p: '/admin/settings', i: <Settings size={18}/> },
                ].map((l, idx) => (
                  <button key={idx} onClick={() => {router.push(l.p); setSidebarOpen(false);}} className="w-full flex items-center gap-4 p-4 rounded-2xl hover:bg-emerald-50 dark:hover:bg-emerald-900/20 text-slate-600 dark:text-slate-300 font-bold transition-all">
                    {l.i} {l.n}
                  </button>
                ))}
                <button onClick={() => setShowLogoutConfirm(true)} className="w-full flex items-center gap-4 p-4 rounded-2xl bg-red-50 text-red-600 font-bold mt-4">
                  <LogOut size={18}/> QUITTER
                </button>
              </nav>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* 🛑 BOITE DE DIALOGUE QUITTER */}
      {showLogoutConfirm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 p-8 rounded-[2rem] max-w-sm w-full text-center shadow-2xl">
            <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4"><LogOut size={32}/></div>
            <h3 className="text-xl font-black mb-2">Quitter la session ?</h3>
            <p className="text-gray-500 text-sm mb-6">Êtes-vous sûr de vouloir fermer le portail administratif ?</p>
            <div className="flex gap-4">
              <button onClick={() => setShowLogoutConfirm(false)} className="flex-1 p-4 bg-slate-100 dark:bg-slate-700 font-bold rounded-2xl">Annuler</button>
              <button onClick={() => router.push('/login')} className="flex-1 p-4 bg-red-500 text-white font-bold rounded-2xl">Oui, Quitter</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
