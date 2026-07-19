import uuid
import logging
from rest_framework.decorators import api_view, permission_classes, parser_classes, authentication_classes, throttle_classes
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated, IsAdminUser, AllowAny
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.authentication import JWTAuthentication
from django.shortcuts import get_object_or_404
from django.db import transaction
from django.utils import timezone
from django.utils.dateparse import parse_datetime, parse_date
from django.utils.crypto import get_random_string
from django.contrib.auth import authenticate
from django.db.models import Q, Sum, F
from django.db.models.functions import TruncDate
from django.core.exceptions import ValidationError
from django.contrib.auth.models import User
from datetime import timedelta
from django.utils import timezone

from .models import Produit, Commande, ItemCommande, ClientGuichet, Fournisseur, PharmacieConfig, Mouvement_stock, ProduitSupprimeLog, LotProduit
from .serializers import (
    ProduitSerializer, CommandeSerializer, CommandeClientSerializer,
    PharmacieConfigSerializer, FournisseurSerializer, LotProduitSerializer
)
from .validators import valider_et_desinfecter_ordonnance, valider_et_desinfecter_photo_produit
from .pagination import CataloguePagination
from .throttles import LoginRateThrottle, SoumettrePaiementRateThrottle
from .services_prediction import predire_pour_produit, predire_pour_tous_produits
from .cache_utils import cache_get, cache_set, cache_delete_exact
from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync
from clients_publics.models import CompteClient 
from .authentication import (
    ClientJWTAuthentication,
    StaffJWTAuthentication,
    ClientOrStaffJWTAuthentication,
    resoudre_identite_client,
)

logger = logging.getLogger(__name__)




def _notifier_caisse(tenant_schema_name, type_event, **payload):
    """
    🔴 Diffuse un événement temps réel à TOUS les écrans de caisse connectés pour CE tenant
    précis (jamais aux autres pharmacies). Utilisable depuis du code Django synchrone classique
    (les vues DRF ne sont pas async) grâce à async_to_sync.
    """
    channel_layer = get_channel_layer()
    if channel_layer is None:
        return  # Pas de channel layer configuré (ne devrait pas arriver, mais on ne casse jamais l'action métier pour ça)
    async_to_sync(channel_layer.group_send)(
        f"caisse_{tenant_schema_name}",
        {"type": type_event, **payload},
    )


def _notifier_client(commande_id, **payload):
    """🔴 Diffuse un événement temps réel au client qui suit SA commande précise."""
    channel_layer = get_channel_layer()
    if channel_layer is None:
        return
    async_to_sync(channel_layer.group_send)(
        f"commande_{commande_id}",
        {"type": "statut_mis_a_jour", **payload},
    )

@api_view(['GET'])
@permission_classes([AllowAny])
@authentication_classes([StaffJWTAuthentication])
def infos_pharmacie(request):
    # 🌍 Volontairement PUBLIC (AllowAny) : nom, logo, devise, adresse de la pharmacie
    # doivent s'afficher pour n'importe quel visiteur (catalogue, page de connexion...),
    # pas seulement pour un admin déjà authentifié. Aucune donnée sensible n'est exposée
    # ici -- la modification de la config, elle, reste réservée aux admins (api_update_config).
    #
    # 🔴 CACHE REDIS : cette route est appelée à CHAQUE chargement de page (login, catalogue,
    # panier...) mais son contenu ne change que lorsqu'un admin modifie sa config -- candidat
    # idéal au cache. Clé UNIQUE par tenant (pas de variation par requête), invalidée
    # immédiatement dans api_update_config -- jamais de logo/nom périmé affiché.
    cached = cache_get("infos_pharmacie")
    if cached is not None:
        return Response(cached)

    config = PharmacieConfig.objects.first()
    if not config:
        config = PharmacieConfig.objects.create(
            nom="Pharmacie +",
            adresse="Adresse à configurer",
            telephone="+237 ..."
        )
    # 🔧 FIX LOGO CASSÉ : sans context={'request': request}, DRF sérialise un ImageField
    # en chemin RELATIF (ex: "/media/config/logo.png"). Le frontend interprète alors ce
    # chemin par rapport à SON PROPRE domaine (localhost:3000) et non celui du backend
    # (localhost:8000/dupont.localhost:8000), donc l'image ne charge jamais -- même si
    # `config.logo` est bien "truthy" côté React. Avec le contexte, DRF renvoie l'URL
    # absolue correcte (http://dupont.localhost:8000/media/config/logo.png).
    serializer = PharmacieConfigSerializer(config, context={'request': request})
    cache_set("infos_pharmacie", serializer.data, timeout=3600)  # 1h : invalidé au besoin de toute façon
    return Response(serializer.data)

@api_view(['POST','PUT', 'PATCH'])
@permission_classes([IsAdminUser])
@parser_classes([MultiPartParser, FormParser])
def api_update_config(request):
    try:
        # 1. On récupère d'abord l'objet config existant
        config = PharmacieConfig.objects.first()
        if not config:
            config = PharmacieConfig.objects.create()

        # 2. Sécurité & Validation de l'image (si présente)
        if 'logo' in request.FILES:
            logo_file = request.FILES['logo']
            extension = logo_file.name.split('.')[-1].lower()
            if extension not in ['jpg', 'jpeg', 'png', 'webp']:
                return Response({"error": "Le format de l'image n'est pas autorisé (JPG, PNG, WEBP uniquement)."}, status=status.HTTP_400_BAD_REQUEST)
            if logo_file.size > 2 * 1024 * 1024:
                return Response({"error": "L'image ne doit pas dépasser 2 Mo."}, status=status.HTTP_400_BAD_REQUEST)
            config.logo = logo_file

        # 3. Extraction et assignation des données textuelles
        config.nom = request.data.get('nom', config.nom)
        config.telephone = request.data.get('telephone', config.telephone)
        config.adresse = request.data.get('adresse', config.adresse)
        config.email_contact = request.data.get('email_contact', config.email_contact)
        config.message_remerciement = request.data.get('message_remerciement', config.message_remerciement)
        config.langue_preferee = request.data.get('langue_preferee', config.langue_preferee)
        config.devise_preferee = request.data.get('devise_preferee', config.devise_preferee)

        # 💰 Coordonnées de paiement mobile money propres à CETTE pharmacie (tenant)
        config.numero_orange_money = request.data.get('numero_orange_money', config.numero_orange_money)
        config.nom_titulaire_orange_money = request.data.get('nom_titulaire_orange_money', config.nom_titulaire_orange_money)
        config.numero_mtn_momo = request.data.get('numero_mtn_momo', config.numero_mtn_momo)
        config.nom_titulaire_mtn_momo = request.data.get('nom_titulaire_mtn_momo', config.nom_titulaire_mtn_momo)

        config.save()
        # 🔴 Invalidation IMMÉDIATE du cache (clé unique par tenant, cf. cache_utils.py) --
        # sans ça, le nouveau logo/nom resterait invisible jusqu'à expiration du TTL (1h).
        cache_delete_exact("infos_pharmacie")
        return Response({"message": "Paramètres mis à jour avec succès !"}, status=200)
    except Exception as e:
        # Parfait pour le développement : vous voyez exactement pourquoi ça plante
        return Response({"error": str(e)}, status=500)


@api_view(['GET'])
@authentication_classes([ClientOrStaffJWTAuthentication])
@permission_classes([IsAuthenticated])
def api_infos_paiement(request):
    """
    💰 Expose UNIQUEMENT les coordonnées de paiement mobile money de la pharmacie courante
    (jamais le PharmacieConfig complet, qui peut contenir d'autres informations internes).
    Accessible à tout utilisateur connecté (client comme staff) -- nécessaire pour afficher
    les instructions de paiement sur la page panier.

    🔧 CORRECTIF JONCTION COMPTECLIENT : sans @authentication_classes explicite, cette vue
    utilisait l'authentification par défaut (StaffJWTAuthentication), qui REJETTE tout jeton
    "type": "client" -- un client marketplace connecté ne pouvait donc jamais voir les
    coordonnées de paiement sur sa propre page panier.
    """
    config = PharmacieConfig.objects.first()
    if not config:
        return Response({"error": "Configuration de paiement non disponible pour cette pharmacie."}, status=404)
    return Response({
        "numero_orange_money": config.numero_orange_money,
        "nom_titulaire_orange_money": config.nom_titulaire_orange_money,
        "numero_mtn_momo": config.numero_mtn_momo,
        "nom_titulaire_mtn_momo": config.nom_titulaire_mtn_momo,
    })

# --- 🛂 SYSTÈME DE SÉCURITÉ (Permissions personnalisées) ---
def check_role(user, role_requested):
    if not user or not user.is_authenticated: return False
    # 🔐 CORRECTIF : cette fonction vérifiait l'appartenance à des groupes Django
    # ('administrateur', 'caissiere') que RIEN dans le projet ne crée ni n'assigne jamais
    # (aucun signal, migration, ou management command) -- résultat : plus personne ne
    # pouvait se connecter comme admin/caissière sur un tenant fraîchement créé, alors que
    # api_get_current_user() et TOUTES les vérifications de droits réelles sur les
    # endpoints (fournisseurs, stocks...) se basent sur is_staff/is_superuser. On réaligne
    # sur la même source de vérité partout : plus simple, et ça évite d'avoir à gérer des
    # groupes en plus des flags Django standards.
    if role_requested == 'admin': return user.is_superuser
    if role_requested == 'caissiere': return user.is_staff and not user.is_superuser
    if role_requested == 'client': return not user.is_staff
    return False


# ============================================================================
# 🌍 COMPTE CLIENT GLOBAL (MARKETPLACE) -- schéma public, distinct du personnel
# ============================================================================
@api_view(['POST'])
@permission_classes([AllowAny])
def api_client_register(request):
    email = (request.data.get('email') or '').strip().lower()
    password = request.data.get('password') or ''
    nom = (request.data.get('nom') or '').strip()
    telephone = (request.data.get('telephone') or '').strip()

    if not email or not password or not nom:
        return Response({"error": "email, password et nom sont obligatoires"}, status=400)
    if len(password) < 8:
        return Response({"error": "Le mot de passe doit contenir au moins 8 caractères"}, status=400)
    if CompteClient.objects.filter(email=email).exists():
        return Response({"error": "Un compte existe déjà avec cet email"}, status=400)

    client = CompteClient.objects.create_user(
        email=email, password=password, nom=nom, telephone=telephone or None
    )

    # 📧 Hors du cœur de la transaction d'inscription : un échec d'envoi ne doit jamais
    # faire échouer une création de compte déjà validée en base.
    from .emails import envoyer_email_bienvenue
    envoyer_email_bienvenue(client)

    return Response({"message": "Compte créé avec succès ! 🎉", "email": client.email}, status=201)


@api_view(['POST'])
@permission_classes([AllowAny])
@throttle_classes([LoginRateThrottle])
def api_client_login(request):
    email = (request.data.get('email') or '').strip().lower()
    password = request.data.get('password') or ''

    try:
        client = CompteClient.objects.get(email=email, is_active=True)
    except CompteClient.DoesNotExist:
        return Response({"error": "Identifiants invalides"}, status=401)

    if not client.check_password(password):
        return Response({"error": "Identifiants invalides"}, status=401)

    # 🔴 PAS de RefreshToken.for_user() ici : ça crée un OutstandingToken lié par
    # FK stricte à auth.User (personnel) -- planterait avec un CompteClient.
    refresh = RefreshToken()
    refresh['user_id'] = client.pk
    refresh['type'] = 'client'
    access = refresh.access_token
    access['type'] = 'client'

    return Response({
        "message": "Connexion réussie",
        "access": str(access),
        "refresh": str(refresh),
        "email": client.email,
        "nom": client.nom,
    }, status=200)


@api_view(['GET'])
@authentication_classes([ClientJWTAuthentication])
@permission_classes([IsAuthenticated])
def api_client_whoami(request):
    client = request.user
    return Response({
        "is_authenticated": True,
        "email": client.email,
        "nom": client.nom,
        "telephone": client.telephone,
    })


@api_view(['POST'])
@permission_classes([AllowAny])
@throttle_classes([LoginRateThrottle])
def api_login(request):
    """Connexion Next.js avec génération de jetons JWT 🎭"""
    u_name = request.data.get('username')
    p_word = request.data.get('password')
    role_req = request.data.get('role') # 'admin', 'caissiere', 'client'
    
    user = authenticate(username=u_name, password=p_word)
    if user:
        if not check_role(user, role_req):
            return Response({"error": "Rôle non autorisé pour ce compte"}, status=403)
        
        # SÉCURITÉ JWT : On génère les jetons d'accès pour ton frontend Next.js
        refresh = RefreshToken.for_user(user)

        # 🔐 CORRECTION (bug remonté en test, session du 12/07) : le splash screen affichait
        # jusqu'ici le nom d'utilisateur technique (`user.username`, ex: "client_test") comme
        # s'il s'agissait d'un simple libellé de rôle -- tous les clients qui se connectaient
        # avec le même compte de test voyaient donc toujours le même nom, ce qui pouvait
        # laisser croire à tort que l'app affichait le GROUPE plutôt que le compte réel.
        # Pour un client, on préfère désormais afficher son nom complet réel (Client.nom,
        # ex: "Jean Dupont") -- bien plus parlant que l'identifiant de connexion technique.
        display_name = user.username
        if role_req == "client":
            client_profile = getattr(user, "client_profile", None)
            if client_profile and client_profile.nom:
                display_name = client_profile.nom

        return Response({
            "message": "Connexion réussie",
            "access": str(refresh.access_token),  # Jeton à inclure dans le Header Next.js
            "refresh": str(refresh),              # Jeton pour renouveler la session en tâche de fond
            "user": user.username,
            "display_name": display_name,
            "role": role_req
        }, status=200)
        
    return Response({"error": "Identifiants invalides"}, status=401)

# À ajouter à la fin de core/api.py
@api_view(['GET'])
@authentication_classes([ClientOrStaffJWTAuthentication]) # Traite AUSSI les jetons CompteClient (marketplace)
@permission_classes([AllowAny]) # On permet à tous de demander "qui suis-je"
def api_get_current_user(request):
    """
    🔧 CORRECTIF JONCTION COMPTECLIENT : utilisait StaffJWTAuthentication seule, qui rejette
    tout jeton "type": "client" -- un client marketplace connecté apparaissait donc comme
    "non authentifié" sur cette route (utilisée par la page d'accueil pour savoir quel bouton
    afficher). CompteClient n'a pas d'attribut is_superuser/username (pas de PermissionsMixin
    volontairement, cf. clients_publics/models.py) -> on distingue explicitement les deux cas
    plutôt que d'accéder à des attributs qui n'existent pas sur ce modèle.
    """
    if request.user and request.user.is_authenticated:
        if isinstance(request.user, CompteClient):
            return Response({
                "is_authenticated": True,
                "username": request.user.nom,
                "email": request.user.email,
                "is_staff": False,
                "is_superuser": False,
                "role": "client",
            })
        return Response({
            "is_authenticated": True,
            "username": request.user.username,
            "is_staff": request.user.is_staff,
            "is_superuser": request.user.is_superuser,
            "role": "admin" if request.user.is_superuser else "caissiere" if request.user.is_staff else "client"
        })
    return Response({"is_authenticated": False}, status=200)


# --- 💊 CATALOGUE & RECHERCHE (Remplace HTMX) ---
@api_view(['GET'])
@permission_classes([AllowAny])
def api_catalogue(request):
    """Catalogue réactif pour Next.js 🚀

    🔧 PAGINATION (avant : tout le catalogue était renvoyé en une seule réponse,
    ce qui devenait lourd sur 3G/4G à mesure que le catalogue grossit). On utilise
    désormais CataloguePagination (20 produits/page par défaut, voir core/pagination.py).
    Le frontend doit envoyer ?page=N et peut envoyer ?page_size=N pour ajuster.

    🔴 CACHE REDIS (60s) : c'est la route la plus sollicitée du site (chaque visiteur,
    connecté ou non, la déclenche en boucle en filtrant/paginant). Clé = tenant + query
    string exacte (cf. cache_utils.py) -- page 1 et page 2, ou "q=doliprane" et "q=..." 
    n'écrasent jamais le cache l'un de l'autre. Pas d'invalidation manuelle sur les
    écritures (vente, réappro, modif produit...) : le TTL court (60s) est un compromis
    volontaire -- une minute de fraîcheur en moins sur un catalogue public est largement
    acceptable face à la complexité et aux risques d'oubli d'une invalidation exhaustive
    sur chaque point d'écriture du stock.
    """
    cached = cache_get("catalogue", request)
    if cached is not None:
        return Response(cached)

    produits = Produit.objects.all().order_by('nom')
    query_cat = request.GET.get('cat')
    search_query = request.GET.get('q')

    if query_cat and query_cat != 'None' and query_cat.strip():
        produits = produits.filter(categorie=query_cat)
    
    if search_query and search_query.strip():
        produits = produits.filter(
            Q(nom__icontains=search_query) | 
            Q(laboratoire__icontains=search_query) |
            Q(identifiant__iexact=search_query)
        ).distinct()

    paginator = CataloguePagination()
    page = paginator.paginate_queryset(produits, request)
    serializer = ProduitSerializer(page, many=True)
    categories_dict = dict(getattr(Produit, 'CATEGORIES', {}))

    reponse = paginator.get_paginated_response({
        "produits": serializer.data,
        "categories": categories_dict # Envoie les labels pour les menus Next.js
    })
    cache_set("catalogue", reponse.data, timeout=60, request=request)
    return reponse


# --- 🚀 MODE OFFLINE (session 12/07, brique 2/4) : SYNCHRO DELTA DU CATALOGUE ---
DATE_MODIFICATION_MIN = "1970-01-01T00:00:00+00:00"  # sentinelle "depuis toujours" (1er sync)
CATALOGUE_SYNC_BATCH_SIZE = 300  # cf. docstring api_catalogue_sync : compromis payload/round-trips


@api_view(['GET'])
@permission_classes([AllowAny])
def api_catalogue_sync(request):
    """
    🌐 Endpoint dédié au cache offline (IndexedDB côté frontend) -- DIFFÉRENT de api_catalogue
    (qui sert l'affichage paginé normal du catalogue, 20 produits/page). Ici, l'objectif est de
    permettre au frontend de reconstituer et maintenir à jour une COPIE LOCALE COMPLÈTE du
    catalogue, consultable même sans réseau -- donc on raisonne en "qu'est-ce qui a changé
    depuis mon dernier sync" plutôt qu'en pages.

    Paramètre `?since=<ISO8601>` : timestamp du dernier sync réussi côté client (renvoyé par
    l'appel précédent dans `server_time`). Absent ou vide -- notamment au tout premier sync,
    IndexedDB étant encore vide -- l'endpoint se comporte comme un sync complet ("depuis
    toujours").

    ⚠️ POURQUOI PAS UNE SIMPLE PAGINATION CLASSIQUE : sur une 3G/4G instable (zone CEMAC),
    retélécharger les centaines/milliers de produits d'un tenant à CHAQUE ouverture de l'app
    serait lent et coûteux en data pour l'utilisateur. En ne renvoyant que les produits dont
    `date_modification >= since`, la très grande majorité des syncs (l'utilisateur rouvre son
    app le lendemain, rien n'a changé) ne coûtent presque rien à transférer.

    ⚠️ POURQUOI UN BATCH_SIZE FIXE PLUTÔT QUE `page`/`page_size` COMME api_catalogue : le
    frontend n'a PAS besoin de choisir une page précise ici -- il veut juste "tout ce qui a
    changé", quitte à rappeler l'endpoint en boucle (voir `has_more`/`next_since`) si le volume
    dépasse un batch. C'est un détail d'implémentation invisible pour l'appelant, pas un choix
    utilisateur comme la pagination du catalogue affiché.

    Réponse :
    {
      "server_time": "<ISO8601>",           -- à renvoyer comme `since` au PROCHAIN appel
      "produits": [...],                     -- créés/modifiés depuis `since`, triés par
                                                 date_modification croissante (limité à
                                                 CATALOGUE_SYNC_BATCH_SIZE)
      "supprimes": [id, id, ...],            -- produits supprimés depuis `since` (à retirer
                                                 du cache local, cf. ProduitSupprimeLog)
      "categories": {code: label, ...},
      "has_more": bool,                      -- si true, rappeler IMMÉDIATEMENT avec
                                                 `since=next_since` avant d'utiliser `server_time`
      "next_since": "<ISO8601>|<id>" | null  -- curseur composé (cf. commentaire dans le code :
                                                 évite les doublons de page quand plusieurs
                                                 produits partagent le même timestamp)
    }
    """
    since_str = (request.GET.get('since') or '').strip() or DATE_MODIFICATION_MIN
    # 🔧 Curseur composé "since|since_id" utilisé pour ENCHAÎNER les pages d'un même sync
    # (has_more=True). Sans le "|since_id", une simple comparaison date_modification >= since
    # RÉINTRODUIT en double le(s) dernier(s) produit(s) de la page précédente dès que plusieurs
    # lignes partagent EXACTEMENT le même timestamp -- ce qui arrive systématiquement avec
    # bulk_create() (import fournisseur, seed...) où toute une série de lignes est insérée dans
    # la même transaction/même `now()`. Constaté en test avec 350 produits bulk_create : la
    # boucle de pagination renvoyait 360 produits au lieu de 359 (1 doublon exact à la frontière
    # de page). Le paramètre `since` "simple" (sans `|id`) reste utilisé pour le premier appel
    # d'un sync (bookmark stocké côté client) où ce risque de doublon frontière ne se pose pas.
    since_id = None
    if '|' in since_str:
        since_str, since_id_str = since_str.rsplit('|', 1)
        try:
            since_id = int(since_id_str)
        except ValueError:
            since_id = None
    since = parse_datetime(since_str)
    if since is None:
        return Response({"error": "Paramètre 'since' invalide, attendu au format ISO8601"}, status=400)

    # 🔐 Capturé AVANT la requête : si des écritures arrivent pendant qu'on répond, elles seront
    # simplement incluses au PROCHAIN sync (since >= server_time actuel) plutôt que perdues.
    server_time = timezone.now()

    if since_id is not None:
        # Milieu de pagination : comparaison stricte sur le couple (date_modification, id).
        produits_filtre = Q(date_modification__gt=since) | Q(date_modification=since, id__gt=since_id)
    else:
        produits_filtre = Q(date_modification__gte=since)

    produits_qs = (
        Produit.objects.filter(produits_filtre)
        .order_by('date_modification', 'id')[: CATALOGUE_SYNC_BATCH_SIZE + 1]
    )
    produits_batch = list(produits_qs)
    has_more = len(produits_batch) > CATALOGUE_SYNC_BATCH_SIZE
    if has_more:
        produits_batch = produits_batch[:CATALOGUE_SYNC_BATCH_SIZE]
    dernier = produits_batch[-1] if has_more else None
    next_since = f"{dernier.date_modification.isoformat()}|{dernier.id}" if dernier else None

    supprimes = list(
        ProduitSupprimeLog.objects.filter(date_suppression__gte=since)
        .values_list('produit_id', flat=True)
        .distinct()
    )

    serializer = ProduitSerializer(produits_batch, many=True, context={'request': request})
    categories_dict = dict(getattr(Produit, 'CATEGORIES', {}))

    return Response({
        "server_time": server_time.isoformat(),
        "produits": serializer.data,
        "supprimes": supprimes,
        "categories": categories_dict,
        "has_more": has_more,
        "next_since": next_since,
    })

# --- 🛒 GESTION DU PANIER SÉCURISÉ (Vérification 48h incluse) ---
@api_view(['GET', 'POST'])
@authentication_classes([ClientOrStaffJWTAuthentication])
@permission_classes([IsAuthenticated])
def api_panier(request):
    """
    🔧 CORRECTIF JONCTION COMPTECLIENT : cette vue utilisait auparavant l'authentification
    par défaut (StaffJWTAuthentication), qui rejette tout jeton "type": "client" -- un client
    marketplace connecté ne pouvait donc ni consulter, ni modifier son panier. resoudre_identite_client()
    route vers CompteClient (l'ancien modèle Client par-tenant a depuis été entièrement retiré).
    """
    facture_id = request.GET.get('id')
    
    # 1. Protection du personnel de caisse
    if request.user.is_staff and not facture_id:
        return Response({"error": "Le personnel ne peut pas avoir de panier client"}, status=403)
        
    # 🎯 SÉCURITÉ CONTRÔLE D'ACCÈS (Anti-IDOR)
    client_instance, client_field = resoudre_identite_client(request.user)
    
    # 2. CAS A : Consultation d'une facture spécifique (?id=XXX) -> Accessible Staff ET Client propriétaire
    if facture_id:
        if request.user.is_staff:
            commande_detail = get_object_or_404(Commande, id=facture_id)
            # Le staff voit le serializer complet (avec le nom de l'agent validateur, pour l'audit)
            return Response(CommandeSerializer(commande_detail, context={'request': request}).data)
        else:
            commande_detail = get_object_or_404(Commande, id=facture_id, **{client_field: client_instance})
            # 🔐 Le client ne voit jamais quel agent a traité sa commande
            return Response(CommandeClientSerializer(commande_detail).data)

    # 3. CAS B : Gestion du Panier Courant (Uniquement pour les clients connectés)
    # 🔐 Le "panier en cours" est une commande non encore soumise en paiement. Une fois que le
    # client a cliqué "Payer" (statut paiement_a_verifier) ou que la caisse a confirmé
    # (payee_a_retirer/retiree), ce n'est plus un panier modifiable -> on en ouvre un nouveau.
    STATUTS_PANIER_MODIFIABLE = ("en_cours", "attente_validation")
    commande = (
        Commande.objects.filter(statut__in=STATUTS_PANIER_MODIFIABLE, **{client_field: client_instance})
        .order_by("-date").first()
    )
    created = False
    if commande is None:
        commande = Commande.objects.create(statut="en_cours", **{client_field: client_instance})
        created = True
    
    if not created and getattr(commande, 'est_perimee', False):
        commande.annuler_commande()
        return Response({"message": "Panier expiré", "panier_vide": True}, status=200)

    # Ajout ou modification d'un article dans le panier courant (POST)
    if request.method == 'POST':
        p_id = request.data.get('produit_id')
        
        # SÉCURITÉ INJECTION : Validation stricte que la quantité est un entier positif
        try:
            qte = int(request.data.get('quantite', 1))
            if qte <= 0: raise ValueError()
        except (ValueError, TypeError):
            return Response({"error": "Quantité invalide"}, status=400)
            
        produit = get_object_or_404(Produit, id=p_id)
        
        if qte > produit.quantite:
            return Response({"error": "Stock insuffisant"}, status=400)
            
        item, it_created = ItemCommande.objects.get_or_create(commande=commande, produit=produit)
        if it_created:
            item.quantite = qte
        else:
            # SÉCURITÉ ANTI-RACE CONDITION : On utilise F() pour une mise à jour atomique en BDD
            item.quantite = F('quantite') + qte
        item.save()
        item.refresh_from_db()
        
    # Renvoie le panier courant mis à jour si aucun paramètre ?id n'a été fourni
    # 🔐 On arrive ici uniquement côté client (le staff est bloqué en ligne 177) -> serializer public
    return Response(CommandeClientSerializer(commande).data)


@api_view(['POST'])
@authentication_classes([ClientOrStaffJWTAuthentication])
@permission_classes([IsAuthenticated])
@throttle_classes([SoumettrePaiementRateThrottle])
def api_soumettre_paiement(request, commande_id):
    """
    💰 Le client indique avoir effectué son transfert Orange Money / MTN MoMo et fournit la
    référence de transaction reçue par SMS. La commande passe en "paiement_a_verifier" : le
    STOCK N'EST PAS ENCORE DÉCRÉMENTÉ à ce stade (seule la confirmation par la caisse via
    api_confirmer_paiement déclenche réellement Commande.valider()) -- on ne fait jamais
    confiance à une simple déclaration du client pour engager le stock réel.

    🔧 CORRECTIF JONCTION COMPTECLIENT : authentification par défaut remplacée par
    ClientOrStaffJWTAuthentication (sans quoi un jeton client marketplace était rejeté avant
    même d'atteindre le contrôle is_staff ci-dessous) + résolution via CompteClient.
    """
    if request.user.is_staff:
        return Response({"error": "Action réservée aux clients"}, status=403)

    client_instance, client_field = resoudre_identite_client(request.user)
    commande = get_object_or_404(Commande, id=commande_id, **{client_field: client_instance})

    if commande.statut not in ("en_cours",):
        return Response({"error": "Cette commande ne peut pas être soumise au paiement dans son état actuel."}, status=409)

    # Une ordonnance est exigée et n'a pas encore été validée -> on ne laisse pas passer au paiement
    if commande.items.filter(produit__ordonnance_obligatoire=True).exists() and not commande.ordonnance_valide:
        return Response({"error": "Une ordonnance valide est requise avant de pouvoir payer cette commande."}, status=409)

    moyen = request.data.get('moyen_paiement')
    reference_client = request.data.get('reference_paiement', '').strip()

    if moyen not in dict(Commande.MOYENS_PAIEMENT):
        return Response({"error": "Moyen de paiement invalide."}, status=400)
    if not reference_client:
        return Response({"error": "Merci de renseigner la référence de transaction reçue par SMS."}, status=400)

    commande.moyen_paiement = moyen
    commande.reference_paiement_client = reference_client
    commande.statut = "paiement_a_verifier"
    commande.save()

    # 🔴 TEMPS RÉEL : la caisse voit immédiatement apparaître cette demande de vérification
    # 🐛 CORRECTIF (bug préexistant, sans rapport avec CompteClient) : _notifier_caisse()
    # n'accepte que des kwargs après (schema, type_event) -- cet appel passait le payload
    # en positionnel, ce qui levait TypeError et faisait planter TOUTE soumission de
    # paiement (client comme staff) avec un 500, avant même d'atteindre la réponse finale.
    _notifier_caisse(request.tenant.schema_name, "nouvelle_demande_paiement",
                      commande=CommandeSerializer(commande, context={'request': request}).data)

    return Response({
        "message": "Merci ! Votre paiement est en cours de vérification par la pharmacie.",
        "reference": commande.reference,
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def api_confirmer_paiement(request, commande_id):
    """
    🏥 La caisse (ou l'admin du tenant) a vérifié manuellement -- dans son application Orange
    Money / MTN MoMo -- que le transfert correspondant à reference_paiement_client est bien
    arrivé, et confirme. C'EST SEULEMENT À CE MOMENT que le stock est réellement décrémenté
    (via Commande.valider(), qui contient déjà toutes les protections anti-concurrence et
    anti-survente testées précédemment).
    """
    if not request.user.is_staff:
        return Response({"error": "Action réservée au personnel de la pharmacie"}, status=403)

    with transaction.atomic():
        commande = get_object_or_404(Commande.objects.select_for_update(), id=commande_id)

        if commande.statut != "paiement_a_verifier":
            return Response({"error": "Cette commande n'est pas en attente de vérification de paiement."}, status=409)

        try:
            commande.valider(user_operateur=request.user)
        except ValidationError as e:
            return Response({"error": str(e)}, status=400)

    # 🔴 TEMPS RÉEL : la caisse (autres guichets) et le client sont notifiés du paiement confirmé
    _notifier_caisse(request.tenant.schema_name, "ordonnance_traitee",
                      commande_id=commande.id, action="paiement_confirme")
    _notifier_client(commande.id, statut=commande.statut, ordonnance_valide=commande.ordonnance_valide,
                      motif_refus=None)

    return Response({"message": f"Paiement confirmé. Commande {commande.reference} prête pour retrait au guichet. ✅"})


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def api_paiements_a_verifier(request):
    """
    💰 Liste des commandes dont le client a soumis une référence de transaction mobile money,
    en attente de vérification manuelle par la caisse (cf. api_confirmer_paiement). On ne peut
    pas réutiliser api_archives_caissiere ici : son filtre (payee=True OR ordonnance_valide=True)
    ne couvre pas le cas paiement_a_verifier (payee=False à ce stade -- le stock n'est décrémenté
    qu'après confirmation), ce qui aurait laissé ces commandes invisibles pour la caisse.
    """
    if not request.user.is_staff:
        return Response({"error": "Action réservée au personnel de la pharmacie"}, status=403)

    commandes = Commande.objects.filter(statut="paiement_a_verifier").order_by('-date')
    return Response(CommandeSerializer(commandes, many=True, context={'request': request}).data)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def api_commandes_a_retirer(request):
    """
    🏥 Liste des commandes payées en attente de retrait physique au guichet, pour CE tenant.
    Supporte la recherche par référence (?q=PHC-2026-00042) ou par numéro de téléphone client
    -- exactement le scénario où le client envoie sa référence et la caisse la recherche
    rapidement parmi toutes les commandes en attente.
    """
    if not request.user.is_staff:
        return Response({"error": "Action réservée au personnel de la pharmacie"}, status=403)

    commandes = Commande.objects.filter(statut="payee_a_retirer").order_by('-date')

    recherche = request.GET.get('q', '').strip()
    if recherche:
        commandes = commandes.filter(
            Q(reference__icontains=recherche) |
            Q(client__telephone__icontains=recherche) |
            Q(client__nom__icontains=recherche) |
            Q(client_guichet__telephone__icontains=recherche) |
            Q(client_guichet__nom__icontains=recherche)
        )

    return Response(CommandeSerializer(commandes, many=True, context={'request': request}).data)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def api_marquer_retiree(request, commande_id):
    """
    🏥 La caisse constate que le client est physiquement venu récupérer sa commande payée.
    Statut final pour l'audit financier -- cette vente ne sera plus jamais soumise à
    expiration automatique (cf. Commande.marquer_retiree() et est_perimee).
    """
    if not request.user.is_staff:
        return Response({"error": "Action réservée au personnel de la pharmacie"}, status=403)

    with transaction.atomic():
        commande = get_object_or_404(Commande.objects.select_for_update(), id=commande_id)
        try:
            commande.marquer_retiree(user_operateur=request.user)
        except ValidationError as e:
            return Response({"error": str(e)}, status=409)

    _notifier_caisse(request.tenant.schema_name, "ordonnance_traitee",
                      commande_id=commande.id, action="retrait_confirme")

    return Response({"message": f"Commande {commande.reference} marquée comme retirée. ✅"})


@api_view(['GET'])
@authentication_classes([ClientOrStaffJWTAuthentication])
@permission_classes([IsAuthenticated])
def api_mes_commandes(request):
    """
    Récupère l'historique des commandes du client connecté.

    🔧 CORRECTIF JONCTION COMPTECLIENT : authentification par défaut remplacée (sans quoi un
    jeton client marketplace était rejeté d'office) + résolution via CompteClient. Le personnel
    n'a par définition aucun "historique client" -> 403 explicite plutôt qu'un 404 accidentel.
    """
    client_instance, client_field = resoudre_identite_client(request.user)
    if client_instance is None:
        return Response({"error": "Action réservée aux clients"}, status=403)
    commandes = Commande.objects.filter(**{client_field: client_instance}).order_by('-date')
    # 🔐 Le client ne doit jamais voir quel agent a validé/refusé ses ordonnances
    serializer = CommandeClientSerializer(commandes, many=True)
    return Response(serializer.data)

# --- 📋 GESTION DES ORDONNANCES SÉCURISÉE ---
@api_view(['GET', 'POST'])
@authentication_classes([ClientOrStaffJWTAuthentication])
@permission_classes([IsAuthenticated])
@parser_classes([MultiPartParser, FormParser, JSONParser])
def api_gestion_ordonnance(request, commande_id=None):
    """
    Client: Upload / Caisse: Liste et Valide sans injection de droits 🔓

    🔧 CORRECTIF JONCTION COMPTECLIENT : authentification par défaut remplacée (sans quoi un
    jeton client marketplace était rejeté avant même d'atteindre la vérification is_staff
    ci-dessous) + résolution de la commande via CompteClient dans la branche client.
    """
    
    # ÉTAPE 1 : Rôle Client -> Envoi de l'ordonnance
    if not request.user.is_staff:
        if request.method == 'POST' and commande_id:
            client_instance, client_field = resoudre_identite_client(request.user)
            commande = get_object_or_404(Commande, id=commande_id, **{client_field: client_instance})
            if 'fichier_ordonnance' in request.FILES:
                fichier_brut = request.FILES['fichier_ordonnance']

                # 🔐 SÉCURITÉ : validation de taille + détection du type réel par contenu binaire
                # (pas par extension de nom, falsifiable) + désinfection complète par reconstruction
                # du fichier (élimine tout payload caché par stéganographie ou JS embarqué dans un PDF).
                try:
                    fichier_propre = valider_et_desinfecter_ordonnance(fichier_brut)
                except ValidationError as e:
                    message = e.message if hasattr(e, 'message') else str(e)
                    return Response({"error": message}, status=400)

                # Si une ordonnance précédente existait déjà (ex: réupload après rejet), on la
                # supprime physiquement du disque avant d'enregistrer la nouvelle.
                if commande.ordonnance:
                    commande.ordonnance.delete(save=False)

                commande.ordonnance = fichier_propre
                commande.statut = "attente_validation"
                commande.save()

                # 🔴 TEMPS RÉEL : notifie immédiatement tous les écrans de caisse connectés
                # de CETTE pharmacie qu'une nouvelle ordonnance attend leur traitement.
                _notifier_caisse(
                    request.tenant.schema_name, "nouvelle_ordonnance",
                    commande=CommandeSerializer(commande, context={'request': request}).data,
                )

                return Response({"message": "Ordonnance reçue. En attente de vérification. ⏳"})
        return Response({"error": "Action non autorisée pour un client"}, status=403)

    # ÉTAPE 2 : Rôle Caisse/Admin -> Consultation et Validation
    if request.user.is_staff:
        if request.method == 'GET' and not commande_id:
            attentes = Commande.objects.filter(statut="attente_validation", ordonnance_valide=False).filter(ordonnance__isnull=False).exclude(ordonnance='')
            return Response(CommandeSerializer(attentes, many=True, context={'request': request}).data)
        
        if request.method == 'POST' and commande_id:
            action = request.data.get('action')

            # 🔐 CONCURRENCE : deux agents de caisse pourraient cliquer "approuver"/"rejeter"
            # sur la même ordonnance à quelques millisecondes d'écart. On verrouille la ligne
            # en base (SELECT ... FOR UPDATE) pour la durée de la transaction : la deuxième
            # requête attendra que la première soit terminée, puis verra le nouvel état
            # ("en_cours" au lieu de "attente_validation") et sera proprement rejetée au lieu
            # d'écraser le travail du premier agent ou de traiter deux fois la même ordonnance.
            with transaction.atomic():
                commande = get_object_or_404(
                    Commande.objects.select_for_update(), id=commande_id
                )

                if commande.statut != "attente_validation":
                    return Response(
                        {"error": "Cette ordonnance a déjà été traitée par un autre agent."},
                        status=409,  # 409 Conflict : un autre agent est arrivé en premier
                    )

                if action == 'approuver':
                    commande.ordonnance_valide = True
                    commande.statut = "en_cours"
                    # Sécurité : On utilise l'utilisateur authentifié par le JWT (objet User), pas une chaîne texte
                    commande.agent_validateur = request.user
                    commande.save()

                    # 🔴 TEMPS RÉEL : les autres écrans de caisse retirent cette ordonnance de
                    # leur file d'attente sans avoir à rafraîchir la page (ta question initiale).
                    _notifier_caisse(request.tenant.schema_name, "ordonnance_traitee",
                                      commande_id=commande.id, action="approuver")
                    # Le client voit son bouton "Payer" apparaître en direct.
                    _notifier_client(commande.id, statut=commande.statut,
                                      ordonnance_valide=True, motif_refus=None)

                    return Response({"message": "Approuvée ✅"})

                elif action == 'rejeter':
                    commande.motif_refus = request.data.get('raison', 'Document invalide')
                    if commande.ordonnance:
                        commande.ordonnance.delete(save=False)
                    # 🔐 Traçabilité interne : on garde quand même l'agent qui a refusé en base
                    # (utile pour un futur audit interne), mais ce champ n'est JAMAIS exposé au
                    # client dans le CommandeSerializer — il ne doit pas savoir qui a refusé.
                    commande.agent_validateur = request.user
                    commande.statut = "en_cours"  # Permet au client de réuploader
                    commande.save()

                    # 🔴 TEMPS RÉEL : disparition immédiate de la file d'attente des autres caisses
                    _notifier_caisse(request.tenant.schema_name, "ordonnance_traitee",
                                      commande_id=commande.id, action="rejeter")
                    # Le client voit le motif de refus apparaître en direct (jamais le nom de l'agent)
                    _notifier_client(commande.id, statut=commande.statut,
                                      ordonnance_valide=False, motif_refus=commande.motif_refus)

                    # 📧 Complément à la notif temps réel : utile si le client n'a pas
                    # l'application ouverte au moment du refus.
                    from .emails import envoyer_email_ordonnance_refusee
                    envoyer_email_ordonnance_refusee(commande)

                    return Response({"message": "Rejetée ❌"})

                return Response({"error": "Action invalide"}, status=400)

    return Response({"error": "Requête invalide"}, status=400)

# --- 📈 DASHBOARD & RAPPORTS BOSS SÉCURISÉS ---
@api_view(['GET'])
@authentication_classes([StaffJWTAuthentication])
@permission_classes([IsAdminUser])
def api_boss_dashboard(request):
    """KPIs complets et exacts pour Next.js 🛰️"""
    if not request.user.is_superuser:
        return Response({"error": "Accès refusé. Droits d'administration requis."}, status=403)    
    try:
        aujourdhui = timezone.now().date()
        dans_60_jours = aujourdhui + timedelta(days=60)
        produits = Produit.objects.all()
    
        # 💰 🔐 RECALCUL SÉCURISÉ : On utilise le prix figé de la transaction (prix_facture)
        ca_total = Commande.objects.filter(payee=True).aggregate(
            total=Sum(F('items__quantite') * F('items__prix_facture'))
        )['total'] or 0

        # 💵 VENTILATION CASH (GUICHET) vs EN LIGNE : le total ci-dessus représente bien
        # l'activité réelle de la pharmacie, mais un admin qui ne voit QUE ce total pourrait
        # croire que cette somme est intégralement disponible sur son compte mobile money --
        # alors qu'une partie a été encaissée en cash physique par les caissières au comptoir
        # et n'a pas encore été déposée/remise. On détaille donc explicitement les deux canaux,
        # pour que l'admin sache combien représente du cash actuellement entre les mains de
        # son personnel de caisse (tous guichets confondus pour cette pharmacie) par opposition
        # à de l'argent déjà transféré électroniquement par les clients en ligne.
        ca_guichet_cash = Commande.objects.filter(payee=True, type_vente='guichet').aggregate(
            total=Sum(F('items__quantite') * F('items__prix_facture'))
        )['total'] or 0
        ca_en_ligne = Commande.objects.filter(payee=True, type_vente='en_ligne').aggregate(
            total=Sum(F('items__quantite') * F('items__prix_facture'))
        )['total'] or 0

        # 📊 Graphique des ventes (7 derniers jours) corrigé
        sept_derniers_jours = timezone.now() - timedelta(days=7)
        ventes_par_jour = Commande.objects.filter(
            payee=True, 
            date__gte=sept_derniers_jours
        ).annotate(day=TruncDate('date')).values('day').annotate(
            ventes=Sum(F('items__quantite') * F('items__prix_facture'))
        ).order_by('day')

        graphique_data = []
        for v in ventes_par_jour:
            if v['day']:
                graphique_data.append({
                    "name": v['day'].strftime('%d/%m'), 
                    "ventes": float(v['ventes'] or 0)
                })

        # 🏆 🌟 LE CLASSEMENT DES MEILLEURES VENTES (Ajouté pour Next.js)
        # On calcule la somme des quantités vendues par produit pour toutes les commandes payées
        top_performers = ItemCommande.objects.filter(
            commande__payee=True
        ).values(
            'produit__id', 'produit__nom'
        ).annotate(
            total_vendu=Sum('quantite')
        ).order_by('-total_vendu')[:5] # On extrait le Top 5

        # Formatage propre du tableau pour tes graphiques/statistiques Next.js
        graphique_produits_data = [
            {
                "id": tp['produit__id'],
                "nom": tp['produit__nom'],
                "quantite_vendue": tp['total_vendu']
            } for tp in top_performers
        ]

        # ⚠️ Alertes et Compteurs
        expirent = produits.filter(date_expiration__range=[aujourdhui, dans_60_jours]).order_by('date_expiration')
        stock_faible = produits.filter(quantite__lte=F('seuil_alerte'))
        ventes_recentes = Commande.objects.all().order_by('-date')[:5]

        return Response({
            "nb_produits": produits.count(),
            "ca_total": ca_total,
            # 💵 Ventilation explicite pour l'audit financier (cf. commentaire ci-dessus)
            "ca_ventilation": {
                "guichet_cash": ca_guichet_cash,
                "en_ligne": ca_en_ligne,
            },
            "nb_produits_critiques": stock_faible.count(),
            "nb_fournisseurs": Fournisseur.objects.count(),
            "graphique_ventes": graphique_data,
            "top_produits_vendus": graphique_produits_data, # 🌟 Ta nouvelle clé de classement !
            "produits_expirant_bientot": ProduitSerializer(expirent, many=True).data,
            "ventes_recentes": CommandeSerializer(ventes_recentes, many=True, context={'request': request}).data,
            "date_rapport": aujourdhui
        })
    except Exception as e:
        return Response({"error": str(e)}, status=500)


# --- 🎯 POINT DE VENTE (POS) & STOCK SÉCURISÉ ---
@api_view(['POST'])
@permission_classes([IsAdminUser])
def api_update_stock(request, produit_id):
    """
    Mise à jour rapide du stock par le BOSS avec traçabilité complète 🔄

    🔧 CHANTIER LOTS/FEFO : ce endpoint reste un ajustement du TOTAL (contrat inchangé pour
    ne pas casser app/admin/stocks/page.tsx, qui envoie un nombre absolu, pas une date de
    péremption) -- mais l'écriture réelle passe désormais par les lots :
    - hausse -> crée un nouveau lot "sans date de péremption connue" pour la différence
      (consommé en dernier par le FEFO, cf. Produit.decrementer_stock_fefo) ;
    - baisse -> consomme la différence en FEFO comme une sortie normale.
    Une vraie UI de réception de lot DATÉ reste à construire (voir /admin/ Django en
    attendant, où LotProduit est désormais gérable directement).
    """
    produit = get_object_or_404(Produit, id=produit_id)
    
    # SÉCURITÉ : Validation de la quantité entrante
    try:
        nouvelle_qte = int(request.data.get('quantite'))
        if nouvelle_qte < 0: raise ValueError()
    except (TypeError, ValueError):
        return Response({"error": "La quantité doit être un entier positif"}, status=400)
    try:
        with transaction.atomic():
            produit = Produit.objects.select_for_update().get(id=produit_id)
            delta = nouvelle_qte - produit.quantite
            if delta > 0:
                produit.ajouter_lot(delta, date_peremption=None, auteur=request.user, note="Ajustement manuel (sans date de péremption)")
            elif delta < 0:
                produit.decrementer_stock_fefo(abs(delta), auteur=request.user, note="Ajustement manuel")
            produit.refresh_from_db()
        return Response({"nouveau_statut": "OK", "quantite": produit.quantite}, status=200)
    except Exception as e:
        return Response({"error": str(e)}, status=500)


# --- 📦 GESTION DES LOTS (FEFO) ---
@api_view(['GET', 'POST'])
@permission_classes([IsAdminUser])
def api_lots_produit(request, produit_id):
    """
    GET  : historique des lots d'un produit (le plus proche de la péremption en premier -- ordre FEFO).
    POST : réception d'un nouveau lot daté {quantite, date_peremption (optionnelle, "AAAA-MM-JJ"), numero_lot (optionnel)}.
    Réservé au personnel (IsAdminUser, comme api_update_stock) -- jamais accessible à un CompteClient.
    """
    produit = get_object_or_404(Produit, id=produit_id)

    if request.method == 'GET':
        lots = produit.lots.all()  # déjà trié par date_peremption (Meta.ordering du modèle)
        return Response(LotProduitSerializer(lots, many=True).data)

    # POST : réception d'un nouveau lot
    try:
        quantite = int(request.data.get('quantite'))
        if quantite <= 0: raise ValueError()
    except (TypeError, ValueError):
        return Response({"error": "La quantité doit être un entier strictement positif"}, status=400)

    date_peremption_str = request.data.get('date_peremption') or None
    date_peremption = None
    if date_peremption_str:
        # 🐛 CORRECTIF : request.data renvoie une chaîne brute ("AAAA-MM-JJ"), jamais un objet
        # date -- l'assigner tel quel plantait dans LotProduit.save() (calendar.monthrange()
        # sur un str). parse_date() la convertit proprement, ou renvoie None si mal formée.
        date_peremption = parse_date(date_peremption_str)
        if date_peremption is None:
            return Response({"error": "Date de péremption invalide (format attendu : AAAA-MM-JJ)"}, status=400)
    numero_lot = request.data.get('numero_lot') or None

    try:
        with transaction.atomic():
            produit = Produit.objects.select_for_update().get(id=produit_id)
            lot = produit.ajouter_lot(
                quantite, date_peremption=date_peremption, numero_lot=numero_lot,
                auteur=request.user, note="Réception lot",
            )
        return Response(LotProduitSerializer(lot).data, status=201)
    except ValidationError as e:
        error_message = e.messages[0] if hasattr(e, 'messages') else str(e)
        return Response({"error": error_message}, status=400)
    except Exception as e:
        return Response({"error": str(e)}, status=500)


# 🔐 PROTECTION FOURNISSEURS : Seul l'admin (IsAuthenticated) gère les tiers
@api_view(['GET', 'POST'])
@permission_classes([IsAdminUser])
def api_fournisseurs(request):
    if request.method == 'GET':
        fournisseurs = Fournisseur.objects.all().order_by('-id')
        return Response(FournisseurSerializer(fournisseurs, many=True).data)
    
    # Seul l'administrateur peut ajouter un fournisseur
    if not request.user.is_superuser:
        return Response({"error": "Accès interdit : Droits administrateur requis"}, status=403)
        
    if request.method == 'POST':
        serializer = FournisseurSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['PUT', 'DELETE'])
@permission_classes([IsAdminUser])
def api_fournisseur_detail(request, pk):
    if not request.user.is_superuser:
        return Response({"error": "Accès interdit : Droits administrateur requis"}, status=403)
        
    fournisseur = get_object_or_404(Fournisseur, pk=pk)

    if request.method == 'PUT':
        serializer = FournisseurSerializer(fournisseur, data=request.data)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    elif request.method == 'DELETE':
        fournisseur.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
    
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def api_inventaire_stock(request):
    """Fournit les données de l'inventaire global au format JSON pour la page d'impression Next.js 🛰️"""
    
    # 1. 🔐 SÉCURITÉ : Strictement identique à votre ancienne vue (Personnel / Caisse / Admin)
    if not request.user.is_staff:
        return Response({"detail": "Accès refusé. Réservé au personnel."}, status=403)

    try:
        config = PharmacieConfig.objects.first()
        produits = Produit.objects.all().order_by('nom')
        
        # 2. Calculs identiques à votre ancienne vue backend
        total_med = produits.count()
        stock_faible = produits.filter(quantite__lte=F('seuil_alerte')).count()

        # 3. Envoi des données brutes structurées
        return Response({
            "config": {
                "nom": config.nom if config else "PHARMACIE PLUS +",
                "logo": config.logo.url if config and config.logo else None,
                "adresse": config.adresse if config else "",
                "telephone": config.telephone if config else "",
                "message_remerciement": config.message_remerciement if config else "Votre santé, notre priorité."
            },
            "statistiques": {
                "total_med": total_med,
                "stock_faible": stock_faible
            },
            "produits": ProduitSerializer(produits, many=True).data
        }, status=200)

    except Exception as e:
        return Response({"detail": "Erreur technique lors de la récupération de l'inventaire."}, status=500)


# --- 📊 PRÉDICTION DE STOCK (statistiques classiques, PAS de LLM -- décision ferme) ---
@api_view(['GET'])
@authentication_classes([StaffJWTAuthentication])
@permission_classes([IsAdminUser])
def api_predictions_stock(request):
    """
    Liste des prédictions de réapprovisionnement pour tous les produits du tenant,
    triées par urgence (rupture la plus proche en premier).

    Query params optionnels :
    - ?lookback_jours=90   : fenêtre d'historique analysée (défaut 90)
    - ?lead_time_jours=7   : délai de livraison fournisseur supposé (défaut 7)
    - ?alerte_uniquement=1 : ne renvoie que les produits à surveiller réellement
      (rupture prévue dans le délai de livraison, ou commande recommandée non nulle)
    """
    # 🔐 IsAdminUser (DRF) ne vérifie que is_staff, or une caissière est aussi is_staff=True
    # (cf. seed.py). Les décisions de réapprovisionnement/commande fournisseur relèvent du
    # BOSS uniquement -- même restriction explicite que api_boss_dashboard.
    if not request.user.is_superuser:
        return Response({"error": "Accès réservé à l'administrateur."}, status=403)

    try:
        lookback_jours = int(request.query_params.get("lookback_jours", 90))
        lead_time_jours = int(request.query_params.get("lead_time_jours", 7))
    except ValueError:
        return Response({"error": "lookback_jours et lead_time_jours doivent être des entiers"}, status=400)

    if lookback_jours < 2 or lead_time_jours < 0:
        return Response({"error": "Paramètres hors limites"}, status=400)

    alerte_uniquement = request.query_params.get("alerte_uniquement") in ("1", "true", "True")

    # 🔴 CACHE REDIS (15 min) : calcul statistique sur tout le catalogue -- coûteux (moyenne
    # mobile + régression par produit) pour un résultat qui ne bouge en réalité qu'au rythme
    # des ventes de la journée. Clé = tenant + query string exacte (chaque combinaison de
    # lookback/lead_time/alerte a son propre cache). Pas d'invalidation manuelle : une
    # recommandation de réapprovisionnement vieille de quelques minutes n'a aucune
    # conséquence pratique (ce n'est pas une donnée transactionnelle).
    cached = cache_get("predictions_stock", request)
    if cached is not None:
        return Response(cached)

    predictions = predire_pour_tous_produits(
        lookback_jours=lookback_jours,
        lead_time_jours=lead_time_jours,
        alerte_uniquement=alerte_uniquement,
    )
    resultat = {"count": len(predictions), "predictions": predictions}
    cache_set("predictions_stock", resultat, timeout=900, request=request)
    return Response(resultat, status=200)


@api_view(['GET'])
@authentication_classes([StaffJWTAuthentication])
@permission_classes([IsAdminUser])
def api_prediction_stock_produit(request, produit_id):
    """Prédiction détaillée d'un seul produit (utilisée sur sa fiche/page de détail)."""
    if not request.user.is_superuser:
        return Response({"error": "Accès réservé à l'administrateur."}, status=403)

    produit = get_object_or_404(Produit, id=produit_id)

    try:
        lookback_jours = int(request.query_params.get("lookback_jours", 90))
        lead_time_jours = int(request.query_params.get("lead_time_jours", 7))
    except ValueError:
        return Response({"error": "lookback_jours et lead_time_jours doivent être des entiers"}, status=400)

    if lookback_jours < 2 or lead_time_jours < 0:
        return Response({"error": "Paramètres hors limites"}, status=400)

    resultat = predire_pour_produit(produit, lookback_jours=lookback_jours, lead_time_jours=lead_time_jours)
    return Response(resultat, status=200)


# 🔐 BLINDAGE PHOTO : Passage au standard API DRF pour hériter de la protection JWT
@api_view(['POST'])
@permission_classes([IsAdminUser])
@parser_classes([MultiPartParser, FormParser])
def api_modifier_photo_produit(request, produit_id):
    if not request.user.is_superuser :
        return Response({"error": "Action réservée à l'administrateur"}, status=403)
        
    if 'image' in request.FILES:
        image_brute = request.FILES['image']

        # 🔐 Mêmes garanties que pour une ordonnance : on ne fait jamais confiance au nom de
        # fichier ni au Content-Type déclaré par le navigateur -- détection par contenu réel,
        # réencodage complet (élimine tout payload caché), ET compression au passage (photo
        # catalogue = juste illustrative, pas besoin du poids d'une photo de téléphone brute).
        try:
            image_propre = valider_et_desinfecter_photo_produit(image_brute)
        except ValidationError as e:
            return Response({"error": str(e.message) if hasattr(e, 'message') else str(e)}, status=400)

        produit = get_object_or_404(Produit, id=produit_id)
        produit.image = image_propre
        produit.save()
        image_url_complete = request.build_absolute_uri(produit.image.url)
        return Response({
            "message": "Photo mise à jour par l'administrateur! 📸",
            "image_url": image_url_complete
        }, status=200)
            
    return Response({"error": "Fichier manquant"}, status=400)
  

# --- 🛒 VENTE DIRECTE AU GUICHET SÉCURISÉE (Version avec Table Dédiée Guichet) ---
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def api_vente_directe(request):
    if not request.user.is_staff:
        return Response({"error": "Accès réservé au guichet"}, status=403)
        
    data = request.data
    items_data = data.get('items', [])
    client_infos = data.get('client_infos', {}) or {}
    ordonnance_verifiee = bool(data.get('ordonnance_verifiee_visuellement', False))
    
    if not items_data:
        return Response({"error": "Le panier est vide"}, status=400)

    try:
        with transaction.atomic():
            # 🔐 Vérification AVANT toute écriture en base : si au moins un produit du panier
            # exige une ordonnance, la caissière doit avoir explicitement confirmé l'avoir
            # vérifiée physiquement. On vérifie ça en premier pour ne rien créer (ni
            # ClientGuichet, ni Commande) si la vente doit être bloquée.
            produit_ids = [it['produit_id'] for it in items_data]
            produits_necessitant_ordonnance = Produit.objects.filter(
                id__in=produit_ids, ordonnance_obligatoire=True
            ).values_list('nom', flat=True)

            if produits_necessitant_ordonnance and not ordonnance_verifiee:
                noms = ", ".join(produits_necessitant_ordonnance)
                return Response({
                    "error": f"Ordonnance requise pour : {noms}. "
                             f"Merci de confirmer l'avoir vérifiée avant de valider la vente."
                }, status=400)

            # 1. 🌟 Coordonnées client OPTIONNELLES : une vente rapide au comptoir n'a pas
            # forcément besoin d'identifier le client (ex: un achat ponctuel de paracétamol).
            # On ne crée un ClientGuichet QUE si au moins une coordonnée a été renseignée --
            # sinon on remplit la base de centaines de "Client Passage" vides et sans valeur
            # statistique ou de contact réelle.
            a_des_coordonnees = any([
                client_infos.get('nom'), client_infos.get('telephone'), client_infos.get('email')
            ])
            client_pos = None
            if a_des_coordonnees:
                client_pos = ClientGuichet.objects.create(
                    nom=client_infos.get('nom', 'Client Passage'),
                    telephone=client_infos.get('telephone', ''),
                    email=client_infos.get('email', ''),
                    region=client_infos.get('region', ''),
                    ville=client_infos.get('ville', ''),
                    quartier=client_infos.get('quartier', '')
                )

            # 2. Création de la commande liée au ClientGuichet (ou totalement anonyme)
            # 🐛 CORRECTIF (bug préexistant, introduit par le retrait du modèle Client) :
            # Commande.client n'existe plus depuis la suppression complète de l'ancien
            # modèle Client -- passer "client=None" ici levait TypeError ("unexpected
            # keyword argument 'client'") et faisait planter TOUTE vente au guichet.
            commande = Commande.objects.create(
                client_guichet=client_pos, # 🌟 None si vente anonyme sans coordonnées
                type_vente='guichet',
                payee=True,
                statut='payee',
                agent_validateur=request.user,
                ordonnance_verifiee_visuellement=ordonnance_verifiee,
            )

            # 3. Décrémentation et figeage des prix
            for it in items_data:
                try:
                    produit = Produit.objects.select_for_update().get(id=it['produit_id'])
                except Produit.DoesNotExist:
                    raise ValidationError(f"Le produit avec l'ID {it['produit_id']} n'existe pas.")
                
                try:    
                    qte = int(it['quantite'])
                    if qte <= 0: raise ValueError()
                except (ValueError, TypeError):
                    raise ValidationError(f"Quantité invalide pour le produit {produit.nom}")

                if produit.quantite < qte:
                    raise ValidationError(f"Stock insuffisant pour {produit.nom} ({produit.quantite} disponibles)")
                
                ItemCommande.objects.create(commande=commande, produit=produit, quantite=qte)
                
                # 📦 FEFO : consomme d'abord le(s) lot(s) dont la péremption est la plus proche
                produit.decrementer_stock_fefo(qte, auteur=request.user, note=f"Vente guichet {commande.reference}")

            serializer = CommandeSerializer(commande, context={'request': request})

        # 📧 Hors du bloc transaction.atomic() : un échec d'envoi d'email ne doit jamais
        # faire rollback une vente déjà encaissée et un stock déjà décrémenté.
        from .emails import envoyer_email_confirmation_commande
        envoyer_email_confirmation_commande(commande)

        return Response(serializer.data, status=status.HTTP_201_CREATED)
            
    except ValidationError as e:
        error_message = e.messages[0] if hasattr(e, 'messages') else str(e)
        return Response({"error": error_message}, status=400)
    except Exception as e:
        return Response({"error": f"Erreur technique : {str(e)}"}, status=500)


# --- 📋 ARCHIVES CAISSIÈRE SÉCURISÉES ---
@api_view(['GET'])
# On supprime @authentication_classes([]) pour permettre au JWT de valider le rôle is_staff
@permission_classes([IsAuthenticated])
def api_archives_caissiere(request):
    """
    Récupère les ventes RÉELLEMENT CONFIRMÉES des 90 derniers jours (reçus/factures).

    🔐 CORRECTION (bug remonté en test, session du 12/07) : l'ancien filtre incluait
    `Q(ordonnance_valide=True)` en plus de `Q(payee=True)`. Or une ordonnance peut être
    validée par la caisse BIEN AVANT que le client ait payé (et même avant qu'il ait
    seulement soumis sa référence de transaction) -- une commande encore en "en_cours"
    ou "paiement_a_verifier" pouvait donc apparaître ici, dans le registre des ventes,
    avec le badge "Certifiée", alors qu'elle n'est pas encore une vente réelle et
    n'apparaît pas encore dans le chiffre d'affaires du tableau de bord (qui, lui, filtre
    correctement sur payee=True). Seul `payee=True` doit faire foi : c'est le seul
    moment où le stock a réellement été décrémenté et l'argent réellement encaissé/vérifié.
    """
    if not request.user.is_staff: 
        return Response({"error": "Réservé au personnel de la pharmacie"}, status=403)        
    
    il_ya_90_jours = timezone.now() - timedelta(days=90)
    
    archives = Commande.objects.filter(
        payee=True,
        date__gte=il_ya_90_jours
    ).order_by('-date')
    
    serializer = CommandeSerializer(archives, many=True, context={'request': request})
    return Response(serializer.data)


# --- 👤 GESTION ADMIN DES COMPTES CLIENTS (réinitialisation de mot de passe) ---
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def api_admin_liste_clients(request):
    """
    Liste des clients en ligne (comptes créés via l'app mobile/web) du tenant courant,
    pour la page de gestion admin. Réservé au superuser du tenant : accéder aux
    coordonnées de tous les clients est une action sensible, pas une simple tâche de
    caisse.
    """
    if not request.user.is_superuser:
        return Response({"error": "Accès réservé à l'administrateur."}, status=403)

    # 🌍 CompteClient est global (schéma public) : on ne peut pas filtrer par tenant via
    # une colonne, mais Commande.compte_client vit lui dans CE schéma tenant précis --
    # donc "avoir au moins une commande ici" restreint naturellement la liste aux clients
    # réellement pertinents pour CETTE pharmacie, sans avoir besoin d'un champ dédié.
    clients = CompteClient.objects.filter(commandes__isnull=False).distinct().order_by('nom')
    data = [{
        "id": c.id,
        "nom": c.nom,
        "identifiant": c.identifiant,
        "telephone": c.telephone,
        "email": c.email,
        "is_active": c.is_active,
    } for c in clients]
    return Response(data)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def api_admin_reset_password_client(request, client_id):
    """
    🔐 Réinitialise le mot de passe d'un client et le lui envoie IMMÉDIATEMENT par email,
    en un seul clic côté frontend admin -- remplace le processus Django admin en 3 étapes
    (ouvrir l'utilisateur, cliquer sur "changer le mot de passe", le communiquer soi-même
    au client par un autre canal). Réservé au superuser du tenant.

    Ne modifie RIEN en base tant que l'email n'a pas été confirmé parti : si l'envoi
    échoue (ex: Brevo pas configuré / sender non vérifié), on ne veut surtout pas que
    l'admin croie avoir communiqué un mot de passe qui n'est en réalité connu de personne
    -- le compte serait alors bloqué sans que personne ne s'en aperçoive.
    """
    if not request.user.is_superuser:
        return Response({"error": "Accès réservé à l'administrateur."}, status=403)

    client_obj = get_object_or_404(CompteClient, id=client_id)
    if not client_obj.email:
        return Response({
            "error": "Ce client n'a pas d'adresse email enregistrée -- impossible de lui "
                     "envoyer un nouveau mot de passe automatiquement."
        }, status=400)

    # Mot de passe temporaire aléatoire (12 caractères, alphabet large -> passe sans
    # difficulté les validateurs Django par défaut : longueur mini, pas 100% numérique...).
    alphabet = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789!@#$%"
    nouveau_mdp = get_random_string(12, allowed_chars=alphabet)

    from .emails import envoyer_email_nouveau_mot_de_passe
    try:
        envoyer_email_nouveau_mot_de_passe(client_obj, nouveau_mdp)
    except Exception:
        logger.exception("Échec de l'envoi de l'email de réinitialisation pour le client %s", client_obj.identifiant)
        return Response({
            "error": "Le nouveau mot de passe n'a PAS pu être envoyé par email (problème de "
                     "configuration Brevo/SMTP côté serveur) -- le mot de passe du client n'a "
                     "donc PAS été modifié, pour éviter de le bloquer sans recours."
        }, status=502)

    # 🔐 On ne change réellement le mot de passe qu'APRÈS confirmation que l'email est parti.
    with transaction.atomic():
        client_obj.set_password(nouveau_mdp)
        client_obj.save()

    return Response({
        "message": f"Nouveau mot de passe généré et envoyé à {client_obj.email}. ✅"
    })




