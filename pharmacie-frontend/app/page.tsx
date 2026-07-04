"use client";
import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  ArrowRight, Phone, Mail, LogIn,
  MessageCircle, Moon, Sun, MapPin, HeartPulse, Clock, ShieldCheck, FileText, Receipt, LayoutDashboard, ShoppingBag
} from 'lucide-react';
import Link from 'next/link';
import apiClient from '../lib/apiClient';
import { useConfigPharmacie } from '../lib/context/ConfigPharmacieContext';

export default function HomePage() {
  const [isDark, setIsDark] = useState(false);
  const [user, setUser] = useState<any>(null); 
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);

  // Config pharmacie depuis le Context partagé — évite un double appel à /api/infos-pharmacie/
  // (le layout.tsx l'appelle déjà une fois via ConfigPharmacieProvider)
  const { config } = useConfigPharmacie();

    useEffect(() => {
    setMounted(true);

    const checkSessionAndConfig = async () => {
      const savedUser = localStorage.getItem('user');
      if (savedUser) {
        setUser(JSON.parse(savedUser));
      } else {
        setUser(null);
      }

      const token = localStorage.getItem('access_token');

      if (token) {
        try {
          const resAuth = await apiClient.get('/api/current-user/');
          
          if (resAuth.data.is_authenticated) {
            setUser(resAuth.data);
            localStorage.setItem('user', JSON.stringify(resAuth.data));
          } else {
            setUser(null);
            localStorage.removeItem('user');
            localStorage.removeItem('access_token');
            localStorage.removeItem('refresh_token');
          }
        } catch (err) {
          console.error("Vérification session en attente...");
        }
      } else {
        setUser(null);
        localStorage.removeItem('user');
      }

      setLoading(false);
    };

    checkSessionAndConfig();
  }, []);


  const toggleDarkMode = () => {
    document.documentElement.classList.toggle('dark');
    setIsDark(!isDark);
  };

  // --- 🧠 LOGIQUE DU BOUTON DYNAMIQUE SÉCURISÉE ---
  const renderAuthButton = () => {
    if (loading) return <div className="w-32 h-10 bg-slate-100 dark:bg-slate-800 animate-pulse rounded-full"></div>;

    if (!user) {
      return (
        <Link 
          href="/login" 
          title="Accéder au portail de connexion"
          aria-label="Accéder au portail de connexion"
          className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-2.5 rounded-full text-sm font-bold no-underline flex items-center gap-2 transition-all"
        >
          <LogIn size={16} /> Espace de connexion
        </Link>
      );
    }

    if (user.role === 'admin' || user.is_superuser) {
      return (
        <Link 
          href="/admin/dashboard" 
          title="Accéder à la console d'administration"
          aria-label="Accéder à la console d'administration"
          className="bg-slate-900 dark:bg-white dark:text-slate-900 text-white px-6 py-2.5 rounded-full text-sm font-bold no-underline flex items-center gap-2 transition-all"
        >
          <LayoutDashboard size={16} /> Tableau de bord
        </Link>
      );
    }

    if (user.role === 'caissiere' || user.is_staff) {
      return (
        <Link 
          href="/caisse/pos" 
          title="Accéder au terminal de vente"
          aria-label="Accéder au terminal de vente"
          className="bg-blue-600 text-white px-6 py-2.5 rounded-full text-sm font-bold no-underline flex items-center gap-2 transition-all"
        >
          <ShoppingBag size={16} /> Espace vente au guichet
        </Link>
      );
    }

    return null;
  };

  if (!mounted) return null;


  return (
    <div className="min-h-screen bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors duration-500 font-sans">
      
      {/* 🧭 NAVIGATION DYNAMIQUE */}
      <nav className="fixed top-0 w-full z-50 bg-white/80 dark:bg-slate-950/80 backdrop-blur-md border-b border-slate-100 dark:border-slate-800">
        <div className="max-w-7xl mx-auto px-6 h-20 flex justify-between items-center">
          <div className="flex items-center gap-3">
            {config?.logo ? (
              <img src={config.logo} alt="Logo" className="w-10 h-10 object-contain rounded-lg" />
            ) : (
              <HeartPulse className="text-emerald-600" size={28} />
            )}
            <span className="font-bold text-xl tracking-tight uppercase">
              {config?.nom || "Pharmacie"}
            </span>
          </div>

          <div className="flex items-center gap-6">
            <button onClick={toggleDarkMode} className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 border-none bg-transparent cursor-pointer transition-colors">
              {isDark ? <Sun className="text-yellow-500" size={20} /> : <Moon className="text-slate-500" size={20} />}
            </button>
            <Link href="/catalogue" className="hidden md:block text-sm font-bold text-slate-600 dark:text-slate-300 no-underline hover:text-emerald-600 transition-colors">Catalogue</Link>
            
            {/* 🎯 INTEGRATION DU BOUTON JWT */}
            {renderAuthButton()}
          </div>
        </div>
      </nav>

      {/* 🏥 HERO SECTION */}
      <section className="pt-40 pb-20 px-6 text-center max-w-4xl mx-auto">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
          <span className="text-emerald-600 dark:text-emerald-400 font-bold text-xs uppercase tracking-[0.2em] bg-emerald-50 dark:bg-emerald-900/20 px-4 py-2 rounded-full">
            Votre santé, notre engagement quotidien
          </span>
          <h1 className="text-5xl md:text-7xl font-bold mt-8 mb-6 leading-tight tracking-tight text-slate-900 dark:text-white">
            Prendre soin de vous, <br /> <span className="text-emerald-600">en toute simplicité.</span>
          </h1>
          <p className="text-lg md:text-xl text-slate-500 dark:text-slate-400 leading-relaxed max-w-2xl mx-auto">
            Accédez à vos médicaments, envoyez vos ordonnances et recevez des conseils d'experts depuis chez vous.
          </p>

          <div className="mt-12 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/catalogue" className="w-full sm:w-auto bg-slate-900 dark:bg-emerald-600 text-white px-10 py-4 rounded-xl font-bold no-underline flex items-center justify-center gap-2 hover:shadow-lg transition-all text-sm uppercase tracking-widest">
              Commander un produit <ArrowRight size={18} />
            </Link>
      
            <a 
              href={`tel:${config?.telephone || '+237'}`} 
              className="w-full sm:w-auto relative px-10 py-4 rounded-xl font-bold no-underline flex items-center justify-center gap-2 transition-all text-sm uppercase tracking-widest bg-white dark:bg-slate-800 text-slate-700 dark:text-white border border-slate-200 dark:border-slate-700 hover:border-emerald-500 overflow-hidden group"
            >
              <motion.span
                animate={{ scale: [1, 1.2, 1], opacity: [0.1, 0.3, 0.1] }}
                transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                className="absolute inset-0 bg-emerald-500 pointer-events-none"
              />
              <Phone size={18} className="text-emerald-600 group-hover:rotate-12 transition-transform z-10" /> 
              <span className="z-10">Nous Appeler</span>
            </a>
          </div>
        </motion.div>
      </section>

      {/* 🌿 NOS AVANTAGES */}
      <section className="py-24 px-6 max-w-7xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-16 items-center">
          <div>
            <h2 className="text-4xl font-bold mb-8 italic tracking-tighter">Pourquoi choisir {config?.nom || "notre officine"} ?</h2>
            <p className="text-slate-500 dark:text-slate-400 leading-relaxed mb-8 font-medium text-lg">
              Nous mettons la technologie au service de votre sécurité. Chaque transaction est rigoureusement tracée pour vous offrir une transparence totale sur vos soins.
            </p>
            <div className="space-y-6">
              <div className="flex items-start gap-4">
                <div className="p-2 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg text-emerald-600"><ShieldCheck size={24} /></div>
                <div>
                  <h4 className="font-bold text-slate-900 dark:text-white">Traçabilité Intégrale</h4>
                  <p className="text-sm text-slate-500">Chaque médicament possède un identifiant unique pour un suivi précis de son origine.</p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className="p-2 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg text-emerald-600"><Receipt size={24} /></div>
                <div>
                  <h4 className="font-bold text-slate-900 dark:text-white">Historique & Factures</h4>
                  <p className="text-sm text-slate-500">Retrouvez toutes vos factures et votre historique de soins dans votre espace personnel.</p>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-slate-50 dark:bg-slate-900/50 p-12 rounded-[40px] border border-slate-100 dark:border-slate-800">
            <h4 className="font-black text-emerald-600 text-xs uppercase tracking-[0.2em] mb-8">Services Disponibles</h4>
            <div className="space-y-10">
              <div className="flex gap-5">
                <div className="w-12 h-12 bg-white dark:bg-slate-800 rounded-2xl shadow-sm flex items-center justify-center text-emerald-600"><FileText size={24}/></div>
                <div>
                  <h5 className="font-bold text-lg">Gestion d'Ordonnances</h5>
                  <p className="text-sm text-slate-500 leading-relaxed">Téléchargez vos documents en ligne pour une préparation anticipée en officine.</p>
                </div>
              </div>
              <div className="flex gap-5">
                <div className="w-12 h-12 bg-white dark:bg-slate-800 rounded-2xl shadow-sm flex items-center justify-center text-emerald-600"><Clock size={24}/></div>
                <div>
                  <h5 className="font-bold text-lg">Disponibilité 24h/24</h5>
                  <p className="text-sm text-slate-500 leading-relaxed">Accédez à notre catalogue et à vos informations de santé à tout moment.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 🛠️ CONTACTS DIRECTS */}
      <section className="py-20 px-6 bg-slate-50 dark:bg-slate-900/50">
        <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6">
          <a href={`https://wa.me/${config?.telephone?.replace(/\s+/g, '')}`} target="_blank" rel="noreferrer" className="bg-white dark:bg-slate-800 p-8 rounded-3xl border border-slate-100 dark:border-slate-700 no-underline text-center hover:border-emerald-500 transition-all shadow-sm">
            <MessageCircle className="text-emerald-600 mx-auto mb-4" size={32} />
            <h3 className="font-bold text-slate-900 dark:text-white">WhatsApp</h3>
            <p className="text-xs text-slate-500 mt-2 uppercase font-black tracking-widest">Conseil Direct</p>
          </a>
          <a href={`mailto:${config?.email_contact}`} className="bg-white dark:bg-slate-800 p-8 rounded-3xl border border-slate-100 dark:border-slate-700 no-underline text-center hover:border-emerald-500 transition-all shadow-sm">
            <Mail className="text-emerald-600 mx-auto mb-4" size={32} />
            <h3 className="font-bold text-slate-900 dark:text-white">E-mail</h3>
            <p className="text-xs text-slate-500 mt-2 uppercase font-black tracking-widest">Demandes & Devis</p>
          </a>
          <a href={`tel:${config?.telephone}`} className="bg-white dark:bg-slate-800 p-8 rounded-3xl border border-slate-100 dark:border-slate-700 no-underline text-center hover:border-emerald-500 transition-all shadow-sm">
            <Phone className="text-emerald-600 mx-auto mb-4" size={32} />
            <h3 className="font-bold text-slate-900 dark:text-white">Appel Direct</h3>
            <p className="text-xs text-slate-500 mt-2 uppercase font-black tracking-widest">Ligne Officine</p>
          </a>
        </div>
      </section>

      {/* 🌿 FOOTER */}
      <footer className="py-24 px-6 bg-white dark:bg-slate-950 border-t border-slate-100 dark:border-slate-900">
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-16">
          <div className="space-y-6">
            <div className="flex items-center gap-3 text-2xl font-black uppercase tracking-tighter">
              {config?.logo ? (
                <img src={config.logo} alt="Logo" className="w-8 h-8 object-contain" />
              ) : (
                <HeartPulse className="text-emerald-600" />
              )}
              {config?.nom || "Pharmacie Plus"}
            </div>
            <div className="flex items-center gap-3 text-slate-500 dark:text-slate-400 font-bold text-sm">
              <MapPin className="text-emerald-600" size={20} />
              {config?.adresse || "Adresse en attente de configuration"}
            </div>
          </div>

          <div className="flex flex-col md:items-end gap-4 text-slate-600 dark:text-slate-300 font-black text-sm uppercase tracking-widest">
            <div className="flex items-center gap-3"><Clock className="text-emerald-600" size={18} /> Ouvert 24h/24 — 7j/7</div>
            <div className="flex items-center gap-3"><Phone className="text-emerald-600" size={18} /> {config?.telephone || "+237 ..."}</div>
          </div>
        </div>
        <div className="text-center mt-20 pt-10 border-t border-slate-50 dark:border-slate-900 text-[10px] text-slate-400 font-black uppercase tracking-[0.5em] opacity-40">
          © 2026 {config?.nom || "Pharmacie Plus"} — Éthique & Santé Numérique
        </div>
      </footer>
    </div>
  );
}
