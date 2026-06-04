import type { NextConfig } from "next";
import withPWAInit from "@ducanh2912/next-pwa";

// 🌟 CONFIGURATION PWA ULTRA-STABLE POUR TYPESCRIPT
const withPWA = withPWAInit({
  dest: "public",
  disable: process.env.NODE_ENV === "development", // Désactivé en développement pour ne pas ralentir tes rafraîchissements
  register: true,
});

const nextConfig: NextConfig = {
  /* Tes futures options de configuration Next.js (ex: domaines d'images) */
  turbopack: {},
};

export default withPWA(nextConfig);
