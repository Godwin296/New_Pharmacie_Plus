"use client";

/**
 * ⬇️ PULL-TO-REFRESH -- geste "tirer vers le bas depuis le haut de la page" (mobile).
 *
 * Ne recharge PAS la page : il appelle `onRefresh` (dans app/layout.tsx : remontage de la page
 * courante, donc ses squelettes + ses fetchs repartent) -- aucun splash, aucun rechargement
 * navigateur. Le "tirer pour recharger" natif du navigateur est neutralisé par
 * `overscroll-behavior-y: contain` (app/globals.css).
 *
 * Règles du geste :
 *  - ne démarre que si la page est TOUT EN HAUT (et qu'aucun conteneur défilable sous le doigt
 *    n'est lui-même scrollé -- sinon on volerait le défilement interne d'une liste/modale) ;
 *  - tirage amorti (le doigt bouge 2x plus que l'indicateur), plafonné ;
 *  - déclenche seulement si le seuil est dépassé au relâchement ;
 *  - l'indicateur reste visible au moins MIN_REFRESH_MS même si le refetch est instantané
 *    (sinon on ne voit rien et l'utilisateur croit que ça n'a pas marché).
 */

import { useEffect, useRef, useState } from "react";

export const PULL_SEUIL = 70;
const PULL_MAX = 120;
const AMORTISSEMENT = 0.5;
const MIN_REFRESH_MS = 700;

/** Vrai si, entre la cible du toucher et <body>, un conteneur défilable n'est pas tout en haut. */
function conteneurInterneScrolle(cible: EventTarget | null): boolean {
  let el = cible instanceof Element ? cible : null;
  while (el && el !== document.body && el !== document.documentElement) {
    const { overflowY } = getComputedStyle(el);
    const defilable = /(auto|scroll)/.test(overflowY) && el.scrollHeight > el.clientHeight;
    if (defilable && el.scrollTop > 0) return true;
    el = el.parentElement;
  }
  return false;
}

const pageEnHaut = () => (document.scrollingElement?.scrollTop ?? 0) <= 0;

interface Options {
  onRefresh: () => Promise<void> | void;
  /** Désactiver pendant un splash, un menu ouvert, une modale... */
  enabled?: boolean;
}

export function usePullToRefresh({ onRefresh, enabled = true }: Options) {
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  const startY = useRef<number | null>(null);
  const pullRef = useRef(0);
  const refreshingRef = useRef(false);
  const onRefreshRef = useRef(onRefresh);

  useEffect(() => {
    onRefreshRef.current = onRefresh;
  }, [onRefresh]);

  useEffect(() => {
    if (!enabled) return;

    const maj = (d: number) => {
      pullRef.current = d;
      setPull(d);
    };

    const onStart = (e: TouchEvent) => {
      if (refreshingRef.current || e.touches.length !== 1) return;
      startY.current = pageEnHaut() && !conteneurInterneScrolle(e.target) ? e.touches[0].clientY : null;
    };

    const onMove = (e: TouchEvent) => {
      if (startY.current === null) return;
      // La page a défilé depuis le début du geste : ce n'est plus un "tirer depuis le haut".
      if (!pageEnHaut()) {
        startY.current = null;
        if (pullRef.current !== 0) maj(0);
        return;
      }
      const dy = e.touches[0].clientY - startY.current;
      if (dy <= 0) {
        if (pullRef.current !== 0) maj(0);
        return;
      }
      if (e.cancelable) e.preventDefault(); // bloque le défilement natif pendant le tirage
      maj(Math.min(dy * AMORTISSEMENT, PULL_MAX));
    };

    const onEnd = async () => {
      if (startY.current === null) return;
      startY.current = null;
      if (pullRef.current >= PULL_SEUIL && !refreshingRef.current) {
        refreshingRef.current = true;
        setRefreshing(true);
        maj(PULL_SEUIL);
        const debut = Date.now();
        try {
          await onRefreshRef.current();
        } finally {
          const reste = MIN_REFRESH_MS - (Date.now() - debut);
          if (reste > 0) await new Promise((r) => setTimeout(r, reste));
          refreshingRef.current = false;
          setRefreshing(false);
        }
      }
      maj(0);
    };

    window.addEventListener("touchstart", onStart, { passive: true });
    window.addEventListener("touchmove", onMove, { passive: false });
    window.addEventListener("touchend", onEnd);
    window.addEventListener("touchcancel", onEnd);
    return () => {
      window.removeEventListener("touchstart", onStart);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", onEnd);
      window.removeEventListener("touchcancel", onEnd);
    };
  }, [enabled]);

  return { pull, refreshing };
}
