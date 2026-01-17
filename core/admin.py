from django.contrib import admin
from .models import Client, Produit, Commande, ItemCommande

# --- Gestion des Clients ---
@admin.register(Client)
class ClientAdmin(admin.ModelAdmin):
    list_display = ("nom", "identifiant", "telephone")
    search_fields = ("nom", "identifiant")
    

# --- Gestion des Produits (Médicaments) ---
@admin.register(Produit)
class ProduitAdmin(admin.ModelAdmin):
    list_display = ('nom', 'categorie', 'quantite', 'prix', 'date_ajout', 'seuil_alerte')
    list_filter = ('categorie',) # permet aussi de filtrer dans l'admin !
    search_fields = ('nom',)


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
    list_editable = ("ordonnance_valide", "statut") # Permet de valider d'un clic dans la liste
    search_fields = ("client__nom", "id")
    actions = ['marquer_comme_valide_main_propre']

    def marquer_comme_valide_main_propre(self, request, queryset):
        queryset.update(
            ordonnance_valide=True, 
            type_vente='guichet', 
            agent_validateur=request.user.username
        )
    marquer_comme_valide_main_propre.short_description = "Valider (Ordonnance vue en main propre)"
  
