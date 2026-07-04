import type { NextConfig } from "next";
import { withSerwist } from "@serwist/turbopack";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  turbopack: {},
};

const configAvecSerwist = withSerwist(nextConfig);

// Sentry wrapping : actif uniquement si NEXT_PUBLIC_SENTRY_DSN est défini.
// En dev local (sans DSN), withSentryConfig est un simple pass-through transparent.
export default withSentryConfig(configAvecSerwist, {
  // DSN pour l'upload des source maps (permet de voir le vrai code dans Sentry,
  // pas le code minifié). Laisser vide en dev, remplir en prod.
  org: process.env.SENTRY_ORG || "",
  project: process.env.SENTRY_PROJECT || "pharmacie-plus",

  // Désactive l'upload des source maps en dev pour ne pas ralentir le build.
  silent: !process.env.CI,
});
