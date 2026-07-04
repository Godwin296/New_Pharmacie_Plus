import axios from 'axios';

/**
 * 🏥 MULTI-TENANT : résout l'URL du backend à partir du contexte.
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
  headers: {
    'Content-Type': 'application/json',
  },
});

apiClient.interceptors.request.use(
  (config) => {
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('access_token');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    }
    return config;
  },
  (error) => Promise.reject(error)
);

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      const refreshToken = typeof window !== 'undefined' ? localStorage.getItem('refresh_token') : null;

      // 🔒 Pas de refresh_token en localStorage = il n'y a jamais eu de session à
      // rafraîchir (visiteur anonyme sur une page publique, ex: /login, catalogue...).
      // Ce n'est PAS une "session expirée" : on rejette simplement l'erreur sans
      // toucher au localStorage ni rediriger, sinon on déclenche une boucle de
      // rechargement infinie sur toute page qui appelle un endpoint protégé sans
      // être connecté (cf. bug historique sur ConfigPharmacieContext).
      if (!refreshToken) {
        return Promise.reject(error);
      }

      originalRequest._retry = true;
      try {
        // 2. STABLE : Vous utilisez l'extension SimpleJWT standard, l'URL par défaut de DRF est souvent '/api/token/refresh/'
        // Si vous créez une vue personnalisée plus tard, vous l'ajusterez ici.
        const res = await axios.post(`${API_URL}/api/token/refresh/`, { refresh: refreshToken });

        if (res.status === 200) {
          localStorage.setItem('access_token', res.data.access);
          originalRequest.headers.Authorization = `Bearer ${res.data.access}`;
          return apiClient(originalRequest);
        }
      } catch (refreshError) {
        // Le refresh token existait mais n'est plus valide : là, c'est une vraie
        // session expirée -- on nettoie et redirige, sauf si on y est déjà (évite
        // encore une boucle si /login appelle lui-même un endpoint protégé).
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