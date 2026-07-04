import axios from 'axios';

/**
 * 🌐 MULTI-TENANT : résout l'URL du backend à partir du contexte.
 *
 * En local, chaque pharmacie a son propre sous-domaine (dupont.localhost,
 * martin.localhost...) mais tous partagent le même backend Daphne sur le port 8000.
 * Si NEXT_PUBLIC_API_URL n'est PAS défini, on déduit l'URL dynamiquement à partir du
 * sous-domaine actuellement visité dans le navigateur : ouvrir dupont.localhost:3000
 * appelle automatiquement dupont.localhost:8000, martin.localhost:3000 appelle
 * martin.localhost:8000, etc. -- plus besoin de changer .env.local pour tester un
 * autre tenant.
 *
 * Si NEXT_PUBLIC_API_URL EST défini (prod, tunnel de dev distant...), il est
 * prioritaire et fige l'URL peu importe le sous-domaine visité.
 */
function resolveApiUrl(): string {
  if (process.env.NEXT_PUBLIC_API_URL) {
    return process.env.NEXT_PUBLIC_API_URL;
  }
  if (typeof window !== 'undefined') {
    const port = process.env.NEXT_PUBLIC_API_PORT || '8000';
    return `${window.location.protocol}//${window.location.hostname}:${port}`;
  }
  // Rendu côté serveur (SSR) sans accès à window : repli raisonnable pour le dev local.
  return 'http://localhost:8000';
}

const API_URL = resolveApiUrl();

const apiClient = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
  // Timeout 15s : évite les boucles infinies si le backend ne répond pas
  timeout: 15000,
});

// Intercepteur requête : recalcule l'URL dynamiquement + injecte le JWT
apiClient.interceptors.request.use(
  (config) => {
    if (typeof window !== 'undefined') {
      // Recalcule à chaque requête pour gérer les navigations inter-tenants
      config.baseURL = resolveApiUrl();
      const token = localStorage.getItem('access_token');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Intercepteur réponse : refresh automatique du token JWT si 401
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Réseau injoignable ou timeout : rejeter immédiatement sans boucler
    if (!error.response) {
      return Promise.reject(error);
    }

    if (error.response?.status === 401 && !originalRequest._retry) {
      const refreshToken = typeof window !== 'undefined'
        ? localStorage.getItem('refresh_token')
        : null;

      // Pas de refresh_token = visiteur anonyme (catalogue, login...)
      // Ce n'est PAS une session expirée : on rejette sans rediriger ni boucler.
      if (!refreshToken) {
        return Promise.reject(error);
      }

      originalRequest._retry = true;
      try {
        const res = await axios.post(
          `${resolveApiUrl()}/api/token/refresh/`,
          { refresh: refreshToken },
          { timeout: 10000 }
        );

        if (res.status === 200) {
          localStorage.setItem('access_token', res.data.access);
          originalRequest.headers.Authorization = `Bearer ${res.data.access}`;
          return apiClient(originalRequest);
        }
      } catch (refreshError) {
        // Refresh token expiré : session vraiment terminée.
        // On redirige sauf si on est déjà sur /login (évite la boucle).
        if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
          localStorage.clear();
          window.location.href = '/login';
        }
      }
    }
    return Promise.reject(error);
  }
);

export default apiClient;
