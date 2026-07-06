import type { NextConfig } from "next";
import { withSerwist } from "@serwist/turbopack";

const nextConfig: NextConfig = {
  turbopack: {},
  // ⚠️ ANCIEN FIX RETIRÉ (invalide) : on avait tenté de déplacer distDir vers C:\
  // via NEXT_DIST_DIR pour contourner un disque D:\ lent. Erreur constatée en le
  // testant réellement : "distDir should not leave your project directory" est une
  // règle DURE de Next.js (https://nextjs.org/docs/app/api-reference/config/next-config-js/distDir).
  // Le mécanisme concatène le chemin projet + distDir SANS gérer un chemin absolu sur
  // un autre disque (path.join, pas path.resolve) → ENOENT garanti dès que la variable
  // est réellement définie. Ne JAMAIS remettre NEXT_DIST_DIR dans .env.local.
  //
  // La vraie mitigation pour un disque lent reste turbopackFileSystemCacheForDev: false
  // ci-dessous, complétée par l'exclusion antivirus. Si ça ne suffit pas, la seule
  // option qui marche vraiment est de déplacer TOUT le projet sur C:\.
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
