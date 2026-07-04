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
};

export default withSerwist(nextConfig);
