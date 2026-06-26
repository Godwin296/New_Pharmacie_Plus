"""
🔐 Authentification JWT pour Django Channels (WebSocket).

Le navigateur ne peut pas envoyer un en-tête HTTP "Authorization: Bearer <token>" lors d'un
handshake WebSocket natif (l'API navigateur new WebSocket(url) ne permet pas d'en-têtes
personnalisés). La convention standard consiste donc à passer le token JWT en paramètre de
requête : ws://dupont.pharmacie-plus.com/ws/ordonnances/?token=<access_token>

Ce middleware DOIT s'exécuter APRÈS TenantWebsocketMiddleware (core/tenant_ws_middleware.py),
car l'utilisateur (table auth_user) vit DANS le schéma du tenant -- on ne peut pas vérifier qui
est request.user sans d'abord savoir dans quel schéma chercher.
"""
from channels.db import database_sync_to_async
from channels.middleware import BaseMiddleware
from django.contrib.auth.models import AnonymousUser
from django.db import connection
from rest_framework_simplejwt.tokens import AccessToken
from rest_framework_simplejwt.exceptions import TokenError

from django_tenants.utils import schema_context


@database_sync_to_async
def _recuperer_utilisateur_depuis_token(token_str: str, schema_name: str):
    """
    Décode le token JWT et récupère l'utilisateur Django correspondant, en cherchant
    EXPLICITEMENT dans le schéma du tenant concerné par la connexion WebSocket.
    Retourne AnonymousUser si le token est invalide/expiré ou si l'utilisateur n'existe pas
    dans ce schéma précis (ex: un token valide pour la Pharmacie Dupont, mais utilisé pour
    essayer de se connecter au canal WebSocket de la Pharmacie Martin -> rejeté).
    """
    if not schema_name:
        return AnonymousUser()

    try:
        with schema_context(schema_name):
            access_token = AccessToken(token_str)
            user_id = access_token["user_id"]

            from django.contrib.auth.models import User
            return User.objects.get(id=user_id)
    except (TokenError, KeyError, Exception):
        # Toute erreur (token invalide, expiré, user inexistant DANS CE schéma) -> anonyme.
        # On reste volontairement large sur Exception ici : un schéma inexistant ou une
        # erreur de connexion DB ne doit jamais lever d'exception non gérée dans un middleware
        # d'authentification -- le pire cas acceptable est un rejet de connexion, jamais un crash.
        return AnonymousUser()


class JWTWebsocketAuthMiddleware(BaseMiddleware):
    """
    À placer APRÈS TenantWebsocketMiddleware dans la pile ASGI.
    Attache scope["user"] (objet User authentifié, ou AnonymousUser si échec).
    """

    async def __call__(self, scope, receive, send):
        if scope["type"] != "websocket":
            return await super().__call__(scope, receive, send)

        query_params = scope.get("query_params", {})
        token_list = query_params.get("token", [])
        token_str = token_list[0] if token_list else None

        schema_name = scope.get("schema_name")

        if token_str and schema_name:
            scope["user"] = await _recuperer_utilisateur_depuis_token(token_str, schema_name)
        else:
            scope["user"] = AnonymousUser()

        return await super().__call__(scope, receive, send)


def JWTWebsocketAuthMiddlewareStack(inner):
    return JWTWebsocketAuthMiddleware(inner)
