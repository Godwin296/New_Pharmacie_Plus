from django.contrib import admin
from .models import Client, ClientGuichet, Produit, Commande, ItemCommande, Fournisseur

# --- 👤 GESTION DES CLIENTS EN LIGNE (SMARTPHONE) ---
@admin.register(Client)
class ClientAdmin(admin.ModelAdmin):
    list_display = ("nom", "identifiant", "telephone")
    search_fields = ("nom", "identifiant")
    

# --- 🏪 GESTION DES CLIENTS DE PASSAGE (GUICHTET POS) ---
@admin.register(ClientGuichet)
class ClientGuichetAdmin(admin.ModelAdmin):
    # 🌟 Affiche toutes les coordonnées et la localisation entrées au guichet Next.js !
    list_display = ("nom", "telephone", "email", "region", "ville", "quartier", "date_creation")
    search_fields = ("nom", "telephone", "ville", "quartier")
    list_filter = ("region", "ville", "date_creation")


# --- 💊 GESTION DES PRODUITS (MÉDICAMENTS) ---
@admin.register(Produit)
class ProduitAdmin(admin.ModelAdmin):
    list_display = ('nom', 'laboratoire', 'categorie', 'quantite', 'prix', 'ordonnance_obligatoire', 'statut_peremption', 'seuil_alerte')
    list_filter = ('categorie', 'laboratoire', 'ordonnance_obligatoire')
    search_fields = ('nom', 'laboratoire')
    
    def get_form(self, request, obj=None, **kwargs):
        form = super().get_form(request, obj, **kwargs)
        form.base_fields['categorie'].widget.attrs.update({'class': 'admin-autocomplete'})
        return form

    class Media:
        js = ('admin/js/vendor/jquery/jquery.js', 'admin/js/vendor/select2/select2.full.js', 'admin/js/autocomplete.js')
        css = {
            'all': ('admin/css/vendor/select2/select2.css', 'admin/css/autocomplete.css')
        }


# --- 📦 GESTION DES LIGNES DE COMMANDES ---
@admin.register(ItemCommande)
class ItemCommandeAdmin(admin.ModelAdmin):
    list_display = ("commande", "produit", "quantite")
    search_fields = ("commande__id", "produit__nom")
    

# --- 🛒 GESTIONS DES COMMANDES (VENTES) ---
@admin.register(Commande)
class CommandeAdmin(admin.ModelAdmin):
    # 🌟 STABLE : On ajoute 'client_guichet' et 'compte_client' pour voir immédiatement l'origine de la vente
    list_display = ("id", "client", "compte_client", "client_guichet", "date", "type_vente", "statut", "payee", "ordonnance_valide")
    list_filter = ("statut", "type_vente", "payee", "date")
    list_editable = ("ordonnance_valide", "statut") 
    search_fields = ("client__nom", "compte_client__nom", "client_guichet__nom", "id")
    actions = ['marquer_comme_valide_main_propre']

    def marquer_comme_valide_main_propre(self, request, queryset):
        # 🔐 Sécurité traçabilité
        queryset.update(
            ordonnance_valide=True, 
            type_vente='guichet', 
            agent_validateur=request.user
        )
    marquer_comme_valide_main_propre.short_description = "Valider (Ordonnance vue en main propre)"
  

# --- 🚚 GESTION DES FOURNISSEURS ---
@admin.register(Fournisseur)
class FournisseurAdmin(admin.ModelAdmin):
    list_display = ("nom", "manager", "telephone", "email")
    search_fields = ("nom", "manager")
