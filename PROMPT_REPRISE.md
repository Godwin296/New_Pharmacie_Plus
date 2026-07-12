# Prompt de reprise — Pharmacie+

Je reprends le développement de mon SaaS de gestion de pharmacie multi-tenant pour la zone CEMAC (Cameroun), avec toi comme associé technique. Le projet s'appelle **Pharmacie+**.

**Stack :** Django REST Framework (multi-tenant via django-tenants, isolation par schéma PostgreSQL) + Next.js 16/Turbopack + Django Channels (WebSocket temps réel) + Redis.

**Dépôt GitHub :** `https://github.com/Godwin296/New_Pharmacie_Plus` (branche `main`)

> ⚠️ Mon dépôt est **privé par défaut**. Je l'ouvre uniquement quand j'ai besoin que tu pousses du travail. Si tu n'arrives pas à cloner, dis-le-moi clairement et j'ouvrirai l'accès.

Clone ce dépôt et lis le code réel (pas juste le README) pour retrouver le contexte exact.

**Mon objectif :** vendre ce SaaS à des pharmacies clientes en zone CEMAC. Je suis étudiant en informatique à l'Université de Dschang, je communique en français, et je préfère un guidage pas à pas avec des tests réels.

---

## 🛠️ ENVIRONNEMENT TECHNIQUE — À INSTALLER AVANT TOUT TEST

Ces outils NE SONT PAS dans requirements.txt ni package.json — ce sont des dépendances système.

```bash
# 1. PostgreSQL 16 (obligatoire)
apt-get update && apt-get install -y postgresql postgresql-contrib
service postgresql start
su postgres -c "psql -c \"ALTER USER postgres PASSWORD 'postgres';\""

# 2. Redis (obligatoire pour Channels/WebSocket et rate limiting)
apt-get install -y redis-server
service redis-server start
redis-cli ping   # doit répondre PONG

# 3. libmagic (obligatoire pour core/validators.py)
dpkg -l | grep libmagic1t64   # vérifier si présent
# si absent : apt-get install -y libmagic1

# 4. DNS local multi-tenant
echo "127.0.0.1 dupont.localhost martin.localhost" >> /etc/hosts

# 5. Backend Python
cd pharmacie-backend
python3 -m venv venv_test
venv_test/bin/pip install -r requirements.txt

# 6. Frontend Node
cd pharmacie-frontend
npm install

# 7. Lancer le backend (ASGI obligatoire, pas runserver)
cd pharmacie-backend
venv_test/bin/daphne -b 0.0.0.0 -p 8000 config.asgi:application
```

> ⚠️ **Problème récurrent :** PostgreSQL, Redis et les process Daphne/Next.js NE SURVIVENT PAS entre deux appels d'outils séparés. Toujours relancer les services ET lancer le test dans la MÊME invocation de commande.

---

## 💾 STRATÉGIE DE SAUVEGARDE GIT

L'environnement de fichiers NE SURVIT PAS entre deux conversations. Seul un push GitHub effectif garantit que le travail n'est pas perdu.

**Procédure de push (token temporaire fourni par moi à chaque session) :**

```bash
git remote set-url origin https://Godwin296:LE_TOKEN@github.com/Godwin296/New_Pharmacie_Plus.git
git add -A && git commit -m "message clair"
git push origin main
git remote set-url origin https://github.com/Godwin296/New_Pharmacie_Plus.git  # retirer le token
```

---

## ✅ CE QUI EST FAIT ET TESTÉ (ne pas refaire)

### Architecture & Sécurité
- Multi-tenant par schéma PostgreSQL (django-tenants) — isolation testée et prouvée
- WebSocket temps réel (Django Channels + Redis) — middleware tenant-aware + auth JWT custom
- Rate limiting DRF (login 5/min, paiement 10/min) — `core/throttles.py`
- Compression GZip activée
- Upload ordonnance sécurisé (`core/validators.py`) : magic bytes, anti-stéganographie (Pillow), JS strippé (pikepdf), **resize max 1600px avant compression JPEG** (ajouté session 1)
- SECRET_KEY depuis variables d'environnement (.env)

### Cycle métier complet
- Modèle Commande avec référence lisible (format PHC-AAAA-NNNNN)
- Cycle de vie complet : `en_cours → attente_validation → paiement_a_verifier → payee_a_retirer → retiree` (ou `annulee`)
- Paiement manuel mobile money (Orange Money/MTN MoMo) — vérification caissière avant décrémentation stock
- Numéros mobile money configurables par tenant (PharmacieConfig)
- Page caisse `/caisse/paiements` avec recherche et confirmation de retrait
- Vente au guichet (`api_vente_directe`) avec case ordonnance vérifiée visuellement
- Anti race-condition : `select_for_update()` sur toutes les opérations critiques
- Dashboard admin : ventilation CA cash/en ligne

### Performance
- **Pagination du catalogue** (ajouté session 2) : `CataloguePagination` DRF, 20 produits/page, filtre `?cat=` et recherche `?q=` côté serveur — `core/pagination.py` + frontend adapté avec debounce 400ms
- **Composant `<Prix>` centralisé** (ajouté session 3) : `lib/components/Prix.tsx` + `ConfigPharmacieProvider` dans `layout.tsx` — plus aucun "FCFA" codé en dur dans les 12 fichiers frontend, devise lue depuis `PharmacieConfig.devise_preferee`

### PWA
- Migré de `@ducanh2912/next-pwa` (incompatible Turbopack) vers `@serwist/turbopack`
- Service worker réellement généré et servi
- Icônes PNG générées (192/512 standard + maskable + apple-touch-icon 180px)

### Indexation BDD (session offline, 12/07 — 1ère brique du chantier "Mode offline réel")
- 15 nouveaux index PostgreSQL sur `Produit`, `Commande`, `Client`, `ClientGuichet`
  (`core/migrations/0006_...`), tous alignés sur des requêtes RÉELLES grepées dans `core/api.py`
  (pas d'index spéculatif) : `categorie`, `nom`, `date_expiration`, `(statut,-date)`,
  `(client,statut)`, `(payee,-date)`, `(payee,type_vente)`.
- Extension PostgreSQL `pg_trgm` activée (GIN trigram) pour accélérer les recherches
  `__icontains` (nom produit, laboratoire, nom/téléphone client, référence commande) qu'un
  index B-Tree classique ne peut PAS servir. **Piège rencontré et documenté** : `pg_trgm`
  doit être activée dans une migration SHARED_APP (schéma `public`), PAS dans `core`
  (TENANT_APP) — sinon l'extension se retrouve installée dans le schéma du 1er tenant migré
  et casse tous les tenants suivants (`operator class gin_trgm_ops does not exist`). Voir
  `tenants/migrations/0002_enable_pg_trgm.py` pour le détail.
- Index fonctionnel `Upper('identifiant')` : le code utilise `identifiant__iexact`, qui sous
  Postgres devient `UPPER(identifiant) = UPPER(%s)` — l'index unique standard n'est pas
  utilisé par ce type de requête sans cet index dédié.
- **Validé avec `EXPLAIN ANALYZE` sur un catalogue de test à 8000 lignes** (pas juste "ça
  migre sans erreur") : `prod_ident_upper_idx` et `prod_nom_idx` bien utilisés (Index Scan),
  `prod_nom_trgm_idx` bien utilisé (Bitmap Index Scan) sur une recherche sélective réaliste
  (9 résultats/8010 lignes, 0.37ms vs Seq Scan sur motif peu sélectif où Postgres a raison de
  préférer le Seq Scan — comportement attendu, pas un bug).
- ⚠️ À vérifier avant déploiement prod sur hébergeur managé : `pg_trgm` doit faire partie des
  extensions autorisées (cas de la quasi-totalité des offres PostgreSQL managées modernes).

### Synchro delta du catalogue (session offline, 12/07 — brique 2/4)
- Nouveau champ `Produit.date_modification` (`auto_now=True`, indexé) : curseur de la synchro.
- Nouveau modèle `ProduitSupprimeLog` (tombstone) + signal `post_delete` (`core/signals.py`,
  branché via `CoreConfig.ready()`) : trace les suppressions pour que le cache offline
  (IndexedDB, brique 3/4 à venir) sache retirer un produit supprimé côté serveur.
- Nouvel endpoint `GET /api/catalogue/sync/?since=<ISO8601>` (`api_catalogue_sync` dans
  `core/api.py`) : renvoie UNIQUEMENT les produits créés/modifiés + supprimés depuis `since`
  (au lieu de tout le catalogue à chaque appel — coûteux sur 3G/4G instable). Batché à 300
  produits/appel (`CATALOGUE_SYNC_BATCH_SIZE`), avec curseur `has_more`/`next_since` pour
  enchaîner les pages si un tenant a un très gros catalogue à synchroniser d'un coup.
- **Bug de pagination trouvé ET corrigé en testant réellement avec 350 produits générés en
  `bulk_create()`** (donc partageant le même `date_modification` à la milliseconde près) :
  un curseur `date_modification >= since` simple réintroduisait en double le dernier produit
  de la page précédente à la frontière (360 produits récupérés au lieu de 359 attendus). Fixé
  avec un curseur composé `(date_modification, id)` (`since` au format `"<ISO8601>|<id>"` en
  cours de pagination) — retesté : 359/359, zéro doublon, zéro perte.
- Frontend (IndexedDB, brique 3/4) : pas encore commencé.

### Scripts de seed (session offline, 12/07)
- `seed.py` et `mise_a_jour.py` fusionnés en un seul `seed.py` (l'ancien `mise_a_jour.py`
  a été supprimé) : plus simple à maintenir, un seul point d'entrée `python seed.py`.
- Catalogue de test passé de 10 à **100 produits par tenant** (générés, catégories/stock/
  dates de péremption variés) pour pouvoir tester la pagination catalogue (5 pages de 20) et
  le curseur de synchro offline en conditions réalistes.
- Rejouable sans risque : `python seed.py` peut être relancé à volonté, il régénère
  proprement le catalogue de test (supprime puis recrée uniquement les produits qu'IL a
  générés, préfixe `DUP-`/`MAR-`) sans toucher aux tenants/comptes/config déjà en place ni
  aux produits saisis manuellement par un vrai utilisateur.
- Corrigé au passage : l'ancien seed utilisait des codes de catégorie (`antipaludeen`,
  `autre`) absents de `Produit.CATEGORIES` — invisibles dans les filtres catalogue du
  frontend bien qu'enregistrés en base (Django ne valide les `choices` qu'au `full_clean()`,
  pas au `.save()`).
- ⚠️ Reset complet d'un tenant (DROP du schéma PostgreSQL) reste volontairement une action
  MANUELLE, jamais automatisée dans ce script — cf. `tenants/models.py`,
  `auto_drop_schema = False` ("on ne supprime jamais un schéma automatiquement").

### Bugs corrigés (historique)
- `generate_qr_base64` importé depuis le mauvais module
- `agent_validateur` recevait un username au lieu d'un objet User
- `requirements.txt` encodé en UTF-16 + `djangorestframework-simplejwt` manquant
- `Produit.ordonnance_obligatoire` absent en base (faille réglementaire)
- `CommandeSerializer` exposait le nom de l'agent au client final
- `get_or_create()` dans le panier pouvait provoquer `MultipleObjectsReturned`

---

## 🏗️ DÉCISIONS D'ARCHITECTURE (à respecter)

| Décision | Statut |
|---|---|
| Isolation multi-tenant PAR SCHÉMA (pas tenant_id) | ✅ Implémenté |
| Compte client global (`CompteClient` dans schéma public) | 🔜 À faire — confirmé absent du code (grep `CompteClient` : 0 résultat). Prochain chantier choisi (session du 05/07), avant le test de la vente en ligne. |
| Marketplace de sélection de pharmacie | 🔜 À faire (lié à CompteClient) |
| Paiement manuel (option A) comme fallback permanent | ✅ Implémenté |
| OCR uniquement aide visuelle, jamais automatisé | Décision ferme |
| Africa's Talking pour SMS (pas Twilio) | Décision ferme |
| Prédiction stock = statistiques classiques, PAS LLM | Décision ferme |

---

## 📋 TODO-LIST COMPLÈTE (par difficulté croissante)

### 🟢 Facile (quelques heures, périmètre limité)
- [x] **Lazy loading images catalogue** — vérifié : `loading="lazy"` bien présent dans `app/catalogue/page.tsx`
- [x] **Toggle thème clair/sombre** — vérifié : `ThemeToggleButton.tsx` + `next-themes` + `.dark` sur `<html>`, fonctionnel
- [x] **Email transactionnel basique** — vérifié : `core/emails.py`, déclenché depuis `Commande.valider()`, échec non bloquant
- [ ] **Logs centralisés Sentry** — ⚠️ RETIRÉ le 04/07 (`@sentry/nextjs` 9.x incompatible Next.js 16). À noter : Sentry propose désormais une v10.x avec support officiel Next.js 16 (`instrumentation.ts` + `onRequestError`) — à réévaluer et RE-TESTER isolément avant réintégration, pas de suppositions sur la compatibilité actuelle sans un vrai `npm install` + build.
- [ ] **Retrait de `app/page.tsx`** — toujours en attente (refonte prévue en toute dernière session). En attendant, `app/layout.tsx` exclut désormais `/` de son nav/footer générique (fix session du 05/07) pour éviter le double bandeau visible tant que cette page n'est pas refaite.

### 🐞 Bugs trouvés lors de l'audit du 05/07 (corrigés cette session)
- [x] **Double bandeau sur `/`** — `layout.tsx` affichait son propre nav+footer (texte "Pharmacie +" codé en dur) EN PLUS de celui, dynamique, de `page.tsx`. Fix : `/` exclu du nav générique.
- [x] **Logo cassé dès qu'il est uploadé** — `infos_pharmacie` (core/api.py) sérialisait `PharmacieConfig` sans `context={'request': request}` → l'`ImageField` `logo` aurait renvoyé un chemin relatif (`/media/config/...`), inutilisable par le frontend qui tourne sur un autre port/domaine. Fix : contexte ajouté, l'API renvoie maintenant une URL absolue.
- [ ] **Accès multi-tenant simultané (2 onglets)** — PAS un bug de code : `lib/apiClient.ts` déduit déjà dynamiquement le tenant depuis `window.location.hostname` si `NEXT_PUBLIC_API_URL` n'est pas défini. Ton `.env.local` local fige cette valeur sur `dupont.localhost:8000`, ce qui bloque tout autre tenant. Solution : retirer `NEXT_PUBLIC_API_URL` de `.env.local` et redémarrer `npm run dev` (voir message de chat pour le détail).

### 🟡 Effort moyen (plusieurs sessions)
- [ ] **Backups automatiques PostgreSQL** — cron + pg_dump ou Railway/Render managé, critique (actuellement zéro backup)
- [ ] **Toggle vérification ordonnance par tenant** — champ booléen sur `PharmacieConfig` + clause CGU
- [ ] **Dashboard analytics avancé** — comparaison période/période, marge réelle (ajouter `prix_achat` sur `Produit`), export multi-format
- [ ] **Chiffrement au repos des ordonnances** — stockage chiffré applicatif ou niveau filesystem
- [ ] **Internationalisation (next-intl)** — extraction de tout le texte FR en dur, gros volume mécanique
- [ ] **Détection d'interactions médicamenteuses** — table de règles métier statiques, pas d'IA

### 🔴 Effort élevé / risque architectural
- [ ] **Gestion des lots (`LotProduit`) + FEFO** — nouveau modèle, migration données existantes (`Produit.lot`/`date_expiration` → lots individuels), décrémentation FEFO dans tout le cycle de vente sans casser `select_for_update()`
- [ ] **Compte client global (`CompteClient`) + marketplace** — modèle dans schéma public, nouveau JWT clients (distinct personnel), migration clients existants, page marketplace
- [ ] **Mode offline réel (Service Worker + IndexedDB)** — synchronisation bidirectionnelle catalogue/panier. Découpé en 4 briques (session du 12/07) :
  - [x] **1/4 — Indexation BDD** — voir section "Indexation BDD" ci-dessus. Fait et testé (EXPLAIN ANALYZE, 8000 lignes).
  - [x] **2/4 — Cache catalogue en IndexedDB (côté backend)** — endpoint `/api/catalogue/sync/` avec synchro delta + curseur, testé (voir section "Synchro delta du catalogue" ci-dessus). ⚠️ Reste à faire : la partie FRONTEND (IndexedDB réel dans le navigateur, pas encore commencée).
  - [ ] **3/4 — File d'attente panier hors-ligne** (ajout au panier en offline, sync auto au retour réseau) — Background Sync API + IndexedDB côté client.
  - [ ] **4/4 — Adaptation du service worker** (`app/sw.ts`) pour mettre en cache les réponses API catalogue (actuellement volontairement minimal, ne cache que les assets statiques).
- [ ] **Refonte UI/UX mobile-first complète** — maquettes disponibles (6 images, style vert émeraude, cartes arrondies, bottom nav avec bouton central flottant, splash screen avec halo radial). À attaquer APRÈS le compte client global.

---

## 🎨 DIRECTION STYLISTIQUE (maquettes reçues)

Des maquettes ont été fournies et analysées. Points clés à respecter lors de la refonte :
- Vert émeraude dominant (`emerald-500/600`), fond blanc/gris-vert très pâle
- Cartes très arrondies (`rounded-2xl`/`3xl`), ombres douces, beaucoup d'espace blanc
- Bannières dégradées vert foncé→clair avec icônes flottantes décoratives
- Bottom nav mobile avec bouton central flottant rond (panier/+) qui dépasse de la barre
- Écran connexion avec sélection de rôle par cartes (Client/Caisse/Admin) avant le formulaire
- Splash screen avec halo radial + icônes flottantes en orbite
- Dashboard admin : sidebar sombre verte sur desktop, clair sur mobile

---

## ⚙️ COMMENT JE PRÉFÈRE TRAVAILLER

- Toujours tester réellement (PostgreSQL/Redis/Daphne réels, pas de simulation)
- Expliquer les concepts techniques que je ne connais pas (j'apprends en construisant)
- Ne jamais me restituer le code dans le chat — travailler dans l'environnement de fichiers
- Me prévenir clairement quand il est temps de pousser vers GitHub
- Ne pas remettre en question les décisions d'architecture sans bonne raison documentée

---

## 💻 TESTER EN LOCAL SUR TON PC

Pour tester le projet sur ta machine personnelle :

### Prérequis minimum
- Python 3.11+, Node.js 20+, PostgreSQL (déjà installé selon toi), Git

### Ce qui manque sur ton PC
- **Redis** — obligatoire pour les WebSockets. Installation : [https://redis.io/docs/install/](https://redis.io/docs/install/) ou via Docker : `docker run -d -p 6379:6379 redis`
- **Daphne** — installé automatiquement via `pip install -r requirements.txt`
- **libmagic** — `brew install libmagic` sur Mac, `apt install libmagic1` sur Linux

### Commandes
```bash
git clone https://github.com/Godwin296/New_Pharmacie_Plus.git
cd New_Pharmacie_Plus

# Backend
cd pharmacie-backend
python3 -m venv venv && venv/bin/pip install -r requirements.txt
cp .env.example .env   # remplir DB_NAME, DB_USER, DB_PASSWORD
venv/bin/python manage.py migrate_schemas --shared
venv/bin/daphne -b 127.0.0.1 -p 8000 config.asgi:application

# Frontend (autre terminal)
cd pharmacie-frontend
npm install && npm run dev
# → ouvre http://localhost:3000
```

### DNS local (multi-tenant obligatoire)
```bash
# Sur Mac/Linux :
sudo echo "127.0.0.1 dupont.localhost" >> /etc/hosts
# Sur Windows : éditer C:\Windows\System32\drivers\etc\hosts
```

Ensuite accède à `http://dupont.localhost:3000` (pas `localhost:3000` — le sous-domaine détermine quel tenant est servi).

---

**Par où veux-tu commencer ?**
