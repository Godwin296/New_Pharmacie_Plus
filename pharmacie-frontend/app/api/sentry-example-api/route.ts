// 🧪 TEMPORAIRE -- vérification manuelle de l'intégration Sentry frontend.
// À SUPPRIMER une fois le test confirmé (voir app/sentry-example-page/page.tsx).
export async function GET() {
  throw new Error('Erreur serveur volontaire -- test Sentry backend Next.js (route API)');
}
