# Admin plateforme « Pharmacie+ » : conception

> **Statut : conception, aucun code écrit.** Ce document fixe les décisions d'architecture, de
> sécurité et de contenu AVANT d'implémenter. Il est fait pour être repris par plusieurs sessions :
> chaque phase (§11) est autonome et testable. Les points marqués **🔶 À TRANCHER** (§12) attendent
> une décision du propriétaire du produit.
>
> Contexte : `docs/UIUX_REFONTE_GUIDE.md` §5 décrit le besoin de façon générale. Ce document le remplace
> pour tout ce qui concerne l'architecture et le contrat d'API.

---

## 0. Résumé en dix lignes

1. L'admin plateforme est un **outil interne pour l'équipe Pharmacie+**, jamais pour les pharmacies ni leurs clients.
2. Ses données vivent dans le **schéma `public`**. Aucune donnée de ce module ne vit dans un schéma de pharmacie.
3. Son API est servie par `config/urls_public.py` sous `/api/v1/plateforme/` : **uniquement sur le domaine plateforme**, jamais sur un sous-domaine de pharmacie.
4. Il a ses **propres comptes** (`ComptePlateforme`, schéma public), son propre type de jeton, sa propre classe d'authentification, avec 2FA obligatoire et jetons courts.
5. Il ne fait **jamais de requête cross-schéma en temps réel**. Les chiffres par pharmacie viennent d'un **instantané quotidien** (`MetriquesTenantJour`) calculé par une commande planifiée qui entre dans chaque schéma l'un après l'autre.
6. Il ne copie **aucune donnée de santé ni donnée personnelle de client final** : uniquement des compteurs et des dates.
7. Toute action d'écriture (suspendre, changer de plan, créer une pharmacie…) est **tracée dans un journal d'audit immuable**.
8. **Deux défauts de sécurité existants** doivent être corrigés AVANT d'ouvrir ce module (§3.1) : le jeton du personnel n'est pas lié à une pharmacie, et la suspension d'une pharmacie n'est appliquée nulle part.
9. Le chiffre d'affaires des pharmacies n'est **pas** affiché par défaut (décision à confirmer, §12.1) ; on mesure l'activité (nombre de commandes) et la contribution (part du volume), pas l'argent encaissé.
10. Réalisation en **6 phases** (§11), la phase 0 étant la correction de sécurité.

---

## 1. Qui, pourquoi, et ce que l'admin plateforme n'est pas

| | |
|---|---|
| **Utilisateurs** | L'équipe Pharmacie+ : propriétaire de la plateforme, administrateurs, support, finance |
| **Objectif** | Connaître chaque pharmacie cliente (identité, état, usage, santé technique, contribution), la piloter (plan, suspension, onboarding) et surveiller la plateforme dans son ensemble |
| **Pas pour** | Les pharmaciens (ils ont `/admin` de leur sous-domaine), les caissières, les clients |
| **Ne fait pas** | Lire les ordonnances, les noms/contacts des clients finaux d'une pharmacie, le détail d'une vente, ni modifier les données métier d'une pharmacie (stock, prix…). Si un support doit intervenir dans une pharmacie, c'est un processus distinct (§4.6) |

Principe de **minimisation** : l'admin plateforme n'a besoin de connaître que ce qu'il faut pour exploiter
le SaaS. Plus on copie de données dans le schéma public, plus on augmente le risque et les obligations
légales (données de santé, protection des données personnelles : à faire relire par un juriste, comme
déjà indiqué pour les mentions légales).

---

## 2. Où est-ce que ça vit : schémas, URLs, frontend

### 2.1 Schémas PostgreSQL

| Donnée | Schéma | Pourquoi |
|---|---|---|
| Pharmacie, Domain (existants) | `public` | Déjà là ; c'est la liste des tenants |
| `ComptePlateforme` (nouveau) | `public` | Comptes de l'équipe, indépendants de toute pharmacie |
| `JournalAudit` (nouveau) | `public` | Trace des actions de l'équipe, hors de portée des pharmacies |
| `MetriquesTenantJour` (nouveau) | `public` | Instantanés quotidiens par pharmacie |
| `UsageClientPharmacie` (nouveau, §6.3) | `public` | Quelles pharmacies chaque `CompteClient` a utilisées, sans copier de contenu |
| `NoteTenant`, abonnement/facturation SaaS (nouveaux, plus tard) | `public` | Données de gestion de la relation client |
| Produits, commandes, stock, utilisateurs du personnel… | schéma de chaque pharmacie | **Ne bougent pas, ne sont jamais copiés** |

Nouvelle app Django **`plateforme`**, à ajouter à `SHARED_APPS` uniquement (jamais à `TENANT_APPS`,
même règle que `clients_publics`, voir le piège de FK ambiguë documenté dans `clients_publics/models.py`).

### 2.2 URLs et domaine

- API : `config/urls_public.py` → `path("api/v1/plateforme/", include("plateforme.urls"))`. Comme `urls_public` est la seule urlconf du schéma public, **ces routes n'existent pas** sur le sous-domaine d'une pharmacie : un `dupont.pharmacieplus.com/api/v1/plateforme/…` répond 404. C'est la première barrière.
- **🔶 Domaine dédié (recommandé)** : servir l'interface sur `plateforme.<domaine>` (ou `admin.<domaine>`), enregistré dans `PLATEFORME_DOMAINES`. Avantages : origine séparée (le `localStorage` du site grand public n'est pas partagé avec l'admin), CSP et règles de pare-feu dédiées (liste d'IP autorisées possible), pas de mélange avec la marketplace. Le chemin `/plateforme` sur le domaine racine reste possible en développement.
- Frontend : routes `pharmacie-frontend/app/plateforme/…` dans le **même projet Next.js** (réutilise Tailwind, composants, `apiClient`), protégées par un garde côté client (contexte `plateforme` via `/api/v1/contexte/` + session `ComptePlateforme`) **et** par l'API (la vraie barrière). Une autre app Next.js dédiée est une option si l'équipe veut séparer les déploiements ; à trancher (§12.3).

### 2.3 Ce que l'interface n'utilise jamais

Elle n'appelle **aucune** route `/api/v1/…` d'une pharmacie. Tout passe par `/api/v1/plateforme/`. Il n'y a pas
de « se connecter en tant que pharmacien » (voir §4.6).

---

## 3. Sécurité : le point le plus important

### 3.1 Prérequis P0 : deux défauts existants à corriger d'abord

Constatés à la lecture du code (`core/authentication.py`, `config/settings.py`, `tenants/`), **à confirmer par
un test automatisé écrit en premier** (phase 0) :

**(a) Le jeton du personnel n'est lié à aucune pharmacie.** `StaffJWTAuthentication` ne rejette que les jetons
de type `client`. Un jeton du personnel (`RefreshToken.for_user(user)`) ne contient que `user_id`, sans
pharmacie. Or chaque schéma a sa propre table `auth_user` avec ses ID à partir de 1. Conséquences :
- un admin (superuser, `id=1`) de la pharmacie A, qui présente son jeton sur le domaine de la pharmacie B, est résolu comme l'utilisateur `id=1` **de B** (souvent son propre admin) ;
- le même jeton présenté sur le **domaine plateforme** serait résolu contre `auth_user` du schéma public, où `id=1` est le superuser de la plateforme.

C'est exactement la classe de faille déjà corrigée pour les jetons clients (voir la docstring de
`StaffJWTAuthentication`). **Correctif** : ajouter une claim `schema` à tous les jetons du personnel à
la connexion, et la vérifier dans `StaffJWTAuthentication.get_user` (rejeter si `claim != connection.schema_name`).
Les sessions existantes (sans claim) devront se reconnecter ; à annoncer. Ajouter la durée de vie : l'access token
actuel vit **100 heures** (`SIMPLE_JWT`), à ramener à une valeur courte (voir §3.3 pour l'admin plateforme ; pour
les pharmacies, à discuter séparément).

**(b) La suspension n'est appliquée nulle part.** `Pharmacie.actif` et `plan == 'suspendu'` existent, mais
aucun middleware, aucune permission, aucune vue ne les lit (recherche exhaustive dans le code hors migrations/tests).
Suspendre une pharmacie depuis l'admin Django ne change donc **rien** pour ses utilisateurs. Or c'est
l'action phare de l'admin plateforme. **Correctif** : un middleware placé juste après
`TenantMainMiddleware` qui, pour tout schéma ≠ `public`, répond `403 {"code": "compte_suspendu"}` (JSON, avec un
message affichable) si `not tenant.actif or tenant.plan == 'suspendu'`, en laissant passer `/healthz/`, les
routes d'authentification (pour pouvoir afficher le message) et les WebSockets de façon cohérente (refuser aussi).
Définir précisément : suspendu = lecture seule pour le personnel ? ou blocage total ? (§12.5).

### 3.2 Comptes plateforme : modèle dédié, pas `auth_user`

**Décision recommandée** : un modèle `ComptePlateforme` (`AbstractBaseUser`, schéma public), sur le même patron que
`CompteClient`, plutôt que de réutiliser `auth.User` du schéma public.

| | `auth.User` du schéma public | `ComptePlateforme` (recommandé) |
|---|---|---|
| Collision d'ID avec les jetons de pharmacies | Oui (même type de jeton) | Non : type de jeton et table distincts |
| Rôles fins (support, finance, lecture seule) | À greffer | Natif |
| 2FA, verrouillage, dernière IP | À greffer | Natif |
| Risque de mélange avec le Django admin | Fort | Faible |

Champs : `email` (identifiant unique), `nom`, `role`, `is_active`, `mot_de_passe` (hash Django),
`totp_secret` (chiffré, voir `core/chiffrement.py`) et `totp_active`, `codes_secours` (hachés),
`tentatives_echec`, `verrouille_jusqua`, `derniere_connexion`, `derniere_ip`, `date_creation`, `cree_par`.

Les comptes sont créés **uniquement** par une commande (`manage.py creer_compte_plateforme`) ou par un
propriétaire déjà connecté. **Aucune inscription publique**, aucune route d'« oubli de mot de passe » en libre-service
au départ (réinitialisation par un propriétaire).

### 3.3 Jetons et sessions

- Nouvelle classe `PlateformeJWTAuthentication` : n'accepte QUE les jetons portant `type == "plateforme"`, vérifie le compte actif, le rôle courant (lu en base à chaque requête, pas dans le jeton) et que la **session** n'est pas révoquée.
- `StaffJWTAuthentication` et `ClientJWTAuthentication` rejettent le type `plateforme` (et inversement). Un jeton d'un autre monde n'ouvre jamais cette porte.
- Durées : **access 15 min**, **refresh 8 h** (journée de travail), rotation + liste noire (`token_blacklist` est déjà dans `SHARED_APPS`, mais attention au piège documenté dans `CompteClient` : pas de `RefreshToken.for_user()` sur un modèle non-`auth.User` ; utiliser le même patron `RefreshToken()` + claims que `api_client_login`).
- Jeton stocké en **mémoire + cookie HttpOnly `SameSite=Strict`** de préférence au `localStorage` (l'admin plateforme est une cible de choix pour du XSS). **🔶 À trancher** (§12.4) : le reste de l'app utilise `localStorage` ; ici le risque justifie un cookie.
- Verrouillage : 5 échecs → 15 min ; throttle `plateforme_login` (ex. 5/min par IP) à ajouter dans `DEFAULT_THROTTLE_RATES`.

### 3.4 2FA et accès réseau

- **2FA TOTP obligatoire** pour tous les rôles (application d'authentification), avec codes de secours. Connexion en deux temps : `POST auth/connexion/` → `{etape: "2fa", jeton_temporaire}` → `POST auth/2fa/`.
- Liste d'IP autorisées **optionnelle** (variable d'environnement `PLATEFORME_IP_AUTORISEES`), appliquée par middleware sur `/api/v1/plateforme/`.
- En production : HTTPS/HSTS (déjà documenté dans `INFRASTRUCTURE_ROADMAP.md`) est un prérequis avant toute ouverture de ce module.

### 3.5 Rôles et permissions

| Rôle | Voit | Peut faire |
|---|---|---|
| `proprietaire` | Tout | Tout, dont créer/désactiver des comptes plateforme, supprimer/archiver une pharmacie |
| `admin` | Tout sauf gestion des comptes plateforme | Créer une pharmacie, changer le plan, suspendre/réactiver, éditer les notes, exporter |
| `support` | Liste et fiches des pharmacies, santé, journal de ses propres actions | Ajouter des notes, relancer l'envoi d'un email de bienvenue au titulaire ; **pas** de changement de plan ni suspension |
| `finance` | Plans, abonnements, facturation (quand elle existera) | Marquer une facture payée, changer un plan pour raison de facturation |
| `lecture` | Tout ce que voit `admin`, sans aucune écriture | Rien |

Les permissions sont des classes DRF (`EstProprietaire`, `PeutEcrire`, …) appliquées **par vue**, jamais par masquage côté frontend seul.

### 3.6 Journal d'audit

Toute écriture crée une ligne `JournalAudit` **dans la même transaction** que l'action : `acteur`, `action` (code stable :
`tenant.suspendre`, `tenant.plan_change`, `compte.cree`…), `cible_type`, `cible_id`, `avant` / `apres` (JSON, sans secrets),
`ip`, `user_agent`, `date`. Le modèle interdit `update`/`delete` (méthodes `save` conditionnée à la création, `delete` qui lève,
et l'utilisateur de base de données applicatif idéalement sans droit `UPDATE/DELETE` sur cette table en production). Les connexions
(réussies et échouées) et les lectures de fiches sensibles (export) sont aussi journalisées. Consultable dans l'interface (§7.9).

### 3.7 Communication sécurisée entre l'admin et les données des pharmacies

Deux flux seulement, tous deux **internes au serveur** (pas d'appel HTTP entre schémas) :

1. **Lecture de la liste des pharmacies et de leur configuration** : directe, tables `public` (`Pharmacie`, `Domain`).
2. **Métriques d'usage** : une commande serveur (`collecter_metriques_tenants`, §5) entre dans le schéma de chaque pharmacie avec
   `schema_context(...)`, exécute des agrégats en **lecture seule** (`COUNT`, `MAX(date)`, `SUM` de volumes), écrit les résultats
   dans `MetriquesTenantJour` (public) puis ressort. Rien d'autre ne traverse la frontière.

Garanties : (i) l'API de l'admin ne reçoit **jamais** un nom de schéma du client (le schéma est déduit de l'ID de `Pharmacie` en base),
donc pas d'injection de schéma ; (ii) la commande tourne avec le même rôle PostgreSQL que l'application (pas de super-utilisateur) ;
(iii) elle n'écrit que dans `MetriquesTenantJour` ; (iv) une pharmacie en erreur n'empêche pas les autres (chaque schéma est dans son
propre `try/except`, l'erreur est consignée et signalée dans la vue Santé) ; (v) aucune donnée personnelle ne quitte son schéma.

---

## 4. Ce que l'admin doit savoir sur chaque pharmacie (catalogue de données)

Chaque ligne indique la **source**, l'**état actuel** dans le code, et si c'est livré en lecture directe (L) ou via l'instantané quotidien (I).

### 4.1 Identité et contact (L, schéma public)

| Donnée | Source | État |
|---|---|---|
| Nom, nom public, identifiant technique (`schema_name`) | `Pharmacie` | ✅ existe |
| Domaine(s), domaine primaire | `Domain` | ✅ existe |
| Titulaire : email, téléphone | `Pharmacie.proprietaire_*` | ✅ existe |
| Adresse, téléphone public, logo, coordonnées GPS | miroir marketplace (`*_public`, `latitude/longitude`) | ✅ existe |
| Date d'inscription | `date_creation` | ✅ existe |
| Services proposés, horaires, H24 | `services`, `ouvert_24h`, `HoraireOuverture` | ✅ existe |
| **Pays / ville / région** | – | ❌ manque (champ `ville`, utile pour segmenter ; le code note volontairement l'absence de `pays`) |
| **Numéro d'agrément / licence** de la pharmacie | – | ❌ manque (**🔶** utile pour la conformité, à décider §12.6) |
| **Source d'acquisition, commercial responsable** | – | ❌ manque (CRM léger, optionnel) |

### 4.2 Abonnement et statut (L)

| Donnée | Source | État |
|---|---|---|
| Plan (`essai/standard/pro/suspendu`), actif | `Pharmacie` | ✅ champs, ❌ **non appliqués** (§3.1b) |
| **Date de fin d'essai** | – | ❌ manque : sans elle, aucun `essai` ne peut expirer |
| **Date de début d'abonnement, prochaine échéance, motif de suspension, date de suspension** | – | ❌ manque |
| **Historique des changements de plan** | `JournalAudit` (dès la phase 1) | ❌ à construire |
| Facturation SaaS (factures, paiements) | – | ❌ phase ultérieure |

Décision de modèle : séparer **plan** (offre commerciale) et **statut** (actif / en essai / suspendu / résilié). Le mélange
actuel (`suspendu` est une valeur de `plan`) empêche de savoir quel plan avait une pharmacie suspendue. **🔶 §12.5**.

### 4.3 Activité (I, instantané quotidien)

| Mesure | Calcul dans le schéma de la pharmacie |
|---|---|
| Dernière commande (date) | `MAX(Commande.date)` |
| Commandes sur 7 / 30 jours, en ligne vs guichet | `COUNT` filtré par `date` et `type_vente` |
| Dernière connexion d'un membre du personnel | `MAX(auth_user.last_login)` (`UPDATE_LAST_LOGIN` est actif) |
| Nombre de membres du personnel actifs | `COUNT(auth_user WHERE is_active)` dont admins / caissières |
| Nombre de clients distincts ayant commandé (30 j) | `COUNT(DISTINCT compte_client_id)`, **comptage uniquement** |
| Paiements à vérifier en attente, ancienneté du plus vieux | `Commande.statut == paiement_a_verifier` |

### 4.4 Volume et taille (I)

| Mesure | Calcul |
|---|---|
| Produits au catalogue, produits en stock, produits proches de la péremption | `COUNT` sur `Produit`, `LotProduit` |
| Total de commandes, de lignes de commande | `COUNT` |
| **Taille du schéma en base** | `SELECT SUM(pg_total_relation_size(...))` sur les tables du schéma ; **taille des médias** (ordonnances, logos, images produits) par dossier |
| Nombre d'ordonnances stockées | `COUNT` (jamais leur contenu) |

### 4.5 Contribution et poids (I, calculé à l'affichage)

On répond à « peser sa contribution » **sans afficher d'argent** (§12.1) :

- **Part du volume** : commandes de la pharmacie ÷ commandes de toute la plateforme sur la période.
- **Part des commandes en ligne** (usage de la marketplace, donc valeur de la plateforme pour cette pharmacie).
- **Part du stockage** et de la charge (aide à dimensionner et à tarifer).
- **Rang** parmi les pharmacies actives, et **tendance** (30 j vs 30 j précédents) : croissance, stabilité, déclin.
- **Statut d'engagement** dérivé (règles simples et explicites, pas de « score » opaque) :
  `nouvelle` (< 14 j), `active` (≥ 1 commande sur 14 j), `dormante` (aucune commande 14 à 30 j), `a_risque` (> 30 j sans commande
  ou essai expirant sous 7 j sans activité), `suspendue`.

Si le chiffre d'affaires est finalement souhaité (§12.1), il s'ajoute comme `ca_30j` dans l'instantané, avec les mêmes
précautions que `core/analytics.py` (marge exclue des produits sans coût, etc.) et un droit d'accès réservé aux rôles
`proprietaire`/`admin`/`finance`. **À ne pas faire sans accord contractuel avec les pharmacies** (c'est leur donnée commerciale).

### 4.6 Santé et support (I + L)

| Donnée | Source |
|---|---|
| Statut de la dernière collecte (réussie / en erreur, message) | `MetriquesTenantJour.statut_collecte` |
| Erreurs applicatives par pharmacie | Sentry (lien profond depuis la fiche, filtre par tag `schema`) ; **à faire** : taguer les événements Sentry avec `schema_name` |
| Latence / indisponibilité | `/healthz/` global ; par pharmacie = **à construire** (sonde par domaine) |
| Sauvegardes | `backup_db` existe (base entière, pas par pharmacie) ; afficher la date de la dernière sauvegarde réussie |
| Notes internes du support | `NoteTenant` (auteur, date, texte) |
| Version / fonctionnalités activées | indicateurs (paiement mobile configuré ? marketplace complétée ? logo ? horaires ?) ; calculés depuis `PharmacieConfig` lors de la collecte |

**Intervention dans une pharmacie** : pas d'« impersonation » (se connecter comme un pharmacien) en phase 1. Si le besoin
apparaît : fonctionnalité séparée, limitée dans le temps, avec consentement de la pharmacie, journalisée, et signalée à l'écran
de la pharmacie. **🔶 §12.7**.

### 4.7 Vue « clients globaux » (I)

`CompteClient` est global. Utile à la plateforme : nombre de comptes, croissance, comptes inactifs, **nombre de pharmacies
utilisées par compte**. Cette dernière donnée n'existe pas en public (les commandes vivent par pharmacie) ; la collecte remplit
`UsageClientPharmacie(compte_client, pharmacie, nb_commandes, derniere_commande)`. L'admin voit des **compteurs et des
distributions** ; l'email/téléphone d'un client n'est affiché qu'au rôle `support`/`admin`, sur recherche exacte, avec journalisation
de l'accès (principe de minimisation).

---

## 5. Instantané quotidien : fonctionnement

Pourquoi pas des requêtes en direct : agréger N schémas à chaque affichage de liste coûte N requêtes et ne passe pas à l'échelle
(plus la liste grandit, plus l'écran ralentit) ; l'instantané donne en plus l'**historique** (tendances) pour presque rien.

**Commande** : `python manage.py collecter_metriques_tenants [--schema X] [--jour AAAA-MM-JJ]`.

1. Boucle sur les `Pharmacie` actives hors schéma `public`.
2. Pour chacune : `with schema_context(p.schema_name):` calcule les mesures §4.3 à §4.6 (agrégats SQL, pas de chargement d'objets).
3. `update_or_create` d'une ligne `MetriquesTenantJour(pharmacie, jour)` (idempotent : relancer la commande le même jour met à jour).
4. En cas d'exception : consigner `statut_collecte="erreur"` + message court ; continuer.
5. Terminer en recalculant `UsageClientPharmacie` et en purgeant au-delà de 24 mois (rétention).

**Planification** : le projet n'a ni Celery ni planificateur aujourd'hui. Choix retenu : **cron système / planificateur de
l'hébergeur** appelant la commande chaque nuit (comme `backup_db`, déjà prévu ainsi dans `docs/BACKUP_POSTGRESQL.md`). Un
bouton « Actualiser maintenant » (rôle `admin`) lance la collecte d'**une seule** pharmacie en tâche courte (limitée en débit) pour
le confort, sans bloquer la requête plus de quelques secondes.

Pas de ré-implémentation de `core/analytics.py` : la collecte l'appelle quand une mesure existe déjà (ex. volumes), pour
rester cohérent avec ce que voit le pharmacien.

---

## 6. Modèles à créer (schéma `public`, app `plateforme`)

### 6.1 `ComptePlateforme`
Voir §3.2.

### 6.2 `JournalAudit`
`id`, `acteur` (FK `ComptePlateforme`, null pour système), `acteur_email` (copie, survit à la suppression), `action`, `cible_type`,
`cible_id`, `avant` (JSON), `apres` (JSON), `ip`, `user_agent`, `date` (indexé). Append-only.

### 6.3 `MetriquesTenantJour` et `UsageClientPharmacie`

`MetriquesTenantJour` : `pharmacie` (FK), `jour` (date), unique `(pharmacie, jour)`, `statut_collecte`, `erreur`, puis les mesures
§4.3–4.6 en colonnes typées (entiers/dates, **pas de JSON fourre-tout** pour les mesures filtrables), index sur `(jour)` et
`(pharmacie, jour)`.
`UsageClientPharmacie` : `compte_client` (FK), `pharmacie` (FK), `nb_commandes`, `derniere_commande`, unique `(compte_client, pharmacie)`.

### 6.4 Extensions de `Pharmacie` (migration dans `tenants`)
`statut` (`essai/actif/suspendu/resilie`, avec migration de données depuis `plan == 'suspendu'` et `actif`), `fin_essai`, `date_suspension`,
`motif_suspension`, `ville`, `numero_agrement` (selon §12.6). Garder `plan` = offre commerciale (`essai/standard/pro`).

### 6.5 `NoteTenant`
`pharmacie`, `auteur`, `texte`, `date`.

### 6.6 Plus tard : `Abonnement` / `FactureSaaS`
Hors périmètre de ce document (phase 6, besoin de décisions commerciales : prix, cycle, TVA, moyens de paiement).

---

## 7. Écrans et routes d'API

Base : `/api/v1/plateforme/`. Authentification `PlateformeJWTAuthentication`, sauf mention. Pagination DRF standard,
recherche `?q=`, tris `?ordre=`. Toutes les réponses d'erreur : `{"error": "message"}` (comme le reste de l'API).

| # | Écran (frontend `app/plateforme/…`) | Contenu | Routes |
|---|---|---|---|
| 1 | `/login` + `/login/2fa` | Connexion en deux temps | `POST auth/connexion/` · `POST auth/2fa/` · `POST auth/rafraichir/` · `POST auth/deconnexion/` · `GET auth/moi/` |
| 2 | `/` Tableau de bord | KPIs globaux : pharmacies par statut, nouvelles (30 j), actives/dormantes/à risque, essais qui expirent, commandes plateforme (7/30 j), clients globaux, santé des collectes | `GET tableau-de-bord/` |
| 3 | `/pharmacies` | Liste filtrable (plan, statut, engagement, ville), recherche, tri (activité, taille, date), export CSV | `GET pharmacies/` · `GET pharmacies/export.csv` |
| 4 | `/pharmacies/[id]` | Fiche complète (§4) : identité, abonnement, activité, volume, contribution, santé, notes, historique d'audit de cette pharmacie, courbes sur 90 j | `GET pharmacies/<id>/` · `GET pharmacies/<id>/metriques/?du=&au=` · `GET pharmacies/<id>/audit/` |
| 5 | actions sur la fiche | Changer le plan, suspendre / réactiver (avec motif), éditer le contact titulaire, notes | `PATCH pharmacies/<id>/` · `POST pharmacies/<id>/suspendre/` · `POST pharmacies/<id>/reactiver/` · `GET/POST pharmacies/<id>/notes/` · `POST pharmacies/<id>/actualiser-metriques/` |
| 6 | `/pharmacies/nouvelle` | Onboarding : crée `Pharmacie` + `Domain` + premier compte admin dans le schéma (mot de passe provisoire à changer) + email de bienvenue | `POST pharmacies/` (la création de schéma est lente : réponse `202` + état, ou création synchrone avec délai long, à mesurer) |
| 7 | `/clients` | Compteurs, croissance, distribution « nombre de pharmacies par client », recherche exacte (email) pour le support | `GET clients/stats/` · `GET clients/?q=` |
| 8 | `/sante` | Dernière collecte par pharmacie (OK/erreur), pharmacies sans activité, sauvegardes, lien Sentry | `GET sante/` |
| 9 | `/audit` | Journal filtrable (acteur, action, cible, période), export | `GET audit/` |
| 10 | `/equipe` (rôle `proprietaire`) | Comptes plateforme : créer, changer le rôle, désactiver, réinitialiser le 2FA | `GET/POST equipe/` · `PATCH equipe/<id>/` · `POST equipe/<id>/reinitialiser-2fa/` |
| 11 | `/facturation` | Phase 6 | – |

Contrat de la liste (exemple de ligne) :

```json
{
  "id": 3, "nom": "Pharmacie Dupont", "schema_name": "dupont", "domaine": "dupont.pharmacieplus.com",
  "plan": "standard", "statut": "actif", "engagement": "active",
  "date_creation": "2026-03-02T10:11:00Z", "fin_essai": null,
  "proprietaire_email": "…", "ville": "Douala",
  "derniere_commande": "2026-10-17T14:02:00Z", "commandes_30j": 412, "part_volume_pct": 8.4, "tendance_pct": 12.0,
  "personnel_actif": 4, "taille_mo": 318, "derniere_collecte": "2026-10-18T02:00:00Z", "collecte_ok": true
}
```

---

## 8. Frontend

- Dossier `app/plateforme/` avec sa propre mise en page (pas de bandeau de pharmacie, pas de `ConfigPharmacieProvider`, pas de splash de pharmacie) ; identité **Pharmacie+** (`public/branding/logo-card-green.png`).
- Ajouter `/plateforme` aux routes spéciales de `app/layout.tsx` (même mécanisme que `/admin`, `/caisse`).
- Client API dédié (`lib/plateformeClient.ts`) qui ne partage ni jeton ni intercepteur avec `apiClient.ts`.
- Design : responsive ; l'admin plateforme est surtout consulté sur ordinateur, mais la liste et la fiche doivent rester lisibles sur mobile (règle mobile-first du projet).
- Accessibilité et libellés : français d'abord, clés i18n dès le départ (une autre session fait l'internationalisation : se coordonner avant d'ajouter des chaînes).

---

## 9. Tests exigés (règle du projet : tester réellement)

- **Sécurité** : jeton de pharmacie refusé sur `/plateforme/` ; jeton `plateforme` refusé sur les routes pharmacie et client ; jeton d'une pharmacie refusé sur une autre (correctif §3.1a) ; route `/plateforme/` en 404 sur un sous-domaine ; verrouillage après 5 échecs ; 2FA obligatoire ; permissions de chaque rôle sur chaque écriture.
- **Audit** : chaque écriture produit exactement une ligne ; `JournalAudit` non modifiable.
- **Suspension** : un tenant suspendu reçoit 403 sur l'API et refuse les WebSockets ; réactivation immédiate.
- **Collecte** : valeurs exactes sur des jeux de données connus (`TenantTestCase`), idempotence, isolation des erreurs (une pharmacie cassée n'arrête pas les autres), aucune donnée personnelle dans les colonnes.
- **Performance** : liste de 200 pharmacies en un nombre constant de requêtes (`CaptureQueriesContext`, comme le garde-fou N+1 de la marketplace).

---

## 10. Risques et points d'attention

| Risque | Mesure |
|---|---|
| Faille de jeton inter-pharmacies (§3.1a) | Phase 0, test d'abord |
| Suspension sans effet (§3.1b) | Phase 0 |
| Compte plateforme compromis = accès à toutes les pharmacies | 2FA, jetons courts, IP autorisées, rôles minimaux, audit, aucune lecture de données de santé |
| Instantané périmé | Afficher la date de collecte partout ; bouton d'actualisation |
| Création de schéma lente (onboarding) | Réponse asynchrone ou délai long ; ne jamais bloquer un worker web trop longtemps |
| Suppression de pharmacie | **Interdite depuis l'interface** (`auto_drop_schema = False` est voulu) : résiliation = `statut=resilie` + export puis archivage manuel |
| Couplage avec les autres sessions (marketplace, i18n) | Cette app n'importe pas `marketplace` ; elle ne touche pas aux fichiers i18n ; coordonner uniquement `app/layout.tsx` |

---

## 11. Plan de réalisation par phases

| Phase | Contenu | Livrable testable |
|---|---|---|
| **0. Sécurité préalable** | Test qui démontre la faille de jeton ; claim `schema` + vérification ; middleware de suspension (HTTP + WebSocket) ; tests | Jeton A refusé sur B ; tenant suspendu bloqué |
| **1. Fondations** | App `plateforme`, `ComptePlateforme`, `JournalAudit`, authentification + 2FA + rôles, commande `creer_compte_plateforme`, routes `auth/*`, throttle, tests sécurité | Connexion 2FA fonctionnelle, rien d'autre |
| **2. Lecture des pharmacies** | Extensions de `Pharmacie` (migration), `MetriquesTenantJour`, commande de collecte, routes `pharmacies/` (liste + fiche), `tableau-de-bord/`, `sante/` | Liste et fiche avec vraies mesures |
| **3. Actions** | Plan, suspension/réactivation, notes, contact titulaire, journal visible | Actions auditées |
| **4. Onboarding** | `POST pharmacies/` : tenant + domaine + premier admin + email | Pharmacie créée de bout en bout |
| **5. Clients globaux et audit** | `UsageClientPharmacie`, routes `clients/*`, `audit/`, `equipe/` | Écrans 7, 9, 10 |
| **6. Frontend** | `app/plateforme/*` (peut démarrer en parallèle dès la phase 2 sur contrat fixé §7) | Interface complète |
| **7. Facturation SaaS** | Après décisions commerciales | – |

Chaque phase : tests, mise à jour de `PROMPT_REPRISE.md`, commit. Les phases 0 et 1 sont indispensables avant tout le reste.

---

## 12. 🔶 Décisions à prendre (par le propriétaire du produit)

1. **Chiffre d'affaires des pharmacies** : afficher (avec accord contractuel et droits restreints) ou se limiter à l'activité et à la part du volume ? *Recommandation : ne pas l'afficher en phase 1-5.*
2. **2FA** : obligatoire pour tous (recommandé) ?
3. **Domaine et déploiement** : `plateforme.<domaine>` dédié (recommandé) ou chemin `/plateforme` ; même projet Next.js ou application séparée ?
4. **Stockage du jeton** : cookie HttpOnly (recommandé) ou `localStorage` comme le reste de l'application ?
5. **Statuts** : séparer `plan` et `statut` (recommandé) ; une pharmacie suspendue : blocage total ou lecture seule pour son personnel ? Quel message afficher ?
6. **Champs supplémentaires sur la pharmacie** : ville, numéro d'agrément, commercial responsable, source d'acquisition.
7. **Support** : faut-il prévoir un jour une « prise en main » temporaire d'une pharmacie (avec consentement) ?
8. **Équipe** : combien de comptes et quels rôles au démarrage ?
9. **Politique de résiliation et de conservation des données** (durée, export remis à la pharmacie, suppression) ; à valider avec un juriste.
10. **Facturation SaaS** : modèle de prix, cycle, moyens de paiement (mobile money ?), qui facture, TVA.

---

## 13. Hors périmètre

Facturation automatique (phase 7), prise en main d'une pharmacie, envoi de messages groupés aux pharmacies, tableau de bord financier
des pharmacies, application mobile de l'admin plateforme.
