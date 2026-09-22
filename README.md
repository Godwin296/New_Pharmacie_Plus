<div align="center">
<img src="https://raw.githubusercontent.com/Godwin296/New_Pharmacie_Plus/main/pharmacie-frontend/public/icons/icon-512x512.png" alt="Pharmacie+" width="88" />

# Pharmacie+

SaaS de gestion de pharmacie multi-tenant pour la zone CEMAC — stock, ventes, ordonnances et clients, pensé pour un usage mobile en conditions de réseau instable.

[![License: BSL 1.1](https://img.shields.io/badge/License-BSL%201.1-blue.svg)](LICENSE)
[![Django 5.2](https://img.shields.io/badge/Django-5.2-092E20)](https://www.djangoproject.com/)
[![Next.js 16](https://img.shields.io/badge/Next.js-16-000000)](https://nextjs.org/)
[![PostgreSQL 16](https://img.shields.io/badge/PostgreSQL-16-4169E1)](https://www.postgresql.org/)

</div>

---

## Le problème que ça résout

La plupart des pharmacies indépendantes au Cameroun (et plus largement en zone CEMAC) gèrent encore leur stock sur cahier ou tableur, encaissent du mobile money sans traçabilité fiable, et n'ont aucun moyen de savoir à l'avance qu'un produit va manquer ou périmer. Les logiciels de gestion officinale existants viennent d'Europe ou d'Amérique du Nord : facturés en devise étrangère, pensés pour un poste fixe en pharmacie occidentale, avec une hypothèse de connexion internet stable qui ne tient pas toujours sur le terrain.

Pharmacie+ est conçu à l'inverse : mobile-first, en FCFA nativement, avec un mode dégradé qui continue de fonctionner (file d'attente locale, resynchronisation automatique) quand la connexion coupe — ce qui arrive.

Le produit s'adresse à trois profils dans chaque pharmacie cliente (client final, caissière, administrateur), plus — à terme — une équipe Pharmacie+ qui pilote l'ensemble des pharmacies abonnées depuis une interface dédiée (chantier en cours, voir plus bas).

---

## Ce que la plateforme fait aujourd'hui

### Côté client
Catalogue paginé avec recherche, panier, upload d'ordonnance depuis le téléphone (photo validée par magic bytes puis re-encodée pour retirer toute stéganographie et redimensionnée à 1600px max), paiement par Mobile Money avec référence de transaction vérifiée manuellement par la caisse, suivi de commande en temps réel par WebSocket, facture PDF, et un compte client global (`CompteClient`) valable chez plusieurs pharmacies abonnées — la brique de base d'une marketplace multi-pharmacies, dont l'interface de sélection reste à construire.

### Côté caisse
Poste de vente dédié avec écoute clavier pour douchette scanner (détection d'une rafale de frappes suivie d'un `Entrée`, signature typique d'un scanner), vérification des paiements mobile money en attente, validation ou rejet des ordonnances uploadées, notifications temps réel des nouvelles commandes.

### Côté administrateur (par pharmacie)
Dashboard avec chiffre d'affaires ventilé cash guichet / en ligne, ventes sur 7 jours glissants, alertes de rupture de stock et de péremption à 60 jours, gestion des lots datés (`LotProduit`) avec décrémentation automatique FEFO (premier expiré, premier sorti), prédiction de réapprovisionnement (moyenne mobile, régression, lissage de Holt amorti, détection d'anomalie par z-score — des statistiques classiques, pas un modèle de langage : ce problème n'en a pas besoin), détection d'interactions médicamenteuses par table de règles sourcées (pas d'IA non plus, pour la même raison — la fiabilité prime sur la flexibilité en matière pharmacovigilance), export PDF des rapports, gestion des fournisseurs, configuration de la devise et des numéros mobile money par tenant.

### Transverse
Authentification JWT avec trois rôles distincts (`admin`, `caissiere`, `client`), rate limiting sur les endpoints sensibles (connexion, soumission de paiement), emails transactionnels via Brevo, mode clair/sombre, PWA installable sur Android (Serwist), suivi d'erreurs Sentry côté backend, sauvegarde/restauration PostgreSQL (`manage.py backup_db`/`restore_db`), endpoint `/healthz/` pour le monitoring, et chiffrement au repos des ordonnances (Fernet).

---

## Décisions d'architecture qui comptent

| Décision | Pourquoi |
|---|---|
| Isolation multi-tenant **par schéma PostgreSQL** (django-tenants), pas par colonne `tenant_id` | Élimine par construction le risque de fuite de données entre deux pharmacies clientes en cas d'oubli d'un filtre dans une requête — un bug de développeur ne peut pas faire fuiter les données d'une pharmacie vers une autre |
| Paiement **manuel** (référence mobile money vérifiée par la caissière) comme mécanisme permanent, pas un fallback temporaire | Utilisable en production dès le premier jour sans dépendre d'un agrégateur de paiement, et reste fiable même une fois un agrégateur intégré |
| **Pas d'OCR automatique** sur les ordonnances | L'écriture manuscrite des médecins camerounais est trop variable pour qu'une validation automatique soit fiable ; l'OCR reste une aide visuelle pour la caissière, jamais une décision |
| Prédiction de stock par **statistiques classiques**, pas par LLM | Moyenne mobile et séries temporelles suffisent largement à ce problème et restent auditables — un LLM n'apporterait rien de plus, avec beaucoup moins de garanties |
| Détection d'interactions médicamenteuses par **table de règles statiques sourcées**, pas par IA | En pharmacovigilance, une réponse fausse a un coût réel ; une table de règles vérifiables est plus sûre qu'un modèle probabiliste |
| `Produit.ordonnance_obligatoire` configurable **par produit et par tenant**, pas de politique imposée globalement | Chaque pharmacie reste responsable de sa propre conformité réglementaire ; la plateforme fournit l'outil, pas la décision |
| Facture PDF téléchargeable uniquement **par le personnel**, pas par le client | Le téléchargement client a été retiré plutôt que réparé après un échec systématique en production — mieux vaut une fonctionnalité absente qu'une fonctionnalité cassée en silence |

---

## Architecture technique

```
┌──────────────────────────────────────────────┐
│            CLIENT (navigateur / PWA)          │
└──────────────────────┬─────────────────────────┘
                        │ HTTP + WebSocket
┌──────────────────────▼─────────────────────────┐
│      NEXT.JS 16 (Turbopack) — App Router, PWA   │
└──────────────────────┬─────────────────────────┘
                        │ REST /api/v1/ + JWT
┌──────────────────────▼─────────────────────────┐
│  DJANGO 5.2 + DRF + DAPHNE (ASGI)               │
│  django-tenants · Channels · WeasyPrint          │
└──────────┬───────────────────────┬──────────────┘
           │                       │
┌──────────▼──────────┐  ┌─────────▼──────────┐
│ PostgreSQL 16        │  │ Redis 7             │
│ 1 schéma par tenant   │  │ Channels + cache +   │
│                       │  │ rate limiting         │
└───────────────────────┘  └────────────────────┘
```

### Structure du dépôt

```
New_Pharmacie_Plus/
├── pharmacie-backend/
│   ├── config/              # Settings, URLs versionnées (/api/v1/), ASGI, /healthz/
│   ├── core/                # App principale
│   │   ├── api.py           # Endpoints REST
│   │   ├── models.py        # Produit, LotProduit, Commande, PharmacieConfig...
│   │   ├── validators.py    # Upload sécurisé (magic bytes, anti-stéganographie)
│   │   ├── chiffrement.py   # Chiffrement Fernet des ordonnances
│   │   ├── services_prediction.py  # Prédiction de stock (statistiques)
│   │   ├── cache_utils.py   # Cache Redis, préfixé par schéma tenant
│   │   ├── throttles.py     # Rate limiting par endpoint sensible
│   │   └── consumers.py     # WebSocket (suivi commande, notifs caisse)
│   ├── clients_publics/     # CompteClient — compte client global, schéma public
│   ├── pharmacovigilance/   # Règles d'interactions médicamenteuses
│   └── tenants/             # Pharmacie + Domain (django-tenants)
├── pharmacie-frontend/      # Application (client, caisse, admin par pharmacie)
│   ├── app/
│   │   ├── catalogue/ panier/ commandes/ ordonnance/ profil/
│   │   ├── caisse/           # POS, paiements, ordonnances
│   │   └── admin/            # Dashboard, stocks, prédictions, rapports...
│   └── lib/
│       ├── apiClient.ts      # Axios + JWT, détection d'URL par sous-domaine tenant
│       ├── wsClient.ts       # WebSocket avec reconnexion automatique
│       ├── components/Prix.tsx  # Devise centralisée (jamais de FCFA codé en dur)
│       └── offline/          # File d'attente panier hors-ligne (IndexedDB)
└── pharmacie-marketing/     # Site vitrine public (projet Next.js séparé)
```

---

## Stack

| Couche | Choix |
|---|---|
| Backend | Django 5.2 + Django REST Framework, ASGI via Daphne |
| Multi-tenant | django-tenants (isolation par schéma PostgreSQL) |
| Temps réel | Django Channels + Redis |
| Base de données | PostgreSQL 16 |
| Cache / rate limiting | Redis 7 |
| PDF | WeasyPrint |
| Frontend | Next.js 16 (App Router, Turbopack), PWA via Serwist |
| Email transactionnel | Brevo |
| Erreurs | Sentry (backend branché, frontend pas encore) |

---

## Installation

### Prérequis

```
Python 3.11+  ·  Node.js 20+  ·  PostgreSQL 16  ·  Redis 7+  ·  libmagic
```

### Backend

```bash
cd pharmacie-backend
python3 -m venv venv && venv/bin/pip install -r requirements.txt
cp .env.example .env          # remplir les variables (voir commentaires du fichier)
venv/bin/python manage.py migrate_schemas --shared
venv/bin/daphne -b 0.0.0.0 -p 8000 config.asgi:application
```

> Toujours `daphne`, jamais `python manage.py runserver` — ce dernier ne supporte pas les WebSockets de Django Channels.

### Frontend

```bash
cd pharmacie-frontend
npm install
npm run dev                   # http://localhost:3000
```

### DNS local (obligatoire — le sous-domaine identifie le tenant)

```bash
echo "127.0.0.1 mapharmacietest.localhost" | sudo tee -a /etc/hosts
```

Accès ensuite via `http://mapharmacietest.localhost:3000`.

### Docker

Un `docker-compose.yml` complet existe à la racine (backend, frontend, PostgreSQL, Redis) — écrit et relu mais pas encore validé par un lancement réel faute de Docker disponible dans l'environnement où il a été rédigé. Voir [docs/INFRASTRUCTURE_ROADMAP.md](docs/INFRASTRUCTURE_ROADMAP.md).

---

## État d'avancement

**Fait et testé réellement** — architecture multi-tenant par schéma, cycle de vie complet d'une commande, paiement mobile money avec vérification manuelle, WebSocket temps réel, upload d'ordonnance sécurisé, PWA installable, pagination catalogue/POS, compte client global multi-pharmacies, emails transactionnels, prédiction de stock, versionnement d'API (`/api/v1/`), sauvegarde/restauration PostgreSQL, cache Redis multi-tenant, gestion des lots avec décrémentation FEFO, chiffrement des ordonnances, détection d'interactions médicamenteuses, mode offline (cache catalogue + file d'attente panier en IndexedDB).

**Restant à faire, par ordre de priorité** :
- Refonte UI/UX mobile-first — en cours, plusieurs pages déjà refaites (catalogue, panier, accueil, détail produit, profil client)
- Page marketplace (sélection de pharmacie par un `CompteClient`)
- Admin plateforme Pharmacie+ (n'existe pas du tout aujourd'hui — seul le Django admin brut permet de gérer les pharmacies clientes)
- Notifications SMS via Africa's Talking
- Dashboard analytics avancé (marge réelle, comparaison période/période — `Produit.prix_achat` existe déjà, le calcul et l'affichage restent à construire)
- Internationalisation frontend (l'infrastructure backend est posée : détection de langue, préférence par client ; reste next-intl côté Next.js)
- Sentry frontend

Détail complet et priorisé : [PROMPT_REPRISE.md](PROMPT_REPRISE.md). Guide fonctionnel de la refonte UI/UX (pages et lacunes par rôle) : [docs/UIUX_REFONTE_GUIDE.md](docs/UIUX_REFONTE_GUIDE.md). Versionnement d'API : [docs/API_VERSIONING.md](docs/API_VERSIONING.md). Sauvegarde/restauration : [docs/BACKUP_POSTGRESQL.md](docs/BACKUP_POSTGRESQL.md). Sujets d'infrastructure documentés mais volontairement différés : [docs/INFRASTRUCTURE_ROADMAP.md](docs/INFRASTRUCTURE_ROADMAP.md).

---

## Contribuer

Voir [CONTRIBUTING.md](CONTRIBUTING.md) pour l'environnement de développement, les décisions d'architecture à respecter et le processus de Pull Request.

---

## Licence

[Business Source License 1.1](LICENSE) — usage personnel et commercial libre, modification et dérivés autorisés, revente en tant que SaaS concurrent interdite. Conversion automatique en licence MIT le 2028-01-01.

---

## Auteur

**SIGNING DONGMO Marc Godwin** — étudiant en informatique, Université de Dschang, Cameroun.
[github.com/Godwin296](https://github.com/Godwin296)
