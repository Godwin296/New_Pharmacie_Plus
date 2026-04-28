import uuid
from rest_framework.decorators import api_view, permission_classes, parser_classes, authentication_classes
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated, IsAdminUser, AllowAny
from rest_framework.parsers import MultiPartParser, FormParser
from django.shortcuts import get_object_or_404
from django.db import transaction
from django.utils import timezone
from django.contrib.auth import authenticate, login
from django.db.models import Q, Sum, F
from django.views.decorators.csrf import csrf_exempt, ensure_csrf_cookie
from django.http import JsonResponse
from django.utils.decorators import method_decorator
from django.db.models.functions import TruncDate
from django.core.exceptions import ValidationError

import qrcode
import base64
from io import BytesIO
from datetime import timedelta
from django.utils import timezone

from .models import Produit, Commande, ItemCommande, Client, Fournisseur, PharmacieConfig, Mouvement_stock
from .serializers import (
    ProduitSerializer, CommandeSerializer, ClientSerializer, 
    PharmacieConfigSerializer, ItemCommandeSerializer, FournisseurSerializer
)

@api_view(['GET'])
@authentication_classes([]) # 👈 Ajoute cette ligne pour ignorer toute session/token
@permission_classes([AllowAny])
def infos_pharmacie(request):
    config = PharmacieConfig.objects.first()
    if not config:
        # On crée une config par défaut si la base est vide
        config = PharmacieConfig.objects.create(
            nom="Pharmacie Plus",
            adresse="Adresse à configurer",
            telephone="+237 ..."
        )
    serializer = PharmacieConfigSerializer(config)
    return Response(serializer.data)


@csrf_exempt
@api_view(['POST'])
@authentication_classes([])
@permission_classes([AllowAny])
@parser_classes([MultiPartParser, FormParser])
def api_update_config(request):
    try:
        config = PharmacieConfig.objects.first()
        if not config:
            config = PharmacieConfig.objects.create()

        # On récupère les données. Si la clé n'existe pas dans l'envoi, on garde la valeur actuelle.
        config.nom = request.data.get('nom', config.nom)
        config.telephone = request.data.get('telephone', config.telephone)
        config.adresse = request.data.get('adresse', config.adresse)
        config.email_contact = request.data.get('email_contact', config.email_contact) # 👈 On l'ajoute ici
        config.message_remerciement = request.data.get('message_remerciement', config.message_remerciement)
        
        # Pour les préférences
        config.langue_preferee = request.data.get('langue_preferee', config.langue_preferee)
        config.devise_preferee = request.data.get('devise_preferee', config.devise_preferee)

        if 'logo' in request.FILES:
            config.logo = request.FILES['logo']

        config.save()
        return Response({"message": "Paramètres mis à jour avec succès !"}, status=200)
    except Exception as e:
        return Response({"error": str(e)}, status=500)

# --- 🛂 SYSTÈME DE SÉCURITÉ (Permissions personnalisées) ---
def check_role(user, role_requested):
    if role_requested == 'admin' and user.is_superuser: return True
    if role_requested == 'caissiere' and user.is_staff and not user.is_superuser: return True
    if role_requested == 'client' and not user.is_staff: return True
    return False

@api_view(['POST'])
@permission_classes([AllowAny])
def api_login(request):
    """Connexion Next.js avec vérification des rôles 🎭"""
    u_name = request.data.get('username')
    p_word = request.data.get('password')
    role_req = request.data.get('role') # 'admin', 'caissiere', 'client'
    
    user = authenticate(username=u_name, password=p_word)
    if user:
        if not check_role(user, role_req):
            return Response({"error": "Rôle non autorisé pour ce compte"}, status=403)
        
        login(request, user)
        return Response({
            "message": "Connexion réussie",
            "user": user.username,
            "role": role_req,
            "is_staff": user.is_staff,
            "is_boss": user.is_superuser
        })
    return Response({"error": "Identifiants invalides"}, status=401)

# --- 💊 CATALOGUE & RECHERCHE (Remplace HTMX) ---
@api_view(['GET'])
@permission_classes([AllowAny])
def api_catalogue(request):
    """Catalogue réactif pour Next.js 🚀"""
    produits = Produit.objects.all().order_by('nom')
    query_cat = request.GET.get('cat')
    search_query = request.GET.get('q')

    if query_cat and query_cat != 'None':
        produits = produits.filter(categorie=query_cat)
    
    if search_query:
        produits = produits.filter(
            Q(nom__icontains=search_query) | 
            Q(laboratoire__icontains=search_query)
        ).distinct()

    serializer = ProduitSerializer(produits, many=True)
    return Response({
        "produits": serializer.data,
        "categories": dict(Produit.CATEGORIES) # Envoie les labels pour les menus Next.js
    })

# --- 🛒 GESTION DU PANIER (Vérification 48h incluse) ---
@api_view(['GET', 'POST'])
@permission_classes([AllowAny])
def api_panier(request):
    # 🎯 AJOUT : Si un ID est fourni, on renvoie cette commande précise (payée ou non)
    facture_id = request.GET.get('id')
    if facture_id:
        commande_detail = get_object_or_404(Commande, id=facture_id)
        return Response(CommandeSerializer(commande_detail).data)

    # --- Logique normale du panier pour le client connecté ---
    client_profile, _ = Client.objects.get_or_create(user=request.user, defaults={'nom': request.user.username})
    commande, created = Commande.objects.get_or_create(client=client_profile, payee=False)
    
    if not created and commande.est_perimee:
        commande.annuler_commande()
        return Response({"message": "Panier expiré", "panier_vide": True}, status=200)

    if request.method == 'POST':
        p_id = request.data.get('produit_id')
        qte = int(request.data.get('quantite', 1))
        produit = get_object_or_404(Produit, id=p_id)
        
        if qte > produit.quantite:
            return Response({"error": "Stock insuffisant"}, status=400)
            
        item, it_created = ItemCommande.objects.get_or_create(commande=commande, produit=produit)
        item.quantite = (item.quantite + qte) if not it_created else qte
        item.save()

    return Response(CommandeSerializer(commande).data)

# --- 📋 GESTION DES ORDONNANCES (Flux Caisse) ---
@api_view(['GET', 'POST'])
@csrf_exempt
@permission_classes([AllowAny])
@parser_classes([MultiPartParser, FormParser])
def api_gestion_ordonnance(request, commande_id=None):
    """Client: Upload / Caisse: Liste et Valide 🔓"""
    # 1. Le Client envoie son document
    if request.method == 'POST' and not request.user.is_staff:
        commande = get_object_or_404(Commande, id=commande_id, client__user=request.user)
        if 'fichier_ordonnance' in request.FILES:
            commande.ordonnance = request.FILES['fichier_ordonnance']
            commande.statut = "attente_validation"
            commande.save()
            return Response({"message": "Ordonnance reçue. En attente de vérification. ⏳"})

    # 2. La Caisse voit la liste des attentes
    if request.user.is_staff:
        if not commande_id:
            attentes = Commande.objects.filter(statut="attente_validation", ordonnance_valide=False).exclude(ordonnance='')
            return Response(CommandeSerializer(attentes, many=True).data)
        
        # 3. Action de Validation/Rejet par la caisse
        commande = get_object_or_404(Commande, id=commande_id)
        action = request.data.get('action') # 'approuver' ou 'rejeter'
        
        if action == 'approuver':
            commande.ordonnance_valide = True
            commande.statut = "en_cours"
            commande.agent_validateur = request.user.username
            commande.save()
            return Response({"message": "Approuvée ✅"})
        
        elif action == 'rejeter':
            commande.motif_refus = request.data.get('raison', 'Document invalide')
            if commande.ordonnance:
                commande.ordonnance.delete(save=False)
            commande.save()
            return Response({"message": "Rejetée ❌"})

    return Response({"error": "Action non autorisée"}, status=403)

# --- 🎯 POINT DE VENTE (POS) & STOCK ---
@api_view(['POST'])
@permission_classes([IsAdminUser])
def api_update_stock(request, produit_id):
    """Mise à jour rapide du stock par le BOSS 🔄"""
    produit = get_object_or_404(Produit, id=produit_id)
    nouvelle_qte = request.data.get('quantite')
    with transaction.atomic():
        produit.quantite = int(nouvelle_qte)
        produit.save()
        Mouvement_stock.objects.create(produit=produit, quantite=nouvelle_qte, type="entree")
    return Response({"nouveau_statut": produit.statut_stock(), "quantite": produit.quantite})

# --- 📈 DASHBOARD & RAPPORTS BOSS ---
@api_view(['GET'])
@authentication_classes([])
@permission_classes([AllowAny])
def api_boss_dashboard(request):
    """KPIs complets pour Next.js 🛰️"""
    aujourdhui = timezone.now().date()
    dans_60_jours = aujourdhui + timedelta(days=60)
    produits = Produit.objects.all()
    
    # 💰 Revenu Global
    ca_total = Commande.objects.filter(payee=True).aggregate(
        total=Sum(F('items__quantite') * F('items__produit__prix'))
    )['total'] or 0

    # 📊 Graphique des ventes (7 derniers jours)
    sept_derniers_jours = timezone.now() - timedelta(days=7)
    ventes_par_jour = Commande.objects.filter(
        payee=True, 
        date__gte=sept_derniers_jours
    ).annotate(day=TruncDate('date')).values('day').annotate(
        ventes=Sum(F('items__quantite') * F('items__produit__prix'))
    ).order_by('day')

    graphique_data = [
        {"name": v['day'].strftime('%d/%m'), "ventes": float(v['ventes'])} 
        for v in ventes_par_jour
    ]

    # ⚠️ Alertes et Compteurs
    expirent = produits.filter(date_expiration__range=[aujourdhui, dans_60_jours]).order_by('date_expiration')
    stock_faible = produits.filter(quantite__lte=F('seuil_alerte'))

    # 🧾 Ventes récentes (les 5 dernières)
    ventes_recentes = Commande.objects.all().order_by('-date')[:5]

    return Response({
        "nb_produits": produits.count(),
        "ca_total": ca_total,
        "nb_produits_critiques": stock_faible.count(),
        "nb_fournisseurs": Fournisseur.objects.count(),
        "graphique_ventes": graphique_data,
        "produits_expirant_bientot": ProduitSerializer(expirent, many=True).data,
        "ventes_recentes": CommandeSerializer(ventes_recentes, many=True).data,
        "date_rapport": aujourdhui
    })

@csrf_exempt
@api_view(['GET'])
@authentication_classes([])
@permission_classes([AllowAny])
def api_archives_caissiere(request):
    """Récupère toutes les factures et ordonnances validées des 90 derniers jours"""
    #if not request.user.is_staff:
        #return Response({"error": "Accès refusé"}, status=403)
        
    il_ya_90_jours = timezone.now() - timedelta(days=90)
    
    # On prend les commandes payées ou validées récemment
    archives = Commande.objects.filter(
        Q(payee=True) | Q(ordonnance_valide=True),
        date__gte=il_ya_90_jours
    ).order_by('-date')
    
    serializer = CommandeSerializer(archives, many=True)
    return Response(serializer.data)


@api_view(['POST'])
@permission_classes([AllowAny])
def api_register(request):
    """Inscription d'un nouveau Client avec hachage de mot de passe 🛡️"""
    data = request.data
    
    try:
        # 1. Vérification si l'identifiant ou le téléphone existe déjà
        if Client.objects.filter(username=data.get('username')).exists():
            return Response({"error": "Ce nom d'utilisateur est déjà pris 👤"}, status=400)
        
        if Client.objects.filter(telephone=data.get('telephone')).exists():
            return Response({"error": "Ce numéro de téléphone est déjà utilisé 📞"}, status=400)

        # 2. Création du Client (Le hachage du password se fait dans le save() du model qu'on a modifié)
        nouveau_client = Client.objects.create(
            username=data.get('username'),
            password=data.get('password'), # Sera haché par le model.save()
            nom=data.get('nom'),
            telephone=data.get('telephone'),
            email=data.get('email', '')
        )

        return Response({
            "message": "Compte créé avec succès ! 🎉",
            "username": nouveau_client.username,
            "id_client": nouveau_client.identifiant
        }, status=201)

    except Exception as e:
        return Response({"error": f"Erreur lors de la création : {str(e)}"}, status=500)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def api_mes_commandes(request):
    """Récupère l'historique des commandes du client connecté"""
    client_profile = get_object_or_404(Client, user=request.user)
    commandes = Commande.objects.filter(client=client_profile).order_by('-date_commande')
    serializer = CommandeSerializer(commandes, many=True)
    return Response(serializer.data)


@api_view(['GET', 'POST'])
@authentication_classes([]) 
@permission_classes([AllowAny])
def api_fournisseurs(request):
    if request.method == 'GET':
        fournisseurs = Fournisseur.objects.all().order_by('-id')
        serializer = FournisseurSerializer(fournisseurs, many=True)
        return Response(serializer.data)
    
    elif request.method == 'POST':
        serializer = FournisseurSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

@api_view(['PUT', 'DELETE'])
@authentication_classes([]) 
@permission_classes([AllowAny])
def api_fournisseur_detail(request, pk):
    try:
        fournisseur = Fournisseur.objects.get(pk=pk)
    except Fournisseur.DoesNotExist:
        return Response(status=status.HTTP_404_NOT_FOUND)

    if request.method == 'PUT':
        serializer = FournisseurSerializer(fournisseur, data=request.data)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    elif request.method == 'DELETE':
        fournisseur.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
    

# --- 🛒 VENTE DIRECTE AU GUICHET (Version Finalisée) ---
@api_view(['POST'])
@csrf_exempt
@permission_classes([AllowAny])
def api_vente_directe(request):
    data = request.data
    items_data = data.get('items', [])
    client_infos = data.get('client_infos', {}) # Récupère les infos de la modale
    agent = request.user.username if request.user.is_authenticated else "Caisse_Auto"
    
    if not items_data:
        return Response({"error": "Le panier est vide"}, status=400)

    try:
        with transaction.atomic():
            # 1. Gestion du client (Recherche par tel ou création)
            client_obj = None
            tel = client_infos.get('telephone')
            if tel:
                client_obj, _ = Client.objects.get_or_create(
                    telephone=tel,
                    defaults={
                        'nom': client_infos.get('nom', 'Client Passage'),
                        'username': f"pos_{uuid.uuid4().hex[:6]}"
                    }
                )

            # 2. Création de la commande
            commande = Commande.objects.create(
                client=client_obj,
                type_vente='guichet',
                payee=True,
                statut='payee',
                agent_validateur=agent
            )

            for it in items_data:
                produit = get_object_or_404(Produit, id=it['produit_id'])
                qte = int(it['quantite'])
                if produit.quantite < qte:
                    raise ValidationError(f"Stock insuffisant pour {produit.nom}")
                
                ItemCommande.objects.create(commande=commande, produit=produit, quantite=qte)
                produit.quantite -= qte
                produit.save()
                Mouvement_stock.objects.create(produit=produit, quantite=qte, type="sortie")

            # On renvoie la commande sérialisée pour que Next.js récupère l'ID
            serializer = CommandeSerializer(commande)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
    except Exception as e:
        return Response({"error": str(e)}, status=400)


def generate_qr_base64(data_string):
    # 1. Création du QR Code
    qr = qrcode.QRCode(version=1, box_size=10, border=5)
    qr.add_data(data_string)
    qr.make(fit=True)

    # 2. Création de l'image
    img = qr.make_image(fill_color="black", back_color="white")

    # 3. Conversion en Base64 pour Next.js
    buffered = BytesIO()
    img.save(buffered, format="PNG")
    img_str = base64.b64encode(buffered.getvalue()).decode()
    
    return f"data:image/png;base64,{img_str}"


@csrf_exempt  # On utilise l'exempt car le frontend gère ses propres headers
def api_modifier_photo_produit(request, produit_id):
    if request.method == 'POST' and request.FILES.get('image'):
        try:
            produit = get_object_or_404(Produit, id=produit_id)
            produit.image = request.FILES['image']
            produit.save()
            
            return JsonResponse({
                "message": "Photo mise à jour ! 📸",
                "image_url": produit.image.url
            })
        except Exception as e:
            return JsonResponse({"error": str(e)}, status=400)
            
    return JsonResponse({"error": "Méthode non autorisée ou fichier manquant"}, status=405)