from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework_simplejwt.exceptions import AuthenticationFailed, InvalidToken

from clients_publics.models import CompteClient


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