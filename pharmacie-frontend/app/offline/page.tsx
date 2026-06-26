"use client";

export default function OfflinePage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-950 px-6 text-center">
      <div className="text-6xl mb-6">📡</div>
      <h1 className="text-2xl font-black text-slate-800 dark:text-white mb-2">
        Connexion indisponible
      </h1>
      <p className="text-slate-500 dark:text-slate-400 font-medium max-w-sm">
        Cette page n'est pas encore disponible hors-ligne. Vérifiez votre connexion internet et réessayez.
      </p>
      <button
        onClick={() => window.location.reload()}
        className="mt-8 bg-emerald-600 text-white font-bold px-6 py-3 rounded-2xl hover:bg-emerald-700 transition-colors"
      >
        Réessayer
      </button>
    </div>
  );
}
