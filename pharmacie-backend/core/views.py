from django.contrib.auth.decorators import login_required
from django.shortcuts import render, get_object_or_404, redirect
from django.contrib import messages
from .models import Produit, Commande, ItemCommande, Client, Fournisseur, PharmacieConfig, Mouvement_stock
from django.db import transaction, IntegrityError
import qrcode
import base64
from io import BytesIO
from django.conf import settings
from django.http import HttpResponse
from django.template.loader import render_to_string
from django.db.models import Sum, F, Q, ExpressionWrapper, DecimalField, Count, Avg
from datetime import timedelta
from django.utils import timezone
from datetime import timedelta, date
from .models import PharmacieConfig 
import os
from django.views.decorators.csrf import csrf_exempt
from django.contrib.admin.views.decorators import staff_member_required
from django.contrib.auth import authenticate, login
from django.contrib.admin.views.decorators import staff_member_required
from django.contrib.auth.decorators import user_passes_test
from django.contrib.auth.models import User
from django.contrib.auth.signals import user_logged_in
from django.dispatch import receiver
from weasyprint import HTML
import tempfile



# --- 🛡️ SYSTÈME DE VÉRIFICATION DES RÔLES ---
def is_staff_member(user):
    # Autorise les admins ET les membres du staff (caisse)
    return user.is_authenticated and (user.is_staff or user.is_superuser)

def is_boss(user):
    """Vérifie si l'utilisateur est le Super Admin (Boss)"""
    return user.is_authenticated and user.is_superuser

# Accueil
def home(request):
    return render(request, 'core/home.html')

# Catalogue avec filtres et recherche
def catalogue(request):
    # 1. On récupère la base
    produits = Produit.objects.all().order_by('nom')
    categories = Produit.CATEGORIES
    
    # 2. On récupère les filtres de l'URL
    query_cat = request.GET.get('cat')
    search_query = request.GET.get('q')

    # 🎯 FILTRAGE PAR CATÉGORIE
    if query_cat and query_cat != 'None':
        produits = produits.filter(categorie=query_cat)
    
    # 🔍 RECHERCHE PROGRESSIVE (Nom + Laboratoire)
    if search_query:
        # On utilise Q pour chercher dans les deux champs en même temps 🧪
        produits = produits.filter(
            Q(nom__icontains=search_query) | 
            Q(laboratoire__icontains=search_query)
        ).distinct()

    # ⚙️ PRÉPARATION DU CONTEXTE
    context = {
        'produits': produits,
        'categories': categories,
        'active_cat': query_cat,
        'search_query': search_query,
        'p_devise': "FCFA" # Tu pourras lier ça à ta PharmacieConfig plus tard
    }

    # ⚡️ MAGIE HTMX : Si la requête vient de HTMX (Input ou Bouton)
    # On renvoie uniquement le fragment de la liste
    if request.headers.get('HX-Request'):
        return render(request, 'core/partials/liste_produits_partial.html', context)

    # Sinon, on renvoie la page entière au premier chargement
    return render(request, 'core/catalogue.html', context)



# Validation de commande (Appelle la méthode du modèle)
@login_required
def facture_commande(request, commande_id):
    commande = get_object_or_404(Commande, id=commande_id, client__user=request.user)
    
    # Sécurité Ordonnance
    if commande.ordonnance and not commande.ordonnance_valide:
        messages.error(request, "Votre ordonnance est en cours de déchiffrage par notre équipe.")
        return redirect("core:panier")

    if not commande.payee:
        try:
            commande.valider() # Utilise la méthode sécurisée du modèle
            messages.success(request, "Commande validée avec succès !")
            messages.info(request, f"Nouvelle commande #{commande.id} prête pour encaissement !", extra_tags="Caisse")
        except Exception as e:
            messages.error(request, f"Erreur : {e}")
            return redirect("core:panier")
            
    return redirect("core:facture", commande_id=commande.id)

# Affichage Facture avec QR Code
@login_required
def facture(request, commande_id):
   # 🕵️ LOGIQUE DE SÉPARATION : La caisse voit tout, le client voit les siennes.
    if request.user.is_staff:
        commande = get_object_or_404(Commande, id=commande_id)
    else:
        commande = get_object_or_404(Commande, id=commande_id, client__user=request.user)
    items = commande.items.all()
    total = commande.total()
    config = PharmacieConfig.objects.first()
    devise = config.devise_preferee if config else "FCFA"
    
    qr_data = f"Facture ID: {commande.id} | Client: {commande.client.nom} | Total: {total} {devise}"
    qr = qrcode.make(qr_data)
    buffer = BytesIO()
    qr.save(buffer, format="PNG")
    qr_base64 = base64.b64encode(buffer.getvalue()).decode('utf-8')
    
    return render(request, 'facture.html', {
        "commande": commande,
        "items": items,
        "total": total,
        "qr_code": qr_base64
    })

# Panier - Ajout avec quantité
def ajouter_au_panier(request, produit_id):
    produit = get_object_or_404(Produit, id=produit_id)
    
    # 🔐 1. Vérification de l'authentification
    if not request.user.is_authenticated:
        messages.error(request, "Veuillez vous connecter pour commander. 👤")
        return redirect("login")
    
    # 🔢 2. Récupération de la quantité choisie
    choix_qte = int(request.POST.get('selection_quantite', 1))
    if choix_qte > produit.quantite:
        messages.error(request, f"Stock insuffisant ({produit.quantite} disponibles). ⚠️")
        return redirect("core:catalogue")
    
    # 🛡️ 3. Création/Récupération du profil Client ET de la Commande (D'ABORD !)
    client_profile, _ = Client.objects.get_or_create(
        user=request.user, 
        defaults={'nom': request.user.username}
    )
    # C'est ici qu'on définit 'commande' pour qu'elle soit utilisable après
    commande, _ = Commande.objects.get_or_create(client=client_profile, payee=False)

    # 🛒 4. Maintenant on peut créer l'item car 'commande' existe !
    item, created = ItemCommande.objects.get_or_create(commande=commande, produit=produit)
    
    # 📉 5. Mise à jour de la quantité dans le panier
    if not created:
        if (item.quantite + choix_qte) > produit.quantite:
            messages.error(request, "Impossible d'ajouter plus que le stock disponible. 🚫")
            return redirect("core:catalogue")
        item.quantite += choix_qte
    else:
        item.quantite = choix_qte
    
    item.save()
    
    messages.success(request, f"{produit.nom} ajouté au panier ! 🛒✨")
    return redirect("core:panier")


@login_required
def panier(request):
    client_profile = get_object_or_404(Client, user=request.user)
    commande = Commande.objects.filter(client=client_profile, payee=False).first()
    
    # ⏳ LOGIQUE 48H : Si la commande est périmée, on l'annule avant l'affichage
    if commande and commande.est_perimee:
        commande.annuler_commande()
        commande = None # Elle n'existe plus pour le tunnel d'achat
        messages.warning(request, "Votre commande a dépassé le délai de 48h et a été annulée. ⏳", extra_tags="Client")

    total = commande.total() if commande else 0
    return render(request, "core/panier.html", {"commande": commande, "total": total})

@login_required
def mes_commandes(request):
    client_profile = get_object_or_404(Client, user=request.user)
    commandes = Commande.objects.filter(client=client_profile, payee=True).order_by('-date')
    return render(request, 'core/mes_commandes.html', {'commandes': commandes})


@csrf_exempt  # 👈 CRUCIAL : Empêche l'erreur 403 quand Next.js appelle l'URL
def export_facture_pdf(request, commande_id):
    commande = get_object_or_404(Commande, id=commande_id)
    config = PharmacieConfig.objects.first()

    # 1. Génération du QR Code
    qr_data = f"FACTURE:{commande.id}|TOTAL:{commande.total()}"
    qr = qrcode.make(qr_data)
    buf = BytesIO()
    qr.save(buf, format="PNG")
    qr_base64 = base64.b64encode(buf.getvalue()).decode('utf-8')

    # 2. Préparation du contexte
    context = {
        'commande': commande,
        'items': commande.items.all(),
        'config': config,
        'qr_code': qr_base64,
        # On s'assure que l'URL du logo est absolue
        'logo_url': request.build_absolute_uri(config.logo.url) if config and config.logo else None
    }

    # 3. Rendu HTML
    html_string = render_to_string('core/Caisse/facture_pdf.html', context)
    
    # 4. Génération du PDF
    try:
        # On passe le base_url pour que WeasyPrint trouve les fichiers statiques/medias
        html = HTML(string=html_string, base_url=request.build_absolute_uri('/'))
        pdf = html.write_pdf()

        response = HttpResponse(pdf, content_type='application/pdf')
        # 'inline' pour l'aperçu, 'attachment' pour le téléchargement direct
        response['Content-Disposition'] = f'attachment; filename="Facture_{commande.id}.pdf"'
        return response
    except Exception as e:
        print(f"Erreur WeasyPrint: {e}")
        return HttpResponse(f"Erreur lors de la génération du PDF : {e}", status=500)


@login_required
def uploader_ordonnance(request, commande_id):
    commande = get_object_or_404(Commande, id=commande_id, client__user=request.user)
    if request.method == 'POST' and request.FILES.get('fichier_ordonnance'):
        commande.ordonnance = request.FILES['fichier_ordonnance']
        commande.statut = "attente_validation"
        commande.save()
        messages.info(request, "Ordonnance reçue pour vérification.")
        return redirect('core:panier')
    return render(request, 'core/upload_ordonnance.html', {'commande': commande})

@login_required
def validation_guichet(request, commande_id):
    if not request.user.is_staff:
        messages.error(request, "Accès réservé.")
        return redirect('core:home')
    commande = get_object_or_404(Commande, id=commande_id)
    with transaction.atomic():
        commande.ordonnance_valide = True
        commande.type_vente = 'guichet'
        commande.agent_validateur = request.user.username
        commande.save()
        commande.valider()
    return redirect("core:facture", commande_id=commande.id)



@user_passes_test(is_boss)
def dashboard_boss(request):
    aujourdhui = timezone.now().date()
    # AJUSTEMENT : Changement de 30 à 60 jours 🚨
    dans_60_jours = aujourdhui + timedelta(days=60)

    # 📊 Calculs financiers
    ventes_payees = Commande.objects.filter(payee=True)
    revenu_total = sum(v.total() for v in ventes_payees)
    
    # 💊 Stats Stocks & Alertes
    produits = Produit.objects.all()
    total_medicaments = produits.aggregate(Sum('quantite'))['quantite__sum'] or 0
    alerte_stock = produits.filter(quantite__lte=F('seuil_alerte')).count()
    
    # 🚨 Expirations AJUSTÉES (J-60)
    liste_expirent_bientot = produits.filter(
        date_expiration__range=[aujourdhui, dans_60_jours]
    ).order_by('date_expiration')

    # 🤝 Partenaires
    total_fournisseurs = Fournisseur.objects.count()

    # 🧾 Dernières ventes pour le tableau
    ventes_recentes = ventes_payees.order_by('-date')[:5]

    context = {
        'total_medicaments': total_medicaments,
        'revenu_total': revenu_total,
        'alerte_stock': alerte_stock,
        'total_fournisseurs': total_fournisseurs,
        'liste_expirent_bientot': liste_expirent_bientot,
        'ventes_recentes': ventes_recentes,
    }
    return render(request, 'core/admin/dashboard.html', context)



@login_required
def gestion_stocks_boss(request):
    # 1. Calcul de la valeur totale du stock (Prix x Quantité) 💰
    produits = Produit.objects.all()
    valeur_totale = sum(p.prix * p.quantite for p in produits)
    
    # 2. Analyse des produits critiques (Rupture ou Seuil atteint) 🚩
    critiques = Produit.objects.filter(quantite__lte=F('seuil_alerte'))
    
    # 3. Calcul du taux de remplissage global (Optionnel/Vision) 📈
    context = {
        'produits': produits,
        'valeur_totale': valeur_totale,
        'nb_critiques': critiques.count(),
        'produits_critiques': critiques,
    }
    return render(request, 'core/admin/gestion_stocks.html', context)


@login_required
def fournisseurs_boss(request):
    # On récupère tous les partenaires enregistrés 📝
    fournisseurs = Fournisseur.objects.all().order_by('nom')
    
    context = {
        'fournisseurs': fournisseurs,
        'nb_partenaires': fournisseurs.count(),
    }
    return render(request, 'core/admin/fournisseurs.html', context)


@user_passes_test(is_boss)
def rapports_boss(request):
    """
    Génère la vision financière globale pour l'administrateur 📊
    """
    # 1. Chiffre d'Affaire Global (Ventes payées)
    total_ca = Commande.objects.filter(payee=True).aggregate(
        ca=Sum(F('items__quantite') * F('items__produit__prix'))
    )['ca'] or 0

    # 2. Nombre de transactions réussies
    nb_ventes = Commande.objects.filter(payee=True).count()

    # 3. Top 5 des médicaments les plus vendus (Analyse de performance)
    top_produits = Produit.objects.annotate(
        total_vendu=Sum('itemcommande__quantite')
    ).filter(total_vendu__gt=0).order_by('-total_vendu')[:5]

    context = {
        'total_ca': total_ca,
        'nb_ventes': nb_ventes,
        'top_produits': top_produits,
        'date_rapport': timezone.now(),
    }
    return render(request, 'core/admin/rapports.html', context)


@user_passes_test(is_staff_member)
def historique_ventes_boss(request):
    """ Journal de bord avec recherche multicritères 🔎 """
    query = request.GET.get('q')
    ventes = Commande.objects.filter(payee=True).order_by('-date')

    # Logique de recherche multicritères 🔍
    if query:
        ventes = ventes.filter(
            Q(id__icontains=query) | 
            Q(items__produit__nom__icontains=query) |
            Q(date__icontains=query)
        ).distinct()

    # Calculs pour les cartes flottantes 💰
    total_ca = sum(v.total() for v in ventes)
    nb_ventes = ventes.count()

    context = {
        'ventes': ventes,
        'total_ca': total_ca,
        'nb_ventes': nb_ventes,
        'query': query,
    }
    return render(request, 'core/admin/historique_ventes.html', context)


@login_required
def reapprovisionnement_boss(request):
    """ Gestion des commandes fournisseurs et alertes rupture 🔄 """
    # 1. Identifier les produits qui ont besoin d'être recommandés
    alertes = Produit.objects.filter(quantite__lte=F('seuil_alerte'))
    
    # 2. Récupérer les fournisseurs pour le formulaire de commande
    fournisseurs = Fournisseur.objects.all()
    
    context = {
        'alertes': alertes,
        'fournisseurs': fournisseurs,
        'nb_alertes': alertes.count(),
    }
    return render(request, 'core/admin/reapprovisionnement.html', context)


@login_required
def fournisseurs_boss(request):
    """ Hub Fournisseurs avec recherche 🔎 """
    query = request.GET.get('q')
    fournisseurs = Fournisseur.objects.all().order_by('nom')

    if query:
        fournisseurs = fournisseurs.filter(
            Q(nom__icontains=query) | Q(contact_personne__icontains=query)
        )

    context = {
        'fournisseurs': fournisseurs,
        'query': query,
    }
    return render(request, 'core/admin/fournisseurs.html', context)

@login_required
def supprimer_fournisseur(request, f_id):
    """ Suppression éclair d'un partenaire 🗑️ """
    fournisseur = get_object_or_404(Fournisseur, id=f_id)
    fournisseur.delete()
    messages.success(request, "Partenaire supprimé. ✅")
    return redirect('fournisseurs_boss')



@staff_member_required
def rapports_boss(request):
    """ Intelligence Artificielle de Reporting 📈 """
    periode = request.GET.get('periode', 'quotidienne')
    aujourdhui = timezone.now().date()
    
    # 📅 Filtrage de la période
    if periode == 'hebdomadaire':
        date_debut = aujourdhui - timedelta(days=7)
    elif periode == 'mensuelle':
        date_debut = aujourdhui - timedelta(days=30)
    else: # quotidienne
        date_debut = aujourdhui

    ventes = Commande.objects.filter(payee=True, date__date__gte=date_debut)
    
    # 💰 Calculs KPIs
    ca_total = sum(v.total() for v in ventes)
    nb_trans = ventes.count()
    moyenne = ca_total / nb_trans if nb_trans > 0 else 0
    
    # 🏆 Top Médicaments (Top 5)
    # Note: On utilise une logique simple ici pour rester fluide
    top_produits = Produit.objects.filter(itemcommande__commande__payee=True).annotate(
        vendu=Sum('itemcommande__quantite')
    ).order_by('-vendu')[:5]

    # 🚨 Alertes Stocks
    alertes_stock = Produit.objects.filter(quantite__lte=F('seuil_alerte'))

    context = {
        'ca_total': ca_total,
        'nb_trans': nb_trans,
        'moyenne': moyenne,
        'classement_produits': top_produits,
        'alertes_stock': alertes_stock,
        'periode': periode,
    }
    
    # Si c'est une requête HTMX, on pourrait ne renvoyer que les fragments (optionnel)
    return render(request, 'core/admin/rapports.html', context)


@csrf_exempt # Pour autoriser l'appel depuis Next.js
def export_pdf_financier(request):
    config = PharmacieConfig.objects.first()
    ventes = Commande.objects.filter(payee=True)
    
    # Calculs
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
    }

    # 1. Rendu du HTML
    html_string = render_to_string('core/Admin/pdf_financier.html', context)
    
    # 2. Conversion en PDF via WeasyPrint
    html = HTML(string=html_string, base_url=request.build_absolute_uri('/'))
    pdf = html.write_pdf()

    # 3. Réponse HTTP pour téléchargement direct
    response = HttpResponse(pdf, content_type='application/pdf')
    # 'attachment' force le téléchargement
    response['Content-Disposition'] = 'attachment; filename="Rapport_Financier.pdf"'
    
    return response


@csrf_exempt
def export_rapport_stock(request):
    try:
        config = PharmacieConfig.objects.first()
        produits = Produit.objects.all().order_by('nom')
        
        # Stats globales
        total_med = produits.count()
        stock_faible = produits.filter(quantite__lte=F('seuil_alerte')).count()

        context = {
            'config': config,
            'produits': produits,
            'total_med': total_med,
            'stock_faible': stock_faible,
            'date_heure': timezone.now(),
        }
        
        # 1. Rendu du HTML
        html_string = render_to_string('core/Admin/pdf_stock.html', context)
        
        # 2. Génération du PDF en mémoire vive (Buffer)
        html = HTML(string=html_string, base_url=request.build_absolute_uri('/'))
        pdf_file = html.write_pdf() # Ceci génère les octets du PDF

        # 3. Préparation de la réponse
        response = HttpResponse(pdf_file, content_type='application/pdf')
        response['Content-Disposition'] = 'attachment; filename="Inventaire_Stock.pdf"'
        
        return response

    except Exception as e:
        # En cas d'erreur, on renvoie un message texte pour ne pas bloquer le navigateur
        return HttpResponse(f"Erreur lors de la génération du PDF : {str(e)}", status=500)

@csrf_exempt
def export_alertes_pdf(request):
    config = PharmacieConfig.objects.first()
    aujourdhui = timezone.now().date()
    limite_peremption = aujourdhui + timedelta(days=60)

    # Récupération des données pour les KPIs
    nb_produits = Produit.objects.count()
    
    # Correction ici : on utilise 'quantite' au lieu de 'quantite_stock'
    nb_produits_critiques = Produit.objects.filter(quantite__lte=F('seuil_alerte')).count()

    # Correction ici aussi pour la liste combinée
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
    }

    # Génération du PDF
    html_string = render_to_string('core/Admin/alertes.html', context)
    pdf = HTML(string=html_string, base_url=request.build_absolute_uri('/')).write_pdf()

    response = HttpResponse(pdf, content_type='application/pdf')
    response['Content-Disposition'] = 'attachment; filename="Etat_Critique_Stocks.pdf"'
    
    return response


@user_passes_test(is_boss)
def parametres_boss(request):
    """ Piloter l'identité visuelle de la pharmacie ⚙️ """
    config = PharmacieConfig.objects.first()
    
    if request.method == 'POST':
        nom = request.POST.get('nom')
        logo = request.FILES.get('logo')
        
        if config:
            config.nom = nom
            if logo: config.logo = logo
            config.save()
        else:
            config = PharmacieConfig.objects.create(nom=nom, logo=logo)
            
        messages.success(request, "Paramètres mis à jour avec succès ! ✨")
        return redirect('/boss/parametres/')

    return render(request, 'core/Admin/parametres.html', {'config': config})


@staff_member_required # Seule la caissière (ou le staff) y accède
def validation_caissiere_ordonnance(request, commande_id):
    """ Action de la caissière : Vérifie, valide et détruit l'image 🗑️✨ """
    commande = get_object_or_404(Commande, id=commande_id)
    # 1. On marque l'ordonnance comme vérifiée par l'humain
    commande.ordonnance_valide = True
    commande.statut = "en_cours" # La commande peut passer au paiement
    commande.agent_validateur = request.user.username    
    commande.save()
    messages.success(request, f"Votre ordonnance pour la commande #{commande.id} a été VALIDÉE !  Vous pouvez maintenant procéder au paiement.✅", extra_tags='Client')
    return redirect('core:gestion_ordonnances') # On redirigera vers sa session


@staff_member_required
def annuler_commande_caisse(request, commande_id):
    commande = get_object_or_404(Commande, id=commande_id)
    commande.annuler_commande()
    messages.success(request, f"La commande #{commande.id} a été annulée et les stocks mis à jour. 🗑️", extra_tags="Caisse")
    return redirect("core:gestion_ordonnances")



def nettoyer_vieilles_ordonnances():
    """ Supprime les fichiers d'ordonnances de plus de 90 jours """
    limite = timezone.now() - timedelta(days=90)
    vieilles_commandes = Commande.objects.filter(date__lt=limite).exclude(ordonnance='')
    
    for c in vieilles_commandes:
        if c.ordonnance:
            c.ordonnance.delete(save=True) # Supprime le fichier et vide le champ

def login_portail(request):
    if request.method == 'POST':
        u_name = request.POST.get('username')
        p_word = request.POST.get('password')
        role = request.POST.get('role') # Administrateur, Caissière, Client

        user = authenticate(request, username=u_name, password=p_word)
        
        if user is not None:
            login(request, user)
            # Redirection selon le rôle choisi et le statut réel
            if role == "administrateur" and user.is_superuser:
                return redirect('dashboard_boss')
            elif role == "caissiere" and user.is_staff:
                return redirect('session_caissiere_home')
            else:
                return redirect('core:home') # Client par défaut
        else:
            messages.error(request, "Identifiants invalides ou rôle incorrect. ❌")
            
    return render(request, 'registration/login.html')




@receiver(user_logged_in)
def welcome_message(sender, request, user, **kwargs):
    role = "Client"
    if user.is_superuser:
        role = "Administrateur"
    elif user.is_staff:
        role = "Employe a la Caisse"
    
    messages.info(request, f"Bienvenue {user.username} | {role} 🛰️")



def signup(request):
    """ Création de l'User (Simple client, PAS d'accès staff) 👤 """
    if request.method == 'POST':
        u_name = request.POST.get('username')
        f_name = request.POST.get('nom')
        tel = request.POST.get('telephone')
        passw = request.POST.get('password')

        try:
            # 1. Création de l'User Django SANS accès staff/admin 🚫🛡️
            user = User.objects.create_user(
                username=u_name, 
                password=passw,
                is_staff=False,    # Sécurité : Pas d'accès caisse
                is_superuser=False # Sécurité : Pas d'accès boss
            )
            
            # 2. Création du Profil Client (Automatique & lié) 🖇️
            Client.objects.create(
                user=user, 
                nom=f_name, 
                telephone=tel
            )
            
            # 🔔 BIENVENUE & ALERTE
            messages.success(request, f"Bienvenue {f_name} ! Votre compte est créé. ✨")
            return redirect('login')
            
        except Exception as e:
            messages.error(request, f"Erreur : l'identifiant est déjà utilisé. ❌")
            
    return render(request, 'core/register.html')


def custom_login(request):
    """ Connexion avec vérification du rôle et redirection QG 🎭 """
    if request.method == 'POST':
        u = request.POST.get('username')
        p = request.POST.get('password')
        role_select = request.POST.get('role') # Récupère le bouton radio du portail 🎫
        
        user = authenticate(request, username=u, password=p)
        
        if user is not None:
            # 🛡️ VÉRIFICATION DE LA COHÉRENCE (Séparation des pouvoirs)
            if role_select == 'admin' and not user.is_superuser:
                messages.error(request, "Accès au CONTROLE GENERAL refusé : Droits insuffisants. 🚫")
            elif role_select == 'caissiere' and (not user.is_staff or user.is_superuser):
                messages.error(request, "Accès Caisse refusé : Rôle non assigné. ❌")
            elif role_select == 'client' and user.is_staff:
                messages.error(request, "Accès Client refusé : Utilisez le portail Pro. 🛰️")
            else:
                # TOUT EST OK ✅
                login(request, user)
                
                # 🔔 NOTIFICATION POUR LA SESSION CAISSE
                if user.is_staff and not user.is_superuser:
                    messages.info(request, "Session Caisse activée. Prêt pour les ordonnances. 📋")
                    return redirect('core:point_de_vente')
                
                elif user.is_superuser:
                    messages.success(request, "Liaison ADMINISTRATEUR établie. Surveillance active. 🛰️")
                    return redirect('core:dashboard_boss')
                
                else:
                    messages.success(request, f"Heureux de vous revoir, {user.username} ! ✨")
                    return redirect('core:home')
        else:
            messages.error(request, "Identifiants invalides. ❌")
            
    return render(request, 'registration/login.html')



@staff_member_required
def gestion_ordonnances(request):
    """ Interface pour que la caissière valide les ordonnances 📋 """
    # On récupère les commandes qui ont une ordonnance mais ne sont pas encore validées
    attentes = Commande.objects.filter(
        statut="attente_validation", 
        ordonnance_valide=False
    ).exclude(ordonnance='').order_by('-date')
    
    return render(request, 'core/Caisse/gestion_ordonnances.html', {'attentes': attentes})

@staff_member_required
def approuver_ordonnance(request, commande_id):
    """ Valide l'ordonnance et permet au client de payer 🔓 """
    commande = get_object_or_404(Commande, id=commande_id)
    commande.ordonnance_valide = True
    commande.statut = "en_cours" # Prêt pour le paiement
    commande.save()
    messages.success(request, f"L'ordonnance pour la commande #{commande.id} a été approuvée ! ✅")
    return redirect('core:gestion_ordonnances')


@staff_member_required
def rejeter_ordonnance(request, commande_id):
    """ La caisse refuse et explique pourquoi ✍️ """
    commande = get_object_or_404(Commande, id=commande_id)
    
    if request.method == 'POST':
        raison = request.POST.get('raison_refus')
        commande.motif_refus = raison
        commande.ordonnance_valide = False
        commande.statut = "attente_validation" # On le laisse en attente d'une nouvelle version
        
        # On peut vider l'ancienne ordonnance pour forcer le client à en mettre une nouvelle
        if commande.ordonnance:
            commande.ordonnance.delete(save=False)
            
        commande.save()
        messages.error(
            request, 
            f"Ordonnance refusée pour la commande #{commande.id}. Motif : {raison} ✍️. Veuillez renvoyer un document valide.", 
            extra_tags='Client'
        )
        
    return redirect('core:gestion_ordonnances')


@user_passes_test(lambda u: u.is_superuser) # 🔐 Seul le BOSS (Superuser)
def update_stock_inline(request, produit_id):
    produit = get_object_or_404(Produit, id=produit_id)
    if request.method == "POST":
        nouvelle_qte = request.POST.get('quantite')
        if nouvelle_qte is not None:
            produit.quantite = int(nouvelle_qte)
            produit.save()
            Mouvement_stock.objects.create(produit=produit, quantite=nouvelle_qte, type="entree")
    return HttpResponse(produit.statut_stock())


@staff_member_required
def point_de_vente(request):
    """ Interface de vente directe au comptoir 🛒 """
    query = request.GET.get('q', '')
    produits = Produit.objects.filter(nom__icontains=query, quantite__gt=0)[:8]
    
    # On gère l'ajout rapide au panier via AJAX/HTMX
    return render(request, 'core/Caisse/pos.html', {
        'produits': produits,
        'query': query
    })


@staff_member_required
def modifier_photo_produit(request, produit_id):
    if request.method == 'POST' and request.FILES.get('nouvelle_photo'):
        produit = get_object_or_404(Produit, id=produit_id)
        produit.image = request.FILES['nouvelle_photo']
        produit.save()
        messages.success(request, f"Photo de {produit.nom} mise à jour ! 📸")
    return redirect('core:catalogue')


# views.py
def ticket_caisse_guichet(request, commande_id):
    commande = get_object_or_404(Commande, id=commande_id)
    config = PharmacieConfig.objects.first()
    
    # Génération du QR Code de traçabilité (ID + Date + Total)
    qr_data = f"TICKET:{commande.id}|DATE:{commande.date.strftime('%d%m%Y')}|TOTAL:{commande.total()}"
    qr = qrcode.make(qr_data)
    buf = BytesIO()
    qr.save(buf, format="PNG")
    qr_base64 = base64.b64encode(buf.getvalue()).decode('utf-8')

    return render(request, 'core/Caisse/ticket_thermique.html', {
        'commande': commande,
        'config': config,
        'qr_code': qr_base64,
    })


def telecharger_facture_pdf(request, commande_id):
    # 1. Récupération des données
    commande = get_object_or_404(Commande, id=commande_id)
    config = PharmacieConfig.objects.first()
    
    # 2. Préparation du contexte
    context = {
        'commande': commande,
        'config': config,
        'items': commande.items.all(),
        'date_edition': timezone.now(),
    }

    # 3. Rendu du template HTML (on va utiliser un style propre A4)
    html_string = render_to_string('core/Caisse/facture_a4_template.html', context)
    
    # 4. Conversion en PDF avec WeasyPrint
    response = HttpResponse(content_type='application/pdf')
    response['Content-Disposition'] = f'attachment; filename="Facture_PHARMA_{commande.id}.pdf"'
    
    # On précise base_url pour que WeasyPrint trouve les images/logos
    HTML(string=html_string, base_url=request.build_absolute_uri('/')).write_pdf(response)
    
    return response