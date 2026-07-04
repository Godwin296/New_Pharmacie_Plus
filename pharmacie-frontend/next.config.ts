import type { NextConfig } from "next";
import { withSerwist } from "@serwist/turbopack";

const nextConfig: NextConfig = {
  turbopack: {},
};

// Sentry est géré uniquement via les fichiers sentry.*.config.ts (chargés
// automatiquement par Next.js). Le paquet @sentry/nextjs n'est pas compatible
// avec Next.js 16 pour l'instant — on l'intégrera quand une version compatible
// sortira. Les fichiers de config restent en place pour ne pas perdre la config.
export default withSerwist(nextConfig);
