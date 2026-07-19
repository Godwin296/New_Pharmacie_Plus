"""
🔐 Cache Redis — utilitaires MULTI-TENANT.

⚠️ POINT CRITIQUE : une seule instance Redis est partagée par TOUTES les pharmacies
clientes (le cache Django, comme Channels, se connecte à la même instance Redis pour
tout le monde). Si on mettait en cache une clé "catalogue" toute nue, la pharmacie
"dupont" pourrait recevoir en réponse le catalogue mis en cache de "martin" -- fuite de
données entre tenants, en plus d'un bug fonctionnel. TOUTE clé de cache posée depuis une
vue "tenant" (core.urls, exécutée dans le schema_context d'une pharmacie précise) DOIT
donc passer par `tenant_cache_key()` ci-dessous, qui préfixe avec `connection.schema_name`.

Stratégie d'invalidation retenue : TTL courts + auto-expiration plutôt que suppression
manuelle par motif ("cache invalidation is one of the two hard things..."). Le backend
Redis natif de Django 5.x (`django.core.cache.backends.redis.RedisCache`, déjà utilisé
dans settings.py) n'expose pas `delete_pattern` (fonctionnalité spécifique au paquet
tiers `django-redis`, pas installé ici) -- on ne peut donc de toute façon PAS faire de
suppression par motif proprement sans ajouter une dépendance. Pour un catalogue public
en lecture, quelques dizaines de secondes de fraîcheur en moins sont un compromis très
raisonnable face à la complexité (et aux bugs potentiels) d'une invalidation manuelle
exhaustive sur chaque point d'écriture (vente, réappro, modification produit, photo...).

Seule exception : la config pharmacie (`infos_pharmacie`) a UNE clé fixe par tenant (pas
de variation par paramètres de requête) -- on peut et on DOIT l'invalider immédiatement
à chaque modification, sans attendre le TTL, sinon le logo/nom fraîchement changés par
l'admin resteraient invisibles jusqu'à expiration du cache.
"""
import hashlib
from django.core.cache import cache
from django.db import connection


def _schema_name() -> str:
    # `connection.schema_name` n'existe QUE grâce à django-tenants ; en dehors d'un
    # contexte de requête tenant (ex: script one-off), on retombe sur "public" par sécurité.
    return getattr(connection, "schema_name", "public")


def tenant_cache_key(base_key: str, request=None) -> str:
    """
    Construit une clé de cache préfixée par le schéma du tenant courant.
    Si `request` est fourni, la query string complète (?page=2&cat=X...) est incluse
    dans la clé (hashée) : chaque combinaison de filtres a son propre emplacement de
    cache, on ne sert jamais une page 2 en réponse à une demande de page 1.
    """
    schema = _schema_name()
    if request is not None:
        query_hash = hashlib.md5(
            request.META.get("QUERY_STRING", "").encode("utf-8")
        ).hexdigest()[:12]
        return f"tenant:{schema}:{base_key}:{query_hash}"
    return f"tenant:{schema}:{base_key}"


def cache_get(base_key: str, request=None):
    return cache.get(tenant_cache_key(base_key, request))


def cache_set(base_key: str, value, timeout: int, request=None):
    cache.set(tenant_cache_key(base_key, request), value, timeout=timeout)


def cache_delete_exact(base_key: str):
    """Invalidation immédiate d'une clé SANS variation par requête (ex: infos_pharmacie)."""
    cache.delete(tenant_cache_key(base_key))
