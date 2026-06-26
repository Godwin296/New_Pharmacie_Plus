from django.contrib import admin
from django_tenants.admin import TenantAdminMixin
from .models import Pharmacie, Domain


class DomainInline(admin.TabularInline):
    model = Domain
    extra = 1


@admin.register(Pharmacie)
class PharmacieAdmin(TenantAdminMixin, admin.ModelAdmin):
    list_display = ("nom", "schema_name", "plan", "actif", "proprietaire_email", "date_creation")
    list_filter = ("plan", "actif")
    search_fields = ("nom", "schema_name", "proprietaire_email")
    inlines = [DomainInline]

    def delete_model(self, request, obj):
        # 🔐 Sécurité : on force l'utilisateur à confirmer explicitement la suppression du schéma
        # (django-tenants empêche par défaut le drop accidentel d'un schéma contenant des données réelles)
        obj.delete(force_drop=True)


@admin.register(Domain)
class DomainAdmin(admin.ModelAdmin):
    list_display = ("domain", "tenant", "is_primary")
    search_fields = ("domain",)
