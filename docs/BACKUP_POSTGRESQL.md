# Sauvegarde & restauration PostgreSQL — Pharmacie Plus

## Pourquoi une seule sauvegarde suffit pour toutes les pharmacies

Avec django-tenants, chaque pharmacie cliente (dupont, martin...) vit dans son propre
**schéma** PostgreSQL, mais toutes ces schémas sont dans **une seule base de données**
physique. Sauvegarder cette base capture donc automatiquement toutes les pharmacies en
une seule fois — pas besoin d'un script par pharmacie.

## Commandes disponibles

```bash
# Sauvegarde (garde les 14 dernières par défaut, supprime les plus anciennes)
python manage.py backup_db

# Options utiles
python manage.py backup_db --output-dir /chemin/personnalise
python manage.py backup_db --keep 30
python manage.py backup_db --no-cleanup   # ne supprime rien, quel que soit --keep

# Restauration (⚠️ ÉCRASE toutes les données actuelles par celles du fichier)
python manage.py restore_db backups/pharmacie_backup_20260716_030000.dump
python manage.py restore_db backups/pharmacie_backup_20260716_030000.dump --yes  # sans confirmation (scripts)
```

Les fichiers sont au format "custom" de PostgreSQL (`-Fc`) : compressés, et
restaurables sélectivement si besoin avec `pg_restore` directement (ex: un seul schéma) :

```bash
pg_restore -h localhost -U postgres -d pharmacie_db --schema=dupont backups/pharmacie_backup_XXXX.dump
```

## Testé réellement (pas seulement "ça s'exécute sans erreur")

Avant d'écrire cette doc, le cycle complet a été vérifié dans un environnement de test :
1. Sauvegarde prise avec une valeur connue en base (nom de pharmacie "X").
2. Donnée volontairement corrompue en base ("X" → "CORROMPU").
3. Restauration depuis la sauvegarde de l'étape 1.
4. Valeur en base redevenue "X" — confirmé.

La rétention automatique (`--keep`) a aussi été testée : avec 6 sauvegardes présentes et
`--keep 3`, les 3 les plus anciennes sont bien supprimées, les 3 plus récentes conservées.

## Planifier l'exécution automatique

### En production (Linux) — cron

```bash
# Éditer le crontab de l'utilisateur qui fait tourner l'application :
crontab -e

# Sauvegarde tous les jours à 3h du matin (heure creuse) :
0 3 * * * cd /chemin/vers/pharmacie-backend && /chemin/vers/venv/bin/python manage.py backup_db >> /var/log/pharmacie_backup.log 2>&1
```

### En développement local (Windows) — Planificateur de tâches

1. Ouvrir le **Planificateur de tâches Windows** (`taskschd.msc`).
2. Créer une tâche de base : déclencheur "Tous les jours", action "Démarrer un
   programme".
3. Programme : chemin complet vers `venv\Scripts\python.exe`.
4. Arguments : `manage.py backup_db`.
5. Démarrer dans (répertoire de travail) : le dossier `pharmacie-backend`.

### ⚠️ Prérequis technique : `pg_dump` / `pg_restore` dans le PATH

Ces deux commandes viennent avec l'installation de PostgreSQL elle-même (pas un paquet
Python). Sur Windows, si `pg_dump` n'est pas reconnu, ajoutez le dossier `bin` de votre
installation PostgreSQL à la variable d'environnement PATH, par exemple :
`C:\Program Files\PostgreSQL\16\bin`.

## Ce qui n'est PAS encore fait (à considérer pour la suite)

- **Stockage hors-site (offsite)** : les sauvegardes sont actuellement écrites sur le
  même disque que le serveur — en cas de panne matérielle/incendie/vol du serveur, elles
  seraient perdues avec le reste. Pour une vraie résilience, il faudrait copier
  automatiquement chaque sauvegarde vers un stockage externe (S3, Backblaze B2, un NAS
  distant...). Pas implémenté ici faute d'identifiants de compte cloud à configurer —
  c'est une prochaine étape naturelle une fois un compte de stockage choisi.
- **Chiffrement des sauvegardes** : un fichier `.dump` contient TOUTES les données de
  TOUTES les pharmacies (ordonnances, coordonnées clients, etc.) en clair. S'il doit
  transiter vers un stockage externe, il devrait être chiffré au repos (ex:
  `gpg --symmetric` avant l'upload, ou chiffrement natif du service de stockage choisi).
- **Alerte en cas d'échec** : la commande écrit dans `logs/pharmacie.log` en cas
  d'erreur (cf. LOGGING dans settings.py), mais rien n'envoie encore une alerte active
  (email/Slack) si le cron échoue silencieusement une nuit. À ajouter si/quand un canal
  d'alerte est choisi (Sentry pourrait très bien capter ça aussi, cf. docs monitoring).
