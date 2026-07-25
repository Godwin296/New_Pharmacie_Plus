/// <reference lib="esnext" />
/// <reference lib="webworker" />
import { defaultCache } from "@serwist/turbopack/worker";
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import { Serwist } from "serwist";

// Déclaration nécessaire pour TypeScript : injectionPoint est remplacé au build par le
// manifeste réel des fichiers à précharger (JS/CSS générés par Next.js).
declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  // 🚀 MODE OFFLINE (brique 4/4, terminée) : `defaultCache` gère déjà la mise en cache de la
  // COQUILLE de l'app (assets statiques, ET pages/RSC via ses caches "pages"/"pages-rsc") --
  // une page déjà visitée en ligne (ex: /catalogue) reste donc chargeable hors-ligne par ce
  // seul mécanisme. Le cache des DONNÉES dynamiques du catalogue (produits, stock, prix) est
  // volontairement géré ICI PAS via une règle Workbox/Serwist classique : l'endpoint de sync
  // (`/api/v1/catalogue/sync/`) répond par DELTA (son URL change à chaque appel via `?since=`),
  // un cache HTTP par URL ne rejouerait donc jamais qu'un fragment figé, pas le catalogue
  // complet à jour. La vraie copie locale vit dans IndexedDB, tenue à jour par
  // lib/offline/syncCatalogue.ts (déclenché en tâche de fond par useOfflineCatalogue.ts) et
  // consultée en repli par app/catalogue/page.tsx quand le réseau manque.
  runtimeCaching: defaultCache,
  fallbacks: {
    entries: [
      {
        url: "/offline",
        matcher({ request }) {
          return request.destination === "document";
        },
      },
    ],
  },
});

serwist.addEventListeners();
