import type { NextConfig } from "next";

// Autorise le serveur de dev à répondre aux requêtes venant d'une origine
// externe (ex. un tunnel VS Code / devtunnels.ms) en plus de localhost.
// Renseigner NEXT_DEV_TUNNEL_ORIGIN dans .env.local (jamais commité), avec
// le nom d'hôte du tunnel (sans https://), ex :
//   NEXT_DEV_TUNNEL_ORIGIN=abc123-3000.euw.devtunnels.ms
// Plusieurs origines possibles, séparées par des virgules.
const extraDevOrigins = (process.env.NEXT_DEV_TUNNEL_ORIGIN ?? "")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

const nextConfig: NextConfig = {
  allowedDevOrigins: extraDevOrigins,
};

export default nextConfig;
