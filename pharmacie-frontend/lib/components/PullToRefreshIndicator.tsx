"use client";

import { RefreshCw } from "lucide-react";
import { PULL_SEUIL } from "@/lib/hooks/usePullToRefresh";

interface Props {
  pull: number;
  refreshing: boolean;
}

/**
 * Pastille qui descend du haut de l'écran pendant le tirage (tourne avec le doigt, puis
 * tourne en continu pendant le rafraîchissement). Purement visuelle : toute la logique du
 * geste est dans lib/hooks/usePullToRefresh.ts.
 */
export default function PullToRefreshIndicator({ pull, refreshing }: Props) {
  if (pull <= 0 && !refreshing) return null;

  const progression = Math.min(pull / PULL_SEUIL, 1);
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed left-1/2 z-[60]"
      style={{
        top: "env(safe-area-inset-top, 0px)",
        transform: `translate(-50%, ${pull - 44}px)`,
        opacity: refreshing ? 1 : progression,
        // Pas de transition pendant que le doigt tire (suivi direct), retour fluide au relâchement
        transition: pull === 0 || refreshing ? "transform 0.25s ease, opacity 0.25s ease" : "none",
      }}
    >
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-lg ring-1 ring-black/5 dark:bg-[#10231d] dark:ring-white/10">
        <RefreshCw
          size={18}
          className={`text-emerald-600 dark:text-emerald-400 ${refreshing ? "animate-spin" : ""}`}
          style={refreshing ? undefined : { transform: `rotate(${progression * 270}deg)` }}
        />
      </div>
    </div>
  );
}
