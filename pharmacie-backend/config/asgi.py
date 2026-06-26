"""
ASGI config for config project.

Route à la fois les requêtes HTTP classiques (gérées par Django/django-tenants normalement)
et les connexions WebSocket (gérées par Django Channels, avec notre pile de middlewares
tenant-aware + authentification JWT custom).

For more information on this file, see
https://docs.djangoproject.com/en/5.2/howto/deployment/asgi/
"""

import os

from django.core.asgi import get_asgi_application

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')

# 🔴 IMPORTANT : get_asgi_application() DOIT être appelé avant tout import qui charge des
# modèles Django (ex: core.routing), sous peine d'AppRegistryNotReady. C'est pourquoi
# l'import de core.routing et des middlewares se fait APRÈS cette ligne.
django_asgi_app = get_asgi_application()

from channels.routing import ProtocolTypeRouter, URLRouter  # noqa: E402

from core.routing import websocket_urlpatterns  # noqa: E402
from core.tenant_ws_middleware import TenantWebsocketMiddlewareStack  # noqa: E402
from core.jwt_ws_middleware import JWTWebsocketAuthMiddlewareStack  # noqa: E402

application = ProtocolTypeRouter({
    "http": django_asgi_app,
    "websocket": TenantWebsocketMiddlewareStack(
        JWTWebsocketAuthMiddlewareStack(
            URLRouter(websocket_urlpatterns)
        )
    ),
})
