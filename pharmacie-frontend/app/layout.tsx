"use client";
import "@fontsource/poppins/500.css";
import "@fontsource/poppins/600.css";
import "@fontsource/poppins/700.css";
import "@fontsource/poppins/800.css";
import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";
import "@fontsource/inter/600.css";
import "@fontsource/inter/700.css";
import "@fontsource/jetbrains-mono/400.css";
import "@fontsource/jetbrains-mono/500.css";
import './globals.css';
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Menu, X, House,  
  Power, ShoppingCart, LogIn, Pill, History, LayoutDashboard, User, ClipboardList
} from 'lucide-react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { SerwistProvider } from '@serwist/turbopack/react';
import { ConfigPharmacieProvider } from '../lib/context/ConfigPharmacieContext';
import { ThemeProvider } from '../lib/context/ThemeProvider';
import { ThemeToggleButton } from '../components/ThemeToggleButton';
import { PharmacyBrandName } from '../components/PharmacyBrandName';
import { PharmacyIcon } from '../components/PharmacyIcon';
import { PulseLine } from '../components/PulseLine';
import { useOfflinePanier } from '../lib/hooks/useOfflinePanier';
import apiClient from '../lib/apiClient';
import { useOfflineCatalogue } from '../lib/hooks/useOfflineCatalogue';


export default function RootLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  
  // 🔧 FIX DOUBLE BANDEAU : app/page.tsx (l'accueil) affiche déjà sa propre nav
  // ET son propre footer, branchés sur useConfigPharmacie() (nom/logo dynamiques du
  // tenant). Sans exclure "/" ici, ce nav générique (texte "PHARMACIE +" codé en dur)
  // s'affichait EN PLUS de celui de la page d'accueil -- d'où les "2 bandeaux" visibles
  // au scroll, et le nom de la pharmacie qui restait "Pharmacie +" sur l'un des deux.
  // 🆕 (30/07) : /produit ajouté à la liste -- cette page a son propre en-tête (flèche
  // retour) ET sa propre barre d'action fixe en bas (sélecteur de quantité + "Ajouter au
  // panier"). Sans cette exclusion, la nav du bas générique du client (elle aussi fixed
  // bottom-0) se serait superposée exactement à cet endroit -- collision visuelle directe,
  // deux barres au même endroit à l'écran.
  // 🔧 (30/07, v3) : '/' retiré de cette liste -- l'ancien accueil (plein-écran immersif,
  // façon Hero du site marketing) justifiait de masquer le bandeau/la nav du bas. Le nouvel
  // accueil (fidèle à la maquette du 25/07) les garde au contraire : hamburger, logo, panier
  // en haut ; Accueil/Catalogue/Panier/Commandes/Profil en bas pour un client connecté.
  const isSpecialRoute = pathname.startsWith('/admin') || pathname.startsWith('/caisse') || pathname.startsWith('/produit') || pathname === '/login' || pathname === '/register';

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

  // 🛒 REFONTE UI/UX (25/07) : badge panier dans le header + nav du bas -- uniquement
  // pertinent pour un client (le staff n'a pas de panier personnel, api_panier renvoie
  // même un 403 explicite pour is_staff sans ?id=, cf. son commentaire dans core/api.py).
  const [cartCount, setCartCount] = useState(0);
  const estClient = user.loggedIn && user.role !== 'ADMIN' && user.role !== 'CAISSIERE';
  const fetchCartCount = async () => {
    if (!estClient) { setCartCount(0); return; }
    try {
      const res = await apiClient.get('/api/v1/panier/');
      const items = res.data?.items || [];
      setCartCount(items.reduce((s: number, it: any) => s + (it.quantite || 0), 0));
    } catch { setCartCount(0); }
  };
  useEffect(() => { fetchCartCount(); }, [user.loggedIn, user.role]);
  useEffect(() => {
    const rafraichir = () => fetchCartCount();
    window.addEventListener('panier-maj', rafraichir);
    return () => window.removeEventListener('panier-maj', rafraichir);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estClient]);

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

  // 🎨 REFONTE UI/UX (splash screen, 30/07) : plus nuancée qu'un simple avant/après 18h --
  // petite touche pour que l'app donne l'impression de "connaître" la personne plutôt qu'une
  // salutation générique à toute heure. Toujours utilisée à l'identique dans la modale de
  // déconnexion plus bas (pas de duplication).
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 5) return 'Bonne nuit';
    if (hour < 12) return 'Bonjour';
    if (hour < 18) return 'Bon après-midi';
    return 'Bonsoir';
  };

  // 🎨 REFONTE UI/UX (30/07, v2) : le splashscreen parle désormais un langage
  // spécifique à chaque type de compte plutôt qu'un texte générique -- un
  // administrateur, une caissière et un patient n'ouvrent pas l'app pour la
  // même raison, autant que le tout premier écran le reflète.
  const getRoleCopy = () => {
    if (!user.loggedIn) {
      return { eyebrow: 'Bienvenue', message: 'Votre santé, notre priorité' };
    }
    if (user.role === 'ADMIN') {
      return { eyebrow: 'Tableau de bord', message: 'voici votre officine aujourd\u2019hui' };
    }
    if (user.role === 'CAISSIERE') {
      return { eyebrow: 'Session caisse', message: 'votre guichet vous attend' };
    }
    return { eyebrow: 'Espace patient', message: 'heureux de vous revoir' };
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
        <meta name="theme-color" content="#0b6440" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="Pharmacie +" />
        <meta name="mobile-web-app-capable" content="yes" />
      </head>
      <body className="bg-slate-50 dark:bg-[#050e0c] text-slate-900 dark:text-slate-100 min-h-screen flex flex-col font-sans transition-colors duration-300">
        <ThemeProvider>
        <SerwistProvider swUrl="/serwist/sw.js">

        {/* 🔧 FIX LOGO : ConfigPharmacieProvider doit englober le splash screen aussi,
            pas seulement le nav/footer -- sinon useConfigPharmacie() à l'intérieur du
            splash retombe toujours sur la valeur par défaut (config: null), car un
            composant ne peut jamais consommer un Provider qu'il rend lui-même dans son
            propre JSX ; il doit être un DESCENDANT de ce Provider. D'où le déplacement
            de l'ouverture de <ConfigPharmacieProvider> ici, avant le splash. */}
        <ConfigPharmacieProvider>
        {/* SPLASH SCREEN -- refonte 30/07 v2 : même dégradé "brand-deep" et mêmes
            polices que le site marketing, pour qu'il n'y ait plus aucune rupture
            visuelle en entrant dans l'app depuis le site. Les 3 anneaux de pouls
            concentriques (jugés too much) ont été retirés au profit d'une lueur
            douce et d'un tracé ECG (PulseLine, déjà utilisé sur le site) comme
            indicateur de chargement -- un clin d'œil santé plus subtil. */}
        <AnimatePresence>
          {showSplash && (
            <motion.div 
              exit={{ opacity: 0, scale: 1.06 }}
              transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
              className="fixed inset-0 z-[150] flex flex-col items-center justify-center bg-brand-deep overflow-hidden"
            >
              {/* 🌿 FOND VIVANT : masses lumineuses floutées qui dérivent lentement --
                  mêmes teintes (émeraude + bleu) que le Hero du site marketing. */}
              <motion.div
                animate={{ x: [0, 40, -20, 0], y: [0, -30, 20, 0], scale: [1, 1.15, 0.95, 1] }}
                transition={{ duration: 9, repeat: Infinity, ease: 'easeInOut' }}
                className="absolute -top-24 -left-16 w-80 h-80 rounded-full bg-emerald-500/20 blur-[100px]"
              />
              <motion.div
                animate={{ x: [0, -30, 25, 0], y: [0, 25, -15, 0], scale: [1, 0.9, 1.1, 1] }}
                transition={{ duration: 11, repeat: Infinity, ease: 'easeInOut', delay: 0.5 }}
                className="absolute -bottom-32 -right-20 w-96 h-96 rounded-full bg-blue-500/15 blur-[110px]"
              />
              <motion.div
                animate={{ x: [0, 20, -25, 0], y: [0, -20, 15, 0] }}
                transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
                className="absolute top-1/3 right-1/4 w-56 h-56 rounded-full bg-emerald-300/10 blur-[90px]"
              />

              <div className="relative flex flex-col items-center px-6 text-center">
                {/* Étiquette contextuelle -- change selon le compte (visiteur, patient,
                    caissière, administrateur), plutôt qu'un texte générique fixe. */}
                <motion.span
                  initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.15, duration: 0.4 }}
                  className="text-[12px] font-mono uppercase tracking-[0.25em] text-emerald-300 mb-6"
                >
                  {getRoleCopy().eyebrow}
                </motion.span>

                {/* Halo doux et respirant derrière le logo -- remplace les anneaux
                    de pouls concentriques par quelque chose de plus feutré. */}
                <motion.div
                  animate={{ scale: [1, 1.12, 1], opacity: [0.35, 0.55, 0.35] }}
                  transition={{ duration: 3.2, repeat: Infinity, ease: 'easeInOut' }}
                  className="absolute top-0 h-28 w-28 rounded-[2rem] bg-emerald-300/40 blur-2xl"
                />

                {/* Logo -- entrée avec ressort (pas un simple fade), léger settle de rotation */}
                <motion.div
                  initial={{ opacity: 0, scale: 0.4, rotate: -12 }}
                  animate={{ opacity: 1, scale: 1, rotate: 0 }}
                  transition={{ type: 'spring', stiffness: 260, damping: 16, delay: 0.05 }}
                  className="relative h-24 w-24 bg-white rounded-[1.75rem] flex items-center justify-center shadow-2xl shadow-black/20 p-4"
                >
                  <PharmacyIcon className="w-full h-full object-cover" alt="Pharmacie+" />
                </motion.div>

                <motion.h1
                  initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.45, duration: 0.4 }}
                  className="font-display text-2xl font-bold text-white tracking-tight mt-5"
                >
                  <PharmacyBrandName />
                </motion.h1>

                {/* 👋 Le "moment" personnalisé : la salutation arrive d'abord, puis le prénom
                    "pop" juste après avec son propre petit ressort -- pour que l'app donne
                    vraiment l'impression de RECONNAÎTRE la personne, pas juste d'afficher une
                    variable dans une phrase figée. */}
                <motion.p
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.7 }}
                  className="text-emerald-50/90 text-sm font-medium mt-2.5 flex items-center gap-1.5"
                >
                  {user.loggedIn ? (
                    <>
                      {getGreeting()},
                      <motion.span
                        initial={{ opacity: 0, scale: 0.5 }} animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 0.95, type: 'spring', stiffness: 300, damping: 12 }}
                        className="font-display font-semibold text-white"
                      >
                        {user.name}
                      </motion.span>
                      — {getRoleCopy().message} 👋
                    </>
                  ) : (
                    getRoleCopy().message
                  )}
                </motion.p>
              </div>

              {/* Tracé ECG animé -- indicateur de chargement, même motif que celui déjà
                  utilisé sur le site marketing (composant PulseLine), pour que l'app et
                  le site parlent visuellement le même langage santé. */}
              <motion.div
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3, duration: 0.5 }}
                className="absolute bottom-16 w-48"
              >
                <PulseLine className="w-full h-10" stroke="#67d29e" width={480} height={80} />
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {!isSpecialRoute && (
          <>
            <nav className="sticky top-0 z-50 bg-white/95 dark:bg-[#0b1a16]/95 backdrop-blur-md px-5 py-3 shadow-sm border-b border-slate-100 dark:border-white/10">
              <div className="container mx-auto flex justify-between items-center gap-3">
                <button aria-label="Ouvrir le menu" onClick={() => setIsMenuOpen(true)} className="relative min-h-11 min-w-11 flex items-center justify-center bg-transparent border-none -ml-2 cursor-pointer text-slate-700 dark:text-slate-200 active:scale-90 transition-transform">
                  <Menu size={22} />
                  {fileAttenteOffline.length > 0 && (
                    <span
                      title={`${fileAttenteOffline.length} article(s) en attente de synchronisation`}
                      className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-amber-500 text-white text-[9px] font-black flex items-center justify-center border-2 border-white dark:border-[#0b1a16]"
                    >
                      {fileAttenteOffline.length}
                    </span>
                  )}
                </button>

                <Link href="/" className="flex items-center gap-2.5 text-slate-800 dark:text-white no-underline group min-w-0">
                  <div className="h-9 w-9 shrink-0 flex items-center justify-center overflow-hidden group-hover:rotate-6 transition-transform">
                    <PharmacyIcon className="w-full h-full object-cover" alt="Pharmacie+" />
                  </div>
                  <div className="min-w-0">
                    <PharmacyBrandName className="font-black text-base leading-tight tracking-tighter block truncate" />
                    <p className="text-[10px] text-slate-400 dark:text-slate-500 font-semibold leading-tight truncate">Votre santé, notre priorité</p>
                  </div>
                </Link>

                <div className="flex items-center gap-2 shrink-0">
                  <ThemeToggleButton />
                  {estClient && (
                    <Link href="/panier" aria-label="Mon panier" className="relative bg-slate-50 dark:bg-white/[0.06] hover:bg-emerald-50 dark:hover:bg-emerald-900/20 p-2.5 rounded-2xl text-slate-700 dark:text-slate-200 transition-colors no-underline">
                      <ShoppingCart size={19} />
                      {cartCount > 0 && (
                        <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-emerald-500 text-white text-[10px] font-black flex items-center justify-center border-2 border-white dark:border-[#0b1a16]">
                          {cartCount}
                        </span>
                      )}
                    </Link>
                  )}
                </div>
              </div>
            </nav>

            <AnimatePresence>
              {isMenuOpen && (
                <>
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsMenuOpen(false)} className="fixed inset-0 z-[60] bg-slate-950/60 backdrop-blur-md" />
                  {/* 📱 Feuille mobile (bottom sheet), pas un tiroir latéral façon desktop : glisse
                      depuis le bas (zone naturellement accessible au pouce), coins arrondis en
                      haut, poignée de glissement visible, et se referme au swipe vers le bas --
                      exactement le comportement attendu d'une vraie app native iOS/Android. */}
                  <motion.div
                    drag="y"
                    dragConstraints={{ top: 0, bottom: 0 }}
                    dragElastic={{ top: 0, bottom: 0.5 }}
                    onDragEnd={(_e, info) => {
                      if (info.offset.y > 100 || info.velocity.y > 500) setIsMenuOpen(false);
                    }}
                    initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
                    transition={{ type: 'spring', damping: 32, stiffness: 320 }}
                    className="fixed bottom-0 left-0 right-0 z-[70] max-h-[88vh] bg-white dark:bg-[#0b1a16] rounded-t-[2rem] shadow-2xl flex flex-col touch-none"
                  >
                    {/* Poignée de glissement -- l'affordance universelle du bottom sheet mobile */}
                    <div className="flex justify-center pt-3 pb-1 shrink-0 cursor-grab active:cursor-grabbing">
                      <div className="w-10 h-1.5 rounded-full bg-slate-200 dark:bg-white/15" />
                    </div>

                    <div className="px-8 pb-5 pt-2 flex justify-between items-center border-b dark:border-white/10 shrink-0">
                      <h3 className="font-display text-lg font-bold text-slate-900 dark:text-white">Navigation</h3>
                      <button aria-label="Fermer le menu" onClick={() => setIsMenuOpen(false)} className="min-h-11 min-w-11 flex items-center justify-center rounded-xl bg-slate-100 dark:bg-white/[0.06] border-none text-slate-500 hover:text-red-500 active:scale-90 cursor-pointer transition-all"><X size={20} /></button>
                    </div>

                    <div className="flex-grow overflow-y-auto p-6 space-y-1 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
                      <Link href="/" onClick={() => setIsMenuOpen(false)} className="flex items-center gap-4 p-4 rounded-2xl font-semibold text-slate-600 dark:text-slate-300 hover:bg-emerald-50 dark:hover:bg-white/[0.04] active:scale-[0.98] transition-all no-underline">
                        <House size={20} /> Accueil
                      </Link>
              
                      {user.loggedIn ? (
                        <>
                          {/* SECTION ADMIN : Uniquement Accueil, Catalogue et Dashboard */}
                          {user.role === 'ADMIN' ? (
                            <>
                              <div className="text-[11px] font-semibold text-red-500/80 dark:text-red-400/70 pt-6 pb-2 px-4">Mode gestionnaire</div>
                              <Link href="/catalogue" onClick={() => setIsMenuOpen(false)} className="flex items-center gap-4 p-4 rounded-2xl font-semibold text-slate-600 dark:text-slate-300 hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:text-blue-600 active:scale-[0.98] transition-all no-underline"><Pill size={20} /> Catalogue produits</Link>
                              <Link href="/admin/dashboard" onClick={() => setIsMenuOpen(false)} className="flex items-center gap-4 p-4 rounded-2xl font-semibold text-slate-600 dark:text-slate-300 hover:bg-red-50 dark:hover:bg-red-950/30 active:scale-[0.98] transition-all no-underline">
                                <LayoutDashboard size={20} className="text-red-500" /> Panneau de contrôle
                              </Link>
                            </>
                          ) : user.role === 'CAISSIERE' ? (
                            <>
                              <div className="text-[11px] font-semibold text-emerald-600/80 dark:text-emerald-400/70 pt-6 pb-2 px-4">Session caisse</div>
                              <Link href="/catalogue" onClick={() => setIsMenuOpen(false)} className="flex items-center gap-4 p-4 rounded-2xl font-semibold text-slate-600 dark:text-slate-300 hover:bg-blue-50 dark:hover:bg-blue-900/20 active:scale-[0.98] transition-all no-underline"><Pill size={20} /> Catalogue produits</Link>
                              <Link href="/caisse/pos" onClick={() => setIsMenuOpen(false)} className="flex items-center gap-4 p-4 rounded-2xl font-semibold text-slate-600 dark:text-slate-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 active:scale-[0.98] transition-all no-underline">
                                <ShoppingCart size={20} className="text-emerald-500" /> Accéder au guichet
                              </Link>
                            </>
                          ) : (
                            /* SECTION CLIENT CLASSIQUE */
                            <>
                              <div className="text-[11px] font-semibold text-blue-500/80 dark:text-blue-400/70 pt-6 pb-2 px-4">Espace pharmacie</div>
                              <Link href="/catalogue" onClick={() => setIsMenuOpen(false)} className="flex items-center gap-4 p-4 rounded-2xl font-semibold text-slate-600 dark:text-slate-300 hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:text-blue-600 active:scale-[0.98] transition-all no-underline"><Pill size={20} /> Catalogue produits</Link>
                              <Link href="/panier" onClick={() => setIsMenuOpen(false)} className="flex items-center gap-4 p-4 rounded-2xl font-semibold text-slate-600 dark:text-slate-300 hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:text-blue-600 active:scale-[0.98] transition-all no-underline"><ShoppingCart size={20} /> Mon panier</Link>
                              <Link href="/commandes" onClick={() => setIsMenuOpen(false)} className="flex items-center gap-4 p-4 rounded-2xl font-semibold text-slate-600 dark:text-slate-300 hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:text-blue-600 active:scale-[0.98] transition-all no-underline"><History size={20} /> Mes commandes</Link>
                              <Link href="/profil" onClick={() => setIsMenuOpen(false)} className="flex items-center gap-4 p-4 rounded-2xl font-semibold text-slate-600 dark:text-slate-300 hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:text-blue-600 active:scale-[0.98] transition-all no-underline"><User size={20} /> Mon profil</Link>
                            </>
                          )}
                        </>
                      ) : (
                        <Link href="/login" onClick={() => setIsMenuOpen(false)} className="flex items-center gap-4 p-4 rounded-2xl font-bold text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950 active:scale-[0.98] transition-all no-underline border border-emerald-500/20 shadow-lg mt-6">
                          <LogIn size={20} /> Se connecter
                        </Link>
                      )}
                    </div>

                    {user.loggedIn && (
                      <div className="p-6 border-t dark:border-white/10 shrink-0" style={{ paddingBottom: 'calc(1.5rem + env(safe-area-inset-bottom))' }}>
                        <button onClick={() => setShowLogoutConfirm(true)} className="w-full min-h-11 flex items-center justify-center gap-3 text-red-500 font-bold text-sm hover:bg-red-50 dark:hover:bg-red-500/10 active:scale-[0.98] p-4 rounded-2xl transition-all border border-red-100 dark:border-red-500/20 bg-transparent cursor-pointer outline-none">
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
              <motion.div initial={{scale: 0.9, opacity: 0}} animate={{scale: 1, opacity: 1}} className="bg-white dark:bg-[#0b1a16] p-8 rounded-[2.5rem] max-w-sm w-full text-center shadow-2xl border border-white/10">
                  <div className="text-5xl mb-4">👋</div>
                  <h3 className="text-xl font-black mb-2 dark:text-white">{getGreeting()}, {user.name} !</h3>
                  <p className="text-slate-500 dark:text-slate-400 mb-8 text-sm font-medium italic">Voulez-vous vraiment vous déconnecter ?</p>
                  <div className="grid grid-cols-2 gap-4">
                      <button onClick={() => setShowLogoutConfirm(false)} className="p-4 rounded-2xl bg-slate-100 dark:bg-white/[0.06] font-bold border-none text-slate-500 cursor-pointer">Annuler</button>
                      <button onClick={confirmLogout} className="p-4 rounded-2xl bg-red-600 text-white font-black border-none cursor-pointer shadow-lg shadow-red-600/20">Quitter</button>
                  </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        <main className={`flex-grow ${!isSpecialRoute && estClient ? 'pb-24' : ''}`}>{children}</main>

        {/* 📱 NAV DU BAS — réservée à l'expérience client (adaptée à son usage : parcourir,
            acheter, suivre ses commandes), fidèle à la maquette fournie le 25/07. */}
        {!isSpecialRoute && estClient && (
          <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-[#0b1a16]/95 backdrop-blur-md border-t border-slate-100 dark:border-white/10 px-4 pt-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))]">
            <div className="container mx-auto max-w-md flex items-end justify-between relative">
              {[
                { href: '/', label: 'Accueil', Icon: House },
                { href: '/catalogue', label: 'Catalogue', Icon: Pill },
              ].map(({ href, label, Icon }) => (
                <Link key={href} href={href} className={`no-underline flex flex-col items-center gap-1 px-3 py-1.5 ${pathname === href ? 'text-emerald-600' : 'text-slate-400'}`}>
                  <Icon size={22} strokeWidth={pathname === href ? 2.5 : 2} />
                  <span className="text-[10px] font-bold">{label}</span>
                </Link>
              ))}

              {/* Bouton panier flottant central, comme sur la maquette */}
              <Link href="/panier" aria-label="Mon panier" className="relative no-underline -mt-7">
                <div className="w-14 h-14 rounded-full bg-emerald-500 hover:bg-emerald-600 shadow-lg shadow-emerald-500/30 flex items-center justify-center border-4 border-white dark:border-[#0b1a16] transition-colors">
                  <ShoppingCart size={22} className="text-white" />
                </div>
                {cartCount > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[19px] h-[19px] px-1 rounded-full bg-red-500 text-white text-[10px] font-black flex items-center justify-center border-2 border-white dark:border-[#0b1a16]">
                    {cartCount}
                  </span>
                )}
              </Link>

              {[
                { href: '/commandes', label: 'Commandes', Icon: ClipboardList },
                { href: '/profil', label: 'Profil', Icon: User },
              ].map(({ href, label, Icon }) => (
                <Link key={href} href={href} className={`no-underline flex flex-col items-center gap-1 px-3 py-1.5 ${pathname === href ? 'text-emerald-600' : 'text-slate-400'}`}>
                  <Icon size={22} strokeWidth={pathname === href ? 2.5 : 2} />
                  <span className="text-[10px] font-bold">{label}</span>
                </Link>
              ))}
            </div>
          </nav>
        )}

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