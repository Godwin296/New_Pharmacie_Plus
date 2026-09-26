from rest_framework import status
from rest_framework.decorators import api_view, authentication_classes, permission_classes
from rest_framework.response import Response

from tenants.models import Pharmacie
from .pagination import PharmaciePagination
from .serializers import PharmacieMarketplaceSerializer, PharmacieMarketplaceDetailSerializer
from .utils import distance_km


@api_view(['GET'])
@authentication_classes([])
@permission_classes([])
def api_liste_pharmacies(request):
    """
    Page de découverte (maquette 22/09) : liste des pharmacies actives, avec recherche
    et tri par proximité si la position du client est fournie.

    Publique (pas d'authentification requise) : parcourir la marketplace ne nécessite pas
    d'être connecté -- même logique que infos_pharmacie (core/api.py), qui expose déjà de
    la config publique sans jeton.

    Query params :
      - q       : recherche texte sur le nom (icontains)
      - lat/lng : position du client -- si fournis, tri par distance croissante et calcul
                  de `distance_km` dans chaque résultat ; sinon tri alphabétique par nom.
    """
    queryset = Pharmacie.objects.filter(actif=True).prefetch_related('domains')

    q = request.query_params.get('q', '').strip()
    if q:
        queryset = queryset.filter(nom_public__icontains=q)

    lat_client = lng_client = None
    lat_param, lng_param = request.query_params.get('lat'), request.query_params.get('lng')
    if lat_param and lng_param:
        try:
            lat_client, lng_client = float(lat_param), float(lng_param)
        except ValueError:
            return Response(
                {"error": "lat/lng invalides -- attendu deux nombres décimaux."},
                status=status.HTTP_400_BAD_REQUEST,
            )

    resultats = list(queryset)
    if lat_client is not None:
        # Tri en Python (pas de PostGIS) -- voir marketplace/utils.py. Les pharmacies sans
        # coordonnées connues sont reléguées en fin de liste plutôt qu'exclues (on ne sait
        # juste pas les classer par distance, elles restent visibles).
        def cle_tri(p):
            if p.latitude is None or p.longitude is None:
                return float('inf')
            return distance_km(lat_client, lng_client, p.latitude, p.longitude)

        resultats.sort(key=cle_tri)
    else:
        resultats.sort(key=lambda p: p.nom_public or p.nom)

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
def api_detail_pharmacie(request, pharmacie_id):
    """Fiche pharmacie complète (avec horaires détaillés jour par jour)."""
    try:
        pharmacie = Pharmacie.objects.prefetch_related('domains', 'horaires').get(
            id=pharmacie_id, actif=True,
        )
    except Pharmacie.DoesNotExist:
        return Response({"error": "Pharmacie introuvable."}, status=status.HTTP_404_NOT_FOUND)

    lat_client = lng_client = None
    lat_param, lng_param = request.query_params.get('lat'), request.query_params.get('lng')
    if lat_param and lng_param:
        try:
            lat_client, lng_client = float(lat_param), float(lng_param)
        except ValueError:
            pass

    serializer = PharmacieMarketplaceDetailSerializer(
        pharmacie,
        context={'request': request, 'lat_client': lat_client, 'lng_client': lng_client},
    )
    return Response(serializer.data)
