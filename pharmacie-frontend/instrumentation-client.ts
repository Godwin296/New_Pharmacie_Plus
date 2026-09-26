// Initialisation Sentry côté NAVIGATEUR (client).
//
// Convention Next.js 16 / @sentry/nextjs 11 : ce fichier remplace l'ancien
// sentry.client.config.ts (déprécié), détecté automatiquement par Next.js -- ne pas
// renommer ni déplacer. Voir sentry.server.config.ts et sentry.edge.config.ts pour les
// deux autres runtimes (Node.js / Edge), chargés eux via instrumentation.ts.
//
// DSN : voir .env.local (NEXT_PUBLIC_SENTRY_DSN) -- volontairement une variable
// NEXT_PUBLIC_* : contrairement à une clé API, une DSN Sentry est CONÇUE pour être
// publique (elle ne permet que d'ENVOYER des événements, jamais de les lire).
import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Sécurité : cohérent avec le backend (config/settings.py) -- ne jamais envoyer les
  // tokens JWT, mots de passe ou données personnelles dans les payloads Sentry.
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

  // Taux d'échantillonnage des performances : 10% en production (même logique que le
  // backend), 100% en dev pour ne rien rater pendant le développement.
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,

  environment: process.env.NODE_ENV,

  // Désactivé tant qu'aucune DSN n'est fournie (dev sans .env.local configuré) --
  // évite un warning Sentry bruyant dans la console à chaque rechargement de page.
  enabled: !!process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Traduit automatiquement les liens 404/erreurs entre les changements de page côté
  // client (App Router) dans les traces Sentry -- utile pour repérer les navigations
  // qui échouent.
  ...(process.env.NEXT_PUBLIC_SENTRY_DSN && {
    integrations: [Sentry.browserTracingIntegration()],
  }),
});

// Instrumente les transitions de route du App Router (nécessite @sentry/nextjs >= 9.12).
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
