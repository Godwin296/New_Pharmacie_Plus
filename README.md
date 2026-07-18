<div align="center">

<img src="https://raw.githubusercontent.com/Godwin296/New_Pharmacie_Plus/main/pharmacie-frontend/public/icons/icon-512x512.png" alt="Pharmacie+ Logo" width="120" />

# Pharmacie+

**Le SaaS de gestion de pharmacie pour la zone CEMAC**

*Votre santé, notre priorité*

[![License: BSL 1.1](https://img.shields.io/badge/License-BSL%201.1-blue.svg)](LICENSE)
[![Django](https://img.shields.io/badge/Django-5.2-092E20?logo=django)](https://www.djangoproject.com/)
[![Next.js](https://img.shields.io/badge/Next.js-16-000000?logo=next.js)](https://nextjs.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?logo=postgresql)](https://www.postgresql.org/)
[![Redis](https://img.shields.io/badge/Redis-7-DC382D?logo=redis)](https://redis.io/)
[![PWA](https://img.shields.io/badge/PWA-Ready-5A0FC8?logo=pwa)](https://web.dev/progressive-web-apps/)

---

<!-- DIAPORAMA CAPTURES D'ÉCRAN -->
<table>
<tr>
<td align="center"><b>🏠 Accueil Client</b></td>
<td align="center"><b>📦 Catalogue</b></td>
<td align="center"><b>🔐 Connexion</b></td>
</tr>
<tr>
<td><img src="https://placehold.co/300x540/059669/ffffff?text=Accueil+Client" width="200"/></td>
<td><img src="https://placehold.co/300x540/047857/ffffff?text=Catalogue" width="200"/></td>
<td><img src="https://placehold.co/300x540/065f46/ffffff?text=Connexion" width="200"/></td>
</tr>
<tr>
<td align="center"><b>📊 Dashboard Admin</b></td>
<td align="center"><b>🛒 Panier</b></td>
<td align="center"><b>💊 Détail Produit</b></td>
</tr>
<tr>
<td><img src="https://placehold.co/300x540/064e3b/ffffff?text=Dashboard" width="200"/></td>
<td><img src="https://placehold.co/300x540/059669/ffffff?text=Panier" width="200"/></td>
<td><img src="https://placehold.co/300x540/047857/ffffff?text=Produit" width="200"/></td>
</tr>
</table>

> 📸 **Note :** Les captures d'écran seront ajoutées après la refonte UI/UX mobile-first (en cours de développement).

</div>

---

## 🌍 À propos

**Pharmacie+** est une plateforme SaaS multi-tenant de gestion de pharmacie conçue spécifiquement pour les marchés d'Afrique Centrale (zone CEMAC). Elle permet à chaque pharmacie abonnée de gérer son stock, ses ventes, ses ordonnances et ses clients depuis n'importe quel appareil Android, avec ou sans connexion internet stable.

### Pourquoi Pharmacie+ ?

| Problème terrain | Solution Pharmacie+ |
|---|---|
| Gestion du stock sur papier ou Excel | Suivi en temps réel avec alertes de rupture |
| Ordonnances perdues ou non vérifiées | Upload sécurisé + validation pharmacien |
| Paiement mobile money sans traçabilité | Workflow vérification caissière avec audit |
| Logiciels non adaptés au mobile | PWA installable, pensée mobile-first |
| Solutions cloud étrangères coûteuses | Devise FCFA native, hébergeable en Afrique |

---

## ✨ Fonctionnalités

### Pour les clients
- 🛒 Catalogue de médicaments paginé avec recherche et filtres
- 📱 Application installable sur Android (PWA)
- 📋 Suivi des commandes en temps réel (WebSocket)
- 📄 Upload d'ordonnance sécurisé depuis le téléphone
- 💰 Paiement par Mobile Money (Orange Money / MTN MoMo)
- 🧾 Factures téléchargeables en PDF

### Pour la caisse
- ⚡ Vente au guichet ultra-rapide (POS dédié)
- ✅ Vérification des paiements mobile money
- 📋 Gestion des ordonnances (validation / rejet)
- 🔔 Notifications temps réel des nouvelles commandes

### Pour l'administrateur
- 📊 Dashboard avec CA global ventilé (cash / en ligne)
- 📦 Gestion du stock avec alertes de rupture
- 📈 Rapports et exports PDF
- ⚙️ Configuration complète (devise, numéros mobile money, logo)
- 👥 Gestion des utilisateurs par rôle

### Architecture & Sécurité
- 🏢 **Multi-tenant par schéma PostgreSQL** — isolation totale entre pharmacies
- 🔐 Authentification JWT par rôle (Client / Caissière / Admin)
- 🛡️ Validation des fichiers par magic bytes
- 🖼️ Re-encodage anti-stéganographie (Pillow) + resize automatique (max 1600px)
- ⚡ Rate limiting API (anti-brute-force)
- 🔒 Protection race-condition (`select_for_update()`)

---

## 🚀 Installation rapide

### Prérequis

```
Python 3.11+  |  Node.js 20+  |  PostgreSQL 16  |  Redis 7+  |  libmagic
```

### Backend

```bash
cd pharmacie-backend
python3 -m venv venv && venv/bin/pip install -r requirements.txt
cp .env.example .env          # configurer les variables
venv/bin/python manage.py migrate_schemas --shared
venv/bin/daphne -b 0.0.0.0 -p 8000 config.asgi:application
```

### Frontend

```bash
cd pharmacie-frontend
npm install
npm run dev                   # http://localhost:3000
```

### DNS local (obligatoire pour le multi-tenant)

```bash
# Linux/Mac
echo "127.0.0.1 mapharmacietest.localhost" | sudo tee -a /etc/hosts

# Windows — éditer C:\Windows\System32\drivers\etc\hosts
# Ajouter : 127.0.0.1 mapharmacietest.localhost
```

> 💡 Accède à `http://mapharmacietest.localhost:3000` — le sous-domaine identifie le tenant.

> ⚠️ Utilise toujours `daphne` et non `python manage.py runserver` — ce dernier ne supporte pas les WebSockets.

---

## 🏗️ Architecture technique

```
┌─────────────────────────────────────────────────┐
│               CLIENTS (Browser/PWA)             │
└────────────────────┬────────────────────────────┘
                     │ HTTP / WebSocket
┌────────────────────▼────────────────────────────┐
│          NEXT.JS 16 — Turbopack · PWA           │
└────────────────────┬────────────────────────────┘
                     │ REST API + JWT
┌────────────────────▼────────────────────────────┐
│      DJANGO 5.2 + DRF + DAPHNE (ASGI)          │
│   django-tenants · Channels · WeasyPrint PDF    │
└──────┬──────────────────────────┬───────────────┘
       │                          │
┌──────▼──────┐          ┌────────▼──────┐
│ PostgreSQL  │          │    Redis 7    │
│ 1 schéma   │          │  Channels +   │
│ par tenant │          │  Rate limit   │
└────────────┘          └───────────────┘
```

### Structure du projet

```
New_Pharmacie_Plus/
├── pharmacie-backend/
│   ├── config/           # Settings, URLs (api/v1/), ASGI, health.py (/healthz/)
│   ├── core/             # App principale
│   │   ├── api.py        # Endpoints REST
│   │   ├── models.py     # Produit, Commande, PharmacieConfig...
│   │   ├── validators.py # Upload sécurisé ordonnances
│   │   ├── pagination.py # CataloguePagination DRF (20/page)
│   │   ├── cache_utils.py # Cache Redis multi-tenant (préfixe par schéma)
│   │   ├── throttles.py  # Rate limiting
│   │   ├── management/commands/backup_db.py   # pg_dump
│   │   ├── management/commands/restore_db.py  # pg_restore
│   │   └── consumers.py  # WebSocket consumers
│   ├── clients_publics/  # CompteClient (schéma public, compte client global)
│   └── tenants/          # Pharmacie + Domain (django-tenants)
└── pharmacie-frontend/
    ├── app/              # Pages Next.js App Router
    │   ├── catalogue/    # Catalogue paginé + recherche debounce
    │   ├── panier/       # Panier + paiement mobile money + file d'attente offline
    │   ├── caisse/       # POS, paiements, ordonnances
    │   └── admin/        # Dashboard, stocks, historique, rapports
    └── lib/
        ├── apiClient.ts                      # Axios + JWT auto
        ├── wsClient.ts                       # WebSocket reconnexion auto
        ├── components/Prix.tsx               # Devise centralisée
        ├── context/ConfigPharmacieContext.tsx # Config pharmacie partagée
        ├── offline/                          # File d'attente panier hors-ligne (IndexedDB)
        └── hooks/useOfflinePanier.ts          # État réseau + synchro auto
```

---

## 📋 Feuille de route

> Détail complet des tâches restantes, priorisées : voir [PROMPT_REPRISE.md](PROMPT_REPRISE.md). Stratégie de versionnement API : [docs/API_VERSIONING.md](docs/API_VERSIONING.md). Sauvegarde/restauration : [docs/BACKUP_POSTGRESQL.md](docs/BACKUP_POSTGRESQL.md). Guide fonctionnel de la refonte UI/UX (pages, gaps par rôle) : [docs/UIUX_REFONTE_GUIDE.md](docs/UIUX_REFONTE_GUIDE.md). Sujets infra documentés mais différés (PostgreSQL, HTTPS, Docker, CDN) : [docs/INFRASTRUCTURE_ROADMAP.md](docs/INFRASTRUCTURE_ROADMAP.md).

- [x] Architecture multi-tenant par schéma PostgreSQL
- [x] Cycle de vie commande complet (en_cours → retiree)
- [x] Paiement mobile money avec vérification manuelle
- [x] WebSocket temps réel (caisse + suivi client)
- [x] Upload ordonnance sécurisé (magic bytes + anti-stéganographie + resize)
- [x] PWA installable Android (Serwist)
- [x] Pagination catalogue et POS (DRF + debounce frontend)
- [x] Composant `<Prix>` centralisé (devise configurable par tenant)
- [x] Compte client global (`CompteClient`, schéma public) — inscription, connexion, panier, paiement, facture, gestion admin ; ancien modèle `Client` par-tenant entièrement retiré
- [x] Emails transactionnels (Brevo) — bienvenue, confirmation commande, ordonnance refusée
- [x] Prédiction de stock (moyenne mobile, régression, Holt amorti, z-score)
- [x] Mode clair/sombre
- [x] Versionnement de l'API — `/api/v1/` canonique (`/api/` conservé pour compatibilité)
- [x] Backups PostgreSQL — `manage.py backup_db` / `restore_db` (pg_dump/pg_restore)
- [x] Cache Redis multi-tenant (infos pharmacie, catalogue, prédictions) + `/healthz/`
- [x] Suivi d'erreurs Sentry (backend) — frontend en attente du support Next.js 16 par `@sentry/nextjs`
- [x] Mode offline — indexation BDD + synchro delta catalogue + file d'attente panier (3/4 briques)
- [ ] Mode offline — cache catalogue réel dans le Service Worker (4/4)
- [ ] Gestion des lots (`LotProduit`) avec décrémentation FEFO
- [ ] Page marketplace (client global multi-pharmacies)
- [ ] Dashboard analytics avancé
- [ ] Refonte UI/UX mobile-first
- [ ] Notifications SMS (Africa's Talking)
- [ ] Internationalisation (next-intl)

---

## 🤝 Contribuer

Consulte [CONTRIBUTING.md](CONTRIBUTING.md) pour les guidelines de contribution, les standards de qualité et la procédure de Pull Request.

---

## 📄 Licence

Ce projet est distribué sous [Business Source License 1.1](LICENSE).

- ✅ Usage personnel et commercial autorisé
- ✅ Modification et dérivés autorisés
- ❌ Revente en tant que SaaS concurrent interdite
- 📅 Conversion automatique en MIT le 2028-01-01

---

## 👤 Auteur

**SIGNING DONGMO Marc Godwin**  
Étudiant en Informatique — Université de Dschang, Cameroun

[![GitHub](https://img.shields.io/badge/GitHub-Godwin296-181717?logo=github)](https://github.com/Godwin296)

---

<div align="center">
  <sub>Fait avec ❤️ au Cameroun 🇨🇲 pour l'Afrique Centrale</sub>
</div>
