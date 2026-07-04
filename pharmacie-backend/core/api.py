import uuid
from rest_framework.decorators import api_view, permission_classes, parser_classes, authentication_classes, throttle_classes
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated, IsAdminUser, AllowAny
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.authentication import JWTAuthentication
from django.shortcuts import get_object_or_404
from django.db import transaction
from django.utils import timezone
from django.contrib.auth import authenticate
from django.db.models import Q, Sum, F
from django.db.models.functions import TruncDate
from django.core.exceptions import ValidationError
from django.contrib.auth.models import User
from datetime import timedelta
from django.utils import timezone

from .models import Produit, Commande, ItemCommande, Client, ClientGuichet, Fournisseur, PharmacieConfig, Mouvement_stock
from .serializers import (
    ProduitSerializer, CommandeSerializer, CommandeClientSerializer, ClientRegisterSerializer, 
    PharmacieConfigSerializer, FournisseurSerializer
)
from .validators import valider_et_desinfecter_ordonnance
from .pagination import CataloguePagination
from .throttles import LoginRateThrottle, SoumettrePaiementRateThrottle
from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync


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
@authentication_classes([JWTAuthentication])
def infos_pharmacie(request):
    # 🌍 Volontairement PUBLIC (AllowAny) : nom, logo, devise, adresse de la pharmacie
    # doivent s'afficher pour n'importe quel visiteur (catalogue, page de connexion...),
    # pas seulement pour un admin déjà authentifié. Aucune donnée sensible n'est exposée
    # ici -- la modification de la config, elle, reste réservée aux admins (api_update_config).
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
        return Response({"message": "Paramètres mis à jour avec succès !"}, status=200)
    except Exception as e:
        # Parfait pour le développement : vous voyez exactement pourquoi ça plante
        return Response({"error": str(e)}, status=500)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def api_infos_paiement(request):
    """
    💰 Expose UNIQUEMENT les coordonnées de paiement mobile money de la pharmacie courante
    (jamais le PharmacieConfig complet, qui peut contenir d'autres informations internes).
    Accessible à tout utilisateur connecté (client comme staff) -- nécessaire pour afficher
    les instructions de paiement sur la page panier.
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

@api_view(['POST'])
@permission_classes([AllowAny])
def api_register(request):
    """Inscription sécurisée d'un Client (Zéro compte fantôme) 🛡️"""
    # Notre sérialiseur s'occupe de TOUT : validation de la force du password,
    # vérification des doublons, et création simultanée dans User et Client.
    serializer = ClientRegisterSerializer(data=request.data)
    if serializer.is_valid():
        nouveau_client = serializer.save()
        return Response({
            "message": "Compte créé avec succès ! 🎉",
            "id_client": nouveau_client.identifiant
        }, status=201)
    
    # En cas d'erreur (mot de passe trop faible, téléphone doublon), DRF répond proprement
    return Response(serializer.errors, status=400)


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
        
        return Response({
            "message": "Connexion réussie",
            "access": str(refresh.access_token),  # Jeton à inclure dans le Header Next.js
            "refresh": str(refresh),              # Jeton pour renouveler la session en tâche de fond
            "user": user.username,
            "role": role_req
        }, status=200)
        
    return Response({"error": "Identifiants invalides"}, status=401)

# À ajouter à la fin de core/api.py
@api_view(['GET'])
@authentication_classes([JWTAuthentication]) # On s'assure que le JWT est traité avant de vérifier les permissions
@permission_classes([AllowAny]) # On permet à tous de demander "qui suis-je"
def api_get_current_user(request):
    if request.user and request.user.is_authenticated:
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
    """
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

    return paginator.get_paginated_response({
        "produits": serializer.data,
        "categories": categories_dict # Envoie les labels pour les menus Next.js
    })

# --- 🛒 GESTION DU PANIER SÉCURISÉ (Vérification 48h incluse) ---
@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def api_panier(request):
    facture_id = request.GET.get('id')
    
    # 1. Protection du personnel de caisse
    if request.user.is_staff and not facture_id:
        return Response({"error": "Le personnel ne peut pas avoir de panier client"}, status=403)
        
    # 🎯 SÉCURITÉ CONTRÔLE D'ACCÈS (Anti-IDOR)
    client_profile = get_object_or_404(Client, user=request.user) if not request.user.is_staff else None
    
    # 2. CAS A : Consultation d'une facture spécifique (?id=XXX) -> Accessible Staff ET Client propriétaire
    if facture_id:
        if request.user.is_staff:
            commande_detail = get_object_or_404(Commande, id=facture_id)
            # Le staff voit le serializer complet (avec le nom de l'agent validateur, pour l'audit)
            return Response(CommandeSerializer(commande_detail).data)
        else:
            commande_detail = get_object_or_404(Commande, id=facture_id, client=client_profile)
            # 🔐 Le client ne voit jamais quel agent a traité sa commande
            return Response(CommandeClientSerializer(commande_detail).data)

    # 3. CAS B : Gestion du Panier Courant (Uniquement pour les clients connectés)
    # 🔐 Le "panier en cours" est une commande non encore soumise en paiement. Une fois que le
    # client a cliqué "Payer" (statut paiement_a_verifier) ou que la caisse a confirmé
    # (payee_a_retirer/retiree), ce n'est plus un panier modifiable -> on en ouvre un nouveau.
    STATUTS_PANIER_MODIFIABLE = ("en_cours", "attente_validation")
    commande = (
        Commande.objects.filter(client=client_profile, statut__in=STATUTS_PANIER_MODIFIABLE)
        .order_by("-date").first()
    )
    created = False
    if commande is None:
        commande = Commande.objects.create(client=client_profile, statut="en_cours")
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
@permission_classes([IsAuthenticated])
@throttle_classes([SoumettrePaiementRateThrottle])
def api_soumettre_paiement(request, commande_id):
    """
    💰 Le client indique avoir effectué son transfert Orange Money / MTN MoMo et fournit la
    référence de transaction reçue par SMS. La commande passe en "paiement_a_verifier" : le
    STOCK N'EST PAS ENCORE DÉCRÉMENTÉ à ce stade (seule la confirmation par la caisse via
    api_confirmer_paiement déclenche réellement Commande.valider()) -- on ne fait jamais
    confiance à une simple déclaration du client pour engager le stock réel.
    """
    if request.user.is_staff:
        return Response({"error": "Action réservée aux clients"}, status=403)

    client_profile = get_object_or_404(Client, user=request.user)
    commande = get_object_or_404(Commande, id=commande_id, client=client_profile)

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
    _notifier_caisse(request.tenant.schema_name, "nouvelle_demande_paiement",
                      commande=CommandeSerializer(commande).data)

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
    return Response(CommandeSerializer(commandes, many=True).data)


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

    return Response(CommandeSerializer(commandes, many=True).data)


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
@permission_classes([IsAuthenticated])
def api_mes_commandes(request):
    """Récupère l'historique des commandes du client connecté"""
    client_profile = get_object_or_404(Client, user=request.user)
    commandes = Commande.objects.filter(client=client_profile).order_by('-date')
    # 🔐 Le client ne doit jamais voir quel agent a validé/refusé ses ordonnances
    serializer = CommandeClientSerializer(commandes, many=True)
    return Response(serializer.data)

# --- 📋 GESTION DES ORDONNANCES SÉCURISÉE ---
@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
@parser_classes([MultiPartParser, FormParser])
def api_gestion_ordonnance(request, commande_id=None):
    """Client: Upload / Caisse: Liste et Valide sans injection de droits 🔓"""
    
    # ÉTAPE 1 : Rôle Client -> Envoi de l'ordonnance
    if not request.user.is_staff:
        if request.method == 'POST' and commande_id:
            commande = get_object_or_404(Commande, id=commande_id, client__user=request.user)
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
                    commande=CommandeSerializer(commande).data,
                )

                return Response({"message": "Ordonnance reçue. En attente de vérification. ⏳"})
        return Response({"error": "Action non autorisée pour un client"}, status=403)

    # ÉTAPE 2 : Rôle Caisse/Admin -> Consultation et Validation
    if request.user.is_staff:
        if request.method == 'GET' and not commande_id:
            attentes = Commande.objects.filter(statut="attente_validation", ordonnance_valide=False).filter(ordonnance__isnull=False).exclude(ordonnance='')
            return Response(CommandeSerializer(attentes, many=True).data)
        
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

                    return Response({"message": "Rejetée ❌"})

                return Response({"error": "Action invalide"}, status=400)

    return Response({"error": "Requête invalide"}, status=400)

# --- 📈 DASHBOARD & RAPPORTS BOSS SÉCURISÉS ---
@api_view(['GET'])
@authentication_classes([JWTAuthentication])
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
            "ventes_recentes": CommandeSerializer(ventes_recentes, many=True).data,
            "date_rapport": aujourdhui
        })
    except Exception as e:
        return Response({"error": str(e)}, status=500)


# --- 🎯 POINT DE VENTE (POS) & STOCK SÉCURISÉ ---
@api_view(['POST'])
@permission_classes([IsAdminUser])
def api_update_stock(request, produit_id):
    """Mise à jour rapide du stock par le BOSS avec traçabilité complète 🔄"""
    produit = get_object_or_404(Produit, id=produit_id)
    
    # SÉCURITÉ : Validation de la quantité entrante
    try:
        nouvelle_qte = int(request.data.get('quantite'))
        if nouvelle_qte < 0: raise ValueError()
    except (TypeError, ValueError):
        return Response({"error": "La quantité doit être un entier positif"}, status=400)
    try:
        with transaction.atomic():
            produit.quantite = nouvelle_qte
            produit.save()
            # 🔐 TRACABILITÉ : On passe l'auteur du mouvement via request.user (extrait du JWT)
            Mouvement_stock.objects.create(produit=produit, quantite=nouvelle_qte, type="entree", auteur=request.user)
        return Response({"nouveau_statut": "OK", "quantite": produit.quantite}, status=200)
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

# 🔐 BLINDAGE PHOTO : Passage au standard API DRF pour hériter de la protection JWT
@api_view(['POST'])
@permission_classes([IsAdminUser])
@parser_classes([MultiPartParser, FormParser])
def api_modifier_photo_produit(request, produit_id):
    if not request.user.is_superuser :
        return Response({"error": "Action réservée à l'administrateur"}, status=403)
        
    if 'image' in request.FILES:
        image_file = request.FILES['image']
        extension = image_file.name.split('.')[-1].lower()
        if extension not in ['jpg', 'jpeg', 'png', 'webp']:
            return Response({"error": "Format d'image non autorisé"}, status=400)

        produit = get_object_or_404(Produit, id=produit_id)
        produit.image = image_file
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
            commande = Commande.objects.create(
                client=None, # Laissé vide car c'est une vente physique comptoir
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
                
                produit.quantite -= qte
                produit.save()
                
                Mouvement_stock.objects.create(produit=produit, quantite=qte, type="sortie", auteur=request.user)

            serializer = CommandeSerializer(commande)
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
    """Récupère toutes les factures et ordonnances validées des 90 derniers jours"""
    if not request.user.is_staff: 
        return Response({"error": "Réservé au personnel de la pharmacie"}, status=403)        
    
    il_ya_90_jours = timezone.now() - timedelta(days=90)
    
    archives = Commande.objects.filter(
        Q(payee=True) | Q(ordonnance_valide=True),
        date__gte=il_ya_90_jours
    ).order_by('-date')
    
    serializer = CommandeSerializer(archives, many=True)
    return Response(serializer.data)




