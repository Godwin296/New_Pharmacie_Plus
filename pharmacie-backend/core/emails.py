"""
📧 EMAIL TRANSACTIONNEL

Deux cas d'usage, déclenchés à deux endroits différents du code :
1. Commande en ligne validée par la caisse -> Commande.valider() (statut "payee_a_retirer")
2. Vente directe au guichet -> api_vente_directe() dans api.py (statut "payee")

Le destinataire dépend du type de vente : `commande.compte_client` (compte en ligne) OU
`commande.client_guichet` (client physique identifié au comptoir) -- jamais les deux à
la fois sur une même commande.

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
    Envoie l'email de confirmation pour une commande qui vient d'être payée (en ligne
    OU au guichet). Ne fait rien silencieusement si :
    - ni client, ni client_guichet ne sont renseignés (vente 100% anonyme au comptoir),
    - le destinataire identifié n'a pas d'email renseigné (champ optionnel des deux côtés).
    """
    from .models import PharmacieConfig  # import local : évite l'import circulaire avec models.py

    # 🐛 CORRECTIF (bug préexistant, introduit par le retrait du modèle Client) :
    # "commande.client" n'existe plus depuis la suppression complète de l'ancien modèle
    # Client -- y accéder levait AttributeError et empêchait TOUT email de confirmation
    # de partir, pour absolument toutes les commandes (en ligne comme au guichet).
    destinataire = commande.compte_client or commande.client_guichet
    if not destinataire or not destinataire.email:
        return

    config = PharmacieConfig.objects.first()
    nom_pharmacie = config.nom if config else "Pharmacie Plus"
    message_remerciement = config.message_remerciement if config and config.message_remerciement else ""
    devise = config.devise_preferee if config else "FCFA"

    items = commande.items.select_related('produit').all()
    lignes = "\n".join(
        f"  - {item.produit.nom} x{item.quantite} : {item.total():.0f} {devise}"
        for item in items
    )

    est_guichet = commande.type_vente == 'guichet'
    lieu_retrait = (
        f"Merci pour votre achat chez {nom_pharmacie}."
        if est_guichet
        else f"Votre commande {commande.reference} a bien été payée et est prête à être "
             f"récupérée au guichet de {nom_pharmacie}."
    )

    sujet = (
        f"{nom_pharmacie} — Reçu de votre achat"
        if est_guichet
        else f"{nom_pharmacie} — Commande {commande.reference} prête au retrait"
    )
    corps = (
        f"Bonjour {destinataire.nom},\n\n"
        f"{lieu_retrait}\n\n"
        f"Détail de la commande :\n{lignes}\n\n"
        f"Total : {commande.total():.0f} {devise}\n\n"
        f"{message_remerciement}\n"
    )

    try:
        send_mail(
            subject=sujet,
            message=corps,
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[destinataire.email],
            fail_silently=False,
        )
    except Exception:
        # 🔐 Une panne d'envoi d'email ne doit jamais remonter jusqu'à l'utilisateur ni
        # annuler le paiement déjà validé -- seulement être visible dans les logs serveur
        # (et dans Sentry, désormais centralisé).
        logger.exception(
            "Échec de l'envoi de l'email de confirmation pour la commande %s",
            commande.reference,
        )


def envoyer_email_nouveau_mot_de_passe(client, nouveau_mot_de_passe):
    """
    🔐 Envoie un nouveau mot de passe généré par l'administrateur à un client (compte en
    ligne) qui a perdu l'accès à son compte. Contrairement à `envoyer_email_confirmation_commande`,
    on NE VEUT PAS avaler l'exception ici en silence : l'administrateur qui clique sur
    "réinitialiser & envoyer" doit savoir immédiatement si l'email est réellement parti,
    sinon il pense (à tort) avoir communiqué un mot de passe au client -- risque de blocage
    total du compte sans que personne ne s'en aperçoive. C'est à l'appelant (la vue API)
    de décider quoi répondre au frontend en cas d'échec.
    """
    from .models import PharmacieConfig  # import local : évite l'import circulaire avec models.py

    config = PharmacieConfig.objects.first()
    nom_pharmacie = config.nom if config else "Pharmacie Plus"

    sujet = f"{nom_pharmacie} — Votre nouveau mot de passe"
    corps = (
        f"Bonjour {client.nom},\n\n"
        f"Votre mot de passe a été réinitialisé par l'équipe de {nom_pharmacie}.\n\n"
        f"Voici votre nouveau mot de passe temporaire :\n\n"
        f"    {nouveau_mot_de_passe}\n\n"
        f"Merci de vous connecter avec ce mot de passe, puis de le modifier dès que possible "
        f"depuis votre profil.\n\n"
        f"Si vous n'êtes pas à l'origine de cette demande, contactez immédiatement "
        f"{nom_pharmacie}.\n"
    )

    send_mail(
        subject=sujet,
        message=corps,
        from_email=settings.DEFAULT_FROM_EMAIL,
        recipient_list=[client.email],
        fail_silently=False,
    )


def envoyer_email_bienvenue(client):
    """
    👋 Email de bienvenue à l'inscription d'un nouveau compte client (en ligne).
    Comme pour la confirmation de commande : on n'avale JAMAIS une exception au point de
    faire échouer la création du compte pour autant -- rater un email de bienvenue est
    largement préférable à rater une inscription déjà validée en base. Ne fait rien
    silencieusement si le client n'a pas renseigné d'email (champ optionnel).
    """
    if not client.email:
        return

    from .models import PharmacieConfig  # import local : évite l'import circulaire avec models.py

    config = PharmacieConfig.objects.first()
    nom_pharmacie = config.nom if config else "Pharmacie Plus"

    sujet = f"Bienvenue chez {nom_pharmacie} 🎉"
    # `identifiant` n'existe que sur l'ancien modèle Client (par-tenant) -- absent sur
    # CompteClient (marketplace, global). On l'inclut seulement quand il est disponible.
    identifiant = getattr(client, "identifiant", None)
    ligne_identifiant = f" (identifiant : {identifiant})" if identifiant else ""
    corps = (
        f"Bonjour {client.nom},\n\n"
        f"Ton compte {nom_pharmacie} a bien été créé{ligne_identifiant}.\n\n"
        f"Tu peux dès maintenant parcourir le catalogue, passer commande en ligne et payer "
        f"par Orange Money ou MTN MoMo, pour venir récupérer directement au guichet.\n\n"
        f"À très vite !\n"
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
        logger.exception(
            "Échec de l'envoi de l'email de bienvenue pour le client %s", client.identifiant
        )


def envoyer_email_ordonnance_refusee(commande):
    """
    ❌ Prévient le client par email quand son ordonnance est refusée par la caisse, avec le
    motif. Complète la notification temps réel WebSocket (`_notifier_client` dans api.py) :
    utile si le client n'a pas l'application ouverte au moment du refus -- une ordonnance
    refusée bloque sa commande, il est important qu'il le sache rapidement même hors ligne.
    Même logique défensive que les autres emails transactionnels : jamais bloquant.
    """
    # 🐛 CORRECTIF (bug préexistant, introduit par le retrait du modèle Client) : idem
    # envoyer_email_confirmation_commande ci-dessus -- "commande.client" n'existe plus.
    # Une ordonnance refusée concerne toujours une commande en ligne (le guichet n'a pas
    # de flux d'upload/refus numérique), donc compte_client seul suffit ici.
    destinataire = commande.compte_client
    if not destinataire or not destinataire.email:
        return

    from .models import PharmacieConfig  # import local : évite l'import circulaire avec models.py

    config = PharmacieConfig.objects.first()
    nom_pharmacie = config.nom if config else "Pharmacie Plus"

    sujet = f"{nom_pharmacie} — Ordonnance refusée pour la commande {commande.reference}"
    corps = (
        f"Bonjour {destinataire.nom},\n\n"
        f"L'ordonnance envoyée pour ta commande {commande.reference} n'a malheureusement pas "
        f"pu être validée par {nom_pharmacie}.\n\n"
        f"Motif : {commande.motif_refus or 'Document invalide'}\n\n"
        f"Tu peux te reconnecter à l'application pour envoyer un nouveau document et relancer "
        f"ta commande.\n\n"
        f"Si tu as des questions, contacte directement {nom_pharmacie}.\n"
    )

    try:
        send_mail(
            subject=sujet,
            message=corps,
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[destinataire.email],
            fail_silently=False,
        )
    except Exception:
        logger.exception(
            "Échec de l'envoi de l'email de refus d'ordonnance pour la commande %s",
            commande.reference,
        )
