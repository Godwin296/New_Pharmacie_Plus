"""
🩺 Health check pour outils de supervision externes (UptimeRobot, Better Stack,
Kubernetes/Docker healthcheck, load balancer...).

Volontairement dans `config/` et NON dans `core/urls.py` : cette route doit répondre
sur N'IMPORTE QUEL domaine (le domaine racine du SaaS ET chaque sous-domaine tenant),
sans dépendre de la résolution de schéma django-tenants -- un outil de monitoring ping
en général une seule URL fixe, souvent le domaine racine, qui utilise
PUBLIC_SCHEMA_URLCONF (config.urls_public) où core.urls n'est PAS monté.

Réponse volontairement minimale : pas de nom de schéma, pas de version de dépendances,
pas de détail d'erreur -- une page de health check est par nature accessible sans
authentification, donc publique sur Internet. On ne veut rien y exposer qui aide un
attaquant à cartographier l'infrastructure.
"""
import time
from django.db import connection
from django.core.cache import cache
from django.http import JsonResponse


def healthz(request):
    checks = {"database": False, "cache": False}
    t0 = time.monotonic()

    try:
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1")
            cursor.fetchone()
        checks["database"] = True
    except Exception:
        pass

    try:
        marker = "healthz_probe"
        cache.set(marker, "1", timeout=5)
        checks["cache"] = cache.get(marker) == "1"
    except Exception:
        pass

    healthy = all(checks.values())
    body = {
        "status": "ok" if healthy else "degraded",
        "checks": checks,
        "latency_ms": round((time.monotonic() - t0) * 1000, 1),
    }
    # 200 même en "degraded" volontairement PARTIEL : un load balancer configuré pour
    # retirer l'instance au premier 5xx serait trop agressif si SEUL Redis est en panne
    # (le site continue de fonctionner en mode dégradé, cf. cache_utils.py qui retombe
    # simplement sur la DB si le cache est indisponible). Seule une DB down mérite un 503
    # franc -- c'est la seule dépendance réellement bloquante pour servir une réponse.
    status_code = 200 if checks["database"] else 503
    return JsonResponse(body, status=status_code)
