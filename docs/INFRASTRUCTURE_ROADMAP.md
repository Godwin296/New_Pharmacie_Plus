# Feuille de route infrastructure — sujets documentés, implémentation différée

> Ces 4 sujets ont été audités et discutés le 18/07/2026 mais **volontairement pas
> implémentés maintenant** — priorité donnée à la refonte UI/UX et au branchement complet
> de l'application. Ce document sert de mémo prêt à l'emploi : quand le moment sera venu,
> pas besoin de tout re-rechercher, il suffit de suivre les étapes ci-dessous.
>
> Déjà fait et actif (pas dans ce document, voir ailleurs) : compression réseau
> (`GZipMiddleware`), rate-limiting (`core/throttles.py`), cache Redis
> (`core/cache_utils.py`), monitoring `/healthz/` + logs structurés, versioning API
> (`docs/API_VERSIONING.md`), backups PostgreSQL (`docs/BACKUP_POSTGRESQL.md`).

---

## 1. PostgreSQL optimisé (index manquants)

**Déclencheur pour s'y mettre :** une fois l'application presque entièrement branchée
(après la refonte UI/UX), quand il ne reste plus que des ajustements légers — c'est-à-dire
quand le schéma de données (`core/models.py`) ne va plus beaucoup bouger. Ajouter des
index avant que le modèle soit stable, c'est risquer de devoir les refaire.

**Coût : aucun** — PostgreSQL que tu as déjà suffit, un index est juste une structure
interne à la base, pas un service supplémentaire à payer.

**Ce qu'il faudra faire, concrètement :**

```python
# core/models.py, class Commande, dans Meta :
class Meta:
    indexes = [
        models.Index(fields=['statut']),       # filtré à chaque dashboard/historique
        models.Index(fields=['payee']),        # filtré à chaque calcul de CA
        models.Index(fields=['date']),         # tri/filtre par période (graphiques, comparaisons)
        models.Index(fields=['payee', 'date']), # index composite : la requête la plus fréquente combine les deux
    ]
```

Puis `python manage.py makemigrations core && python manage.py migrate_schemas`.

**Comment vérifier que ça a servi** (à faire après coup, pas avant) : `EXPLAIN ANALYZE`
sur les requêtes du dashboard (`api_boss_dashboard`) et de l'historique
(`api_archives_caissiere`) avant/après, pour confirmer que Postgres utilise bien le
nouvel index (`Index Scan` au lieu de `Seq Scan` dans le plan d'exécution).

---

## 2. HTTPS / SSL

**Déclencheur pour s'y mettre :** au moment de choisir un hébergement de production (pas
avant, ça dépend de l'hébergeur choisi).

**Coût : gratuit.** Le certificat SSL lui-même ne coûte rien (Let's Encrypt, standard de
l'industrie, gratuit et automatiquement renouvelé). La plupart des hébergeurs modernes
(Render, Railway, Fly.io, ou un VPS avec Certbot) l'activent en quelques clics ou
automatiquement. Aucun budget à prévoir spécifiquement pour ce point.

**Ce qu'il faudra faire, concrètement (côté Django, une fois l'hébergement choisi) :**

```python
# config/settings.py, dans le bloc "if not DEBUG" (production uniquement) :
SECURE_SSL_REDIRECT = True       # force la redirection HTTP -> HTTPS
SECURE_HSTS_SECONDS = 31536000   # 1 an -- dit au navigateur "toujours utiliser HTTPS pour ce site"
SECURE_HSTS_INCLUDE_SUBDOMAINS = True  # couvre aussi dupont.tondomaine.com, martin.tondomaine.com...
SECURE_HSTS_PRELOAD = True

# Si le certificat SSL est géré par un proxy devant Django (nginx, load balancer de
# l'hébergeur) plutôt que par Django lui-même -- cas le plus fréquent :
SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')
```

⚠️ **Piège à éviter** : activer `SECURE_HSTS_SECONDS` AVANT d'être sûr à 100% que HTTPS
fonctionne bien sur tous les sous-domaines tenant (`dupont.tondomaine.com`,
`martin.tondomaine.com`...) — une fois qu'un navigateur a reçu l'en-tête HSTS, il refuse
de revenir en HTTP pendant la durée indiquée, même si tu en as besoin temporairement pour
déboguer.

---

## 3. Docker (multi-conteneur + Docker Compose)

**Déclencheur pour s'y mettre :** dès que tu veux simplifier l'installation pour un futur
collaborateur, ou au moment de choisir l'hébergement de production. Contrairement aux
autres points, celui-ci peut se faire relativement tôt sans risque — ça n'implique aucun
changement de code applicatif, juste une couche d'emballage autour de ce qui existe déjà.

**Coût : gratuit** (Docker et Docker Compose sont des logiciels open-source). Le seul coût
possible serait indirect : si l'hébergement choisi facture différemment un déploiement par
conteneurs vs un déploiement classique — à vérifier au cas par cas selon l'hébergeur.

**Structure prévue** (4 conteneurs, un par service) :

```
docker-compose.yml
├── backend       (Django + Daphne, à partir de pharmacie-backend/)
├── frontend       (Next.js, à partir de pharmacie-frontend/)
├── db             (image officielle postgres:16)
└── redis          (image officielle redis:7)
```

**Squelette à reprendre le moment venu** (non testé, à valider quand on s'y met
réellement — cf. règle "tester réellement" du projet) :

```yaml
# docker-compose.yml (squelette, PAS encore testé)
services:
  db:
    image: postgres:16
    environment:
      POSTGRES_DB: pharmacie_db
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes:
      - pgdata:/var/lib/postgresql/data

  redis:
    image: redis:7

  backend:
    build: ./pharmacie-backend
    depends_on: [db, redis]
    env_file: ./pharmacie-backend/.env
    ports: ["8000:8000"]

  frontend:
    build: ./pharmacie-frontend
    depends_on: [backend]
    ports: ["3000:3000"]

volumes:
  pgdata:
```

Il faudra aussi un `Dockerfile` dans `pharmacie-backend/` et `pharmacie-frontend/`
(actuellement absents des deux dossiers). Point d'attention spécifique à ce projet :
`python-magic-bin` dans `requirements.txt` est un paquet **Windows uniquement** — le
`Dockerfile` backend devra utiliser `python-magic` (sans `-bin`) à la place, comme déjà
fait pour tester ce dépôt sous Linux dans cette session.

---

## 4. CDN pour les images + rappels (monitoring uptime, Kubernetes)

### CDN images

**Déclencheur pour s'y mettre :** quand le trafic devient significatif ou géographiquement
étalé (plusieurs villes/pays). Pour l'instant, avec un nombre limité de pharmacies
clientes au Cameroun, ce n'est pas un besoin urgent — le gain de vitesse serait marginal.

**Coût :** variable, mais des options gratuites existent pour démarrer. Mettre Cloudflare
devant le site (gratuit) fait déjà office de CDN léger pour les images statiques sans
changer une ligne de code Django. Des services dédiés (Cloudinary, Bunny CDN...) ont des
offres gratuites limitées, à réévaluer si le volume d'images (photos produits) grossit
beaucoup.

**Ce qu'il faudra faire, concrètement :** aujourd'hui `MEDIA_URL`/`MEDIA_ROOT` pointent
vers le disque local du serveur (`config/settings.py`). Basculer vers un CDN reviendrait à
changer `DEFAULT_FILE_STORAGE` vers un backend compatible (ex: `django-storages` avec un
bucket S3-compatible + CDN devant), sans toucher au reste du code (les vues utilisent déjà
`ImageField`, agnostique du stockage réel).

### Rappel : monitoring uptime (déjà quasi prêt côté code)

`/healthz/` existe déjà (voir commit du 16/07). Il ne reste qu'une **inscription externe
gratuite** à faire le moment venu — pas de développement supplémentaire :
- [UptimeRobot](https://uptimerobot.com) : gratuit jusqu'à 50 moniteurs, vérification
  toutes les 5 minutes, alerte email/SMS.
- Pointer vers `https://<ton-domaine-de-prod>/healthz/` une fois l'hébergement en place.

### Rappel : Kubernetes

**Pas un chantier à prévoir maintenant, ni même à court/moyen terme.** Kubernetes n'a de
sens que pour faire tourner et faire grossir automatiquement l'application sur
**plusieurs serveurs physiques en même temps** — utile seulement à une échelle bien
supérieure au nombre de pharmacies clientes visé actuellement. La seule chose à retenir :
en structurant l'app avec Docker (point 3 ci-dessus), on garde la porte ouverte pour une
migration Kubernetes plus tard **si jamais** l'échelle le justifie un jour — sans avoir à
payer ou apprendre quoi que ce soit à ce sujet pour l'instant.
