"use client";
import './globals.css';
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Menu, X, House,  
  Power, ShoppingCart, LogIn, Pill, History, LayoutDashboard, User
} from 'lucide-react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { SerwistProvider } from '@serwist/turbopack/react';
import { ConfigPharmacieProvider } from '../lib/context/ConfigPharmacieContext';
import { ThemeProvider } from '../lib/context/ThemeProvider';
import { ThemeToggleButton } from '../components/ThemeToggleButton';
import { PharmacyBrandName } from '../components/PharmacyBrandName';
import { useOfflinePanier } from '../lib/hooks/useOfflinePanier';
import { useOfflineCatalogue } from '../lib/hooks/useOfflineCatalogue';


export default function RootLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  
  // 🔧 FIX DOUBLE BANDEAU : app/page.tsx (l'accueil) affiche déjà sa propre nav
  // ET son propre footer, branchés sur useConfigPharmacie() (nom/logo dynamiques du
  // tenant). Sans exclure "/" ici, ce nav générique (texte "PHARMACIE +" codé en dur)
  // s'affichait EN PLUS de celui de la page d'accueil -- d'où les "2 bandeaux" visibles
  // au scroll, et le nom de la pharmacie qui restait "Pharmacie +" sur l'un des deux.
  const isSpecialRoute = pathname.startsWith('/admin') || pathname.startsWith('/caisse') || pathname === '/login' || pathname === '/register' || pathname === '/';

  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [showSplash, setShowSplash] = useState(true);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  
  const [user, setUser] = useState({ 
    loggedIn: false, 
    role: '', 
    name: 'Visiteur' 
  });

  // 🚀 MODE OFFLINE (session 12/07, brique 3/4) : simple badge global (visible sur toutes
  // les pages client, pas seulement /panier) signalant des ajouts au panier en attente de
  // synchronisation -- rappel discret pour ne pas oublier de repasser en ligne, sans devoir
  // se rendre sur /panier pour s'en rendre compte.
  const { file: fileAttenteOffline } = useOfflinePanier();

  // 🚀 MODE OFFLINE (brique 4/4) : synchronise silencieusement la copie locale du catalogue
  // en arrière-plan (montage + retour réseau) -- purement un effet de fond ici, pas de rendu ;
  // c'est app/catalogue/page.tsx qui consulte cette copie locale en repli si le réseau manque.
  useOfflineCatalogue();

  useEffect(() => {
    const timer = setTimeout(() => setShowSplash(false), 3500);
    const savedRole = localStorage.getItem('user_role');
    const savedName = localStorage.getItem('display_name') || localStorage.getItem('username');
    
    if (savedRole && savedName) {
      setUser({
        loggedIn: true,
        role: savedRole.toUpperCase(),
        name: savedName
      });
    }
    return () => clearTimeout(timer);
  }, []);

  // 🌗 Le thème clair/sombre est désormais entièrement géré par next-themes
  // (voir lib/context/ThemeProvider.tsx + components/ThemeToggleButton.tsx) :
  // plus de classList.toggle manuel ni de clé localStorage gérée à la main ici.

  const confirmLogout = () => {
    localStorage.clear();
    setUser({ loggedIn: false, role: '', name: 'Visiteur' });
    setIsMenuOpen(false);
    setShowLogoutConfirm(false);
    router.push('/login');
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    return hour >= 18 ? 'Bonsoir' : 'Bonjour';
  };

  return (
    <html lang="fr" suppressHydrationWarning>
      <head>
        {/* 🌟 INTEGRATION PWA ET SÉCURITÉ CONFORME AUX COMPOSANTS CLIENTS */}
        <title>Pharmacie +</title>
        <meta name="description" content="Portail d'Accès Sécurisé 🛰️" />
        <link rel="manifest" href="/manifest.json" />
        <link rel="icon" href="/favicon.ico" />
        {/* 🔐 PWA : icône Apple dédiée (PNG carré 180x180 sans transparence) -- un .ico ne
            fonctionne pas comme icône d'écran d'accueil iOS, contrairement à ce qui était
            configuré avant (apple-touch-icon pointait par erreur vers favicon.ico). */}
        <link rel="apple-touch-icon" sizes="180x180" href="/icons/apple-touch-icon.png" />
        <meta name="theme-color" content="#059669" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="Pharmacie +" />
        <meta name="mobile-web-app-capable" content="yes" />
      </head>
      <body className="bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 min-h-screen flex flex-col font-sans transition-colors duration-300">
        <ThemeProvider>
        <SerwistProvider swUrl="/serwist/sw.js">
        
        {/* SPLASH SCREEN */}
        <AnimatePresence>
          {showSplash && (
            <motion.div 
              exit={{ opacity: 0, scale: 1.1 }}
              className="fixed inset-0 z-[150] flex items-center justify-center bg-slate-950/90 backdrop-blur-2xl"
            >
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center">
                <div className="relative inline-block mb-6">
                  <div className="absolute inset-0 bg-emerald-500 rounded-full blur-3xl opacity-20 animate-pulse" />
                  <div className="h-32 w-32 bg-white rounded-3xl flex items-center justify-center shadow-2xl relative border border-white/10 mx-auto p-5">
                    <img src="/branding/icon-mark.png" alt="Pharmacie+" className="w-full h-full object-contain" />
                  </div>
                </div>
                <h1 className="text-5xl md:text-7xl font-black text-white tracking-tighter mb-4">
                  Salut, <span className="text-emerald-500">{user.name}</span> !
                </h1>
                <p className="text-emerald-400 font-black uppercase tracking-[0.5em] text-sm italic">
                  {user.loggedIn ? `Session : ${user.role} 🏥` : "Bienvenue sur Pharmacie +"}
                </p>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        <ConfigPharmacieProvider>
        {!isSpecialRoute && (
          <>
            <nav className="sticky top-0 z-50 bg-emerald-600/90 dark:bg-emerald-900/80 backdrop-blur-md p-4 text-white shadow-lg border-b border-white/10">
              <div className="container mx-auto flex justify-between items-center">
                <Link href="/" className="flex items-center gap-3 text-white no-underline group">
                  <div className="h-10 w-10 bg-white rounded-lg shadow-md flex items-center justify-center p-1.5 overflow-hidden group-hover:rotate-12 transition-transform">
                    <img src="/branding/icon-mark.png" alt="Pharmacie+" className="w-full h-full object-contain" />
                  </div>
                  <PharmacyBrandName className="font-bold text-xl tracking-tighter uppercase italic" />
                </Link>
        
                <div className="flex items-center gap-3">
                  <ThemeToggleButton />
                  <button aria-label="Ouvrir le menu" onClick={() => setIsMenuOpen(true)} className="relative bg-white/10 hover:bg-white/20 p-3 rounded-2xl border-0 text-white cursor-pointer transition-all shadow-inner outline-none">
                    <Menu size={20} />
                    {fileAttenteOffline.length > 0 && (
                      <span
                        title={`${fileAttenteOffline.length} article(s) en attente de synchronisation`}
                        className="absolute -top-1.5 -right-1.5 min-w-[20px] h-5 px-1 rounded-full bg-amber-500 text-white text-[10px] font-black flex items-center justify-center border-2 border-emerald-600"
                      >
                        {fileAttenteOffline.length}
                      </span>
                    )}
                  </button>
                </div>
              </div>
            </nav>

            <AnimatePresence>
              {isMenuOpen && (
                <>
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsMenuOpen(false)} className="fixed inset-0 z-[60] bg-slate-950/60 backdrop-blur-md" />
                  <motion.div 
                    initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
                    className="fixed top-0 right-0 h-full w-full max-w-sm bg-white dark:bg-slate-900 z-[70] shadow-2xl flex flex-col"
                  >
                    <div className="p-8 flex justify-between items-center border-b dark:border-slate-800">
                      <h3 className="text-xl font-black dark:text-white uppercase tracking-tighter italic text-emerald-600">Navigation</h3>
                      <button aria-label="Fermer le menu" onClick={() => setIsMenuOpen(false)} className="p-3 rounded-xl bg-slate-100 dark:bg-slate-800 border-none text-slate-500 hover:text-red-500 cursor-pointer transition-colors"><X size={20} /></button>
                    </div>

                    <div className="flex-grow overflow-y-auto p-8 space-y-2">
                      <Link href="/" onClick={() => setIsMenuOpen(false)} className="flex items-center gap-4 p-4 rounded-2xl font-bold text-slate-500 hover:bg-emerald-50 dark:hover:bg-slate-800 transition-all no-underline">
                        <House size={20} /> Accueil
                      </Link>
              
                      {user.loggedIn ? (
                        <>
                          {/* SECTION ADMIN : Uniquement Accueil, Catalogue et Dashboard */}
                          {user.role === 'ADMIN' ? (
                            <>
                              <div className="text-[10px] font-black text-red-500 uppercase tracking-widest pt-6 pb-2 px-4 italic opacity-50 underline">Mode Gestionnaire 🛰️</div>
                              <Link href="/catalogue" onClick={() => setIsMenuOpen(false)} className="flex items-center gap-4 p-4 rounded-2xl font-bold text-slate-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:text-blue-600 transition-all no-underline"><Pill size={20} /> Catalogue Produits</Link>
                              <Link href="/admin/dashboard" onClick={() => setIsMenuOpen(false)} className="flex items-center gap-4 p-4 rounded-2xl font-bold text-slate-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-all no-underline italic">
                                <LayoutDashboard size={20} className="text-red-500" /> Panneau de Contrôle
                              </Link>
                            </>
                          ) : user.role === 'CAISSIERE' ? (
                            <>
                              <div className="text-[10px] font-black text-emerald-600 uppercase tracking-widest pt-6 pb-2 px-4 italic opacity-50 underline">Ma Session Caisse 💰</div>
                              <Link href="/catalogue" onClick={() => setIsMenuOpen(false)} className="flex items-center gap-4 p-4 rounded-2xl font-bold text-slate-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all no-underline"><Pill size={20} /> Catalogue Produits</Link>
                              <Link href="/caisse/pos" onClick={() => setIsMenuOpen(false)} className="flex items-center gap-4 p-4 rounded-2xl font-bold text-slate-500 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 transition-all no-underline italic">
                                <ShoppingCart size={20} className="text-emerald-500" /> Accéder au Guichet
                              </Link>
                            </>
                          ) : (
                            /* SECTION CLIENT CLASSIQUE */
                            <>
                              <div className="text-[10px] font-black text-blue-500 uppercase tracking-widest pt-6 pb-2 px-4 italic opacity-50 underline">Espace Pharmacie 🏥</div>
                              <Link href="/catalogue" onClick={() => setIsMenuOpen(false)} className="flex items-center gap-4 p-4 rounded-2xl font-bold text-slate-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:text-blue-600 transition-all no-underline"><Pill size={20} /> Catalogue Produits</Link>
                              <Link href="/panier" onClick={() => setIsMenuOpen(false)} className="flex items-center gap-4 p-4 rounded-2xl font-bold text-slate-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:text-blue-600 transition-all no-underline"><ShoppingCart size={20} /> Mon Panier</Link>
                              <Link href="/commandes" onClick={() => setIsMenuOpen(false)} className="flex items-center gap-4 p-4 rounded-2xl font-bold text-slate-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:text-blue-600 transition-all no-underline"><History size={20} /> Mes Commandes</Link>
                              <Link href="/profil" onClick={() => setIsMenuOpen(false)} className="flex items-center gap-4 p-4 rounded-2xl font-bold text-slate-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:text-blue-600 transition-all no-underline"><User size={20} /> Mon Profil</Link>
                            </>
                          )}
                        </>
                      ) : (
                        <Link href="/login" onClick={() => setIsMenuOpen(false)} className="flex items-center gap-4 p-4 rounded-2xl font-black text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950 transition-all no-underline border border-emerald-500/20 shadow-lg mt-10">
                          <LogIn size={20} /> Se Connecter 🔐
                        </Link>
                      )}
                    </div>

                    {user.loggedIn && (
                      <div className="p-8 border-t dark:border-slate-800">
                        <button onClick={() => setShowLogoutConfirm(true)} className="w-full flex items-center justify-center gap-3 text-red-500 font-black text-xs uppercase hover:bg-red-50 dark:hover:bg-red-500/10 p-4 rounded-2xl transition border border-red-100 bg-transparent cursor-pointer outline-none">
                          <Power size={20} /> Terminer la session
                        </button>
                      </div>
                    )}
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </>
        )}

        <AnimatePresence>
          {showLogoutConfirm && (
            <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
              <motion.div initial={{scale: 0.9, opacity: 0}} animate={{scale: 1, opacity: 1}} className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] max-w-sm w-full text-center shadow-2xl border border-white/10">
                  <div className="text-5xl mb-4">👋</div>
                  <h3 className="text-xl font-black mb-2 dark:text-white">{getGreeting()}, {user.name} !</h3>
                  <p className="text-slate-500 dark:text-slate-400 mb-8 text-sm font-medium italic">Voulez-vous vraiment vous déconnecter ?</p>
                  <div className="grid grid-cols-2 gap-4">
                      <button onClick={() => setShowLogoutConfirm(false)} className="p-4 rounded-2xl bg-slate-100 dark:bg-slate-800 font-bold border-none text-slate-500 cursor-pointer">Annuler</button>
                      <button onClick={confirmLogout} className="p-4 rounded-2xl bg-red-600 text-white font-black border-none cursor-pointer shadow-lg shadow-red-600/20">Quitter</button>
                  </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        <main className="flex-grow">{children}</main>

        {!isSpecialRoute && (
          <footer className="bg-slate-950 text-white p-10 border-t-[5px] border-emerald-600 mt-20">
            <div className="container mx-auto text-center">
              <PharmacyBrandName className="text-xl font-black uppercase tracking-tighter italic text-emerald-500" />
              <p className="text-slate-500 text-[10px] mt-2 font-bold tracking-widest uppercase italic opacity-60">
                &copy; {new Date().getFullYear()} <PharmacyBrandName /> . Tous droits réservés.
              </p>
            </div>
          </footer>
        )}
        </ConfigPharmacieProvider>
        </SerwistProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}