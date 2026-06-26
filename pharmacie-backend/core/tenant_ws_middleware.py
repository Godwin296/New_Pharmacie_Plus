"""
🏥 Middleware ASGI tenant-aware pour Django Channels (WebSocket).

PROBLÈME RÉSOLU PAR CE FICHIER :
Le middleware HTTP classique de django-tenants (TenantMainMiddleware) ne s'exécute PAS pour
les connexions WebSocket, car Channels utilise une pile de middlewares ASGI séparée. Sans ce
fichier, un consumer WebSocket ne saurait jamais à quelle pharmacie (schéma PostgreSQL) il
appartient, et risquerait de lire/écrire dans le mauvais schéma -- exactement le genre de fuite
de données entre tenants qu'on a pris soin d'éliminer côté HTTP.

CE QUE FAIT CE MIDDLEWARE :
1. Lit l'en-tête HTTP "Host" de la requête WebSocket entrante (présent même en WebSocket,
   car la connexion démarre par une requête HTTP standard avant l'upgrade de protocole).
2. Cherche le tenant (Pharmacie) correspondant à ce domaine, comme le ferait
   TenantMainMiddleware côté HTTP classique.
3. Attache le schema_name et l'objet tenant directement dans le `scope` du WebSocket, pour
   que chaque Consumer puisse ensuite ouvrir le bon schéma PostgreSQL via schema_context().

⚠️ SÉCURITÉ : comme le rappelle la documentation Django Channels elle-même, l'en-tête Host
(tout comme Origin) peut théoriquement être falsifié par un client malveillant qui parlerait
directement le protocole WebSocket sans passer par un navigateur. Ce n'est PAS un problème pour
nous : la résolution de schéma ne fait que déterminer QUELLES données sont consultées, mais
l'authentification JWT (vérifiée séparément dans chaque Consumer) déterminera QUI a le droit
d'y accéder. Un attaquant qui falsifierait le Host obtiendrait au mieux le schéma d'une autre
pharmacie, mais sans un JWT valide pour CE schéma précis, la connexion sera de toute façon
refusée par le Consumer.
"""
from urllib.parse import parse_qs

from channels.db import database_sync_to_async
from channels.middleware import BaseMiddleware
from django.db import connection

from django_tenants.utils import get_tenant_domain_model, remove_www


@database_sync_to_async
def _resoudre_tenant_depuis_hostname(hostname: str):
    """
    Réplique exactement la logique de TenantMainMiddleware (HTTP) pour le contexte WebSocket :
    bascule en schéma public, cherche le Domain correspondant, retourne le tenant trouvé (ou None).
    """
    connection.set_schema_to_public()
    domain_model = get_tenant_domain_model()
    try:
        domain = domain_model.objects.select_related('tenant').get(domain=hostname)
        return domain.tenant
    except domain_model.DoesNotExist:
        return None


class TenantWebsocketMiddleware(BaseMiddleware):
    """
    À placer tout en haut de la pile de middlewares ASGI (config/asgi.py), avant
    AuthMiddlewareStack et avant le routage vers les Consumers.
    """

    async def __call__(self, scope, receive, send):
        if scope["type"] != "websocket":
            # Ne touche à rien pour les autres types de scope (HTTP classique, déjà géré
            # par TenantMainMiddleware côté Django standard)
            return await super().__call__(scope, receive, send)

        # L'en-tête Host est présent dans scope["headers"], sous forme de tuples (bytes, bytes)
        headers = dict(scope.get("headers", []))
        host_brut = headers.get(b"host", b"").decode("utf-8")
        hostname = remove_www(host_brut.split(":")[0]) if host_brut else ""

        tenant = await _resoudre_tenant_depuis_hostname(hostname) if hostname else None

        scope["tenant"] = tenant
        scope["schema_name"] = tenant.schema_name if tenant else None

        # Bonus pratique : si jamais le frontend a besoin de passer des infos via query string
        # (ex: ws://dupont.pharmacie-plus.com/ws/ordonnances/?token=xxx), on les expose aussi
        # proprement dans le scope pour que les Consumers n'aient pas à reparser l'URL.
        query_string = scope.get("query_string", b"").decode("utf-8")
        scope["query_params"] = parse_qs(query_string)

        return await super().__call__(scope, receive, send)


def TenantWebsocketMiddlewareStack(inner):
    """Petit helper, dans le même esprit que AuthMiddlewareStack de Channels."""
    return TenantWebsocketMiddleware(inner)
