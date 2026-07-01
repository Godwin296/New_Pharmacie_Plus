"use client";
import React, { useEffect, useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  TrendingUp, Loader2, Package, AlertTriangle, Users, 
  CheckCircle2, Clock, Menu, X, LogOut, ShoppingBag, Store, 
  Home, LayoutDashboard, Database, History, Truck, BarChart3, Settings, Wallet
} from 'lucide-react';
import { 
  XAxis, YAxis, CartesianGrid, 
  Tooltip, ResponsiveContainer, Area, AreaChart 
} from 'recharts';
import { useRouter } from 'next/navigation';

// 🌟 CONFIGURATION : Importation de l'apiClient unifié (qui gère l'URL et le Token à votre place !)
import apiClient from '../../../lib/apiClient';
import Prix from '../../../lib/components/Prix';

// --- INTERFACES ---
interface DashboardData {
  nb_produits: number;
  ca_total: number;
  // 💵 Ventilation cash (guichet) vs en ligne -- voir core/api.py:api_boss_dashboard
  ca_ventilation?: { guichet_cash: number; en_ligne: number };
  nb_produits_critiques: number;
  nb_fournisseurs: number;
  graphique_ventes: { name: string; ventes: number }[];
  produits_expirant_bientot: { id: number; nom: string; date_expiration: string; jours_restants: number }[];
  ventes_recentes: { id: number; client_nom: string; date: string; total_general: number; statut: string; type_vente: string }[];
}

export default function DashboardBoss() {
  const [data, setData] = useState<DashboardData | null>(null);
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
    setIsMounted(true); 

    const fetchData = async () => {
      try {
        // 🌟 STABLE : apiClient interroge le bon chemin d'URL et transmet l'access_token en arrière-plan
        const response = await apiClient.get('/api/boss-dashboard/');
        setData(response.data);
      } catch (error: any) {
        // Si Django répond 401 ou 403 et que le refresh token a expiré, l'intercepteur apiClient redirige déjà vers /login
        console.error("Erreur réseau Dashboard:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // Évite les recalculs inutiles pour le composant Recharts
  const graphData = useMemo(() => data?.graphique_ventes || [], [data]);

  const handleNavigation = (path: string) => {
    router.push(path);
  };

  // Classes Tailwind configurées en dur pour contourner les limitations de la compilation statique
  const statsConfig = [
    { title: "Total Produits", val: data?.nb_produits || 0, unit: "", icon: <Package />, iconStyle: "bg-blue-50 text-blue-600 dark:bg-blue-900/30", tag: "Inventaire", path: "/admin/stocks" },
    { title: "Stock Faible", val: data?.nb_produits_critiques || 0, unit: "", icon: <AlertTriangle />, iconStyle: "bg-orange-50 text-orange-600 dark:bg-orange-900/30", tag: "Risques", path: "/admin/stocks" },
    { title: "Fournisseurs", val: data?.nb_fournisseurs || 0, unit: "", icon: <Users />, iconStyle: "bg-purple-50 text-purple-600 dark:bg-purple-900/30", tag: "Réseau", path: "/admin/fournisseurs" },
  ];

  const caGuichet = data?.ca_ventilation?.guichet_cash || 0;
  const caEnLigne = data?.ca_ventilation?.en_ligne || 0;
  const caTotalVentilation = caGuichet + caEnLigne;
  const pourcentGuichet = caTotalVentilation > 0 ? Math.round((caGuichet / caTotalVentilation) * 100) : 0;
  const pourcentEnLigne = 100 - pourcentGuichet;

  if (loading) {
    return (
      <div className="h-96 flex flex-col items-center justify-center text-emerald-600">
        {/* 🌟 ACCESSIBILITÉ : Intégration préventive des attributs d'accessibilité exigés par Next.js */}
        <Loader2 className="w-12 h-12 animate-spin mb-4"  aria-label="Synchronisation des KPI système" />
        <p className="font-bold animate-pulse">Synchronisation des données...</p>
      </div>
    );
  }


  return (
    <div className="space-y-8 pb-10">
      
      {/* 🚀 BANDEAU PRINCIPAL UNIQUE */}
      <div className="flex justify-between items-center bg-white dark:bg-slate-800 p-6 rounded-4xl shadow-sm border border-gray-100 dark:border-slate-700">
        <div className="flex items-center gap-4">
          <button onClick={() => setSidebarOpen(true)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition" aria-label="Ouvrir le menu">
            <Menu size={28} className="text-emerald-600" />
          </button>
          <h1 className="font-black text-xl tracking-tighter text-slate-800 dark:text-white uppercase">
            MODE <span className="text-emerald-600">ADMIN</span>
          </h1>
        </div>

        {/* Heure centrale synchronisée */}
        <div className="hidden md:block absolute left-1/2 -translate-x-1/2 text-center">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
            {currentTime.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
          <p className="text-lg font-black text-emerald-600">{currentTime.toLocaleTimeString('fr-FR')}</p>
        </div>
      </div>

      {/* 💰 REVENU GLOBAL AVEC VENTILATION CASH (GUICHET) vs EN LIGNE */}
      <motion.div
        onClick={() => router.push('/admin/historique')}
        className="bg-white dark:bg-slate-800 p-6 rounded-4xl shadow-sm border border-gray-100 dark:border-slate-700 border-l-4 border-l-green-500 cursor-pointer transition-transform hover:scale-[1.005]"
      >
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-xl bg-green-50 text-green-600 dark:bg-green-900/30 shrink-0">
              <TrendingUp />
            </div>
            <div>
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Finance</span>
              <h6 className="text-gray-400 dark:text-slate-400 text-sm font-semibold">Revenu Global</h6>
              <h3 className="text-3xl font-bold mt-1 text-green-600">
                <Prix montant={data?.ca_total ?? 0} />
              </h3>
            </div>
          </div>

          {/* 💵 Ventilation : ce total mélange du cash physique (en main des caissières) et de
              l'argent déjà transféré électroniquement -- les deux comptent pour l'activité
              réelle, mais ils ne sont PAS disponibles de la même façon pour l'admin. */}
          <div className="flex gap-4 md:gap-6 md:border-l md:border-slate-100 dark:md:border-slate-700 md:pl-6">
            <div className="flex-1 md:flex-none">
              <div className="flex items-center gap-1.5 text-purple-500 mb-1">
                <Store size={14} /> <span className="text-[10px] font-black uppercase tracking-widest">Cash Guichet</span>
              </div>
              <p className="font-bold text-slate-800 dark:text-white">
                <Prix montant={caGuichet} />
              </p>
              <p className="text-[10px] text-slate-400 font-medium">{pourcentGuichet}% du total</p>
            </div>
            <div className="flex-1 md:flex-none">
              <div className="flex items-center gap-1.5 text-blue-500 mb-1">
                <ShoppingBag size={14} /> <span className="text-[10px] font-black uppercase tracking-widest">En ligne</span>
              </div>
              <p className="font-bold text-slate-800 dark:text-white">
                <Prix montant={caEnLigne} />
              </p>
              <p className="text-[10px] text-slate-400 font-medium">{pourcentEnLigne}% du total</p>
            </div>
          </div>
        </div>

        {/* Barre de répartition visuelle */}
        {caTotalVentilation > 0 && (
          <div className="mt-5 h-2 w-full rounded-full overflow-hidden flex bg-slate-100 dark:bg-slate-700">
            <div className="bg-purple-500 h-full" style={{ width: `${pourcentGuichet}%` }} />
            <div className="bg-blue-500 h-full" style={{ width: `${pourcentEnLigne}%` }} />
          </div>
        )}
        <p className="text-[10px] text-slate-400 italic mt-3 flex items-center gap-1.5">
          <Wallet size={12} /> Le cash guichet représente l'argent physique actuellement entre les mains de vos caissières, pas encore déposé.
        </p>
      </motion.div>

      {/* 🚀 STATS CARDS SÉCURISÉES */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {statsConfig.map((item, i) => (
          <div key={i} onClick={() => router.push(item.path)} className="bg-white dark:bg-slate-800 p-6 rounded-4xl shadow-sm border border-gray-100 dark:border-slate-700 cursor-pointer transition-transform hover:scale-[1.01]">
            <div className="flex justify-between items-start mb-4">
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-xl ${item.iconStyle}`}>{item.icon}</div>
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{item.tag}</span>
            </div>
            <h6 className="text-gray-400 dark:text-slate-400 text-sm font-semibold">{item.title}</h6>
            <h3 className="text-3xl font-bold mt-1 text-slate-800 dark:text-white">
              {item.val} <span className="text-xs font-medium">{item.unit}</span>
            </h3>
          </div>
        ))}
      </div>

      {/* 📊 GRAPHIQUE & ALERTES */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 bg-white dark:bg-slate-800 p-8 rounded-4xl shadow-sm border border-gray-100 dark:border-slate-700">
          <h5 className="font-bold text-slate-800 dark:text-white mb-8 flex items-center gap-2"><TrendingUp className="text-emerald-500" /> Performance Hebdomadaire</h5>
          <div className="h-75 w-full">
            {isMounted && (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={graphData}>
                  <defs>
                    <linearGradient id="colorV" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
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
        <div className="bg-white dark:bg-slate-800 p-8 rounded-4xl shadow-sm border-t-8 border-red-500">
          <h5 className="font-bold text-red-600 dark:text-red-400 mb-6 flex items-center gap-2">
            <AlertTriangle size={20} /> Alertes Expiration
          </h5>
          <div className="space-y-4 max-h-87.5 overflow-y-auto pr-2 custom-scrollbar">
            {data?.produits_expirant_bientot?.length ? data.produits_expirant_bientot.map((prod, i) => (
              <div key={i} onClick={() => handleNavigation(`/admin/stocks?id=${prod.id}`)} className="flex justify-between items-center p-4 bg-red-50 dark:bg-red-900/10 rounded-2xl border border-red-100 dark:border-red-900/20 cursor-pointer hover:scale-[1.02] transition-transform group">
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
      <div className="bg-white dark:bg-slate-800 p-8 rounded-4xl shadow-sm border border-gray-100 dark:border-slate-700">
        <div className="flex justify-between items-center mb-6">
          <h5 className="font-bold text-slate-800 dark:text-white">Ventes Récentes</h5>
          <button onClick={() => handleNavigation('/admin/historique')} className="text-[10px] font-bold text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 px-4 py-2 rounded-xl transition uppercase tracking-widest">Voir tout</button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left min-w-125">
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
              {data?.ventes_recentes?.map((v: any) => (
                <tr key={v.id} className="group border-b border-gray-50 dark:border-slate-800 hover:bg-slate-50/50 dark:hover:bg-slate-700/30 transition cursor-pointer">
                  <td className="py-4">
                    {v.type_vente === 'en_ligne' ? <ShoppingBag size={16} className="text-blue-500" /> : <Store size={16} className="text-purple-500" />}
                  </td>
                  <td className="py-4 font-bold">{v.client_nom || "Client Passage"}</td>
                  <td className="py-4 text-gray-400 font-mono text-xs">{new Date(v.date).toLocaleDateString('fr-FR')}</td>
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
      
      {/* 📱 MENU SUPERVISION SIDEBAR */}
      <AnimatePresence>
        {sidebarOpen && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setSidebarOpen(false)} className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50" />
            <motion.div initial={{ x: '-100%' }} animate={{ x: 0 }} exit={{ x: '-100%' }} className="fixed left-0 top-0 h-full w-75 bg-white dark:bg-slate-900 z-50 p-8 shadow-2xl">
              <div className="flex justify-between items-center mb-10 pb-4 border-b dark:border-slate-800">
                <span className="font-black text-emerald-600 uppercase tracking-tighter">Supervision</span>
                <button aria-label="Fermer le menu" onClick={() => setSidebarOpen(false)}><X size={24} /></button>
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
                  <button key={idx} onClick={() => { router.push(l.p); setSidebarOpen(false); }} className="w-full flex items-center gap-4 p-4 rounded-2xl hover:bg-emerald-50 dark:hover:bg-emerald-900/20 text-slate-600 dark:text-slate-300 font-bold transition-all border-none bg-transparent cursor-pointer text-left">
                    {l.i} {l.n}
                  </button>
                ))}
                <button onClick={() => setShowLogoutConfirm(true)} className="w-full flex items-center gap-4 p-4 rounded-2xl bg-red-50 text-red-600 font-bold mt-4 border-none cursor-pointer text-left">
                  <LogOut size={18}/> QUITTER
                </button>
              </nav>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* 🛑 BOITE DE DIALOGUE QUITTER */}
      {showLogoutConfirm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-100 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 p-8 rounded-4xl max-w-sm w-full text-center shadow-2xl">
            <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4"><LogOut size={32}/></div>
            <h3 className="text-xl font-black mb-2">Quitter la session ?</h3>
            <p className="text-gray-500 text-sm mb-6">Êtes-vous sûr de vouloir fermer le portail administratif ?</p>
            <div className="flex gap-4">
              <button onClick={() => setShowLogoutConfirm(false)} className="flex-1 p-4 bg-slate-100 dark:bg-slate-700 font-bold rounded-2xl border-none cursor-pointer">Annuler</button>
              <button onClick={() => { localStorage.clear(); router.push('/login'); }} className="flex-1 p-4 bg-red-500 text-white font-bold rounded-2xl border-none cursor-pointer">Oui, Quitter</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
