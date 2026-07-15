from django.contrib import admin
from .models import CompteClient


# --- 🌍 GESTION DES COMPTES CLIENTS GLOBAUX (MARKETPLACE) ---
@admin.register(CompteClient)
class CompteClientAdmin(admin.ModelAdmin):
    list_display = ("nom", "identifiant", "email", "telephone", "is_active", "date_creation")
    search_fields = ("nom", "identifiant", "email", "telephone")
    list_filter = ("is_active", "date_creation")
    readonly_fields = ("date_creation",)
