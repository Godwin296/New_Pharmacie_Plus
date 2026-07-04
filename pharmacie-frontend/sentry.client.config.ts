// sentry.client.config.ts
// Chargé automatiquement par Next.js dans le navigateur.
// NE PAS importer manuellement — Next.js le détecte par convention de nommage.

import * as Sentry from "@sentry/nextjs";

const SENTRY_DSN = process.env.NEXT_PUBLIC_SENTRY_DSN;

// Sentry ne s'active QUE si la DSN est définie (production).
// En développement local, NEXT_PUBLIC_SENTRY_DSN est absent du .env.local
// → aucun événement envoyé, aucun impact sur les perfs de dev.
if (SENTRY_DSN) {
  Sentry.init({
    dsn: SENTRY_DSN,

    // Taux d'échantillonnage des sessions de replay (enregistrement écran).
    // 0 = désactivé par défaut (économise le quota du plan gratuit).
    // Mettre à 0.1 si tu veux voir des replays d'erreurs en prod.
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 0.1, // 10% des sessions avec erreur → replay enregistré

    // Taux d'échantillonnage des performances (navigation, requêtes réseau).
    // 0.05 = 5% des pages tracées, suffisant pour détecter les lenteurs.
    tracesSampleRate: 0.05,

    // Sécurité : ne jamais envoyer les données personnelles
    // (formulaires, cookies, headers Authorization).
    sendDefaultPii: false,

    environment: process.env.NODE_ENV,
    release: process.env.NEXT_PUBLIC_APP_VERSION || "dev",

    // Ignore les erreurs réseau attendues (timeout apiClient, offline PWA)
    // pour ne pas polluer Sentry avec des faux positifs.
    ignoreErrors: [
      "Network Error",
      "AxiosError",
      "timeout of",
      "Request aborted",
      /^Loading chunk \d+ failed/,   // erreurs de lazy loading Next.js
    ],
  });
}
