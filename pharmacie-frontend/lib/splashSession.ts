/**
 * 🚀 Mémoire "le splash a déjà été vu dans cette session".
 *
 * Règle produit (comme WhatsApp/Uber) : le splash ne s'affiche QU'À L'ENTRÉE dans l'app
 * (nouvel onglet, app PWA relancée), jamais à un simple rafraîchissement ni à un retour sur
 * l'accueil depuis une autre page.
 *
 * `sessionStorage` a exactement la bonne durée de vie : il survit à un F5 / rechargement dans
 * le même onglet, et il est vidé quand l'onglet (ou l'app PWA) est fermé.
 *
 * ⚠️ N'existe pas côté serveur : TOUJOURS passer par ces fonctions (garde SSR + try/catch, car
 * certains navigateurs en navigation privée lèvent une exception à l'accès au storage), et
 * ne jamais lire ce flag directement dans le rendu d'un composant (mismatch d'hydratation) --
 * seulement dans un useEffect.
 *
 * La même clé est lue par le petit script inline de app/layout.tsx (avant le premier rendu,
 * pour masquer le splash sans le moindre clignotement) : si tu changes la clé ici, change-la
 * aussi là-bas.
 */
import { useSyncExternalStore } from "react";

export const SPLASH_SESSION_KEY = "pp_splash_vu";

export function splashDejaVu(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.sessionStorage.getItem(SPLASH_SESSION_KEY) === "1";
  } catch {
    return false;
  }
}

export function marquerSplashVu(): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(SPLASH_SESSION_KEY, "1");
  } catch {
    /* storage indisponible : au pire le splash se réaffichera au prochain rechargement */
  }
}

const sAbonner = () => () => {};

/**
 * Version "composant" de splashDejaVu() : lecture sûre de sessionStorage via
 * useSyncExternalStore (méthode React officielle pour lire un système externe) --
 * `false` côté serveur et pendant l'hydratation (donc aucun mismatch), puis la vraie valeur.
 */
export function useSplashDejaVu(): boolean {
  return useSyncExternalStore(sAbonner, splashDejaVu, () => false);
}
