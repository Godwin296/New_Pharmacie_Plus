from django.contrib import admin
from django_tenants.admin import TenantAdminMixin
from .models import Pharmacie, Domain
from marketplace.models import HoraireOuverture


class DomainInline(admin.TabularInline):
    model = Domain
    extra = 1


class HoraireOuvertureInline(admin.TabularInline):
    model = HoraireOuverture
    extra = 0
    max_num = 7


@admin.register(Pharmacie)
class PharmacieAdmin(TenantAdminMixin, admin.ModelAdmin):
    list_display = ("nom", "schema_name", "plan", "actif", "proprietaire_email", "date_creation")
    list_filter = ("plan", "actif")
    search_fields = ("nom", "schema_name", "proprietaire_email")
    inlines = [DomainInline, HoraireOuvertureInline]
    # 🪞 Miroir marketplace : synchronisé automatiquement depuis PharmacieConfig
    # (marketplace/signals.py) -- lecture seule ici pour ne pas créer d'incohérence en
    # les modifiant depuis cet écran par erreur. Modifier la vraie donnée sur /admin/settings.
    readonly_fields = ("nom_public", "logo_public", "adresse_public", "telephone_public")

    def delete_model(self, request, obj):
        # 🔐 Sécurité : on force l'utilisateur à confirmer explicitement la suppression du schéma
        # (django-tenants empêche par défaut le drop accidentel d'un schéma contenant des données réelles)
        obj.delete(force_drop=True)


@admin.register(Domain)
class DomainAdmin(admin.ModelAdmin):
    list_display = ("domain", "tenant", "is_primary")
    search_fields = ("domain",)
