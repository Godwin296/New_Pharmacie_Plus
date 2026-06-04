import uuid
from rest_framework.decorators import api_view, permission_classes, parser_classes, authentication_classes
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
    ProduitSerializer, CommandeSerializer, ClientRegisterSerializer, 
    PharmacieConfigSerializer, FournisseurSerializer
)

@api_view(['GET'])
@permission_classes([IsAdminUser])
@authentication_classes([JWTAuthentication])
def infos_pharmacie(request):
    config = PharmacieConfig.objects.first()
    if not config:
        config = PharmacieConfig.objects.create(
            nom="Pharmacie +",
            adresse="Adresse à configurer",
            telephone="+237 ..."
        )
    serializer = PharmacieConfigSerializer(config)
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

        config.save()
        return Response({"message": "Paramètres mis à jour avec succès !"}, status=200)
    except Exception as e:
        # Parfait pour le développement : vous voyez exactement pourquoi ça plante
        return Response({"error": str(e)}, status=500)

# --- 🛂 SYSTÈME DE SÉCURITÉ (Permissions personnalisées) ---
def check_role(user, role_requested):
    if not user or not user.is_authenticated: return False
    if role_requested == 'admin' and user.is_superuser: return True
    if role_requested == 'caissiere' and user.is_staff and not user.is_superuser: return True
    if role_requested == 'client' and not user.is_staff: return True
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
    """Catalogue réactif pour Next.js 🚀"""
    produits = Produit.objects.all().order_by('nom')
    query_cat = request.GET.get('cat')
    search_query = request.GET.get('q')

    if query_cat and query_cat != 'None' and query_cat.strip():
        produits = produits.filter(categorie=query_cat)
    
    if search_query and search_query.strip():
        produits = produits.filter(
            Q(nom__icontains=search_query) | 
            Q(laboratoire__icontains=search_query)
        ).distinct()

    serializer = ProduitSerializer(produits, many=True)
    categories_dict = dict(getattr(Produit, 'CATEGORIES', {}))
    return Response({
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
        else:
            commande_detail = get_object_or_404(Commande, id=facture_id, client=client_profile)
        
        # Ce return s'exécute UNIQUEMENT si facture_id est présent
        return Response(CommandeSerializer(commande_detail).data)

    # 3. CAS B : Gestion du Panier Courant (Uniquement pour les clients connectés)
    # Récupération ou création sécurisée du panier en cours
    commande, created = Commande.objects.get_or_create(client=client_profile, payee=False)
    
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
    return Response(CommandeSerializer(commande).data)

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def api_mes_commandes(request):
    """Récupère l'historique des commandes du client connecté"""
    client_profile = get_object_or_404(Client, user=request.user)
    commandes = Commande.objects.filter(client=client_profile).order_by('-date')
    serializer = CommandeSerializer(commandes, many=True)
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
                f = request.FILES['fichier_ordonnance']
                ext = f.name.split('.')[-1].lower()
                if ext not in ['jpg', 'jpeg', 'png', 'pdf']:
                    return Response({"error": "Seuls les formats JPG, PNG et PDF sont acceptés"}, status=400)
                
                commande.ordonnance = f
                commande.statut = "attente_validation"
                commande.save()
                return Response({"message": "Ordonnance reçue. En attente de vérification. ⏳"})
        return Response({"error": "Action non autorisée pour un client"}, status=403)

    # ÉTAPE 2 : Rôle Caisse/Admin -> Consultation et Validation
    if request.user.is_staff:
        if request.method == 'GET' and not commande_id:
            attentes = Commande.objects.filter(statut="attente_validation", ordonnance_valide=False).filter(ordonnance__isnull=False).exclude(ordonnance='')
            return Response(CommandeSerializer(attentes, many=True).data)
        
        if request.method == 'POST' and commande_id:
            commande = get_object_or_404(Commande, id=commande_id)
            action = request.data.get('action')
            
            if action == 'approuver':
                commande.ordonnance_valide = True
                commande.statut = "en_cours"
                # Sécurité : On utilise l'utilisateur authentifié par le JWT, pas une chaîne texte du front
                commande.agent_validateur = request.user.username 
                commande.save()
                return Response({"message": "Approuvée ✅"})
            
            elif action == 'rejeter':
                commande.motif_refus = request.data.get('raison', 'Document invalide')
                if commande.ordonnance:
                    commande.ordonnance.delete(save=False)
                commande.statut = "en_cours" # Permet au client de réuploader
                commande.save()
                return Response({"message": "Rejetée ❌"})

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
    client_infos = data.get('client_infos', {})
    
    if not items_data:
        return Response({"error": "Le panier est vide"}, status=400)

    try:
        with transaction.atomic():
            # 1. 🌟 Création systématique et propre dans la table dédiée ClientGuichet
            # Pas de création de User Django, pas de pollution de la table Client mobile
            client_pos = ClientGuichet.objects.create(
                nom=client_infos.get('nom', 'Client Passage'),
                telephone=client_infos.get('telephone', ''),
                email=client_infos.get('email', ''),
                region=client_infos.get('region', ''),
                ville=client_infos.get('ville', ''),
                quartier=client_infos.get('quartier', '')
            )

            # 2. Création de la commande liée au ClientGuichet
            commande = Commande.objects.create(
                client=None, # Laissé vide car c'est une vente physique comptoir
                client_guichet=client_pos, # 🌟 Lié à notre nouvelle table
                type_vente='guichet',
                payee=True,
                statut='payee',
                agent_validateur=request.user
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




