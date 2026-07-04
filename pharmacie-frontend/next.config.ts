import type { NextConfig } from "next";
import { withSerwist } from "@serwist/turbopack";

const nextConfig: NextConfig = {
  turbopack: {},
  // 🔧 FIX PANIC TURBOPACK SUR WINDOWS : Next.js 16 écrit ses fichiers de build dans
  // .next/ qui peut se trouver sur un disque lent (OneDrive, réseau, D:\...).
  // Le filesystem lent cause des timeouts internes à Turbopack → "FATAL panic".
  // Variable NEXT_DIST_DIR optionnelle : si définie dans .env.local, déplace .next
  // vers un chemin local et rapide (ex: C:\temp\pharmacie-next).
  distDir: process.env.NEXT_DIST_DIR || '.next',
  experimental: {
    // 🔧 FIX PANIC RÉCURRENT "FATAL: An unexpected Turbopack error occurred" :
    // Next.js 16 active PAR DÉFAUT un cache disque persistant pour Turbopack
    // (turbopackFileSystemCacheForDev), qui écrit/relit en continu dans .next/cache
    // pendant que le serveur tourne. Sur un disque Windows lent (le warning
    // "Slow filesystem detected" le confirme dans ton cas), ces écritures
    // périodiques timeout et Turbopack panique — mais le process survit,
    // d'où l'impression de "boucle infinie" avec des requêtes qui continuent
    // à répondre entre deux panics.
    // On désactive ce cache : la compilation à froid sera un peu plus lente,
    // mais plus aucune écriture disque périodique en arrière-plan = plus de panic.
    // Documenté ici : https://nextjs.org/docs/app/api-reference/config/next-config-js/turbopackFileSystemCache
    turbopackFileSystemCacheForDev: false,
  },
};

export default withSerwist(nextConfig);
