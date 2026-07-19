from django.shortcuts import get_object_or_404, render, redirect
from django.http import HttpResponse, HttpResponseForbidden
from django.template.loader import render_to_string
from django.views.decorators.csrf import csrf_exempt
from django.db.models import Sum, Q, F
from django.utils import timezone
from datetime import timedelta
from rest_framework_simplejwt.authentication import JWTAuthentication
from .authentication import StaffJWTAuthentication, ClientOrStaffJWTAuthentication, resoudre_identite_client
from weasyprint import HTML
import qrcode
import base64
from io import BytesIO

# Imports de tes modèles locaux requis pour les requêtes d'impression
from .models import Commande, Produit, PharmacieConfig
from .utils import generate_qr_base64, obtenir_logo_base64_pour_pdf

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


def _recuperer_utilisateur_jwt_client_ou_staff(request):
    """
    Variante de _recuperer_utilisateur_jwt() ci-dessus qui accepte AUSSI les jetons
    "type": "client" (marketplace globale, CompteClient) en plus des jetons du personnel --
    réservée à export_facture_pdf, seul export PDF qu'un client doit pouvoir télécharger
    (sa propre facture). Les 3 autres exports (financier, stock, alertes) restent strictement
    personnel et continuent d'utiliser _recuperer_utilisateur_jwt() : CompteClient n'a
    volontairement pas d'attribut is_superuser (pas de PermissionsMixin), donc les mélanger
    là ferait planter les contrôles de rôle (AttributeError) au lieu de les bloquer proprement.
    """
    try:
        header = ClientOrStaffJWTAuthentication().get_header(request)
        if header is None:
            return None
        raw_token = ClientOrStaffJWTAuthentication().get_raw_token(header)
        validated_token = ClientOrStaffJWTAuthentication().get_validated_token(raw_token)
        return ClientOrStaffJWTAuthentication().get_user(validated_token)
    except Exception:
        return None


# 🔐 FONCTION PRIVÉE DE VÉRIFICATION DU TOKEN JWT POUR LES TÉLÉCHARGEMENTS
@csrf_exempt
def export_facture_pdf(request, commande_id):
    """Génération de PDF hautement sécurisée (Anti-IDOR) compatible Next.js 📄"""
    
    # 1. Authentification stricte via le Jetons JWT envoyé par le Frontend
    # 🔧 CORRECTIF JONCTION COMPTECLIENT : _recuperer_utilisateur_jwt() (staff uniquement)
    # remplacée ici par la variante qui reconnaît aussi les jetons CompteClient -- sans ça,
    # un client marketplace ne pouvait jamais télécharger sa propre facture.
    user = _recuperer_utilisateur_jwt_client_ou_staff(request)
    if not user or not user.is_authenticated:
        return HttpResponse("Authentification requise pour télécharger ce PDF.", status=401)

    # 2. 🕵️ CONTRÔLE D'ACCÈS : Le personnel voit tout, le client ne voit QUE son profil
    if user.is_staff:
        commande = get_object_or_404(Commande, id=commande_id)
    else:
        client_instance, client_field = resoudre_identite_client(user)
        # L'ID de la commande doit impérativement correspondre au profil du client connecté
        commande = get_object_or_404(Commande, id=commande_id, **{client_field: client_instance})

    config = PharmacieConfig.objects.first()

    # 3. Génération du QR Code basé sur le total exact et figé
    # 🔧 CORRECTIF : l'ancien champ Commande.client (modèle Client local au tenant) a été
    # supprimé au profit de Commande.compte_client (CompteClient, marketplace globale) --
    # cf. migration core.0009_remove_client_user_remove_commande_client_and_more. Cette
    # branche `elif commande.client` restait dans le code et faisait planter (500) toute
    # génération de facture pour une commande sans client_guichet ni compte_client.
    if commande.client_guichet:
        nom_client = commande.client_guichet.nom
    elif commande.compte_client:
        nom_client = commande.compte_client.nom
    else:
        nom_client = "Client au Guichet"
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
        'nom_client': nom_client,
        'logo_url': obtenir_logo_base64_pour_pdf(config)
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
        # 🖼️ CORRECTIF LOGO (voir core/utils.py::obtenir_logo_base64_pour_pdf) : l'ancienne
        # URL HTTP absolue ne fonctionnait qu'en DEBUG=True (seul mode où config/urls.py sert
        # MEDIA_URL) -- en production le logo était systématiquement cassé. On lit maintenant
        # l'image directement sur disque et on l'encode en base64, sans requête HTTP.
        'logo_url': obtenir_logo_base64_pour_pdf(config),
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
            # 🖼️ Voir core/utils.py::obtenir_logo_base64_pour_pdf (base64 direct, pas d'URL HTTP)
            'logo_url': obtenir_logo_base64_pour_pdf(config),
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
        # 🖼️ Voir core/utils.py::obtenir_logo_base64_pour_pdf (base64 direct, pas d'URL HTTP)
        'logo_url': obtenir_logo_base64_pour_pdf(config),
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


