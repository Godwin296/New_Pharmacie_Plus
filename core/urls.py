from django.urls import path
from . import views

app_name = 'core'

urlpatterns = [
    # Navigation de base
    path("", views.home, name="home"),
    path("catalogue/", views.catalogue, name="catalogue"),
    path("panier/", views.panier, name="panier"),
    path("mes-commandes/", views.mes_commandes, name="mes_commandes"),
    
    # Processus de commande
    path("ajouter/<int:produit_id>/", views.ajouter_au_panier, name="ajouter_au_panier"),
    path("upload-ordonnance/<int:commande_id>/", views.uploader_ordonnance, name="uploader_ordonnance"),
    
    # Facturation et Validation
    path("facture/<int:commande_id>/", views.facture, name="facture"),
    path("facture-pdf/<int:commande_id>/", views.export_facture_pdf, name="export_facture_pdf"),
    path("valider-commande/<int:commande_id>/", views.facture_commande, name="facture_commande"),
    
    # Espace Pro / Hôpital (District)
    path("validation-guichet/<int:commande_id>/", views.validation_guichet, name="validation_guichet"),
]
