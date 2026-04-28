from django.urls import path
from . import views, api 

app_name = 'core'

urlpatterns = [
    # --- 🚀 NOUVELLES ROUTES POUR NEXT.JS (Le moteur rapide) ---
    # Routes Système & Auth
    path("login/", api.api_login, name="api_login"),
    path("register/", api.api_register, name="api_register"),
    path("infos-pharmacie/", api.infos_pharmacie, name="api_infos_pharmacie"), # Indispensable pour Settings et Print
    path("update-config/", api.api_update_config, name="api_update_config"),

    # Routes Boutique & Client
    path("catalogue/", api.api_catalogue, name="api_catalogue"),
    path("panier/", api.api_panier, name="api_panier"),
    path("commandes/", api.api_mes_commandes, name="api_mes_commandes"),
    path('vente-directe/', api.api_vente_directe, name='api_vente_directe'),
    path('ticket-caisse/<int:commande_id>/', views.facture, name='ticket_caisse'),
    
    # Routes Admin & Gestion
    path("boss-dashboard/", api.api_boss_dashboard, name="api_boss_dashboard"), # Corrigé pour correspondre au Print
    path("boss/update-stock/<int:produit_id>/", api.api_update_stock, name="api_update_stock"),
    path("ordonnances/", api.api_gestion_ordonnance, name="api_liste_ordonnances"),
    path("ordonnances/<int:commande_id>/", api.api_gestion_ordonnance, name="api_action_ordonnance"),
    path("archives/", api.api_archives_caissiere, name="api_archives"),
    path("fournisseurs/", api.api_fournisseurs, name="api_fournisseurs"),
    path("fournisseurs/<int:pk>/", api.api_fournisseur_detail, name="api_fournisseur_detail"),
   
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
    path("boss/historique/", views.historique_ventes_boss, name="historique_ventes_boss"),
    path("boss/reapprovisionnement/", views.reapprovisionnement_boss, name="reapprovisionnement_boss"),
    # --- Rapports & Exports (Boss Mode) ---
    path('export-pdf/rapport-stock/', views.export_rapport_stock, name='export_rapport_stock'),
    path('export-pdf/stocks/', views.export_alertes_pdf, name='export_alertes_pdf'),
    path('export-pdf/financier/', views.export_pdf_financier, name='export_pdf_financier'),
    path("boss/rapports/", views.rapports_boss, name="rapports_boss"),
    path("boss/rapports/pdf-financier/", views.export_pdf_financier, name="pdf_financier"),
    path("boss/rapports/pdf-stock/", views.export_rapport_stock, name="pdf_stock"),
    path('boss/parametres/', views.parametres_boss, name='parametres_boss'),
    path("caisse/ordonnances/", views.gestion_ordonnances, name="gestion_ordonnances"),
    path("caisse/ordonnances/approuver/<int:commande_id>/", views.approuver_ordonnance, name="approuver_ordonnance"),
    path("caisse/pos/", views.point_de_vente, name="point_de_vente"),
    path("inscription/", views.signup, name="signup"),
    path("boss/stocks/", views.gestion_stocks_boss, name="gestion_stocks_boss"),
    path("boss/fournisseurs/", views.fournisseurs_boss, name="fournisseurs_boss"),
    path("boss/dashboard/", views.dashboard_boss, name="dashboard_boss"),
    path("modifier-photo/<int:produit_id>/", views.modifier_photo_produit, name="modifier_photo_produit"),
]
