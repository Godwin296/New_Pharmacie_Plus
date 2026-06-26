import { createSerwistRoute } from "@serwist/turbopack";

// 🔴 PWA : ce route handler compile et sert dynamiquement le service worker (app/sw.ts).
// Pas besoin d'un identifiant de révision basé sur git ici (l'environnement de build n'a pas
// toujours accès à git) -- un UUID aléatoire à chaque build suffit à invalider le cache des
// clients existants quand une nouvelle version est déployée.
const revision = crypto.randomUUID();

export const { dynamic, dynamicParams, revalidate, generateStaticParams, GET } = createSerwistRoute({
  additionalPrecacheEntries: [{ url: "/offline", revision }],
  swSrc: "app/sw.ts",
  useNativeEsbuild: true,
});
