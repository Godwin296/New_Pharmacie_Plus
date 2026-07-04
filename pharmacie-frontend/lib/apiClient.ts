import axios from 'axios';

/**
 * 🌐 DÉTECTION DYNAMIQUE DE L'URL BACKEND
 *
 * Problème initial : API_URL était une constante (ancien tunnel de dev ou variable
 * d'environnement fixe), ce qui empêchait de tester plusieurs tenants simultanément
 * et causait une boucle infinie quand l'URL ne répondait pas.
 *
 * Solution : on détecte le sous-domaine depuis window.location.hostname et on
 * construit l'URL backend dynamiquement.
 *
 * Exemples :
 *   dupont.localhost:3000  → backend sur http://dupont.localhost:8000
 *   martin.localhost:3000  → backend sur http://martin.localhost:8000
 *   pharmacie.mondomaine.cm:3000 → backend sur http://pharmacie.mondomaine.cm:8000
 *   (en prod, le port sera retiré via un reverse proxy Nginx)
 *
 * Côté serveur (SSR) : window n'existe pas, on utilise la variable d'environnement
 * NEXT_PUBLIC_API_URL comme fallback (utile pour le build et le rendu serveur).
 */
function getApiBaseUrl(): string {
  // Côté serveur (SSR/build) : utilise la variable d'environnement
  if (typeof window === 'undefined') {
    return process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
  }

  const hostname = window.location.hostname; // ex: "dupont.localhost" ou "dupont.pharmacieplus.cm"
  const port = process.env.NEXT_PUBLIC_API_PORT || '8000';

  // En développement local : remplace le port 3000 par le port backend
  // dupont.localhost → http://dupont.localhost:8000
  if (hostname.endsWith('.localhost') || hostname === 'localhost') {
    return `http://${hostname}:${port}`;
  }

  // En production : même domaine, port standard (Nginx reverse proxy gère le routing)
  // dupont.pharmacieplus.cm → https://dupont.pharmacieplus.cm/api/...
  // (le /api prefix est géré par Nginx, pas ici)
  const protocol = window.location.protocol; // https: en prod
  return `${protocol}//${hostname}`;
}

const apiClient = axios.create({
  // baseURL calculé dynamiquement à chaque instanciation (côté client)
  // ou depuis la variable d'environnement (côté serveur)
  baseURL: getApiBaseUrl(),
  headers: {
    'Content-Type': 'application/json',
  },
  // Timeout de 15s : évite les boucles infinies si le backend ne répond pas
  timeout: 15000,
});

// Intercepteur requête : injecte le token JWT si disponible
apiClient.interceptors.request.use(
  (config) => {
    // Recalcule l'URL à chaque requête côté client pour gérer les navigations
    // entre tenants dans la même session (cas rare mais possible)
    if (typeof window !== 'undefined') {
      config.baseURL = getApiBaseUrl();
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

    // Si timeout ou réseau injoignable : ne pas boucler, rejeter immédiatement
    if (!error.response) {
      return Promise.reject(error);
    }

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      try {
        const refreshToken = localStorage.getItem('refresh_token');
        if (!refreshToken) throw new Error('Pas de refresh token');

        const baseUrl = getApiBaseUrl();
        const res = await axios.post(
          `${baseUrl}/api/token/refresh/`,
          { refresh: refreshToken },
          { timeout: 10000 }
        );

        if (res.status === 200) {
          localStorage.setItem('access_token', res.data.access);
          originalRequest.headers.Authorization = `Bearer ${res.data.access}`;
          return apiClient(originalRequest);
        }
      } catch (refreshError) {
        // Refresh échoué → déconnexion propre sans boucle
        if (typeof window !== 'undefined') {
          localStorage.clear();
          window.location.href = '/login';
        }
      }
    }
    return Promise.reject(error);
  }
);

export default apiClient;
