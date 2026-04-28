"use client";
import React, { useState, useEffect } from 'react';
import { ShoppingCart, FileText, History, Power, X, Menu, ArrowLeft, Home, LayoutGrid } from 'lucide-react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';

export default function CaisseLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [userName, setUserName] = useState('');
  const [greeting, setGreeting] = useState('');

  useEffect(() => {
    const name = localStorage.getItem('username') || 'Caissière';
    setUserName(name);
    const hour = new Date().getHours();
    setGreeting(hour >= 18 ? 'Bonsoir' : 'Bonjour');
  }, []);

  const confirmLogout = () => {
    localStorage.clear();
    router.push('/login');
  };

  return (
    <div className="min-h-screen bg-emerald-50 dark:bg-slate-950 flex flex-col font-sans">
      
      {/* 🏹 FLÈCHE DE RETOUR STYLÉE (Fixe) */}
      <motion.button 
        initial={{ x: -20, opacity: 0 }} animate={{ x: 0, opacity: 1 }}
        onClick={() => router.back()}
        className="fixed bottom-8 left-8 z-50 p-4 bg-emerald-700/80 backdrop-blur-xl text-white rounded-full shadow-2xl border-none cursor-pointer hover:scale-110 active:scale-95 transition-all group"
      >
        <ArrowLeft size={24} className="group-hover:-translate-x-1 transition-transform" />
      </motion.button>

      {/* Header Caisse */}
      <nav className="sticky top-0 z-50 bg-emerald-700 text-white p-4 shadow-xl">
        <div className="container mx-auto flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 bg-white rounded-lg flex items-center justify-center text-emerald-700 font-black italic">C+</div>
            <div className="flex flex-col">
                <span className="font-black uppercase italic tracking-tighter text-lg leading-none">ESPACE CAISSE</span>
                <span className="text-[8px] font-bold opacity-60 uppercase tracking-[0.3em]">Empire v1.0</span>
            </div>
          </div>
          <button onClick={() => setIsMenuOpen(true)} className="bg-white/10 hover:bg-white/20 p-3 rounded-2xl border-none text-white cursor-pointer transition-colors">
            <Menu size={20}/>
          </button>
        </div>
      </nav>

      {/* Menu Latéral Caisse (Amélioré) */}
      <AnimatePresence>
        {isMenuOpen && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsMenuOpen(false)} className="fixed inset-0 z-[60] bg-slate-950/60 backdrop-blur-sm" />
            <motion.div initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} className="fixed top-0 right-0 h-full w-80 bg-white dark:bg-slate-900 z-[70] shadow-2xl flex flex-col p-8 border-l border-emerald-500/20">
                
                <div className="flex justify-between items-center mb-10 text-emerald-700">
                    <div className="flex flex-col">
                        <span className="font-black italic uppercase text-xs text-slate-400">Navigation</span>
                        <span className="font-black text-lg text-emerald-600">Menu Principal</span>
                    </div>
                    <button onClick={() => setIsMenuOpen(false)} className="p-2 bg-slate-100 dark:bg-slate-800 rounded-xl border-none cursor-pointer"><X size={20}/></button>
                </div>

                <nav className="flex-grow space-y-3">
                    {/* Liens Système */}
                    <Link href="/" onClick={() => setIsMenuOpen(false)} className="flex items-center gap-4 p-4 rounded-2xl font-black text-xs uppercase tracking-widest text-slate-500 hover:bg-blue-50 hover:text-blue-600 no-underline transition-all">
                        <Home size={20} /> Accueil Boutique
                    </Link>
                    <Link href="/catalogue" onClick={() => setIsMenuOpen(false)} className="flex items-center gap-4 p-4 rounded-2xl font-black text-xs uppercase tracking-widest text-slate-500 hover:bg-orange-50 hover:text-orange-600 no-underline transition-all">
                        <LayoutGrid size={20} /> Catalogue Médicaments
                    </Link>

                    <div className="h-px bg-slate-100 dark:bg-slate-800 my-6" />

                    {/* Liens Métier */}
                    <Link href="/caisse/pos" onClick={() => setIsMenuOpen(false)} className={`flex items-center gap-4 p-4 rounded-2xl font-black text-xs uppercase tracking-widest no-underline transition-all ${pathname === '/caisse/pos' ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-500/30' : 'text-slate-600 hover:bg-emerald-50'}`}>
                        <ShoppingCart size={20} /> Vente Comptoir
                    </Link>
                    <Link href="/caisse/ordonnances" onClick={() => setIsMenuOpen(false)} className="flex items-center gap-4 p-4 rounded-2xl font-black text-xs uppercase tracking-widest text-slate-600 hover:bg-emerald-50 no-underline transition-all">
                        <FileText size={20} /> Gestion Ordonnances
                    </Link>
                    <Link href="/caisse/archives" onClick={() => setIsMenuOpen(false)} className="flex items-center gap-4 p-4 rounded-2xl font-black text-xs uppercase tracking-widest text-slate-600 hover:bg-emerald-50 no-underline transition-all">
                        <History size={20} /> Historique Ventes
                    </Link>
                </nav>

                <button onClick={() => setShowLogoutConfirm(true)} className="w-full mt-auto flex items-center justify-center gap-3 text-red-500 font-black p-5 rounded-2xl border-none bg-red-50 dark:bg-red-500/10 cursor-pointer uppercase text-[10px] tracking-widest">
                    <Power size={20} /> Déconnexion
                </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Modale de Déconnexion */}
      <AnimatePresence>
        {showLogoutConfirm && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
            <motion.div initial={{scale: 0.9, opacity: 0}} animate={{scale: 1, opacity: 1}} className="bg-white dark:bg-slate-900 p-10 rounded-[3rem] max-w-sm w-full text-center shadow-2xl border border-white/5">
                <div className="text-5xl mb-4">👋</div>
                <h3 className="text-2xl font-black mb-2 dark:text-white italic tracking-tighter uppercase">{greeting}, {userName}</h3>
                <p className="text-slate-500 dark:text-slate-400 mb-8 text-xs font-bold uppercase tracking-widest">Voulez-vous fermer la caisse ?</p>
                <div className="grid grid-cols-2 gap-4">
                    <button onClick={() => setShowLogoutConfirm(false)} className="p-4 rounded-2xl bg-slate-100 dark:bg-slate-800 font-bold border-none cursor-pointer uppercase text-[10px] tracking-widest">Rester</button>
                    <button onClick={confirmLogout} className="p-4 rounded-2xl bg-red-600 text-white font-black border-none cursor-pointer uppercase text-[10px] tracking-widest shadow-lg shadow-red-500/30">Quitter</button>
                </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <main className="flex-grow">{children}</main>
      
      <footer className="p-8 text-center text-slate-400 text-[10px] font-black uppercase tracking-[0.5em] opacity-40">
        PHARMACIE + &copy; {new Date().getFullYear()}
      </footer>
    </div>
  );
}
