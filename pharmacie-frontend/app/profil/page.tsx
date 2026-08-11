"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  User, ShoppingBag, ClipboardList, FileText, Lock,
  ChevronRight, LogOut, Eye, EyeOff, MapPin, Bell,
  Globe, HelpCircle, MessageCircle, Star, Heart,
  ShieldCheck, X, Camera, Loader2, Clock, Package,
  TrendingUp,
} from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import apiClient from "../../lib/apiClient";
import Prix from "../../lib/components/Prix";
import PageSkeleton from "../../lib/components/PageSkeleton";

/* ═══════════════════════════════════════════════════════════════
   TYPES
   ═══════════════════════════════════════════════════════════════ */

interface ProfilData {
  email: string;
  nom: string;
  telephone: string | null;
  identifiant: string;
  nb_commandes: number;
  montant_total_depense: number;
  photo?: string; // TODO(backend): ajouter photo au serializer client
}

interface Commande {
  id: number;
  numero: string;
  statut: "recue" | "preparation" | "prete" | "retiree";
  date: string;
  total: number;
  nb_produits: number;
}

interface Produit {
  id: number;
  nom: string;
  laboratoire: string;
  prix: number;
  prix_vente?: number;
  image?: string;
  en_stock: boolean;
  ordonnance: boolean;
}

/* ═══════════════════════════════════════════════════════════════
   DESIGN TOKENS
   ═══════════════════════════════════════════════════════════════ */
const EASE = [0.22, 1, 0.36, 1] as const;

/* ═══════════════════════════════════════════════════════════════
   COMPOSANTS INTERNES
   ═══════════════════════════════════════════════════════════════ */

/** Ligne de menu style iOS Settings */
function MenuRow({
  icon: Icon,
  iconBg,
  iconColor,
  label,
  value,
  badge,
  onClick,
  disabled = false,
  soon = false,
}: {
  icon: React.ElementType;
  iconBg: string;
  iconColor: string;
  label: string;
  value?: string;
  badge?: string;
  onClick?: () => void;
  disabled?: boolean;
  soon?: boolean;
}) {
  return (
    <button
      onClick={disabled ? undefined : onClick}
      className={`w-full flex items-center gap-3 px-4 h-[52px] text-left transition-colors border-b border-black/5 dark:border-white/5 last:border-b-0 ${
        disabled
          ? "opacity-40 cursor-not-allowed"
          : "active:bg-gray-50 dark:active:bg-white/5 cursor-pointer"
      }`}
      style={{ background: "transparent", border: "none", borderBottom: "1px solid rgba(0,0,0,0.04)" }}
    >
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${iconBg}`}>
        <Icon className={`w-[18px] h-[18px] ${iconColor}`} strokeWidth={2} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-[15px] font-medium text-gray-900 dark:text-gray-100">
            {label}
          </span>
          {soon && (
            <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-gray-100 dark:bg-gray-800 text-gray-500 uppercase tracking-wide">
              Bientôt
            </span>
          )}
        </div>
      </div>
      {value && !disabled && (
        <span className="text-sm text-gray-400 truncate max-w-[120px]">{value}</span>
      )}
      {!disabled && <ChevronRight className="w-4 h-4 text-gray-300 shrink-0" />}
    </button>
  );
}

/** Card conteneur de section */
function SectionCard({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`bg-white dark:bg-gray-900 rounded-2xl overflow-hidden ring-1 ring-black/5 dark:ring-white/5 ${className}`}
    >
      {children}
    </div>
  );
}

/** Titre de section */
function SectionTitle({ title }: { title: string }) {
  return (
    <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2 px-1">
      {title}
    </h3>
  );
}

/** Mini card produit horizontal (pour aperçu favoris) */
function MiniProduit({ p }: { p: Produit }) {
  const router = useRouter();
  return (
    <button
      onClick={() => router.push(`/produit/${p.id}`)}
      className="flex-shrink-0 w-[120px] text-left"
      style={{ background: "none", border: "none" }}
    >
      <div className="relative aspect-square rounded-2xl overflow-hidden bg-gray-100 dark:bg-gray-800 ring-1 ring-black/5 dark:ring-white/5">
        {p.image ? (
          <Image src={p.image} alt={p.nom} fill className="object-cover" sizes="120px" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-300 dark:text-gray-600">
            <Package className="w-8 h-8" />
          </div>
        )}
      </div>
      <p className="mt-1.5 text-[11px] font-medium text-gray-900 dark:text-gray-100 line-clamp-2 leading-snug">
        {p.nom}
      </p>
      <Prix valeur={p.prix_vente ?? p.prix} className="text-[11px] font-bold text-gray-900 dark:text-gray-100 mt-0.5" />
    </button>
  );
}

/* ═══════════════════════════════════════════════════════════════
   BOTTOM SHEETS
   ═══════════════════════════════════════════════════════════════ */

/** Bottom sheet édition profil */
function EditProfilSheet({
  open,
  onClose,
  data,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  data: ProfilData;
  onSave: (nom: string, telephone: string) => Promise<void>;
}) {
  const [nom, setNom] = useState(data.nom);
  const [tel, setTel] = useState(data.telephone || "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setNom(data.nom);
      setTel(data.telephone || "");
    }
  }, [open, data]);

  const handleSave = async () => {
    setSaving(true);
    await onSave(nom, tel);
    setSaving(false);
    onClose();
  };

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          />
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            className="relative bg-white dark:bg-[#0b1a16] w-full sm:max-w-sm rounded-t-[28px] sm:rounded-[28px] shadow-2xl overflow-hidden border border-black/5 dark:border-white/5"
          >
            <div className="sm:hidden flex justify-center pt-3">
              <div className="h-1.5 w-10 rounded-full bg-gray-200 dark:bg-white/20" />
            </div>
            <div className="px-6 py-4 border-b border-black/5 dark:border-white/5 flex justify-between items-center">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">Modifier le profil</h3>
              <button
                onClick={onClose}
                className="h-9 w-9 flex items-center justify-center rounded-full bg-gray-100 dark:bg-white/5 text-gray-500 border-none"
              >
                <X size={18} />
              </button>
            </div>
            <div className="p-6 space-y-4" style={{ paddingBottom: "calc(1.5rem + env(safe-area-inset-bottom))" }}>
              <div>
                <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                  Nom complet
                </label>
                <input
                  value={nom}
                  onChange={(e) => setNom(e.target.value)}
                  className="w-full h-12 rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 px-4 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                  Téléphone
                </label>
                <input
                  value={tel}
                  onChange={(e) => setTel(e.target.value)}
                  placeholder="Ex: 690 00 00 00"
                  className="w-full h-12 rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 px-4 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                  Email
                </label>
                <div className="w-full h-12 rounded-xl bg-gray-100 dark:bg-gray-800/50 px-4 flex items-center text-sm text-gray-400">
                  {data.email}
                </div>
                <p className="text-[10px] text-gray-400 mt-1">L'email ne peut pas être modifié.</p>
              </div>
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={handleSave}
                disabled={saving}
                className="w-full h-12 rounded-2xl bg-emerald-600 text-white font-bold text-sm flex items-center justify-center gap-2 active:bg-emerald-700 transition-colors border-none disabled:opacity-50"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Enregistrer"}
              </motion.button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

/** Bottom sheet changement mot de passe */
function PasswordSheet({
  open,
  onClose,
  onChange,
}: {
  open: boolean;
  onClose: () => void;
  onChange: (ancien: string, nouveau: string) => Promise<void>;
}) {
  const [ancien, setAncien] = useState("");
  const [nouveau, setNouveau] = useState("");
  const [voir, setVoir] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    if (open) {
      setAncien("");
      setNouveau("");
      setMsg(null);
    }
  }, [open]);

  const handleSubmit = async () => {
    if (nouveau.length < 8) {
      setMsg({ ok: false, text: "8 caractères minimum." });
      return;
    }
    setSaving(true);
    setMsg(null);
    try {
      await onChange(ancien, nouveau);
      setMsg({ ok: true, text: "Mot de passe mis à jour" });
      setTimeout(onClose, 1200);
    } catch (err: any) {
      setMsg({ ok: false, text: err.response?.data?.error || "Échec du changement." });
    } finally {
      setSaving(false);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          />
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            className="relative bg-white dark:bg-[#0b1a16] w-full sm:max-w-sm rounded-t-[28px] sm:rounded-[28px] shadow-2xl overflow-hidden border border-black/5 dark:border-white/5"
          >
            <div className="sm:hidden flex justify-center pt-3">
              <div className="h-1.5 w-10 rounded-full bg-gray-200 dark:bg-white/20" />
            </div>
            <div className="px-6 py-4 border-b border-black/5 dark:border-white/5 flex justify-between items-center">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">Mot de passe</h3>
              <button
                onClick={onClose}
                className="h-9 w-9 flex items-center justify-center rounded-full bg-gray-100 dark:bg-white/5 text-gray-500 border-none"
              >
                <X size={18} />
              </button>
            </div>
            <div className="p-6 space-y-4" style={{ paddingBottom: "calc(1.5rem + env(safe-area-inset-bottom))" }}>
              <div>
                <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                  Mot de passe actuel
                </label>
                <div className="relative">
                  <input
                    type={voir ? "text" : "password"}
                    value={ancien}
                    onChange={(e) => setAncien(e.target.value)}
                    className="w-full h-12 rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 pr-11 pl-4 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                  />
                  <button
                    type="button"
                    onClick={() => setVoir((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 border-none bg-transparent"
                  >
                    {voir ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                  Nouveau mot de passe
                </label>
                <input
                  type={voir ? "text" : "password"}
                  value={nouveau}
                  onChange={(e) => setNouveau(e.target.value)}
                  className="w-full h-12 rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 px-4 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                />
                <p className="text-[10px] text-gray-400 mt-1">8 caractères minimum.</p>
              </div>

              {msg && (
                <p className={`text-xs font-semibold ${msg.ok ? "text-emerald-600" : "text-red-500"}`}>
                  {msg.text}
                </p>
              )}

              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={handleSubmit}
                disabled={saving || !ancien || !nouveau}
                className="w-full h-12 rounded-2xl bg-gray-900 dark:bg-white text-white dark:text-gray-900 font-bold text-sm flex items-center justify-center active:opacity-90 transition-opacity border-none disabled:opacity-30"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Changer le mot de passe"}
              </motion.button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

/* ═══════════════════════════════════════════════════════════════
   PAGE PRINCIPALE
   ═══════════════════════════════════════════════════════════════ */

export default function MonProfil() {
  const router = useRouter();

  /* ─── États données ─── */
  const [data, setData] = useState<ProfilData | null>(null);
  const [commandeActive, setCommandeActive] = useState<Commande | null>(null);
  const [favoris, setFavoris] = useState<Produit[]>([]);
  const [loading, setLoading] = useState(true);

  /* ─── États UI ─── */
  const [showEdit, setShowEdit] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  /* ─── Fetch initial ─── */
  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const [profilRes, cmdRes, favRes] = await Promise.allSettled([
          apiClient.get<ProfilData>("/api/v1/client/me/"),
          apiClient.get<Commande[]>("/api/commandes/dernieres/"),
          apiClient.get<Produit[]>("/api/client/favoris/"),
        ]);

        if (cancelled) return;

        if (profilRes.status === "fulfilled") setData(profilRes.value.data);
        if (cmdRes.status === "fulfilled" && cmdRes.value.data.length > 0) {
          setCommandeActive(cmdRes.value.data[0]);
        }
        if (favRes.status === "fulfilled") setFavoris(favRes.value.data);
      } catch (err) {
        console.error("Erreur profil:", err);
      } finally {
        // Petit délai pour éviter le flash si cache instantané
        setTimeout(() => {
          if (!cancelled) setLoading(false);
        }, 300);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  /* ─── Handlers ─── */
  const handleSaveProfil = async (nom: string, telephone: string) => {
    const res = await apiClient.patch("/api/v1/client/me/", { nom, telephone });
    setData(res.data);
  };

  const handleChangePassword = async (ancien: string, nouveau: string) => {
    await apiClient.post("/api/v1/client/changer-mot-de-passe/", {
      ancien_mot_de_passe: ancien,
      nouveau_mot_de_passe: nouveau,
    });
  };

  const handleDeconnexion = () => {
    localStorage.clear();
    window.location.href = "/login";
  };

  if (loading) return <PageSkeleton variant="profil" />;

  if (!data) {
    return (
      <div className="h-screen flex items-center justify-center text-sm text-gray-400">
        Impossible de charger le profil.
      </div>
    );
  }

  /* ─── Stats dérivées ─── */
  const stats = [
    { label: "Commandes", value: String(data.nb_commandes), icon: ShoppingBag },
    { label: "Dépensé", value: <Prix valeur={data.montant_total_depense} className="text-sm font-bold" />, icon: TrendingUp },
    // TODO(backend): créer endpoint GET /api/client/points-fidelite/ et ajouter ici
    { label: "Points", value: "—", icon: Star, soon: true },
  ];

  return (
    <main className="pb-28 pt-2 px-4 max-w-md mx-auto">
      {/* ═══ HEADER : Avatar centré + Nom ═══ */}
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: EASE }}
        className="flex flex-col items-center pt-6 pb-4"
      >
        {/* Avatar */}
        <div className="relative">
          <div className="w-20 h-20 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center overflow-hidden ring-4 ring-white dark:ring-[#050e0c] shadow-sm">
            {data.photo ? (
              <Image src={data.photo} alt={data.nom} width={80} height={80} className="object-cover" />
            ) : (
              <User className="w-9 h-9 text-emerald-600 dark:text-emerald-400" strokeWidth={1.5} />
            )}
          </div>
          {/* TODO(backend): endpoint POST /api/client/photo/ pour upload avatar */}
          <button
            onClick={() => alert("Upload photo — TODO backend")}
            className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-emerald-600 text-white flex items-center justify-center shadow-md border-2 border-white dark:border-[#050e0c]"
            style={{ border: "none" }}
          >
            <Camera className="w-3.5 h-3.5" />
          </button>
        </div>

        <h1 className="mt-3 text-xl font-bold text-gray-900 dark:text-gray-100 text-center">
          {data.nom}
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
          {data.telephone || "Aucun téléphone"}
        </p>
        <div className="mt-2 flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 text-[11px] font-semibold">
          <ShieldCheck className="w-3 h-3" />
          Client vérifié
        </div>
      </motion.section>

      {/* ═══ STATS ═══ */}
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: EASE, delay: 0.08 }}
        className="mt-2"
      >
        <SectionCard>
          <div className="grid grid-cols-3 divide-x divide-black/5 dark:divide-white/5">
            {stats.map((s) => (
              <div key={s.label} className="flex flex-col items-center py-4 gap-1 relative">
                {s.soon && (
                  <span className="absolute top-2 right-2 text-[8px] font-bold text-gray-400 uppercase bg-gray-100 dark:bg-gray-800 px-1 rounded">
                    Bientôt
                  </span>
                )}
                <s.icon className={`w-4 h-4 ${s.soon ? "text-gray-300" : "text-emerald-500"}`} />
                <div className={`text-sm font-bold ${s.soon ? "text-gray-400" : "text-gray-900 dark:text-gray-100"}`}>
                  {s.value}
                </div>
                <span className="text-[10px] font-medium text-gray-400 uppercase tracking-wide">
                  {s.label}
                </span>
              </div>
            ))}
          </div>
        </SectionCard>
      </motion.section>

      {/* ═══ COMMANDE EN COURS ═══ */}
      {commandeActive && (
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: EASE, delay: 0.16 }}
          className="mt-5"
        >
          <div className="flex items-center justify-between mb-2 px-1">
            <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
              En cours
            </h3>
            <button
              onClick={() => router.push("/commandes")}
              className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-0.5 border-none bg-transparent"
            >
              Voir tout <ChevronRight className="w-3 h-3" />
            </button>
          </div>
          <SectionCard>
            <button
              onClick={() => router.push(`/commandes/${commandeActive.id}`)}
              className="w-full flex items-center gap-3 p-4 text-left active:bg-gray-50 dark:active:bg-white/5 transition-colors"
              style={{ background: "none", border: "none" }}
            >
              <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center shrink-0">
                <Package className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                  Commande #{commandeActive.numero}
                </p>
                <p className="text-[11px] text-gray-500 mt-0.5 flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {new Date(commandeActive.date).toLocaleDateString("fr-FR")}
                  <span className="mx-1">·</span>
                  {commandeActive.nb_produits} produit{commandeActive.nb_produits > 1 ? "s" : ""}
                </p>
              </div>
              <div className="text-right">
                <Prix valeur={commandeActive.total} className="text-sm font-bold text-gray-900 dark:text-gray-100" />
              </div>
            </button>
          </SectionCard>
        </motion.section>
      )}

      {/* ═══ FAVORIS ═══ */}
      {favoris.length > 0 && (
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: EASE, delay: 0.24 }}
          className="mt-5"
        >
          <div className="flex items-center justify-between mb-2 px-1">
            <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
              Favoris
            </h3>
            <button
              onClick={() => router.push("/profil?tab=favoris")} // ou page dédiée
              className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-0.5 border-none bg-transparent"
            >
              Voir tout <ChevronRight className="w-3 h-3" />
            </button>
          </div>
          <div className="flex gap-3 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden pb-2 -mx-4 px-4">
            {favoris.slice(0, 6).map((p) => (
              <MiniProduit key={p.id} p={p} />
            ))}
          </div>
        </motion.section>
      )}

      {/* ═══ MON COMPTE ═══ */}
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: EASE, delay: 0.32 }}
        className="mt-5"
      >
        <SectionTitle title="Mon compte" />
        <SectionCard>
          <MenuRow
            icon={User}
            iconBg="bg-blue-50 dark:bg-blue-900/20"
            iconColor="text-blue-600 dark:text-blue-400"
            label="Informations personnelles"
            value={data.nom}
            onClick={() => setShowEdit(true)}
          />
          <MenuRow
            icon={Lock}
            iconBg="bg-amber-50 dark:bg-amber-900/20"
            iconColor="text-amber-600 dark:text-amber-400"
            label="Mot de passe"
            onClick={() => setShowPassword(true)}
          />
          <MenuRow
            icon={MapPin}
            iconBg="bg-rose-50 dark:bg-rose-900/20"
            iconColor="text-rose-600 dark:text-rose-400"
            label="Mes adresses"
            disabled
            soon
            // TODO(backend): créer modèle Adresse (client FK, libellé, quartier, ville, defaut)
            // + endpoints: GET/POST/PATCH/DELETE /api/client/adresses/
            // + intégrer dans la commande (choix adresse de retrait)
          />
          <MenuRow
            icon={FileText}
            iconBg="bg-purple-50 dark:bg-purple-900/20"
            iconColor="text-purple-600 dark:text-purple-400"
            label="Mes factures"
            onClick={() => router.push("/commandes")}
          />
        </SectionCard>
      </motion.section>

      {/* ═══ PRÉFÉRENCES ═══ */}
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: EASE, delay: 0.40 }}
        className="mt-5"
      >
        <SectionTitle title="Préférences" />
        <SectionCard>
          <MenuRow
            icon={Bell}
            iconBg="bg-sky-50 dark:bg-sky-900/20"
            iconColor="text-sky-600 dark:text-sky-400"
            label="Notifications"
            disabled
            soon
            // TODO(backend): table NotificationPreference (client FK, push_email, push_sms,
            // promotions, commande_prete). Endpoints: GET/PATCH /api/client/notifications/
          />
          <MenuRow
            icon={Globe}
            iconBg="bg-indigo-50 dark:bg-indigo-900/20"
            iconColor="text-indigo-600 dark:text-indigo-400"
            label="Langue"
            value="Français"
            disabled
            soon
            // TODO(backend): i18n setup + table LanguagePreference ou localStorage suffisant?
          />
        </SectionCard>
      </motion.section>

      {/* ═══ SUPPORT ═══ */}
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: EASE, delay: 0.48 }}
        className="mt-5"
      >
        <SectionTitle title="Support" />
        <SectionCard>
          <MenuRow
            icon={MessageCircle}
            iconBg="bg-emerald-50 dark:bg-emerald-900/20"
            iconColor="text-emerald-600 dark:text-emerald-400"
            label="Contacter la pharmacie"
            disabled
            soon
            // TODO(backend): modèle TicketSupport (client FK, sujet, message, statut,
            // date_creation). Endpoints: GET/POST /api/support/tickets/ + messages nested.
          />
          <MenuRow
            icon={HelpCircle}
            iconBg="bg-gray-50 dark:bg-gray-800"
            iconColor="text-gray-600 dark:text-gray-400"
            label="Centre d'aide"
            disabled
            soon
            // TODO(backend): modèle FAQArticle (titre, contenu, categorie, ordre).
            // Endpoint: GET /api/support/faq/
          />
        </SectionCard>
      </motion.section>

      {/* ═══ DÉCONNEXION ═══ */}
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: EASE, delay: 0.56 }}
        className="mt-8 mb-4"
      >
        <button
          onClick={handleDeconnexion}
          className="w-full h-12 rounded-2xl bg-red-50 dark:bg-red-900/10 text-red-600 dark:text-red-400 font-semibold text-sm flex items-center justify-center gap-2 active:bg-red-100 dark:active:bg-red-900/20 transition-colors border-none"
        >
          <LogOut className="w-4 h-4" />
          Déconnexion
        </button>
        <p className="text-center text-[11px] text-gray-400 mt-3">
          Pharmacie+ v1.0 · {data.identifiant}
        </p>
      </motion.section>

      {/* ═══ BOTTOM SHEETS ═══ */}
      <EditProfilSheet
        open={showEdit}
        onClose={() => setShowEdit(false)}
        data={data}
        onSave={handleSaveProfil}
      />
      <PasswordSheet
        open={showPassword}
        onClose={() => setShowPassword(false)}
        onChange={handleChangePassword}
      />
    </main>
  );
}