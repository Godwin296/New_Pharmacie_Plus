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
  // 🔧 Stratégies de cache de base (fichiers statiques, polices, images). Le cache des
  // DONNÉES dynamiques de l'API (catalogue, panier...) sera ajouté dans une étape ultérieure
  // dédiée -- ce service worker est volontairement minimal pour l'instant : son seul objectif
  // ici est de rendre l'app installable (condition technique obligatoire pour l'invite PWA).
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
