// Initialisation Sentry côté SERVEUR (runtime Node.js -- SSR, API routes, etc.).
// Chargé par instrumentation.ts, jamais importé directement ailleurs.
import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  // 🔒 Confidentialité -- cohérent avec send_default_pii=False côté backend (config/settings.py).
  // Remplace sendDefaultPii (retiré dans cette version du SDK) par dataCollection, dont
  // les valeurs par défaut sont permissives (cookies, headers HTTP, query params, variables
  // locales des stack traces TOUS collectés par défaut) -- inacceptable pour une app qui
  // manipule des ordonnances/données de santé. On désactive explicitement.
  dataCollection: {
    userInfo: false,
    cookies: false,
    httpHeaders: false,
    urlQueryParams: false,
    stackFrameVariables: false,
  },
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
  environment: process.env.NODE_ENV,
  enabled: !!process.env.NEXT_PUBLIC_SENTRY_DSN,
});
