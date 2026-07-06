from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework_simplejwt.exceptions import AuthenticationFailed, InvalidToken

from clients_publics.models import CompteClient


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