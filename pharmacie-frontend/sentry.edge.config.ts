// sentry.edge.config.ts
// Chargé pour les Edge Functions et le Middleware Next.js.

import * as Sentry from "@sentry/nextjs";

const SENTRY_DSN = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (SENTRY_DSN) {
  Sentry.init({
    dsn: SENTRY_DSN,
    tracesSampleRate: 0.05,
    sendDefaultPii: false,
    environment: process.env.NODE_ENV,
  });
}
