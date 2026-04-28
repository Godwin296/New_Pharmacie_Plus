"use client";
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  LayoutDashboard, Box, History, Truck, 
  BarChart3, Settings, Power, Sun, Moon,
  House, Pill
} from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [isDark, setIsDark] = useState(false);
  const [currentTime, setCurrentTime] = useState('');
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [adminName, setAdminName] = useState('Admin');

  useEffect(() => {
    setAdminName(localStorage.getItem('username') || 'Admin');
    const timer = setInterval(() => {
      const opt: any = { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit', second: '2-digit' };
      setCurrentTime(new Date().toLocaleDateString('fr-FR', opt));
    }, 1000);
    
    if (localStorage.getItem('color-theme') === 'dark') {
      setIsDark(true);
      document.documentElement.classList.add('dark');
    }
    return () => clearInterval(timer);
  }, []);

  const toggleTheme = () => {
    setIsDark(!isDark);
    document.documentElement.classList.toggle('dark');
    localStorage.setItem('color-theme', !isDark ? 'dark' : 'light');
  };

  const confirmLogout = () => {
    localStorage.clear();
    router.push('/login');
  };

  // MENU RESTREINT : Uniquement les outils de gestion
  const menuItems = [
    { name: 'Accueil Site', icon: House, href: '/' },
    { name: 'Tableau de Bord', icon: LayoutDashboard, href: '/admin/dashboard' },
    { name: 'Catalogue & Photos', icon: Pill, href: '/catalogue' }, 
    { name: 'Gestion des Stocks', icon: Box, href: '/admin/stocks' },
    { name: 'Historique Ventes', icon: History, href: '/admin/historique' },
    { name: 'Fournisseurs', icon: Truck, href: '/admin/fournisseurs' },
    { name: 'Rapports & Stats', icon: BarChart3, href: '/admin/rapports' },
  ];

  return (
    <div className="min-h-screen bg-[#f8fafc] dark:bg-slate-950 text-slate-900 dark:text-white transition-colors duration-300">
      
      {/* HEADER */}
      <header className="fixed top-0 left-0 right-0 h-20 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-gray-100 dark:border-slate-800 flex items-center justify-between px-8 z-50 no-print">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-emerald-500 rounded shadow-lg flex items-center justify-center font-bold text-white">P+</div>
          <div>
            <span className="font-bold text-xl uppercase tracking-tighter block">PHARMACIE +</span>
            <span className="block text-[9px] font-black text-red-500 animate-pulse uppercase tracking-widest">🛰️ ACCÈS GESTION</span>
          </div>
        </div>

        <div className="flex items-center gap-6">
          <button onClick={toggleTheme} className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-all border-none bg-transparent cursor-pointer">
            {isDark ? <Sun size={20} className="text-yellow-400" /> : <Moon size={20} className="text-slate-600" />}
          </button>
          <div className="text-right border-l pl-6 border-gray-200 dark:border-slate-700 hidden md:block">
            <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Identifiant</div>
            <div className="text-sm font-bold text-emerald-600 capitalize">{adminName}</div>
          </div>
        </div>
      </header>

      {/* SIDEBAR */}
      <nav className="fixed top-0 left-0 w-[260px] h-screen bg-slate-900 pt-24 text-white z-40 border-r border-white/5 hidden lg:flex flex-col no-print">
        <div className="px-6 mb-4 text-[10px] uppercase text-gray-500 font-bold tracking-widest opacity-50 italic">Contrôle Inventaire 📂</div>
        
        <div className="flex flex-col gap-1">
          {menuItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link 
                key={item.name} 
                href={item.href}
                className={`flex items-center px-6 py-3 transition-all border-l-4 no-underline ${
                  isActive 
                  ? 'bg-emerald-500/10 border-emerald-500 text-white font-semibold' 
                  : 'border-transparent text-gray-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <item.icon size={18} className={`mr-3 ${isActive ? 'text-emerald-500' : ''}`} />
                {item.name}
              </Link>
            );
          })}
        </div>

        <div className="mt-auto p-6 flex flex-col gap-4">
          <Link href="/admin/settings" className={`flex items-center text-sm no-underline ${pathname === '/admin/settings' ? 'text-white font-bold' : 'text-slate-400 hover:text-white transition-colors'}`}>
            <Settings size={18} className="mr-3" /> Configuration
          </Link>
          <button 
            onClick={() => setShowLogoutConfirm(true)}
            className="w-full bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white py-3 rounded-2xl font-bold text-xs transition flex items-center justify-center gap-2 border-none cursor-pointer"
          >
            <Power size={16} /> FERMER SESSION
          </button>
        </div>
      </nav>

      {/* DIALOGUE DE DÉCONNEXION */}
      <AnimatePresence>
        {showLogoutConfirm && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md no-print">
            <motion.div initial={{scale: 0.9, opacity: 0}} animate={{scale: 1, opacity: 1}} className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] max-w-sm w-full text-center shadow-2xl">
                <div className="text-5xl mb-4">🛰️</div>
                <h3 className="text-xl font-black mb-2 dark:text-white">Déconnexion</h3>
                <p className="text-slate-500 dark:text-slate-400 mb-8 text-sm italic">Quitter le panneau de contrôle de la pharmacie ?</p>
                <div className="grid grid-cols-2 gap-4">
                    <button onClick={() => setShowLogoutConfirm(false)} className="p-4 rounded-2xl bg-slate-100 dark:bg-slate-800 font-bold border-none text-slate-500 cursor-pointer">Rester</button>
                    <button onClick={confirmLogout} className="p-4 rounded-2xl bg-red-600 text-white font-black border-none cursor-pointer shadow-lg shadow-red-600/20">Quitter</button>
                </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* CONTENU PRINCIPAL */}
      <main className="lg:ml-[260px] pt-28 px-6 lg:px-10 pb-12">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
          {children}
        </motion.div>
      </main>
    </div>
  );
}