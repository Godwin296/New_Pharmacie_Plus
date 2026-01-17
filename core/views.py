from django.contrib.auth.decorators import login_required
from django.shortcuts import render, get_object_or_404, redirect
from django.contrib import messages
from .models import Produit, Commande, ItemCommande, Client
from django.db import transaction
import qrcode
import base64
from io import BytesIO
from django.conf import settings
from django.http import HttpResponse
from django.template.loader import render_to_string


# Accueil
def home(request):
    return render(request, 'core/home.html')

# Catalogue avec filtres et recherche
def catalogue(request):
    categories = Produit.CATEGORIES
    query_cat = request.GET.get('cat')
    search_query = request.GET.get('q')
    produits = Produit.objects.all()
    
    if query_cat:
        produits = produits.filter(categorie=query_cat)
    if search_query:
        produits = produits.filter(nom__icontains=search_query)
        
    return render(request, 'core/catalogue.html', {
        'produits': produits,
        'categories': categories,
        'active_cat': query_cat,
        'search_query': search_query
    })

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
        except Exception as e:
            messages.error(request, f"Erreur : {e}")
            return redirect("core:panier")
            
    return redirect("core:facture", commande_id=commande.id)

# Affichage Facture avec QR Code
@login_required
def facture(request, commande_id):
    commande = get_object_or_404(Commande, id=commande_id)
    items = commande.items.all()
    total = commande.total()
    
    qr_data = f"Facture ID: {commande.id} | Client: {commande.client.nom} | Total: {total} FCFA"
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
    if not request.user.is_authenticated:
        messages.error(request, "Veuillez vous connecter.")
        return redirect("login")
    
    choix_qte = int(request.POST.get('selection_quantite', 1))
    if choix_qte > produit.quantite:
        messages.error(request, f"Stock insuffisant ({produit.quantite} disponibles).")
        return redirect("core:catalogue")
    
    if (item.quantite + choix_qte) > produit.quantite:
        messages.error(request, f"Stock insuffisant : seulement {produit.quantite} disponibles.")
        return redirect("core:catalogue")
    
    client_profile, _ = Client.objects.get_or_create(user=request.user, defaults={'nom': request.user.username})
    commande, _ = Commande.objects.get_or_create(client=client_profile, payee=False)
    
    item, created = ItemCommande.objects.get_or_create(commande=commande, produit=produit)
    if created:
        item.quantite = choix_qte
    else:
        item.quantite += choix_qte
    item.save()
    
    messages.success(request, f"Ajouté au panier.")
    return redirect("core:panier")

@login_required
def panier(request):
    client_profile = get_object_or_404(Client, user=request.user)
    commande = Commande.objects.filter(client=client_profile, payee=False).first()
    total = commande.total() if commande else 0
    return render(request, "core/panier.html", {"commande": commande, "total": total})

@login_required
def mes_commandes(request):
    client_profile = get_object_or_404(Client, user=request.user)
    commandes = Commande.objects.filter(client=client_profile, payee=True).order_by('-date')
    return render(request, 'core/mes_commandes.html', {'commandes': commandes})

@login_required
def export_facture_pdf(request, commande_id):
    """Génère un PDF uniquement si les bibliothèques système sont présentes."""
    commande = get_object_or_404(Commande, id=commande_id, client__user=request.user)
    
    try:
        # L'importation se fait ici pour ne pas bloquer le reste du projet
        from weasyprint import HTML
        
        # Préparation du contenu HTML
        html_string = render_to_string('facture.html', {
            'commande': commande, 
            'items': commande.items.all(), 
            'total': commande.total()
        })
        # Génération du PDF
        html = HTML(string=html_string, base_url=request.build_absolute_uri())
        pdf = html.write_pdf()
        
        response = HttpResponse(pdf, content_type='application/pdf')
        response['Content-Disposition'] = f'attachment; filename="Facture_{commande.id}.pdf"'
        return response

    except (ImportError, OSError):
        # Si WeasyPrint ou GTK+ (libgobject) est absent, on affiche un message propre
        return HttpResponse(
            "<h3>L'export PDF est indisponible sur ce poste.</h3>"
            "<p>Les bibliothèques système requises (GTK+) ne sont pas installées.</p>"
            "<p><a href='javascript:history.back()'>Retourner à la facture</a></p>"
        )

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
