import type { NextConfig } from "next";
import { withSerwist } from "@serwist/turbopack";

const nextConfig: NextConfig = {
  /* Tes futures options de configuration Next.js (ex: domaines d'images) */
  turbopack: {},
};

export default withSerwist(nextConfig);
