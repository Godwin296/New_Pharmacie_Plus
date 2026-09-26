from django.contrib import admin
from .models import HoraireOuverture


@admin.register(HoraireOuverture)
class HoraireOuvertureAdmin(admin.ModelAdmin):
    list_display = ("pharmacie", "jour_semaine", "ferme", "heure_ouverture", "heure_fermeture")
    list_filter = ("jour_semaine", "ferme")
    search_fields = ("pharmacie__nom",)
