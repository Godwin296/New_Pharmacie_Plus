from django.shortcuts import get_object_or_404, render, redirect
from django.http import HttpResponse, HttpResponseForbidden
from django.template.loader import render_to_string
from django.views.decorators.csrf import csrf_exempt
from django.db.models import Sum, Q, F
from django.utils import timezone
from datetime import timedelta
from rest_framework_simplejwt.authentication import JWTAuthentication
from .authentication import StaffJWTAuthentication
from weasyprint import HTML
import qrcode
import base64
from io import BytesIO

# Imports de tes modèles locaux requis pour les requêtes d'impression
from .models import Commande, Client, Produit, PharmacieConfig
from .utils import generate_qr_base64

# --- 🛡️ SYSTÈME DE VÉRIFICATION DES RÔLES ---
def is_staff_member(user):
    return user.is_authenticated and (user.is_staff or user.is_superuser)

def is_boss(user):
    return user.is_authenticated and user.is_superuser

def _recuperer_utilisateur_jwt(request):
    """Extrait secrètement l'utilisateur depuis le token Bearer fourni par Next.js"""
    try:
        # 🔐 CORRECTIF : utilisait JWTAuthentication (vanilla), qui ignore la claim
        # "type" du jeton -- un jeton CLIENT (marketplace globale) pouvait donc faire
        # générer/télécharger des PDF réservés au personnel (facture, rapport de stock,
        # ticket de caisse...) en usurpant l'identité du membre du personnel partageant
        # le même ID numérique sur le tenant ciblé. Voir core/authentication.py.
        header = StaffJWTAuthentication().get_header(request)
        if header is None:
            return None
        raw_token = StaffJWTAuthentication().get_raw_token(header)
        validated_token = StaffJWTAuthentication().get_validated_token(raw_token)
        return StaffJWTAuthentication().get_user(validated_token)
    except Exception:
        return None

# 🔐 VALIDATION DE COMMANDE COMPATIBLE NEXT.JS / JWT
def facture_commande(request, commande_id):
    # Sécurité : Si la requête ne contient pas un utilisateur authentifié par l'API (via JWT)
    if not request.user or not request.user.is_authenticated:
        return HttpResponse("Non authentifié", status=401)

    # Récupération sécurisée du profil client associé à l'User JWT
    client_profile = get_object_or_404(Client, user=request.user)
    commande = get_object_or_404(Commande, id=commande_id, client=client_profile)
    
    # Sécurité Ordonnance
    if commande.ordonnance and not commande.ordonnance_valide:
        return HttpResponse("Votre ordonnance est en cours de vérification par notre équipe.", status=400)

    if not commande.payee:
        try:
            # Passe l'utilisateur qui opère l'action pour la traçabilité
            commande.valider(user_operateur=request.user) 
        except Exception as e:
            return HttpResponse(f"Erreur de validation : {str(e)}", status=400)
            
    # Redirection vers la vue de rendu de la facture
    return redirect("core:facture", commande_id=commande.id)


# 🔐 RENDU DE LA FACTURE SÉCURISÉ (ANTI-IDOR ET COMPATIBLE JWT)
def facture(request, commande_id):
    # Sécurité : Vérification de l'authentification JWT
    if not request.user or not request.user.is_authenticated:
        return HttpResponse("Non authentifié", status=401)

    # 🕵️ CONTROL D'ACCES STRICT : La caisse voit tout, le client ne voit QUE son profil
    if request.user.is_staff:
        commande = get_object_or_404(Commande, id=commande_id)
    else:
        client_profile = get_object_or_404(Client, user=request.user)
        commande = get_object_or_404(Commande, id=commande_id, client=client_profile)
        
    items = commande.items.all()
    total = commande.total() # Utilise désormais le calcul sur 'prix_facture' figé
    config = PharmacieConfig.objects.first()
    devise = config.devise_preferee if config else "FCFA"
    
    # Sécurité QR Code : Données fixes issues de la transaction figée
    nom_client = commande.client.nom if commande.client else "Client au Guichet"
    qr_data = f"Facture ID: {commande.id} | Client: {nom_client} | Total: {total} {devise}"
    
    qr = qrcode.make(qr_data)
    buffer = BytesIO()
    qr.save(buffer, format="PNG")
    qr_base64 = base64.b64encode(buffer.getvalue()).decode('utf-8')
    
    # Rendu propre pour l'impression ou l'affichage de la facture
    return render(request, 'facture.html', {
        "commande": commande,
        "items": items,
        "total": total,
        "qr_code": qr_base64
    })


# 🔐 FONCTION PRIVÉE DE VÉRIFICATION DU TOKEN JWT POUR LES TÉLÉCHARGEMENTS
@csrf_exempt
def export_facture_pdf(request, commande_id):
    """Génération de PDF hautement sécurisée (Anti-IDOR) compatible Next.js 📄"""
    
    # 1. Authentification stricte via le Jetons JWT envoyé par le Frontend
    user = _recuperer_utilisateur_jwt(request)
    if not user or not user.is_authenticated:
        return HttpResponse("Authentification requise pour télécharger ce PDF.", status=401)

    # 2. 🕵️ CONTRÔLE D'ACCÈS : Le personnel voit tout, le client ne voit QUE son profil
    if user.is_staff:
        commande = get_object_or_404(Commande, id=commande_id)
    else:
        client_profile = get_object_or_404(Client, user=user)
        # L'ID de la commande doit impérativement correspondre au profil du client connecté
        commande = get_object_or_404(Commande, id=commande_id, client=client_profile)

    config = PharmacieConfig.objects.first()

    # 3. Génération du QR Code basé sur le total exact et figé
    nom_client = commande.client.nom if commande.client else "Client au Guichet"
    qr_data = f"FACTURE:{commande.id}|CLIENT:{nom_client}|TOTAL:{commande.total()} CFA"
    
    qr = qrcode.make(qr_data)
    buf = BytesIO()
    qr.save(buf, format="PNG")
    qr_base64 = base64.b64encode(buf.getvalue()).decode('utf-8')

    # 4. Préparation du contexte pour WeasyPrint
    context = {
        'commande': commande,
        'items': commande.items.all(),
        'config': config,
        'qr_code': qr_base64,
        'logo_url': request.build_absolute_uri(config.logo.url) if config and config.logo else None
    }

    # 5. Rendu du fichier HTML vers le moteur de PDF
    html_string = render_to_string('core/Caisse/facture_pdf.html', context)
    
    try:
        html = HTML(string=html_string, base_url=request.build_absolute_uri('/'))
        pdf = html.write_pdf()

        response = HttpResponse(pdf, content_type='application/pdf')
        # 'inline' permet à Next.js d'ouvrir le PDF directement dans un onglet propre
        response['Content-Disposition'] = f'inline; filename="Facture_{commande.id}.pdf"'
        return response
    except Exception as e:
        print(f"❌ Erreur WeasyPrint: {e}")
        return HttpResponse("Erreur technique lors de la génération du document.", status=500)


@csrf_exempt
def export_pdf_financier(request):
    """Génération du PDF Financier - Verrouillage Strict Admin (Zero Trust) 🔐"""
    
    # 1. Vérification de l'identité via le jeton JWT de Next.js
    user = _recuperer_utilisateur_jwt(request)
    if not user or not user.is_authenticated:
        return HttpResponse("Authentification requise.", status=401)
        
    # 2. 🔐 PRINCIPE DU MOINDRE PRIVILÈGE : Seul le Boss (Superuser) a le droit de voir les finances
    if not user.is_superuser:
        return HttpResponseForbidden("Accès interdit. Cette action est réservée à l'administrateur.")

    config = PharmacieConfig.objects.first()
    ventes = Commande.objects.filter(payee=True)
    
    # Calculs basés sur le prix figé de la transaction (prix_facture) pour une comptabilité exacte
    ca_total = sum(v.total() for v in ventes)
    nb_trans = ventes.count()
    moyenne = ca_total / nb_trans if nb_trans > 0 else 0
    
    top_produits = Produit.objects.annotate(
        vendu=Sum('itemcommande__quantite', filter=Q(itemcommande__commande__payee=True))
    ).order_by('-vendu')[:10]

    context = {
        'config': config,
        'ca_total': ca_total,
        'nb_trans': nb_trans,
        'moyenne': moyenne,
        'top_produits': top_produits,
        'date_heure': timezone.now(),
        # 🖼️ BUG CORRIGÉ : le template utilisait auparavant {{ config.logo.path }}, qui
        # renvoie le chemin DISQUE du serveur (ex: D:\...\media\logo.png sous Windows) --
        # WeasyPrint ne peut pas charger ça comme une image, d'où le logo systématiquement
        # cassé dans le PDF. On construit ici une vraie URL HTTP absolue, exactement comme
        # le fait déjà export_facture_pdf() plus haut dans ce même fichier.
        'logo_url': request.build_absolute_uri(config.logo.url) if config and config.logo else None,
    }

    # 3. Rendu du gabarit HTML vers le moteur WeasyPrint
    html_string = render_to_string('core/Admin/pdf_financier.html', context)
    
    try:
        html = HTML(string=html_string, base_url=request.build_absolute_uri('/'))
        pdf = html.write_pdf()

        response = HttpResponse(pdf, content_type='application/pdf')
        # 'inline' pour permettre à l'admin de le consulter directement dans Next.js
        response['Content-Disposition'] = 'inline; filename="Rapport_Financier.pdf"'
        return response
    except Exception as e:
        print(f"❌ Erreur WeasyPrint Financier: {e}")
        return HttpResponse("Erreur technique lors de la génération du rapport.", status=500)

# =====================================================================
# FONCTIONS D'EXPORTATIONS DE STOCKS SÉCURISÉES (COMPATIBLES NEXT.JS)
# =====================================================================

@csrf_exempt
def export_rapport_stock(request):
    """Génération du PDF de l'Inventaire Global - Accès Personnel Strict 🔐"""
    # 1. Authentification via le Token JWT Next.js
    user = _recuperer_utilisateur_jwt(request)
    if not user or not user.is_authenticated:
        return HttpResponse("Authentification requise.", status=401)
        
    # 2. 🔐 SÉCURITÉ : Seul le personnel de la pharmacie (Caisse / Admin) accède à l'état des stocks
    if not user.is_staff:
        return HttpResponse("Accès refusé. Réservé au personnel.", status=403)

    try:
        config = PharmacieConfig.objects.first()
        produits = Produit.objects.all().order_by('nom')
        
        total_med = produits.count()
        stock_faible = produits.filter(quantite__lte=F('seuil_alerte')).count()

        context = {
            'config': config,
            'produits': produits,
            'total_med': total_med,
            'stock_faible': stock_faible,
            'date_heure': timezone.now(),
            # 🖼️ BUG CORRIGÉ : voir commentaire identique dans export_pdf_financier().
            'logo_url': request.build_absolute_uri(config.logo.url) if config and config.logo else None,
        }
        
        html_string = render_to_string('core/Admin/pdf_stock.html', context)
        html = HTML(string=html_string, base_url=request.build_absolute_uri('/'))
        pdf_file = html.write_pdf()

        response = HttpResponse(pdf_file, content_type='application/pdf')
        response['Content-Disposition'] = 'inline; filename="Inventaire_Stock.pdf"'
        return response

    except Exception as e:
        return HttpResponse("Erreur technique lors de la génération de l'inventaire.", status=500)


@csrf_exempt
def export_alertes_pdf(request):
    """Génération du PDF des États Critiques et Péremptions - Accès Personnel Strict 🔐"""
    # 1. Authentification via le Token JWT Next.js
    user = _recuperer_utilisateur_jwt(request)
    if not user or not user.is_authenticated:
        return HttpResponse("Authentification requise.", status=401)
        
    # 2. 🔐 SÉCURITÉ : Moindre privilège (Caisse / Admin uniquement)
    if not user.is_staff:
        return HttpResponse("Accès refusé. Réservé au personnel.", status=403)

    config = PharmacieConfig.objects.first()
    aujourdhui = timezone.now().date()
    limite_peremption = aujourdhui + timedelta(days=60)

    nb_produits = Produit.objects.count()
    nb_produits_critiques = Produit.objects.filter(quantite__lte=F('seuil_alerte')).count()

    produits_en_alerte = Produit.objects.filter(
        Q(date_expiration__lte=limite_peremption) | 
        Q(quantite__lte=F('seuil_alerte'))
    ).order_by('date_expiration')

    context = {
        'config': config,
        'nb_produits': nb_produits,
        'nb_produits_critiques': nb_produits_critiques,
        'produits_expirant_bientot': produits_en_alerte,
        'date_heure': timezone.now(),
        # 🖼️ Harmonisé avec les autres exports PDF (voir export_pdf_financier) : URL
        # absolue plutôt que config.logo.url relative, pour un seul pattern cohérent.
        'logo_url': request.build_absolute_uri(config.logo.url) if config and config.logo else None,
    }

    html_string = render_to_string('core/Admin/alertes.html', context)
    pdf = HTML(string=html_string, base_url=request.build_absolute_uri('/')).write_pdf()

    response = HttpResponse(pdf, content_type='application/pdf')
    response['Content-Disposition'] = 'inline; filename="Etat_Critique_Stocks.pdf"'
    return response


# =====================================================================
# MAINTENANCE MAINTENANCE CRON TASK (En dehors des requêtes HTTP)
# =====================================================================
def nettoyer_vieilles_ordonnances():
    """ Supprime automatiquement les fichiers d'ordonnances de plus de 90 jours """
    limite = timezone.now() - timedelta(days=90)
    vieilles_commandes = Commande.objects.filter(date__lt=limite).exclude(ordonnance='')
    for c in vieilles_commandes:
        if c.ordonnance:
            c.ordonnance.delete(save=True)

# =====================================================================
# 4. IMPRESSIONS DE TICKETS ET FACTURES SECURE (COMPATIBLE NEXT.JS)
# =====================================================================

@csrf_exempt
def ticket_caisse_guichet(request, commande_id):
    """Génération du ticket thermique de caisse - Accès Personnel Strict 🖨️"""
    user = _recuperer_utilisateur_jwt(request)
    if not user or not user.is_authenticated:
        return HttpResponse("Authentification requise.", status=401)
        
    if not user.is_staff:
        return HttpResponse("Accès refusé. Réservé au guichet.", status=403)

    commande = get_object_or_404(Commande, id=commande_id)
    config = PharmacieConfig.objects.first()
    
    # 🎯 HARMONISATION : On réutilise la logique complète de ton API que tu préfères !
    num_facture = f"FAC-{commande.id}"
    nom_client = commande.client.nom if commande.client else "Client au Guichet"
    date_info = commande.date.strftime('%d/%m/%Y %H:%M') if commande.date else "N/A"
    
    liste_produits = ""
    for item in commande.items.all():
        nom_p = item.produit.nom[:12] 
        liste_produits += f"{item.quantite}x {nom_p}\n"

    total_prix = f"{commande.total()} CFA"

    contenu_qr = (
        f"FACTURE: {num_facture}\n"
        f"CLIENT: {nom_client}\n"
        f"DATE: {date_info}\n"
        f"ARTICLES:\n{liste_produits}"
        f"TOTAL: {total_prix}"
    )
    
    # 🔐 SÉCURITÉ & PROPRETÉ : Fonction utilitaire partagée (core/utils.py)
    qr_base64 = generate_qr_base64(contenu_qr)

    return render(request, 'core/Caisse/ticket_thermique.html', {
        'commande': commande,
        'config': config,
        'qr_code': qr_base64, # Utilise maintenant le même format Base64 complet
    })


@csrf_exempt
def telecharger_facture_pdf(request, commande_id):
    """Génération de la facture A4 PDF - Protection Anti-IDOR stricte 📄"""
    # 1. Vérification de l'identité via le Token JWT Next.js
    user = _recuperer_utilisateur_jwt(request)
    if not user or not user.is_authenticated:
        return HttpResponse("Authentification requise.", status=401)

    # 2. 🕵️ CONTRÔLE D'ACCÈS : Le personnel voit tout, le client ne voit QUE son profil
    if user.is_staff:
        commande = get_object_or_404(Commande, id=commande_id)
    else:
        client_profile = get_object_or_404(Client, user=user)
        commande = get_object_or_404(Commande, id=commande_id, client=client_profile)

    config = PharmacieConfig.objects.first()
    
    context = {
        'commande': commande,
        'config': config,
        'items': commande.items.all(),
        'date_edition': timezone.now(),
    }

    html_string = render_to_string('core/Caisse/facture_a4_template.html', context)
    
    try:
        response = HttpResponse(content_type='application/pdf')
        # 'inline' pour permettre une ouverture propre dans un onglet Next.js
        response['Content-Disposition'] = f'inline; filename="Facture_PHARMA_{commande.id}.pdf"'
        
        HTML(string=html_string, base_url=request.build_absolute_uri('/')).write_pdf(response)
        return response
    except Exception as e:
        return HttpResponse("Erreur technique lors de la génération de la facture A4.", status=500)
