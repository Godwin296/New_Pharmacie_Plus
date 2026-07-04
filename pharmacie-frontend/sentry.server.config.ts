// sentry.server.config.ts
// Chargé automatiquement par Next.js côté serveur (SSR, API routes, Server Components).

import * as Sentry from "@sentry/nextjs";

const SENTRY_DSN = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (SENTRY_DSN) {
  Sentry.init({
    dsn: SENTRY_DSN,
    tracesSampleRate: 0.05,
    sendDefaultPii: false,
    environment: process.env.NODE_ENV,
    release: process.env.NEXT_PUBLIC_APP_VERSION || "dev",
  });
}
