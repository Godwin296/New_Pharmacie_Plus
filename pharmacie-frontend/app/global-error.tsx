'use client';

import { useEffect } from 'react';
import * as Sentry from '@sentry/nextjs';

// Filet de sécurité de dernier recours : capte les erreurs qu'AUCUN error.tsx local
// n'a interceptées (erreur dans le layout racine lui-même, par exemple). Next.js exige
// que ce fichier remplace entièrement <html>/<body> puisqu'il s'affiche à la place du
// layout racine qui vient de planter.
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // error.digest permet de relier cette erreur au log serveur correspondant.
    Sentry.captureException(error, { tags: { digest: error.digest } });
  }, [error]);

  return (
    <html lang="fr">
      <body className="flex min-h-screen flex-col items-center justify-center gap-4 bg-white px-6 text-center dark:bg-[#050e0c]">
        <p className="text-5xl">💊</p>
        <h1 className="font-display text-xl font-bold text-gray-900 dark:text-gray-100">
          Une erreur inattendue est survenue
        </h1>
        <p className="max-w-sm text-sm text-gray-500 dark:text-gray-400">
          L&apos;équipe technique a été notifiée automatiquement. Réessaie, ou reviens plus tard.
        </p>
        <button
          onClick={() => reset()}
          className="mt-2 min-h-[44px] rounded-2xl bg-emerald-500 px-6 font-medium text-white active:scale-95"
        >
          Réessayer
        </button>
      </body>
    </html>
  );
}
