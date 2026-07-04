"""
📧 EMAIL TRANSACTIONNEL

Un seul cas d'usage pour l'instant : confirmer par email à un client EN LIGNE que sa
commande est payée et prête à être retirée au guichet (déclenché depuis
Commande.valider() dans models.py).

Volontairement synchrone et défensif : si l'envoi échoue (Brevo indisponible, quota
dépassé, sender pas encore vérifié...), on logue l'erreur mais on NE FAIT JAMAIS
échouer la transaction de paiement pour autant -- rater un email est très inférieur en
gravité à perdre une vente déjà encaissée. Si le volume grossit, migrer ceci vers une
tâche asynchrone (Celery) pour ne pas ralentir la requête de paiement le temps de
l'appel réseau SMTP.
"""
import logging

from django.conf import settings
from django.core.mail import send_mail

logger = logging.getLogger(__name__)


def envoyer_email_confirmation_commande(commande):
    """
    Envoie l'email de confirmation pour une commande qui vient de passer à
    'payee_a_retirer'. Ne fait rien silencieusement si :
    - la commande est une vente guichet (pas de compte client en ligne à notifier),
    - le client n'a renseigné aucun email (champ optionnel sur Client).
    """
    from .models import PharmacieConfig  # import local : évite l'import circulaire avec models.py

    client = commande.client
    if not client or not client.email:
        return

    config = PharmacieConfig.objects.first()
    nom_pharmacie = config.nom if config else "Pharmacie Plus"
    message_remerciement = config.message_remerciement if config and config.message_remerciement else ""

    items = commande.items.select_related('produit').all()
    lignes = "\n".join(
        f"  - {item.produit.nom} x{item.quantite} : {item.total():.0f} {config.devise_preferee if config else 'FCFA'}"
        for item in items
    )

    sujet = f"{nom_pharmacie} — Commande {commande.reference} prête au retrait"
    corps = (
        f"Bonjour {client.nom},\n\n"
        f"Votre commande {commande.reference} a bien été payée et est prête à être "
        f"récupérée au guichet de {nom_pharmacie}.\n\n"
        f"Détail de la commande :\n{lignes}\n\n"
        f"Total : {commande.total():.0f} {config.devise_preferee if config else 'FCFA'}\n\n"
        f"{message_remerciement}\n"
    )

    try:
        send_mail(
            subject=sujet,
            message=corps,
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[client.email],
            fail_silently=False,
        )
    except Exception:
        # 🔐 Une panne d'envoi d'email ne doit jamais remonter jusqu'à l'utilisateur ni
        # annuler le paiement déjà validé -- seulement être visible dans les logs serveur
        # (et plus tard dans Sentry, cf. TODO "Logs centralisés").
        logger.exception(
            "Échec de l'envoi de l'email de confirmation pour la commande %s",
            commande.reference,
        )
