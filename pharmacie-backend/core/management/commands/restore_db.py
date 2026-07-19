"""
♻️ Restauration PostgreSQL à partir d'une sauvegarde créée par `backup_db`.

⚠️ COMMANDE DESTRUCTIVE : restaure TOUS les tenants (toutes les pharmacies) en même
temps, en écrasant leurs données actuelles par celles du fichier de sauvegarde. Il n'est
PAS possible de restaurer une seule pharmacie isolément avec cette commande simple (les
schémas partagent des séquences/objets globaux) -- pour une restauration partielle
avancée, utiliser directement `pg_restore --schema=nom_pharmacie` à la main.

Usage :
    python manage.py restore_db backups/pharmacie_backup_20260716_030000.dump
    python manage.py restore_db backups/pharmacie_backup_20260716_030000.dump --yes
        (--yes : ignore la confirmation interactive, pour un script automatisé)
"""
import os
import shutil
import subprocess
from pathlib import Path

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError


class Command(BaseCommand):
    help = "Restaure la base PostgreSQL à partir d'un fichier créé par 'backup_db' (ÉCRASE les données actuelles)."

    def add_arguments(self, parser):
        parser.add_argument("chemin_backup", help="Chemin vers le fichier .dump à restaurer.")
        parser.add_argument(
            "--yes",
            action="store_true",
            help="Ignore la confirmation interactive (utile dans un script automatisé).",
        )

    def handle(self, *args, **options):
        if shutil.which("pg_restore") is None:
            raise CommandError(
                "pg_restore introuvable dans le PATH (fourni avec l'installation PostgreSQL)."
            )

        chemin_backup = Path(options["chemin_backup"])
        if not chemin_backup.exists():
            raise CommandError(f"Fichier introuvable : {chemin_backup}")

        db = settings.DATABASES["default"]

        if not options["yes"]:
            self.stdout.write(self.style.WARNING(
                f"\n⚠️  Cette opération va ÉCRASER TOUTES LES DONNÉES ACTUELLES de la base "
                f"'{db['NAME']}' (TOUTES les pharmacies clientes, pas une seule) par le "
                f"contenu de :\n    {chemin_backup}\n"
            ))
            confirmation = input("Tapez exactement 'RESTAURER' pour confirmer : ")
            if confirmation != "RESTAURER":
                self.stdout.write("Annulé -- aucune donnée n'a été modifiée.")
                return

        env = os.environ.copy()
        if db.get("PASSWORD"):
            env["PGPASSWORD"] = db["PASSWORD"]

        commande = [
            "pg_restore",
            "-h", db.get("HOST") or "localhost",
            "-p", str(db.get("PORT") or 5432),
            "-U", db.get("USER") or "postgres",
            "-d", db["NAME"],
            "--clean",       # supprime les objets existants avant de les recréer
            "--if-exists",   # évite les erreurs si un objet n'existe pas encore
            "--no-owner",    # ignore les propriétaires d'origine (utile si restauré sous un autre user)
            str(chemin_backup),
        ]

        self.stdout.write("⏳ Restauration en cours (cela peut prendre plusieurs minutes)...")
        resultat = subprocess.run(commande, env=env, capture_output=True, text=True)

        # pg_restore renvoie souvent un code non-nul même en cas de succès partiel bénin
        # (ex: avertissements sur des extensions déjà présentes) -- on affiche stderr dans
        # tous les cas pour que l'utilisateur puisse juger, plutôt que de masquer l'info.
        if resultat.stderr:
            self.stdout.write(self.style.WARNING(resultat.stderr))

        if resultat.returncode != 0:
            raise CommandError(
                "pg_restore a renvoyé des erreurs (voir ci-dessus) -- vérifiez qu'elles sont "
                "bénignes (avertissements) et non bloquantes avant de considérer la restauration réussie."
            )

        self.stdout.write(self.style.SUCCESS(f"✅ Restauration terminée depuis {chemin_backup}"))
