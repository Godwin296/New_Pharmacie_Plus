from django.contrib import admin
from .models import Client, ClientGuichet, Produit, Commande, ItemCommande, Fournisseur, LotProduit

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


# --- 📦 GESTION DES LOTS (FEFO), EN LIGNE SUR LA FICHE PRODUIT ---
class LotProduitInline(admin.TabularInline):
    """
    🔧 CHANTIER LOTS/FEFO : permet de réceptionner un lot daté directement depuis /admin/,
    en attendant une vraie UI Next.js dédiée. IMPORTANT : Produit.quantite/date_expiration
    sont un CACHE -- voir ProduitAdmin.save_formset ci-dessous, qui le recalcule à chaque
    sauvegarde de la fiche produit (sans ça, l'admin afficherait un stock incohérent avec
    le catalogue/panier tant que le cache n'est pas rafraîchi).
    """
    model = LotProduit
    extra = 0
    fields = ("numero_lot", "quantite_initiale", "quantite_restante", "date_peremption", "auteur", "note")
    readonly_fields = ("date_reception",)


# --- 💊 GESTION DES PRODUITS (MÉDICAMENTS) ---
@admin.register(Produit)
class ProduitAdmin(admin.ModelAdmin):
    list_display = ('nom', 'laboratoire', 'categorie', 'quantite', 'prix', 'ordonnance_obligatoire', 'statut_peremption', 'seuil_alerte')
    list_filter = ('categorie', 'laboratoire', 'ordonnance_obligatoire')
    search_fields = ('nom', 'laboratoire')
    inlines = [LotProduitInline]
    # 🔧 CHANTIER LOTS/FEFO : quantite/date_expiration sont calculés à partir des lots --
    # on les rend visibles mais non éditables directement ici pour éviter toute divergence
    # avec la réalité des lots (l'édition passe désormais par LotProduitInline ci-dessus).
    readonly_fields = ('quantite', 'date_expiration')

    def get_form(self, request, obj=None, **kwargs):
        form = super().get_form(request, obj, **kwargs)
        form.base_fields['categorie'].widget.attrs.update({'class': 'admin-autocomplete'})
        return form

    def save_formset(self, request, form, formset, change):
        """Après ajout/modif/suppression de lots en inline, on recalcule le cache Produit."""
        instances = formset.save(commit=False)
        for obj in instances:
            if not obj.auteur_id:
                obj.auteur = request.user
            obj.save()
        for obj in formset.deleted_objects:
            obj.delete()
        formset.save_m2m()
        if formset.model is LotProduit:
            form.instance.recalculer_cache_stock()

    class Media:
        js = ('admin/js/vendor/jquery/jquery.js', 'admin/js/vendor/select2/select2.full.js', 'admin/js/autocomplete.js')
        css = {
            'all': ('admin/css/vendor/select2/select2.css', 'admin/css/autocomplete.css')
        }


# --- 📦 GESTION DES LOTS (FEFO), VUE TRANSVERSALE (TOUS PRODUITS) ---
@admin.register(LotProduit)
class LotProduitAdmin(admin.ModelAdmin):
    list_display = ("produit", "numero_lot", "quantite_initiale", "quantite_restante", "date_peremption", "date_reception", "auteur")
    list_filter = ("date_peremption",)
    search_fields = ("produit__nom", "numero_lot")
    autocomplete_fields = ("produit",)

    def save_model(self, request, obj, form, change):
        if not obj.auteur_id:
            obj.auteur = request.user
        super().save_model(request, obj, form, change)
        obj.produit.recalculer_cache_stock()

    def delete_model(self, request, obj):
        produit = obj.produit
        super().delete_model(request, obj)
        produit.recalculer_cache_stock()


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
