# Prompt de reprise — Pharmacie+

Je reprends le développement de mon SaaS de gestion de pharmacie multi-tenant pour la zone CEMAC (Cameroun), avec toi comme associé technique. Le projet s'appelle **Pharmacie+**.

**Stack :** Django REST Framework (multi-tenant via django-tenants, isolation par schéma PostgreSQL) + Next.js 16/Turbopack + Django Channels (WebSocket temps réel) + Redis.

**Dépôt GitHub :** `https://github.com/Godwin296/New_Pharmacie_Plus` (branche `main`)

> ⚠️ Mon dépôt est **privé par défaut**. Je l'ouvre uniquement quand j'ai besoin que tu pousses du travail. Si tu n'arrives pas à cloner, dis-le-moi clairement et j'ouvrirai l'accès.

**Ce que ce document contient :** uniquement ce qu'il **reste à faire**, priorisé. Pour ce qui est déjà fait, regarde le [README.md](README.md) (feuille de route à jour, tenue synchrone avec ce document), le dossier [docs/](docs/) (versionnement API, backups, infrastructure) et l'historique `git log` — un travail déjà poussé sur `main` a déjà été testé avant d'être commité (voir [CONTRIBUTING.md](CONTRIBUTING.md), règle "tester réellement").

> ⚠️ **Ce dépôt évolue en parallèle par plusieurs sessions/agents.** Avant de supposer qu'une fonctionnalité n'existe pas, vérifie toujours dans le code actuel (`grep`, lecture directe) plutôt que de te fier à un TODO potentiellement déjà obsolète — y compris celui-ci. Un `git pull`/`fetch` avant de commencer, et une revue rapide des derniers commits, évite de refaire un travail déjà fait ailleurs.

**Mon objectif :** vendre ce SaaS à des pharmacies clientes en zone CEMAC. Je suis étudiant en informatique à l'Université de Dschang, je communique en français, et je préfère un guidage pas à pas avec des tests réels.

---

## 🛠️ ENVIRONNEMENT TECHNIQUE

Voir [CONTRIBUTING.md](CONTRIBUTING.md) pour la procédure complète d'installation (PostgreSQL, Redis, libmagic, DNS local multi-tenant, `seed.py`).

> ⚠️ **Dans un environnement sandbox/agent** : PostgreSQL, Redis et les process Daphne/Next.js ne survivent PAS entre deux appels d'outils séparés. Toujours relancer les services ET lancer le test dans la MÊME invocation de commande.

## 💾 PROCÉDURE DE PUSH GIT

```bash
git fetch origin && git log --oneline main..origin/main   # voir ce qui a changé côté distant avant de commencer
git remote set-url origin https://Godwin296:LE_TOKEN@github.com/Godwin296/New_Pharmacie_Plus.git
git add -A && git commit -m "message clair"
git push origin main   # si rejeté (non-fast-forward) : git pull --no-rebase, résoudre les conflits réels, puis repush
git remote set-url origin https://github.com/Godwin296/New_Pharmacie_Plus.git  # retirer le token
```

---

## 🏗️ DÉCISIONS D'ARCHITECTURE (à respecter)

| Décision | Statut |
|---|---|
| Isolation multi-tenant PAR SCHÉMA (pas `tenant_id`) | ✅ Implémenté |
| Compte client global (`CompteClient`, schéma public) remplace l'ancien `Client` par-tenant | ✅ Implémenté |
| Versionnement API par préfixe d'URL (`/api/v1/`, jamais casser une version en place) | ✅ Implémenté — voir [docs/API_VERSIONING.md](docs/API_VERSIONING.md) |
| Paiement manuel (mobile money vérifié par la caisse) comme fallback permanent | ✅ Implémenté |
| OCR uniquement aide visuelle, jamais automatisé | Décision ferme |
| Africa's Talking pour SMS (pas Twilio) | Décision ferme, pas encore implémenté |
| Prédiction stock = statistiques classiques, PAS LLM | ✅ Implémenté (`core/services_prediction.py`) |
| Détection d'interactions médicamenteuses = table de règles statiques sourcées, PAS d'IA | ✅ Implémenté (`pharmacovigilance/`) |
| Cache Redis : TTL courts plutôt qu'invalidation manuelle par motif (sauf clés à invalidation ciblée déjà en place : facture PDF, infos pharmacie, historique client) | ✅ Implémenté (`core/cache_utils.py`) |
| Gestion du stock par lots datés (`LotProduit`) + décrémentation FEFO | ✅ Implémenté — `Produit.quantite`/`date_expiration` restent des champs cache dénormalisés (recalculés depuis les lots) |
| `Produit.ordonnance_obligatoire` reste configurable PAR PRODUIT (pas de politique globale imposée par la plateforme) | Décision ferme (18/07) — malgré l'évolution réglementaire camerounaise de juillet 2024 (voir [docs/RECHERCHE_FONCTIONNALITES_PHARMACIE.md](docs/RECHERCHE_FONCTIONNALITES_PHARMACIE.md#-1-trouvaille-réglementaire-majeure--à-traiter-en-priorité)), le choix revient à chaque tenant. Clause de limitation de responsabilité correspondante dans `pharmacie-marketing/app/mentions-legales/page.tsx` (brouillon, à faire relire par un juriste) |
| Facture PDF téléchargeable uniquement par le personnel (pas par le client) | Décision ferme (01/08) — le bouton client causait un échec systématique (`window.open()` n'envoie pas le header JWT) ; retiré plutôt que réparé, logique backend dédiée au client supprimée |

---

## 📋 CE QUI RESTE À FAIRE — priorisé

### 🔴 Effort élevé / risque architectural
- [ ] **Refonte UI/UX mobile-first** — en cours (plusieurs sessions en parallèle). Déjà fait : splashscreen, catalogue, panier, écran produit, accueil, historique commandes, menu (bottom sheet). Guide fonctionnel détaillé : [docs/UIUX_REFONTE_GUIDE.md](docs/UIUX_REFONTE_GUIDE.md) (pages manquantes par rôle, gaps identifiés côté caisse/dashboard admin).
- [~] **Page marketplace** — BACKEND TERMINÉ et testé (liste/carte/détail, géolocalisation, services, logo par pharmacie, compte client unique via passerelle SSO `/api/v1/auth/passerelle|echange/`, inscription/connexion client sur le domaine plateforme). **Reste le FRONTEND** : `app/marketplace/page.tsx`, hook de géolocalisation, page `app/auth/relais`, splash = `public/static/SplashScreen.png`, adaptation de `app/page.tsx`/`layout.tsx`/`ConfigPharmacieContext`. Contrat exact route par route et tâches : [docs/MARKETPLACE_FRONTEND.md](docs/MARKETPLACE_FRONTEND.md) (section « Tâches frontend »).
- [ ] **Admin plateforme "Pharmacie Plus"** — n'existe pas du tout aujourd'hui (seulement le Django admin brut sur le schéma public) ; nécessite sa propre authentification (comptes staff plateforme, séparés des comptes par-tenant) ; détail complet dans [docs/UIUX_REFONTE_GUIDE.md](docs/UIUX_REFONTE_GUIDE.md#5-admin-plateforme-pharmacie-plus--confirmé--ça-nexiste-pas-du-tout)
- [ ] **Notifications SMS (Africa's Talking)** — pas commencé

### 🟡 Effort moyen
- [x] **Dashboard analytics avancé** — ✅ fait : `GET /api/v1/boss/analytics/?debut=&fin=` (`core/analytics.py`) + section `app/admin/dashboard/AnalyticsSection.tsx`. CA, nb commandes, panier moyen et marge, chacun comparé à la période précédente de même durée ; répartition par moyen de paiement et par catégorie ; heures de pointe ; stock dormant. La marge utilise `ItemCommande.prix_achat_facture` (coût figé à la vente, migration `0016`) avec repli sur `Produit.prix_achat` pour les lignes antérieures ; les produits sans coût connu sont **exclus** de la marge (jamais comptés à coût 0) et `couverture_marge_pct` le signale à l'écran. 20 tests dans `core/tests_analytics.py`. Reste éventuellement : export PDF/CSV des analyses, rotation de stock en jours (actuellement : liste des produits dormants), graphique d'évolution du CA sur la période choisie (le graphique 7 jours existant n'est pas lié au sélecteur).
- [~] **Internationalisation** — infrastructure BACKEND posée (01/08) : `LocaleMiddleware` + `LANGUAGES` (fr/en), `CompteClient.langue_preferee` (null = "Système", détection auto via `Accept-Language`), activée dans `core/authentication.py::_activer_langue_client` au moment de l'authentification JWT client, exposée en GET/PATCH sur `/api/v1/client/me/`. Testé de bout en bout (préférence explicite > Accept-Language > défaut `fr`). **Reste à faire** : traduire le contenu applicatif lui-même (messages d'erreur API, emails Brevo -- aucune chaîne n'est encore marquée `gettext`/`gettext_lazy`, voir `pharmacie-backend/locale/README.md`) + le frontend (next-intl, pas commencé) + un sélecteur de langue dans `/profil`
- [x] **Sentry frontend** — ✅ fait : `@sentry/nextjs` 11 (`instrumentation-client.ts`, `withSentryConfig`), DSN frontend/backend dans les `.env`, erreurs vérifiées dans les deux projets Sentry.

### 🔵 Documenté, implémentation volontairement différée (voir [docs/INFRASTRUCTURE_ROADMAP.md](docs/INFRASTRUCTURE_ROADMAP.md) pour le détail et le déclencheur de chaque point)
- [ ] Index PostgreSQL sur `Commande.statut`/`payee`/`date` — attendre que le modèle de données soit stable (fin de refonte)
- [ ] HTTPS/HSTS (`SECURE_SSL_REDIRECT` etc.) — attendre le choix de l'hébergement de production
- [ ] CDN pour les images produits — pas urgent tant que le trafic reste local/faible

---

## 🎨 DIRECTION STYLISTIQUE (refonte UI/UX en cours)

- Vert émeraude dominant (`emerald-500/600`), fond blanc/gris-vert très pâle en clair, quasi-noir en sombre (`var(--color-mist)` / `#050e0c`) — cohérent sur TOUTES les pages, pas de fond sombre "hero" isolé qui détonnerait avec le reste de l'app
- `font-display` (Poppins) sur tous les titres
- Cartes très arrondies (`rounded-2xl`/`3xl`), ombres douces
- Feuilles mobiles (bottom sheets) glissant depuis le bas pour toute modale/menu — jamais de popup centrée façon desktop ; fermeture au swipe
- Cibles tactiles 44px minimum, retour tactile (`active:scale-*`) sur tout élément cliquable, aucune interaction qui ne fonctionne qu'au survol souris
- Animations douces et volontairement SANS pulsation/respiration en boucle répétée sur chaque écran (halos statiques ou dérive lente, pas d'effet "vulgaire" qui se remarque à l'usage)
- Toasts système partout, jamais d'`alert()`/`confirm()` navigateur (hook partagé `lib/hooks/useToast`)
- Bottom nav mobile avec bouton central flottant rond (panier/+) qui dépasse de la barre
- Écran connexion avec sélection de rôle par cartes (Client/Caisse/Admin) avant le formulaire

---

## ⚙️ COMMENT JE PRÉFÈRE TRAVAILLER

- Toujours tester réellement (PostgreSQL/Redis/Daphne réels, pas de simulation) — sauf demande explicite ponctuelle de ma part de pousser sans ce cycle complet, auquel cas je remonte les erreurs moi-même
- Expliquer les concepts techniques que je ne connais pas (j'apprends en construisant)
- Ne jamais me restituer le code dans le chat — travailler dans l'environnement de fichiers
- Me prévenir clairement quand il est temps de pousser vers GitHub
- Ne pas remettre en question les décisions d'architecture sans bonne raison documentée
- Vérifier l'état réel du code avant de supposer qu'une tâche reste à faire (voir avertissement en haut de ce document)

---

**Par où veux-tu commencer ?**
