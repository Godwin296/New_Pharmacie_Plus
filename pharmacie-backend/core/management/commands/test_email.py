"""
📧 COMMANDE DE DIAGNOSTIC EMAIL -- ne fait AUCUN des compromis de core/emails.py.

core/emails.py avale volontairement les exceptions d'envoi (voir son docstring) : c'est
le bon choix en production pour ne jamais faire échouer un paiement à cause d'un souci
SMTP. Mais ça veut aussi dire qu'on n'a JAMAIS l'erreur réelle sous les yeux pendant le
diagnostic d'une config Brevo qui ne part pas.

Cette commande fait l'inverse : elle envoie un vrai email et laisse l'exception remonter
telle quelle (avec son message SMTP d'origine), plus quelques vérifications de config
courantes AVANT même de tenter la connexion, pour repérer les pièges classiques
(placeholders oubliés, backend "console" silencieux, etc.).

Usage :
    python manage.py test_email ton-adresse@exemple.com
"""
from django.conf import settings
from django.core.mail import get_connection, EmailMessage
from django.core.management.base import BaseCommand, CommandError


class Command(BaseCommand):
    help = "Envoie un email de test réel et affiche l'erreur SMTP exacte en cas d'échec (diagnostic Brevo)."

    def add_arguments(self, parser):
        parser.add_argument("destinataire", type=str, help="Adresse email qui doit recevoir le test")

    def handle(self, *args, **options):
        destinataire = options["destinataire"]

        self.stdout.write(self.style.NOTICE("\n=== 1. Vérification de la configuration ==="))

        # --- Backend utilisé -------------------------------------------------------------
        self.stdout.write(f"EMAIL_BACKEND      = {settings.EMAIL_BACKEND}")
        if "console" in settings.EMAIL_BACKEND:
            self.stdout.write(self.style.ERROR(
                "⚠️  Backend CONSOLE actif : EMAIL_HOST_USER et/ou EMAIL_HOST_PASSWORD sont vides "
                "dans ton .env (ou pas chargés). Aucun email ne part réellement, il est juste "
                "affiché ci-dessous dans ce terminal -- ce n'est PAS un envoi réel."
            ))

        # --- Placeholders oubliés ----------------------------------------------------------
        valeurs_suspectes = {
            "EMAIL_HOST_USER": settings.EMAIL_HOST_USER,
            "DEFAULT_FROM_EMAIL": settings.DEFAULT_FROM_EMAIL,
        }
        for nom, valeur in valeurs_suspectes.items():
            if "remplace-moi" in valeur or "exemple.com" in valeur or "pharmacieplus.local" in valeur:
                self.stdout.write(self.style.ERROR(
                    f"⚠️  {nom} = {valeur!r} ressemble à une valeur placeholder jamais remplacée."
                ))

        self.stdout.write(f"EMAIL_HOST         = {settings.EMAIL_HOST}")
        self.stdout.write(f"EMAIL_PORT         = {settings.EMAIL_PORT}")
        self.stdout.write(f"EMAIL_USE_TLS      = {settings.EMAIL_USE_TLS}")
        self.stdout.write(f"EMAIL_HOST_USER    = {settings.EMAIL_HOST_USER!r}")
        self.stdout.write(f"DEFAULT_FROM_EMAIL = {settings.DEFAULT_FROM_EMAIL!r}")
        self.stdout.write(self.style.WARNING(
            "\n📌 Rappel Brevo : DEFAULT_FROM_EMAIL doit être un expéditeur VÉRIFIÉ dans Brevo\n"
            "   (Senders, Domains & Dedicated IPs → Senders → email confirmé via le lien reçu),\n"
            "   sinon Brevo rejette l'envoi même avec des identifiants SMTP corrects."
        ))

        # --- 2. Tentative de connexion SMTP séparée de l'envoi, pour isoler l'étape qui échoue ---
        self.stdout.write(self.style.NOTICE("\n=== 2. Connexion au serveur SMTP ==="))
        connexion = get_connection(fail_silently=False)
        try:
            connexion.open()
            self.stdout.write(self.style.SUCCESS("✅ Connexion + authentification SMTP réussies."))
        except Exception as erreur:
            self.stdout.write(self.style.ERROR(f"❌ Échec à la connexion/authentification : {erreur!r}"))
            raise CommandError(
                "La connexion SMTP a échoué avant même d'essayer d'envoyer quoi que ce soit -- "
                "voir le message d'erreur ci-dessus (identifiants EMAIL_HOST_USER/PASSWORD "
                "invalides, port bloqué par ton réseau, ou TLS mal configuré)."
            )

        # --- 3. Envoi réel ------------------------------------------------------------------
        self.stdout.write(self.style.NOTICE("\n=== 3. Envoi de l'email de test ==="))
        try:
            message = EmailMessage(
                subject="Pharmacie Plus — Test de configuration email",
                body=(
                    "Si tu reçois cet email, ta configuration Brevo/SMTP fonctionne "
                    "correctement de bout en bout (connexion, authentification, ET expéditeur "
                    "accepté par Brevo)."
                ),
                from_email=settings.DEFAULT_FROM_EMAIL,
                to=[destinataire],
                connection=connexion,
            )
            message.send(fail_silently=False)
            self.stdout.write(self.style.SUCCESS(f"✅ Email envoyé à {destinataire} sans exception levée."))
            self.stdout.write(self.style.WARNING(
                "⚠️  'Aucune exception' ne veut PAS toujours dire 'livré' : Brevo peut accepter "
                "le message côté SMTP puis le rejeter/bloquer ensuite silencieusement (expéditeur "
                "non vérifié, quota atteint...). Va vérifier les Logs > Email activity sur ton "
                "tableau de bord Brevo pour voir le statut réel de CE message précis, et regarde "
                "aussi les dossiers spam/indésirables du destinataire."
            ))
        except Exception as erreur:
            self.stdout.write(self.style.ERROR(f"❌ Échec à l'envoi : {erreur!r}"))
            raise CommandError(
                "La connexion SMTP a réussi mais l'envoi du message a échoué -- voir le message "
                "d'erreur ci-dessus (souvent : expéditeur DEFAULT_FROM_EMAIL non vérifié dans Brevo)."
            )
        finally:
            connexion.close()
