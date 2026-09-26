// Hook d'instrumentation Next.js -- exécuté UNE FOIS au démarrage de chaque instance
// serveur, avant que le serveur ne commence à traiter des requêtes. Sert ici à charger
// la bonne configuration Sentry selon le runtime réel (Node.js classique vs Edge),
// qui ne sont pas interchangeables (APIs disponibles différentes).
// Doc : https://nextjs.org/docs/app/guides/instrumentation
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./sentry.server.config');
  }
  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('./sentry.edge.config');
  }
}

// Capture automatiquement les erreurs serveur non gérées (Server Components, Server
// Actions, Route Handlers) et les associe à la bonne transaction Sentry.
export { captureRequestError as onRequestError } from '@sentry/nextjs';
