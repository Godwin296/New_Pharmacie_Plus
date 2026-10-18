from django.db import connection
from django.db.models import Q
from django_tenants.utils import get_public_schema_name
from rest_framework import status
from rest_framework.decorators import api_view, authentication_classes, permission_classes
from rest_framework.response import Response

from tenants.models import Pharmacie
from .pagination import PharmaciePagination
from .serializers import (
    PharmacieCarteSerializer,
    PharmacieMarketplaceDetailSerializer,
    PharmacieMarketplaceSerializer,
)
from .utils import ParametreInvalide, distance_km, lire_position, lire_rayon

# Plafond de marqueurs renvoyés d'un coup pour la carte (pas de pagination sur une carte).
LIMITE_CARTE = 500


def _pharmacies_visibles():
    """
    Pharmacies affichables sur la marketplace :
      - actives ;
      - joignables, c'est-à-dire avec un domaine PRIMAIRE (sinon "Choisir cette pharmacie"
        ne mènerait nulle part -- une carte dont le bouton est mort est pire qu'une carte absente) ;
      - hors tenant "public" : sur une vraie plateforme, django-tenants impose une ligne
        Pharmacie pour le schéma public (le domaine racine). Ce n'est pas une pharmacie et
        elle ne doit jamais apparaître dans la liste.

    `domains` et `horaires` sont préchargés : les serializers et utils les lisent via `.all()`
    sans aucune requête supplémentaire par carte.
    """
    return (
        Pharmacie.objects
        .filter(actif=True, domains__is_primary=True)
        .exclude(schema_name=get_public_schema_name())
        .prefetch_related('domains', 'horaires')
        .distinct()
    )


def _filtrer_et_trier(request, queryset):
    """
    Applique recherche texte, position, rayon et tri. Retourne (liste, lat, lng).
    Lève ParametreInvalide pour un paramètre mal formé.

    Tri en Python (pas de PostGIS) -- voir marketplace/utils.py. Sans position : ordre
    alphabétique. Avec position : distance croissante ; les pharmacies sans coordonnées
    connues sont reléguées en fin de liste (on ne sait juste pas les classer) -- sauf si un
    rayon est demandé, où elles sont exclues (impossible de prouver qu'elles sont dans le rayon).
    """
    lat_client, lng_client = lire_position(request.query_params)
    rayon = lire_rayon(request.query_params, lat_client is not None)

    q = request.query_params.get('q', '').strip()
    if q:
        queryset = queryset.filter(
            Q(nom_public__icontains=q) | Q(nom__icontains=q) | Q(adresse_public__icontains=q)
        )

    resultats = list(queryset)

    def nom_tri(p):
        return ((p.nom_public or p.nom).lower(), p.id)

    if lat_client is not None:
        def distance(p):
            if p.latitude is None or p.longitude is None:
                return float('inf')
            return distance_km(lat_client, lng_client, p.latitude, p.longitude)

        if rayon is not None:
            resultats = [p for p in resultats if distance(p) <= rayon]
        resultats.sort(key=lambda p: (distance(p),) + nom_tri(p))
    else:
        resultats.sort(key=nom_tri)

    return resultats, lat_client, lng_client


@api_view(['GET'])
@authentication_classes([])
@permission_classes([])
def api_liste_pharmacies(request):
    """
    Page de découverte : liste paginée des pharmacies actives, avec recherche, tri par
    proximité et filtre de rayon si la position du client est fournie.

    Publique (pas d'authentification requise) : parcourir la marketplace ne nécessite pas
    d'être connecté. Servie sur le domaine plateforme ET sur les sous-domaines de pharmacies.

    Query params (tous optionnels) :
      - q         : recherche texte sur le nom ou l'adresse (insensible à la casse)
      - lat, lng  : position du client (bouton "Utiliser ma position") -- à fournir ensemble ;
                    active le tri par distance et le champ `distance_km` de chaque résultat
      - rayon_km  : ne garde que les pharmacies dans ce rayon (nécessite lat/lng, max 500)
      - page, page_size : pagination (20 par page, 100 max)
    """
    try:
        resultats, lat_client, lng_client = _filtrer_et_trier(request, _pharmacies_visibles())
    except ParametreInvalide as e:
        return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

    paginator = PharmaciePagination()
    page = paginator.paginate_queryset(resultats, request)
    serializer = PharmacieMarketplaceSerializer(
        page, many=True,
        context={'request': request, 'lat_client': lat_client, 'lng_client': lng_client},
    )
    return paginator.get_paginated_response(serializer.data)


@api_view(['GET'])
@authentication_classes([])
@permission_classes([])
def api_carte_pharmacies(request):
    """
    Marqueurs pour la carte (onglet "Carte" et bandeau de carte de la page de découverte) :
    toutes les pharmacies AVEC coordonnées, sans pagination, version allégée de chaque fiche.

    Mêmes query params que api_liste_pharmacies (q, lat, lng, rayon_km). Plafonné à
    LIMITE_CARTE marqueurs, les plus proches d'abord quand une position est fournie.
    """
    try:
        resultats, lat_client, lng_client = _filtrer_et_trier(request, _pharmacies_visibles())
    except ParametreInvalide as e:
        return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

    avec_coordonnees = [p for p in resultats if p.latitude is not None and p.longitude is not None]
    serializer = PharmacieCarteSerializer(
        avec_coordonnees[:LIMITE_CARTE], many=True,
        context={'request': request, 'lat_client': lat_client, 'lng_client': lng_client},
    )
    return Response({"count": len(avec_coordonnees), "results": serializer.data})


@api_view(['GET'])
@authentication_classes([])
@permission_classes([])
def api_detail_pharmacie(request, pharmacie_id):
    """Fiche pharmacie complète (avec horaires détaillés jour par jour). Accepte ?lat=&lng=."""
    try:
        lat_client, lng_client = lire_position(request.query_params)
    except ParametreInvalide as e:
        return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

    try:
        pharmacie = _pharmacies_visibles().get(id=pharmacie_id)
    except Pharmacie.DoesNotExist:
        return Response({"error": "Pharmacie introuvable."}, status=status.HTTP_404_NOT_FOUND)

    serializer = PharmacieMarketplaceDetailSerializer(
        pharmacie,
        context={'request': request, 'lat_client': lat_client, 'lng_client': lng_client},
    )
    return Response(serializer.data)


@api_view(['GET'])
@authentication_classes([])
@permission_classes([])
def api_contexte(request):
    """
    Dit au frontend OÙ il est : sur le domaine de la plateforme, ou sur le sous-domaine d'une
    pharmacie. C'est ce qui décide (1) quelle page d'accueil afficher (marketplace ou
    catalogue) et (2) quel logo montrer (Pharmacie+ ou celui de la pharmacie).

    Monté dans les DEUX urlconfs (config/urls.py et config/urls_public.py) à la même adresse,
    /api/v1/contexte/ : le backend répond selon le domaine réellement appelé. Plus fiable que
    deviner depuis le nom d'hôte côté navigateur (qui casserait avec un domaine personnalisé).

    On teste `connection.schema_name` plutôt que `request.tenant` : quand aucun domaine ne
    correspond (SHOW_PUBLIC_IF_NO_TENANT_FOUND), django-tenants ne définit pas request.tenant.

    Volontairement SANS logo : le logo d'une pharmacie se lit via /api/v1/infos-pharmacie/.
    """
    if connection.schema_name == get_public_schema_name():
        return Response({"contexte": "plateforme"})

    pharmacie = request.tenant
    return Response({
        "contexte": "pharmacie",
        "pharmacie": {"id": pharmacie.id, "nom": pharmacie.nom_public or pharmacie.nom},
    })
