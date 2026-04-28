# admin.py
from django.contrib import admin
from .models import Client, Produit, Commande, ItemCommande, Fournisseur

# --- Gestion des Clients ---
@admin.register(Client)
class ClientAdmin(admin.ModelAdmin):
    list_display = ("nom", "identifiant", "telephone")
    search_fields = ("nom", "identifiant")
    

# --- Gestion des Produits (Médicaments) ---
@admin.register(Produit)
class ProduitAdmin(admin.ModelAdmin):
    list_display = ('nom', 'laboratoire', 'categorie', 'quantite', 'prix', 'statut_peremption', 'seuil_alerte')
    list_filter = ('categorie', 'laboratoire')
    search_fields = ('nom', 'laboratoire')
    
    # 🎯 MAGIE : Transforme le champ catégorie en recherche filtrée progressive
    # (Utilise le widget de recherche de Django pour les choix statiques)
    def get_form(self, request, obj=None, **kwargs):
        form = super().get_form(request, obj, **kwargs)
        # On peut injecter des classes CSS pour que Django Admin 
        # utilise son JS de recherche sur le select
        form.base_fields['categorie'].widget.attrs.update({'class': 'admin-autocomplete'})
        return form

    class Media:
        # On s'assure que les scripts de recherche de l'admin sont chargés
        js = ('admin/js/vendor/jquery/jquery.js', 'admin/js/vendor/select2/select2.full.js', 'admin/js/autocomplete.js')
        css = {
            'all': ('admin/css/vendor/select2/select2.css', 'admin/css/autocomplete.css')
        }


# --- Gestion des commandes ---
@admin.register(ItemCommande)
class ItemCommandeAdmin(admin.ModelAdmin):
    list_display = ("commande", "produit", "quantite")
    search_fields = ("commande__id", "produit__nom")
    
# --- Gestions des commandes (ventes) ---
@admin.register(Commande)
class CommandeAdmin(admin.ModelAdmin):
    list_display = ("id", "client", "date", "type_vente", "statut", "payee", "ordonnance_valide")
    list_filter = ("statut", "type_vente", "payee", "date")
    list_editable = ("ordonnance_valide", "statut") 
    search_fields = ("client__nom", "id")
    actions = ['marquer_comme_valide_main_propre']

    def marquer_comme_valide_main_propre(self, request, queryset):
        queryset.update(
            ordonnance_valide=True, 
            type_vente='guichet', 
            agent_validateur=request.user.username
        )
    marquer_comme_valide_main_propre.short_description = "Valider (Ordonnance vue en main propre)"
  

# ---Gestion des fournisseurs---
@admin.register(Fournisseur)
class FournisseurAdmin(admin.ModelAdmin):
    list_display = ("nom", "manager", "telephone", "email")
    search_fields = ("nom", "manager")
