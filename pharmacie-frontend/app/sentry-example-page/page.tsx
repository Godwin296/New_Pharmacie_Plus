'use client';

// 🧪 TEMPORAIRE -- page de vérification manuelle de l'intégration Sentry.
// À SUPPRIMER (ce dossier + app/api/sentry-example-api/) une fois le test confirmé
// dans les deux dashboards Sentry (pharmacie-frontend ET pharmacie-backend).
import { useState } from 'react';

export default function SentryExamplePage() {
  const [status, setStatus] = useState<string>('');

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-white px-6 text-center dark:bg-[#050e0c]">
      <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">
        Test Sentry -- page temporaire
      </h1>

      <button
        className="min-h-[44px] rounded-2xl bg-emerald-500 px-6 font-medium text-white active:scale-95"
        onClick={() => {
          throw new Error('Erreur client volontaire -- test Sentry frontend (navigateur)');
        }}
      >
        1. Déclencher une erreur CLIENT
      </button>

      <button
        className="min-h-[44px] rounded-2xl bg-emerald-700 px-6 font-medium text-white active:scale-95"
        onClick={async () => {
          setStatus('Appel en cours...');
          try {
            await fetch('/api/sentry-example-api');
            setStatus('Réponse reçue sans erreur -- inattendu, vérifie la route API.');
          } catch {
            setStatus('Requête envoyée -- vérifie le dashboard Sentry (pharmacie-frontend, événement serveur).');
          }
        }}
      >
        2. Déclencher une erreur SERVEUR (route API)
      </button>

      {status && <p className="text-sm text-gray-500 dark:text-gray-400">{status}</p>}
    </div>
  );
}
