# Contribuer à Pharmacie+

Merci de l'intérêt que tu portes à Pharmacie+ ! Ce document explique comment contribuer au projet de façon efficace et en cohérence avec les décisions d'architecture déjà prises.

---

## 📋 Avant de commencer

### Prérequis système

| Outil | Version minimale | Notes |
|---|---|---|
| Python | 3.11+ | Via `python3` |
| Node.js | 20+ | LTS recommandé |
| PostgreSQL | 16 | **Obligatoire** — django-tenants ne fonctionne pas avec SQLite |
| Redis | 7+ | Obligatoire pour Django Channels (WebSocket) et rate limiting |
| libmagic | Système | `apt install libmagic1` sur Ubuntu |

### Installation de l'environnement de développement

```bash
# 1. Cloner le dépôt
git clone https://github.com/Godwin296/New_Pharmacie_Plus.git
cd New_Pharmacie_Plus

# 2. Backend
cd pharmacie-backend
python3 -m venv venv
venv/bin/pip install -r requirements.txt
cp .env.example .env   # puis remplir les valeurs

# 3. Base de données
service postgresql start
su postgres -c "psql -c \"ALTER USER postgres PASSWORD 'postgres';\""
su postgres -c "psql -c \"CREATE DATABASE pharmacie_saas;\""
venv/bin/python manage.py migrate_schemas --shared

# 4. Frontend
cd ../pharmacie-frontend
npm install

# 5. DNS local pour le multi-tenant
echo "127.0.0.1 dupont.localhost martin.localhost" >> /etc/hosts
```

### Lancer les serveurs

```bash
# Terminal 1 — Backend (ASGI obligatoire pour WebSocket)
cd pharmacie-backend
service redis-server start
venv/bin/daphne -b 0.0.0.0 -p 8000 config.asgi:application

# Terminal 2 — Frontend
cd pharmacie-frontend
npm run dev
```

> ⚠️ **Important** : Utilise toujours `daphne`, jamais `python manage.py runserver`. Ce dernier ne supporte pas les WebSockets de Django Channels.

---

## 🏗️ Architecture — Décisions à respecter

Ces décisions ont été prises délibérément. Ne les remets pas en question sans avoir lu la justification et en avoir discuté d'abord.

| Décision | Justification |
|---|---|
| Multi-tenant par **schéma PostgreSQL** (django-tenants) | Isolation totale des données entre pharmacies, pas de fuite possible par oubli d'un filtre `tenant_id` |
| Paiement **manuel** (Mobile Money vérifié par la caisse) | Utilisable immédiatement en production, fallback fiable même après intégration future d'un agrégateur |
| **Pas d'OCR automatique** pour les ordonnances | Écriture manuscrite des médecins camerounais trop variable pour déclencher une validation automatique |
| **Africa's Talking** pour les SMS (pas Twilio) | Meilleure couverture et coût plus faible en zone CEMAC |
| Prédiction de stock via **statistiques classiques** | Les LLM sont un mauvais outil pour ce problème ; moyenne mobile / séries temporelles suffisent |

---

## 🌿 Workflow Git

### Nommage des branches

```
feature/nom-court-de-la-feature
fix/description-du-bug
refactor/ce-qui-est-refactorisé
```

### Processus

1. **Fork** le dépôt et crée une branche depuis `main`
2. Code ta contribution (voir règles ci-dessous)
3. **Teste réellement** (PostgreSQL + Redis + Daphne réels, pas de mock)
4. Ouvre une **Pull Request** vers `main` avec un titre clair et une description des changements

### Messages de commit

Suit la convention [Conventional Commits](https://www.conventionalcommits.org/) :

```
feat: ajoute la gestion des lots (modèle LotProduit + FEFO)
fix: corrige le double déclenchement du WebSocket caisse
refactor: migre api_catalogue vers CataloguePagination DRF
docs: met à jour la section deployment du README
```

---

## ✅ Standards de qualité

### Règle absolue : tester réellement

> Ne déclare jamais qu'une fonctionnalité "devrait marcher" sans l'avoir testée avec PostgreSQL, Redis et Daphne réels.

Cela signifie concrètement :
- Lancer les migrations et vérifier qu'elles passent
- Appeler les endpoints avec `curl` ou un client HTTP réel
- Vérifier les logs Daphne pour les WebSockets
- Tester les cas limites (race conditions → `select_for_update()`, fichiers invalides → `validators.py`)

### Backend (Django)

- Tout accès concurrent à un stock ou une commande doit utiliser `select_for_update()`
- Les fichiers uploadés passent **toujours** par `valider_et_desinfecter_ordonnance()` (magic bytes + re-encodage Pillow + resize 1600px)
- Les nouvelles vues qui touchent des données sensibles doivent avoir un `@permission_classes` explicite
- Pas de logique métier dans les serializers — ça va dans les modèles ou les vues

### Frontend (Next.js)

- Tout montant affiché passe par le composant `<Prix montant={...} />` (`lib/components/Prix.tsx`) — ne jamais coder "FCFA" en dur
- Les appels API passent par `apiClient` (`lib/apiClient.ts`) — jamais de `fetch()` direct
- Les pages de catalogue utilisent la pagination DRF (paramètres `?page=` et `?page_size=`) — ne pas re-charger tout le catalogue en une seule requête
- Pas de `localStorage` pour la devise ou les préférences de devise — utilise `ConfigPharmacieContext`

### Sécurité

- Ne jamais commiter de clés secrètes, tokens, ou mots de passe (le `.env` est dans `.gitignore`)
- Tout nouveau endpoint public doit avoir un rate limiting approprié (voir `core/throttles.py`)
- Les uploads de fichiers doivent passer par `core/validators.py` sans exception

---

## 🚫 Ce qu'on n'accepte pas

- Code non testé ("ça devrait marcher")
- Contournement du système de validation des fichiers uploadés
- Ajout d'une dépendance npm ou pip sans justification claire
- Suppression de `select_for_update()` sur les opérations critiques
- Affichage de montants avec devise codée en dur (utilise `<Prix>`)
- Utilisation de `localStorage` pour stocker des données de configuration pharmacie

---

## 🗺️ Feuille de route — Où contribuer

Consulte les [Issues GitHub](https://github.com/Godwin296/New_Pharmacie_Plus/issues) pour les tâches ouvertes. Les priorités actuelles :

**Haute priorité**
- [ ] Gestion des lots (`LotProduit`) avec décrémentation FEFO
- [ ] Backups automatiques PostgreSQL
- [ ] Compte client global (`CompteClient` dans le schéma public) + marketplace

**Priorité normale**
- [ ] Dashboard analytics avancé (comparaison périodes, marge réelle)
- [ ] Notifications email transactionnelles
- [ ] Mode offline réel (Service Worker + IndexedDB)
- [ ] Refonte UI/UX mobile-first complète

**Contributions bienvenues**
- [ ] Logs d'accès aux ordonnances
- [ ] Internationalisation (next-intl)
- [ ] Page de paramètres compte client (thème, langue)

---

## 💬 Communication

Pour toute question sur l'architecture ou une contribution majeure, ouvre d'abord une **Issue** avant de coder — ça évite de travailler dans le mauvais sens.

Contact : [godwin@pharmacieplus.dev](mailto:godwin@pharmacieplus.dev)
