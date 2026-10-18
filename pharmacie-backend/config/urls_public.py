"""
URLs servies sur le domaine RACINE de la plateforme (schéma "public" de django-tenants),
c'est-à-dire les requêtes qui n'appartiennent à AUCUNE pharmacie cliente en particulier.

Exemples de ce qui vit ici à terme :
- Le site marketing / page d'accueil du SaaS ("Pharmacie+ Cloud")
- L'inscription d'une nouvelle pharmacie cliente (création du tenant + de son schéma)
- L'administration globale de la plateforme (liste des pharmacies, plans, facturation SaaS)

Tout le reste (catalogue, ventes, stock, factures...) vit dans core.urls,
servi sur le sous-domaine propre à chaque pharmacie (cf. config/urls.py).
"""
from django.contrib import admin
from django.urls import path, include
from marketplace.api import api_contexte
from .health import healthz

urlpatterns = [
    path("healthz/", healthz, name="healthz_public"),

    # 🏥 Panneau d'administration de la plateforme : gestion des pharmacies clientes (tenants)
    path("admin/", admin.site.urls),

    # 🛒 Marketplace (découverte multi-pharmacies) : DOIT être servie ici, sur le domaine
    # plateforme -- c'est la page où le client choisit sa pharmacie AVANT d'être sur un
    # sous-domaine. Montée aussi dans config/urls.py (sous-domaines de pharmacies), mêmes vues.
    path("api/v1/marketplace/", include("marketplace.urls", namespace="marketplace_public_v1")),

    # 📍 Contexte (plateforme ou pharmacie ?) : même adresse que dans config/urls.py,
    # le backend répond selon le domaine appelé. Voir marketplace/api.py.
    path("api/v1/contexte/", api_contexte, name="contexte_public"),

    # TODO (prochaine étape) : endpoint public d'inscription d'une nouvelle pharmacie
    # path("api/signup-pharmacie/", tenants_api.api_signup_pharmacie, name="api_signup_pharmacie"),
]
