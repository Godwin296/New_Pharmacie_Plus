"use client";

import { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import {
  Search, ShoppingCart, Pill, Zap, Sun, Tablets, HeartPulse,
  Droplets, ScanFace, Eye, Wind, Leaf, ChevronRight, Clock,
  Package, Plus, User, LogIn, ArrowRight, TrendingUp,
} from "lucide-react";
import { useConfigPharmacie } from "@/lib/context/ConfigPharmacieContext";
import apiClient from "@/lib/apiClient";
import Prix from "@/lib/components/Prix";
import PageSkeleton from "@/lib/components/PageSkeleton";

/* ─── Types ─── */
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

interface Commande {
  id: number;
  numero: string;
  statut: "recue" | "preparation" | "prete" | "retiree";
  date: string;
  total: number;
  nb_produits: number;
}

interface Client {
  id: number;
  nom: string;
  prenom: string;
}

/* ─── Design tokens ─── */
const EASE_OUT_EXPO = [0.22, 1, 0.36, 1] as const;

const CATEGORIES = [
  { id: "antibiotiques", nom: "Antibiotiques", icone: Pill, bg: "bg-rose-50 text-rose-600 dark:bg-rose-950/30 dark:text-rose-400" },
  { id: "antalgiques", nom: "Antalgiques", icone: Zap, bg: "bg-amber-50 text-amber-600 dark:bg-amber-950/30 dark:text-amber-400" },
  { id: "vitamines", nom: "Vitamines", icone: Sun, bg: "bg-yellow-50 text-yellow-600 dark:bg-yellow-950/30 dark:text-yellow-400" },
  { id: "digestion", nom: "Digestion", icone: Tablets, bg: "bg-orange-50 text-orange-600 dark:bg-orange-950/30 dark:text-orange-400" },
  { id: "cardio", nom: "Cardio & Tension", icone: HeartPulse, bg: "bg-red-50 text-red-600 dark:bg-red-950/30 dark:text-red-400" },
  { id: "diabete", nom: "Diabète", icone: Droplets, bg: "bg-sky-50 text-sky-600 dark:bg-sky-950/30 dark:text-sky-400" },
  { id: "dermato", nom: "Dermatologie", icone: ScanFace, bg: "bg-pink-50 text-pink-600 dark:bg-pink-950/30 dark:text-pink-400" },
  { id: "ophtalmo", nom: "Ophtalmologie", icone: Eye, bg: "bg-indigo-50 text-indigo-600 dark:bg-indigo-950/30 dark:text-indigo-400" },
  { id: "orl", nom: "ORL & Toux", icone: Wind, bg: "bg-cyan-50 text-cyan-600 dark:bg-cyan-950/30 dark:text-cyan-400" },
  { id: "homeopathie", nom: "Homéopathie", icone: Leaf, bg: "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-400" },
];

/* ─── Helpers ─── */
function getEtapesCommande(statut: string) {
  const etapes = [
    { key: "recue", label: "Reçue" },
    { key: "preparation", label: "Préparation" },
    { key: "prete", label: "Prête" },
    { key: "retiree", label: "Retirée" },
  ];
  const idx = etapes.findIndex((e) => e.key === statut);
  return etapes.map((e, i) => ({ ...e, done: i <= idx }));
}

/* ─── Section Title ─── */
function SectionTitle({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  return (
    <div className="flex items-center justify-between mb-3 px-1">
      <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100" style={{ fontFamily: "Poppins, sans-serif" }}>
        {title}
      </h2>
      {action && (
        <button onClick={onAction} className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-0.5 active:opacity-60 transition-opacity">
          {action}
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}

/* ─── Product Card ─── */
function ProductCard({ produit, index, badge }: { produit: Produit; index: number; badge?: string }) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);

  const handleAdd = useCallback(
    async (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setAdding(true);
      try {
        await apiClient.post("/api/panier/ajouter/", { produit_id: produit.id, quantite: 1 });
      } catch { /* offline queue prend le relais */ }
      finally { setTimeout(() => setAdding(false), 400); }
    },
    [produit.id]
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: EASE_OUT_EXPO, delay: index * 0.06 }}
      className="w-[156px] flex-shrink-0 snap-start"
    >
      <Link href={`/produit/${produit.id}`} className="block group">
        <div className="relative aspect-square rounded-[20px] overflow-hidden bg-gray-100 dark:bg-gray-800 ring-1 ring-black/5 dark:ring-white/10 shadow-sm">
          {produit.image ? (
            <Image
              src={produit.image}
              alt={produit.nom}
              fill
              className="object-cover transition-transform duration-500 group-active:scale-105"
              sizes="156px"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-gray-300 dark:text-gray-600">
              <Package className="w-10 h-10" />
            </div>
          )}

          {badge && (
            <span className="absolute top-2 left-2 px-2 py-0.5 rounded-full bg-emerald-600 text-white text-[9px] font-bold uppercase tracking-wide shadow-sm flex items-center gap-1">
              <TrendingUp className="w-3 h-3" />
              {badge}
            </span>
          )}

          {produit.ordonnance && !badge && (
            <span className="absolute top-2 left-2 px-2 py-0.5 rounded-full bg-amber-500 text-white text-[9px] font-bold uppercase tracking-wide shadow-sm">
              Ordonnance
            </span>
          )}

          <span
            className={`absolute top-2 right-2 w-2.5 h-2.5 rounded-full border-2 border-white dark:border-gray-900 shadow-sm ${
              produit.en_stock ? "bg-emerald-500" : "bg-red-500"
            }`}
          />
        </div>

        <div className="mt-2.5 px-0.5">
          <h3 className="font-semibold text-[13px] leading-snug line-clamp-2 text-gray-900 dark:text-gray-100">
            {produit.nom}
          </h3>
          <p className="text-[11px] text-gray-500 mt-0.5 truncate">{produit.laboratoire}</p>

          <div className="flex items-center justify-between mt-2">
            <Prix valeur={produit.prix_vente ?? produit.prix} className="font-bold text-sm text-gray-900 dark:text-gray-100" />
            <motion.button
              whileTap={{ scale: 0.78 }}
              onClick={handleAdd}
              disabled={adding || !produit.en_stock}
              className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
                produit.en_stock
                  ? "bg-emerald-600 text-white active:bg-emerald-700 shadow-sm shadow-emerald-900/20"
                  : "bg-gray-200 text-gray-400 dark:bg-gray-700 dark:text-gray-500 cursor-not-allowed"
              }`}
            >
              <Plus className="w-4 h-4" />
            </motion.button>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}

/* ─── Page principale ─── */
export default function HomePage() {
  const router = useRouter();
  const { config } = useConfigPharmacie();

  const [phase, setPhase] = useState<"splash" | "skeleton" | "content">("splash");
  const [client, setClient] = useState<Client | null>(null);
  const [favoris, setFavoris] = useState<Produit[]>([]);
  const [populaires, setPopulaires] = useState<Produit[]>([]);
  const [commandeActive, setCommandeActive] = useState<Commande | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  /* Séquence : splash → skeleton → contenu */
  useEffect(() => {
    const t1 = setTimeout(() => setPhase("skeleton"), 1500);
    return () => clearTimeout(t1);
  }, []);

  useEffect(() => {
    if (phase !== "skeleton") return;
    let cancelled = false;

    async function load() {
      try {
        const [meRes, popRes] = await Promise.allSettled([
          apiClient.get<Client>("/api/client/me/"),
          apiClient.get<{ results?: Produit[] }>("/api/produits/?page=1&page_size=10"),
        ]);

        if (cancelled) return;

        if (meRes.status === "fulfilled") {
          setClient(meRes.value.data);
          const [favRes, cmdRes] = await Promise.allSettled([
            apiClient.get<Produit[]>("/api/client/favoris/"),
            apiClient.get<Commande[]>("/api/commandes/dernieres/"),
          ]);
          if (!cancelled) {
            if (favRes.status === "fulfilled") setFavoris(favRes.value.data);
            if (cmdRes.status === "fulfilled" && cmdRes.value.data.length > 0) {
              setCommandeActive(cmdRes.value.data[0]);
            }
          }
        }

        if (popRes.status === "fulfilled" && !cancelled) {
          setPopulaires(popRes.value.data.results ?? []);
        }
      } catch { /* silencieux */ }
      finally {
        // ⭐ Minimum 600ms de skeleton même si tout est en cache
        setTimeout(() => {
          if (!cancelled) setPhase("content");
        }, 600);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [phase]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      router.push(`/catalogue?q=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  if (phase === "splash") return null;
  if (phase === "skeleton") return <PageSkeleton variant="home" />;

  const etapes = commandeActive ? getEtapesCommande(commandeActive.statut) : [];

  return (
    <motion.main
      key="home-content"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.35 }}
      className="pb-28 pt-2 px-4 max-w-md mx-auto"
    >
      {/* ═══ HERO ═══ */}
      <motion.section
        initial={{ opacity: 0, y: 28 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease: EASE_OUT_EXPO, delay: 0 }}
        className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-900 to-[#04241a] text-white p-6 shadow-lg shadow-emerald-900/20"
      >
        <div className="relative z-10">
          <p className="text-emerald-200 text-xs font-medium tracking-wide uppercase mb-1" style={{ fontFamily: "JetBrains Mono, monospace" }}>
            {config?.nom ?? "Votre pharmacie"}
          </p>
          <h1 className="text-[26px] font-bold leading-tight mb-5" style={{ fontFamily: "Poppins, sans-serif" }}>
            Commandez en ligne,
            <br />
            retirez au guichet
          </h1>

          <form onSubmit={handleSearch} className="relative mb-4">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-200/70" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Rechercher un médicament..."
              className="w-full h-11 pl-10 pr-4 rounded-full bg-white/10 backdrop-blur-md border border-white/15 text-sm text-white placeholder:text-white/45 focus:outline-none focus:ring-2 focus:ring-emerald-400/40 transition-all"
            />
          </form>

          <motion.button
            whileTap={{ scale: 0.96 }}
            onClick={() => router.push("/catalogue")}
            className="w-full h-12 rounded-2xl bg-white text-emerald-900 font-bold text-sm flex items-center justify-center gap-2 shadow-md active:bg-gray-100 transition-colors"
          >
            <ShoppingCart className="w-4 h-4" />
            Parcourir le catalogue
          </motion.button>
        </div>

        {/* Texture subtile */}
        <div className="absolute -bottom-10 -right-10 w-48 h-48 rounded-full bg-emerald-500/8 blur-3xl pointer-events-none" />
        <div className="absolute -top-10 -left-10 w-32 h-32 rounded-full bg-emerald-400/5 blur-2xl pointer-events-none" />
      </motion.section>

      {/* ═══ CATÉGORIES ═══ */}
      <motion.section
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: EASE_OUT_EXPO, delay: 0.1 }}
        className="mt-6"
      >
        <SectionTitle title="Catégories" />
        <div className="flex gap-2.5 overflow-x-auto snap-x snap-mandatory [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden pb-2 -mx-4 px-4">
          {CATEGORIES.map((cat) => (
            <motion.button
              key={cat.id}
              whileTap={{ scale: 0.9 }}
              onClick={() => router.push(`/catalogue?categorie=${cat.id}`)}
              className={`flex-shrink-0 snap-start flex items-center gap-2 px-4 py-3 rounded-2xl ${cat.bg} active:opacity-80 transition-opacity ring-1 ring-black/5 dark:ring-white/5`}
            >
              <cat.icone className="w-[18px] h-[18px]" strokeWidth={2.2} />
              <span className="text-sm font-semibold whitespace-nowrap">
                {cat.nom}
              </span>
            </motion.button>
          ))}
        </div>
      </motion.section>

      {/* ═══ COMMANDE EN COURS ═══ */}
      {commandeActive && (
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: EASE_OUT_EXPO, delay: 0.18 }}
          className="mt-6"
        >
          <SectionTitle
            title="Commande en cours"
            action="Détails"
            onAction={() => router.push(`/commandes/${commandeActive.id}`)}
          />
          <div className="rounded-2xl bg-white dark:bg-gray-900 p-4 shadow-sm ring-1 ring-black/5 dark:ring-white/10">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400 font-mono">
                  N° {commandeActive.numero}
                </p>
                <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 mt-0.5">
                  {commandeActive.nb_produits} produit{commandeActive.nb_produits > 1 ? "s" : ""}
                </p>
              </div>
              <div className="text-right">
                <Prix valeur={commandeActive.total} className="text-sm font-bold text-gray-900 dark:text-gray-100" />
                <p className="text-[11px] text-gray-500 mt-0.5 flex items-center justify-end gap-1">
                  <Clock className="w-3 h-3" />
                  {new Date(commandeActive.date).toLocaleDateString("fr-FR")}
                </p>
              </div>
            </div>

            {/* Timeline animée */}
            <div className="relative mt-3">
              <div className="absolute top-[7px] left-0 right-0 h-0.5 bg-gray-100 dark:bg-gray-800 rounded-full" />
              <motion.div
                className="absolute top-[7px] left-0 h-0.5 bg-emerald-500 rounded-full"
                initial={{ width: "0%" }}
                animate={{ width: `${((etapes.filter((e) => e.done).length - 1) / (etapes.length - 1)) * 100}%` }}
                transition={{ duration: 1.4, ease: EASE_OUT_EXPO, delay: 0.5 }}
              />
              <div className="relative flex justify-between">
                {etapes.map((etape, i) => (
                  <div key={etape.key} className="flex flex-col items-center gap-1.5">
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ delay: 0.4 + i * 0.12, type: "spring", stiffness: 400, damping: 18 }}
                      className={`w-3.5 h-3.5 rounded-full border-2 ${
                        etape.done
                          ? "bg-emerald-500 border-emerald-500"
                          : "bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-600"
                      }`}
                    />
                    <span className={`text-[10px] font-semibold ${etape.done ? "text-emerald-600 dark:text-emerald-400" : "text-gray-400"}`}>
                      {etape.label}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </motion.section>
      )}

      {/* ═══ FAVORIS ═══ */}
      {client && favoris.length > 0 && (
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: EASE_OUT_EXPO, delay: 0.26 }}
          className="mt-6"
        >
          <SectionTitle
            title="Vos favoris"
            action="Tout voir"
            onAction={() => router.push("/profil?tab=favoris")}
          />
          <div className="flex gap-3 overflow-x-auto snap-x snap-mandatory [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden pb-2 -mx-4 px-4">
            {favoris.map((p, i) => (
              <ProductCard key={p.id} produit={p} index={i} />
            ))}
          </div>
        </motion.section>
      )}

      {/* ═══ POPULAIRES ═══ */}
      <motion.section
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: EASE_OUT_EXPO, delay: 0.34 }}
        className="mt-6"
      >
        <SectionTitle
          title="Les plus demandés"
          action="Catalogue"
          onAction={() => router.push("/catalogue")}
        />
        <div className="flex gap-3 overflow-x-auto snap-x snap-mandatory [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden pb-2 -mx-4 px-4">
          {populaires.length > 0 ? (
            populaires.map((p, i) => (
              <ProductCard key={p.id} produit={p} index={i} badge={i === 0 ? "Top" : undefined} />
            ))
          ) : (
            <div className="w-full py-8 text-center text-sm text-gray-400">Aucun produit populaire pour le moment</div>
          )}
        </div>
      </motion.section>

      {/* ═══ GUEST CTA ═══ */}
      {!client && (
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: EASE_OUT_EXPO, delay: 0.42 }}
          className="mt-6"
        >
          <div className="rounded-2xl bg-gray-50 dark:bg-gray-900/50 p-5 text-center ring-1 ring-black/5 dark:ring-white/5">
            <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto mb-3">
              <User className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100 mb-1">Connectez-vous pour commander</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">Accédez à vos favoris et suivez vos commandes en temps réel.</p>
            <div className="flex gap-3">
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={() => router.push("/login")}
                className="flex-1 h-11 rounded-xl bg-emerald-600 text-white text-sm font-bold flex items-center justify-center gap-2 active:bg-emerald-700 transition-colors shadow-sm shadow-emerald-900/15"
              >
                <LogIn className="w-4 h-4" />
                Se connecter
              </motion.button>
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={() => router.push("/catalogue")}
                className="flex-1 h-11 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm font-bold flex items-center justify-center gap-2 ring-1 ring-black/8 dark:ring-white/10 active:bg-gray-50 dark:active:bg-gray-700 transition-colors"
              >
                Explorer
                <ArrowRight className="w-4 h-4" />
              </motion.button>
            </div>
          </div>
        </motion.section>
      )}

      <div className="h-6" />
    </motion.main>
  );
}