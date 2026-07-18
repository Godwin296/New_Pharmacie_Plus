# Prompt de reprise — Pharmacie+

Je reprends le développement de mon SaaS de gestion de pharmacie multi-tenant pour la zone CEMAC (Cameroun), avec toi comme associé technique. Le projet s'appelle **Pharmacie+**.

**Stack :** Django REST Framework (multi-tenant via django-tenants, isolation par schéma PostgreSQL) + Next.js 16/Turbopack + Django Channels (WebSocket temps réel) + Redis.

**Dépôt GitHub :** `https://github.com/Godwin296/New_Pharmacie_Plus` (branche `main`)

> ⚠️ Mon dépôt est **privé par défaut**. Je l'ouvre uniquement quand j'ai besoin que tu pousses du travail. Si tu n'arrives pas à cloner, dis-le-moi clairement et j'ouvrirai l'accès.

**Ce que ce document contient :** uniquement ce qu'il **reste à faire**, priorisé. Pour ce qui est déjà fait, regarde le [README.md](README.md) (feuille de route à jour), le dossier [docs/](docs/) (versionnement API, backups) et l'historique `git log` — un travail déjà poussé sur `main` a déjà été testé avant d'être commité (voir [CONTRIBUTING.md](CONTRIBUTING.md), règle "tester réellement").

> ⚠️ **Ce dépôt évolue en parallèle par plusieurs sessions/agents.** Avant de supposer qu'une fonctionnalité n'existe pas, vérifie toujours dans le code actuel (`grep`, lecture directe) plutôt que de te fier à un TODO potentiellement déjà obsolète — y compris celui-ci. Un `git pull`/`fetch` avant de commencer, et une revue rapide des derniers commits, évite de refaire un travail déjà fait ailleurs (vécu le 12/07 : suppression du modèle `Client` faite deux fois en parallèle, en pure perte de temps sur l'une des deux).

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
git push origin main   # si rejeté (non-fast-forward) : git rebase origin/main, résoudre les conflits réels, puis repush
git remote set-url origin https://github.com/Godwin296/New_Pharmacie_Plus.git  # retirer le token
```

---

## 🏗️ DÉCISIONS D'ARCHITECTURE (à respecter)

| Décision | Statut |
|---|---|
| Isolation multi-tenant PAR SCHÉMA (pas `tenant_id`) | ✅ Implémenté |
| Compte client global (`CompteClient`, schéma public) remplace l'ancien `Client` par-tenant | ✅ Implémenté — `Client` entièrement retiré du code (16/07) |
| Versionnement API par préfixe d'URL (`/api/v1/`, jamais casser une version en place) | ✅ Implémenté — voir [docs/API_VERSIONING.md](docs/API_VERSIONING.md) |
| Paiement manuel (mobile money vérifié par la caisse) comme fallback permanent | ✅ Implémenté |
| OCR uniquement aide visuelle, jamais automatisé | Décision ferme |
| Africa's Talking pour SMS (pas Twilio) | Décision ferme, pas encore implémenté |
| Prédiction stock = statistiques classiques, PAS LLM | ✅ Implémenté (`core/services_prediction.py`) |
| Cache Redis : TTL courts plutôt qu'invalidation manuelle par motif | ✅ Implémenté (`core/cache_utils.py`) — `django-redis` (avec `delete_pattern`) volontairement pas ajouté, voir le docstring du fichier |

---

## 📋 CE QUI RESTE À FAIRE — priorisé

### 🔴 Urgent (bug bloquant en production)
- [ ] **POS : la finalisation d'une vente au guichet échoue.** `core/api.py`, flux vente directe guichet : `Commande.objects.create(client=None, ...)` référence encore un champ `client` supprimé de `Commande` lors du retrait de l'ancien modèle `Client` (commentaire en place : *"Laissé vide car c'est une vente physique comptoir"*). Il suffit normalement de retirer cette ligne (le champ `client_guichet` juste en dessous suffit déjà) — **mais vérifier qu'aucune autre ligne du même genre n'a été oubliée ailleurs** dans le même flux avant de considérer que c'est réglé. (⚠️ Session du 18/07 : une autre session en parallèle gère ce chantier, ne pas y toucher en même temps.)

### 🟡 Effort moyen
- [ ] **Toggle vérification ordonnance par tenant** — champ booléen sur `PharmacieConfig`
- [ ] **Dashboard analytics avancé** — comparaison période/période, marge réelle (ajouter `prix_achat` sur `Produit`) ; détail complet (ce qui est faisable immédiatement vs bloqué par le modèle de données) dans [docs/UIUX_REFONTE_GUIDE.md](docs/UIUX_REFONTE_GUIDE.md#4-côté-admin-par-pharmacie--réponse-à-ta-question--dashboard-réellement-basique-tu-as-raison)
- [ ] **Chiffrement au repos des ordonnances**
- [ ] **Internationalisation (next-intl)**
- [ ] **Détection d'interactions médicamenteuses** — table de règles statiques, pas d'IA
- [ ] **Sentry frontend** — bloqué tant que `@sentry/nextjs` ne supporte pas Next.js 16 ; réévaluer périodiquement (une v10.x avec support officiel via `instrumentation.ts` était annoncée — vérifier son état actuel avant de re-tenter, ne pas supposer)

### 🔵 Documenté, implémentation volontairement différée (voir [docs/INFRASTRUCTURE_ROADMAP.md](docs/INFRASTRUCTURE_ROADMAP.md) pour le détail et le déclencheur de chaque point)
- [ ] Index PostgreSQL sur `Commande.statut`/`payee`/`date` — attendre que le modèle de données soit stable (fin de refonte)
- [ ] HTTPS/HSTS (`SECURE_SSL_REDIRECT` etc.) — attendre le choix de l'hébergement de production
- [ ] Docker + Docker Compose (backend + frontend + postgres + redis) — squelette prêt dans la doc, peut se faire relativement tôt sans risque
- [ ] CDN pour les images produits — pas urgent tant que le trafic reste local/faible

### 🔴 Effort élevé / risque architectural
- [ ] **Gestion des lots (`LotProduit`) + FEFO** — nouveau modèle, migration des données existantes, décrémentation FEFO sans casser `select_for_update()`
- [ ] **Page marketplace** (sélection de pharmacie par le client global `CompteClient`)
- [ ] **Refonte UI/UX mobile-first complète** — voir maquettes ci-dessous ET le guide fonctionnel détaillé [docs/UIUX_REFONTE_GUIDE.md](docs/UIUX_REFONTE_GUIDE.md) (pages manquantes par rôle, gaps identifiés côté caisse/dashboard admin). À attaquer une fois le bug POS réglé (priorité à la stabilité avant l'esthétique)
- [ ] **Admin plateforme "Pharmacie Plus"** — n'existe pas du tout aujourd'hui (seulement le Django admin brut sur le schéma public) ; nécessite sa propre authentification (comptes staff plateforme, séparés des comptes par-tenant) ; détail complet dans [docs/UIUX_REFONTE_GUIDE.md](docs/UIUX_REFONTE_GUIDE.md#5-admin-plateforme-pharmacie-plus--confirmé--ça-nexiste-pas-du-tout)
- [ ] **Notifications SMS (Africa's Talking)**

---

## 💬 Mon avis sur l'ordre à suivre (à discuter)

1. **Le bug POS d'abord, sans discussion** — une caisse qui ne peut plus encaisser une vente est un incident de production, pas une tâche de roadmap.
2. **Finir le mode offline (brique 4/4)** — puisque 3 briques sur 4 sont déjà faites et testées, terminer maintenant coûte moins cher que d'y revenir plus tard après avoir perdu le contexte.
3. Le reste (lots/FEFO, marketplace, refonte UI/UX, SMS, i18n) peut attendre — ce sont des fonctionnalités d'expansion, pas des risques. Les vrais risques identifiés au départ (pas de backup, pas de versioning API) sont déjà réglés.

Je n'ai pas d'avis tranché sur l'ordre entre lots/FEFO et marketplace — ça dépend surtout de ce qui te rapproche le plus vite d'un premier client payant, ce que je ne peux pas juger à ta place.

---

## 🎨 DIRECTION STYLISTIQUE (maquettes reçues, pour la refonte UI/UX)

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
- Vérifier l'état réel du code avant de supposer qu'une tâche reste à faire (voir avertissement en haut de ce document)

---

**Par où veux-tu commencer ?**
