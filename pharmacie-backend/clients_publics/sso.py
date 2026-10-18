"""
Compte client UNIQUE d'une pharmacie à l'autre (passerelle de connexion).

Constat : `CompteClient` est global (schéma public) -- un seul compte suffit pour toutes les
pharmacies, et un même JWT est valide sur n'importe quel sous-domaine. Le seul obstacle est le
NAVIGATEUR : chaque origine (plateforme, dupont.localhost, martin.localhost...) a son propre
localStorage, donc le jeton obtenu sur l'une n'existe pas sur l'autre.

Solution (fonctionne avec n'importe quels domaines, y compris domaines personnalisés et
localhost, contrairement à un cookie de domaine parent) : un CODE à usage unique.

    1. Sur l'origine A, client connecté :  POST /api/v1/auth/passerelle/  {"cible": "dupont.localhost"}
       -> {"code": "..."}                  (valable 60 s, utilisable une seule fois, UNIQUEMENT sur `cible`)
    2. Redirection vers  http://dupont.localhost:3000/auth/relais?code=...
    3. Sur l'origine B :  POST /api/v1/auth/echange/  {"code": "..."}
       -> {"access", "refresh", "email", "nom"}   -> le frontend les stocke et efface le code de l'URL.

Le code ne contient aucun jeton : l'URL (historique, logs) n'expose donc rien de réutilisable.
"""
import secrets

from django.core.cache import cache
from django.conf import settings
from rest_framework import status
from rest_framework.decorators import api_view, authentication_classes, permission_classes, throttle_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework_simplejwt.tokens import RefreshToken

from core.authentication import ClientJWTAuthentication
from core.throttles import LoginRateThrottle

DUREE_CODE_SECONDES = 60
PREFIXE_CLE = "sso:passerelle:"


def _hote_sans_port(valeur: str) -> str:
    return (valeur or "").strip().lower().split(":")[0]


def _cible_autorisee(cible: str) -> bool:
    """
    Une cible valide est un domaine de pharmacie enregistré (table Domain, schéma public) ou un
    domaine de la plateforme listé dans PLATEFORME_DOMAINES (.env, séparés par des virgules).
    Sans ce contrôle, n'importe qui pourrait demander un code à destination d'un site tiers.
    """
    from tenants.models import Domain

    if not cible:
        return False
    if cible in getattr(settings, "PLATEFORME_DOMAINES", []):
        return True
    return Domain.objects.filter(domain=cible).exists()


def emettre_jetons(client):
    """Mêmes jetons que api_client_login (voir core/api.py pour la raison du RefreshToken() nu)."""
    refresh = RefreshToken()
    refresh["user_id"] = client.pk
    refresh["type"] = "client"
    access = refresh.access_token
    access["type"] = "client"
    return str(access), str(refresh)


@api_view(["POST"])
@authentication_classes([ClientJWTAuthentication])
@permission_classes([IsAuthenticated])
def api_passerelle_creer(request):
    cible = _hote_sans_port(request.data.get("cible"))
    if not _cible_autorisee(cible):
        return Response({"error": "Destination inconnue."}, status=status.HTTP_400_BAD_REQUEST)
    code = secrets.token_urlsafe(32)
    cache.set(PREFIXE_CLE + code, {"client_id": request.user.pk, "cible": cible}, DUREE_CODE_SECONDES)
    return Response({"code": code, "expire_dans": DUREE_CODE_SECONDES})


@api_view(["POST"])
@authentication_classes([])
@permission_classes([AllowAny])
@throttle_classes([LoginRateThrottle])
def api_passerelle_echanger(request):
    from clients_publics.models import CompteClient

    code = (request.data.get("code") or "").strip()
    invalide = Response({"error": "Code invalide ou expiré."}, status=status.HTTP_400_BAD_REQUEST)
    if not code:
        return invalide
    cle = PREFIXE_CLE + code
    donnees = cache.get(cle)
    # delete() renvoie True pour un seul appelant : garantit l'usage unique même en concurrence.
    if not donnees or not cache.delete(cle):
        return invalide
    # Le code n'est utilisable que sur le domaine pour lequel il a été émis.
    if _hote_sans_port(request.get_host()) != donnees["cible"]:
        return invalide
    try:
        client = CompteClient.objects.get(pk=donnees["client_id"], is_active=True)
    except CompteClient.DoesNotExist:
        return invalide
    access, refresh = emettre_jetons(client)
    return Response({"access": access, "refresh": refresh, "email": client.email, "nom": client.nom})


@api_view(["GET"])
@authentication_classes([ClientJWTAuthentication])
@permission_classes([IsAuthenticated])
def api_client_identite(request):
    """Identité minimale du client connecté -- utilisable sur la plateforme (pas de donnée par pharmacie)."""
    c = request.user
    return Response({"id": c.pk, "email": c.email, "nom": c.nom, "telephone": c.telephone,
                     "identifiant": c.identifiant, "langue_preferee": c.langue_preferee})
