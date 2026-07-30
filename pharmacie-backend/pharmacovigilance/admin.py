from django.contrib import admin
from .models import PrincipeActif, InteractionMedicamenteuse


@admin.register(PrincipeActif)
class PrincipeActifAdmin(admin.ModelAdmin):
    list_display = ("nom", "alias")
    search_fields = ("nom", "alias")


@admin.register(InteractionMedicamenteuse)
class InteractionMedicamenteuseAdmin(admin.ModelAdmin):
    list_display = ("principe_actif_a", "principe_actif_b", "gravite", "source")
    list_filter = ("gravite",)
    search_fields = ("principe_actif_a__nom", "principe_actif_b__nom", "description")
    autocomplete_fields = ("principe_actif_a", "principe_actif_b")
