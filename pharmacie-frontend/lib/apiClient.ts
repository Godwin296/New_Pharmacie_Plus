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

// 🔐 Un SEUL rafraîchissement de jeton à la fois pour tout le site.
//
// 🔴 CORRECTIF CRITIQUE (bug remonté en test, session du 19/07) : au chargement d'une
// page, PLUSIEURS requêtes partent en parallèle (ex: infos-pharmacie + catalogue/sync).
// Si le jeton d'accès est périmé, elles échouent TOUTES en 401 quasi simultanément.
// Avant ce correctif, CHACUNE déclenchait sa propre tentative de rafraîchissement,
// indépendamment. Or le backend a ROTATE_REFRESH_TOKENS=True + BLACKLIST_AFTER_ROTATION=True
// (voir config/settings.py) : un refresh_token n'est utilisable qu'UNE SEULE fois. La
// première requête à rafraîchir réussissait et obtenait un nouveau refresh_token, mais la
// deuxième était déjà partie avec l'ANCIEN (lu en mémoire avant que le premier n'ait fini
// d'écrire le nouveau) -- ce deuxième essai échouait donc systématiquement, déclenchant la
// déconnexion complète (localStorage.clear() + redirection /login) alors que la session
// était en réalité tout à fait valide. C'est la cause de la boucle de déconnexion observée
// sur les comptes clients (mode offline + config publique chargées en parallèle à chaque page).
//
// La solution : une seule promesse de rafraîchissement partagée. La première requête à
// échouer en 401 lance le rafraîchissement ; toute requête suivante qui échoue PENDANT que
// ce rafraîchissement est en cours attend la MÊME promesse au lieu d'en déclencher une
// nouvelle -- une seule consommation du refresh_token, peu importe le nombre de requêtes
// parallèles qui en avaient besoin.
let refreshEnCours: Promise<string> | null = null;

async function rafraichirToken(refreshToken: string): Promise<string> {
  const res = await axios.post(
    `${resolveApiUrl()}/api/token/refresh/`,
    { refresh: refreshToken },
    { timeout: 10000 }
  );
  localStorage.setItem('access_token', res.data.access);
  if (res.data.refresh) {
    localStorage.setItem('refresh_token', res.data.refresh);
  }
  return res.data.access;
}

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
        // Rejoint le rafraîchissement déjà en cours s'il y en a un, sinon en démarre un
        // nouveau. `finally` libère le verrou une fois résolu (succès OU échec), pour que
        // la prochaine expiration de jeton puisse déclencher un nouveau cycle.
        if (!refreshEnCours) {
          refreshEnCours = rafraichirToken(refreshToken).finally(() => {
            refreshEnCours = null;
          });
        }
        const nouvelAccessToken = await refreshEnCours;
        originalRequest.headers.Authorization = `Bearer ${nouvelAccessToken}`;
        return apiClient(originalRequest);
      } catch (refreshError) {
        // Refresh token expiré (ou déjà utilisé/blacklisté) : session vraiment terminée.
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
