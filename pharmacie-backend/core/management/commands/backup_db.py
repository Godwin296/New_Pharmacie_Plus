"""
🗄️ Sauvegarde PostgreSQL -- une seule base de données pour TOUS les tenants.

Avec django-tenants, chaque pharmacie cliente vit dans son propre SCHÉMA PostgreSQL
(dupont, martin...) mais À L'INTÉRIEUR de la MÊME base de données physique
(cf. DATABASES['default']['NAME'] dans settings.py). Un simple `pg_dump` de cette base
capture donc automatiquement TOUS les tenants (+ le schéma public partagé) en un seul
fichier -- pas besoin d'un dump par pharmacie.

Utilise le format "custom" de pg_dump (-Fc) plutôt qu'un .sql brut :
- compressé nativement (bien plus léger que du SQL texte)
- restaurable sélectivement (un seul schéma, une seule table...) via pg_restore
- restaurable en parallèle (pg_restore -j) pour les grosses bases

Usage :
    python manage.py backup_db
    python manage.py backup_db --output-dir /chemin/personnalise
    python manage.py backup_db --keep 30          # conserve les 30 derniers (défaut: 14)
    python manage.py backup_db --no-cleanup        # ne supprime aucun ancien backup

⚠️ Nécessite que `pg_dump` (fourni avec PostgreSQL) soit accessible dans le PATH, avec une
version compatible avec le serveur cible (idéalement la même version majeure).
"""
import os
import subprocess
import shutil
from datetime import datetime, timezone
from pathlib import Path

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError


class Command(BaseCommand):
    help = "Sauvegarde complète de la base PostgreSQL (tous les tenants + schéma public) via pg_dump."

    def add_arguments(self, parser):
        parser.add_argument(
            "--output-dir",
            default=str(settings.BASE_DIR / "backups"),
            help="Dossier de destination des sauvegardes (défaut : <projet>/backups/).",
        )
        parser.add_argument(
            "--keep",
            type=int,
            default=14,
            help="Nombre de sauvegardes récentes à conserver (défaut : 14). Les plus anciennes sont supprimées.",
        )
        parser.add_argument(
            "--no-cleanup",
            action="store_true",
            help="Ne supprime aucune ancienne sauvegarde, quel que soit --keep.",
        )

    def handle(self, *args, **options):
        if shutil.which("pg_dump") is None:
            raise CommandError(
                "pg_dump introuvable dans le PATH. Installez les outils clients PostgreSQL "
                "(sur Windows : ajoutez le dossier 'bin' de votre installation PostgreSQL, "
                "ex. 'C:\\Program Files\\PostgreSQL\\16\\bin', à la variable d'environnement PATH)."
            )

        db = settings.DATABASES["default"]
        output_dir = Path(options["output_dir"])
        output_dir.mkdir(parents=True, exist_ok=True)

        horodatage = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
        nom_fichier = f"pharmacie_backup_{horodatage}.dump"
        chemin_backup = output_dir / nom_fichier

        env = os.environ.copy()
        if db.get("PASSWORD"):
            # 🔐 Évite de faire apparaître le mot de passe dans la liste des process (ps aux) --
            # pg_dump lit PGPASSWORD depuis l'environnement plutôt qu'un argument en ligne de commande.
            env["PGPASSWORD"] = db["PASSWORD"]

        commande = [
            "pg_dump",
            "-h", db.get("HOST") or "localhost",
            "-p", str(db.get("PORT") or 5432),
            "-U", db.get("USER") or "postgres",
            "-Fc",  # format "custom" : compressé, restaurable sélectivement
            "-f", str(chemin_backup),
            db["NAME"],
        ]

        self.stdout.write(f"⏳ Sauvegarde de la base '{db['NAME']}' en cours...")
        resultat = subprocess.run(commande, env=env, capture_output=True, text=True)

        if resultat.returncode != 0:
            # Le fichier peut avoir été partiellement créé -- on le supprime pour ne jamais
            # laisser un backup corrompu/incomplet se faire passer pour une sauvegarde valide.
            chemin_backup.unlink(missing_ok=True)
            raise CommandError(f"Échec de pg_dump :\n{resultat.stderr}")

        taille_mo = chemin_backup.stat().st_size / (1024 * 1024)
        self.stdout.write(self.style.SUCCESS(
            f"✅ Sauvegarde réussie : {chemin_backup} ({taille_mo:.1f} Mo)"
        ))

        if not options["no_cleanup"]:
            self._nettoyer_anciennes_sauvegardes(output_dir, options["keep"])

    def _nettoyer_anciennes_sauvegardes(self, output_dir: Path, keep: int):
        sauvegardes = sorted(
            output_dir.glob("pharmacie_backup_*.dump"),
            key=lambda p: p.stat().st_mtime,
            reverse=True,
        )
        a_supprimer = sauvegardes[keep:]
        for fichier in a_supprimer:
            fichier.unlink()
            self.stdout.write(f"🗑️  Ancienne sauvegarde supprimée (rétention {keep}) : {fichier.name}")
