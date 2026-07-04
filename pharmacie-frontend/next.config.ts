import type { NextConfig } from "next";
import { withSerwist } from "@serwist/turbopack";

const nextConfig: NextConfig = {
  turbopack: {},
};

const configAvecSerwist = withSerwist(nextConfig);

// Sentry ne s'applique QU'EN PRODUCTION (build) pour éviter les panics Turbopack en dev.
// En dev local (npm run dev), on exporte directement sans Sentry pour garder Turbopack stable.
// En production (npm run build), withSentryConfig s'active si NEXT_PUBLIC_SENTRY_DSN est défini.
const isProd = process.env.NODE_ENV === 'production';

async function getConfig() {
  if (isProd && process.env.NEXT_PUBLIC_SENTRY_DSN) {
    const { withSentryConfig } = await import('@sentry/nextjs');
    return withSentryConfig(configAvecSerwist, {
      org: process.env.SENTRY_ORG || '',
      project: process.env.SENTRY_PROJECT || 'pharmacie-plus',
      silent: !process.env.CI,
    });
  }
  return configAvecSerwist;
}

export default getConfig();
