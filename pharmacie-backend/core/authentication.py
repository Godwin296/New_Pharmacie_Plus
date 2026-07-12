from django.shortcuts import get_object_or_404
from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework_simplejwt.exceptions import AuthenticationFailed, InvalidToken

from clients_publics.models import CompteClient
from .models import Client


class StaffJWTAuthentication(JWTAuthentication):
    """
    🔐 CORRECTIF CRITIQUE : authentification par défaut pour TOUT le reste de l'API
    (personnel : admin, caissière, et tout endpoint sans @authentication_classes
    explicite). Avant ce correctif, ces routes utilisaient la classe JWTAuthentication
    standard, qui ignore totalement la claim "type" -- un jeton CLIENT valide (marketplace
    globale, schéma public) était donc accepté partout, et résolu comme
    `auth.User.objects.get(pk=user_id)` sur le tenant ciblé par le Host de la requête.
    Comme les deux tables ont chacune leur propre compteur d'ID démarrant à 1, le
    PREMIER client inscrit sur toute la plateforme obtenait de fait les droits du
    PREMIER admin de N'IMPORTE QUELLE pharmacie (souvent son fondateur/superuser).
    Vérifié en conditions réelles : un compte client fraîchement créé pouvait lire
    /api/fournisseurs/ et /api/boss-dashboard/ (chiffre d'affaires, stats internes).
    On rejette donc ici tout jeton portant "type": "client" -- les jetons du personnel
    n'ont jamais porté cette claim (RefreshToken.for_user() standard), donc les
    sessions existantes ne sont pas affectées.
    """

    def get_user(self, validated_token):
        if validated_token.get("type") == "client":
            raise AuthenticationFailed(
                "Ce jeton client ne peut pas être utilisé sur les routes du personnel.",
                code="token_not_staff",
            )
        return super().get_user(validated_token)


class ClientJWTAuthentication(JWTAuthentication):
    """
    🔐 Authentification JWT dédiée aux comptes CLIENTS (marketplace globale),
    strictement séparée de celle du personnel. Le token porte une claim
    "type": "client" qui empêche toute confusion dans les deux sens.
    """

    def get_user(self, validated_token):
        if validated_token.get("type") != "client":
            raise AuthenticationFailed(
                "Ce jeton n'est pas un jeton client valide.",
                code="token_not_client",
            )
        try:
            user_id = validated_token["user_id"]
        except KeyError:
            raise InvalidToken("Le jeton ne contient pas d'identifiant utilisateur.")
        try:
            return CompteClient.objects.get(pk=user_id, is_active=True)
        except CompteClient.DoesNotExist:
            raise AuthenticationFailed(
                "Compte client introuvable ou désactivé.",
                code="client_not_found",
            )


class ClientOrStaffJWTAuthentication(JWTAuthentication):
    """
    🔐 Authentification "double-lecture", réservée aux endpoints partagés entre le
    PERSONNEL et les comptes CLIENTS marketplace (ex: /panier/, où la caisse peut
    consulter une facture précise pendant qu'un client gère son panier ; ou
    /current-user/, consulté par n'importe quel visiteur connecté).

    Contrairement à StaffJWTAuthentication, elle NE REJETTE PAS les jetons
    "type": "client" -- elle les route vers CompteClient au lieu de auth.User.
    Elle ne remplace PAS le correctif de sécurité de StaffJWTAuthentication : les
    routes strictement réservées au personnel (fournisseurs, boss-dashboard,
    vente-directe, confirmer-paiement...) continuent d'utiliser StaffJWTAuthentication
    SEULE, qui elle rejette bien les jetons client. N'utiliser cette classe-ci QUE
    sur les endpoints qui ont explicitement besoin d'accepter les deux mondes.
    """

    def get_user(self, validated_token):
        if validated_token.get("type") == "client":
            try:
                user_id = validated_token["user_id"]
            except KeyError:
                raise InvalidToken("Le jeton ne contient pas d'identifiant utilisateur.")
            try:
                return CompteClient.objects.get(pk=user_id, is_active=True)
            except CompteClient.DoesNotExist:
                raise AuthenticationFailed(
                    "Compte client introuvable ou désactivé.",
                    code="client_not_found",
                )
        return super().get_user(validated_token)


def resoudre_identite_client(user):
    """
    🌍 Résout l'identité "client" (jamais personnel) portée par `user`, qu'elle
    provienne du nouveau système global (CompteClient, schéma public, marketplace)
    ou de l'ancien système par-tenant (Client, lié en OneToOne à un auth.User) --
    conservé uniquement pour compatibilité descendante avec d'éventuelles données
    déjà existantes, le nouveau flux d'inscription/connexion ne produit plus que
    des CompteClient.

    Renvoie un tuple (instance, nom_du_champ_fk) où nom_du_champ_fk vaut
    "compte_client" ou "client" -- directement utilisable comme clé de filtre
    (ex: Commande.objects.filter(**{nom_du_champ_fk: instance})).

    Renvoie (None, None) si `user` est un membre du personnel (is_staff=True),
    qui n'a par définition aucune identité client.
    """
    if not user or getattr(user, "is_staff", False):
        return None, None
    if isinstance(user, CompteClient):
        return user, "compte_client"
    # 🕰️ Ancien système : le "profil client" est une ligne à part, liée par
    # OneToOne à l'auth.User authentifié.
    client_profile = get_object_or_404(Client, user=user)
    return client_profile, "client"