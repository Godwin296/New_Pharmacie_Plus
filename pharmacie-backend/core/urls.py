from django.urls import path
from . import views, api 

app_name = 'core'

urlpatterns = [
    # --- 🔐 SYSTÈME ET AUTHENTIFICATION (NEXT.JS) ---
    path("login/", api.api_login, name="api_login"),
    path("register/", api.api_register, name="api_register"),
    path("infos-pharmacie/", api.infos_pharmacie, name="api_infos_pharmacie"),
    path("update-config/", api.api_update_config, name="api_update_config"),
    path("current-user/", api.api_get_current_user, name="api_get_current_user"),
    
    # --- 🛒 EXPOSITION DES SERVICES CLIENT (NEXT.JS) ---
    path("catalogue/", api.api_catalogue, name="api_catalogue"), # Résolu : Plus de doublon
    path("panier/", api.api_panier, name="api_panier"),
    path("commandes/", api.api_mes_commandes, name="api_mes_commandes"),
    
    # --- 🏥 OPÉRATIONS DE CAISSE ET DE VENTE (NEXT.JS) ---
    path('vente-directe/', api.api_vente_directe, name='api_vente_directe'),
    path("ordonnances/", api.api_gestion_ordonnance, name="api_liste_ordonnances"),
    path("ordonnances/<int:commande_id>/", api.api_gestion_ordonnance, name="api_action_ordonnance"),
    path("archives/", api.api_archives_caissiere, name="api_archives"),
    
    # --- 📉 GESTION ET ADMINISTRATION STRICTE (NEXT.JS) ---
    path("boss-dashboard/", api.api_boss_dashboard, name="api_boss_dashboard"),
    path("boss/update-stock/<int:produit_id>/", api.api_update_stock, name="api_update_stock"),
    path("fournisseurs/", api.api_fournisseurs, name="api_fournisseurs"),
    path("fournisseurs/<int:pk>/", api.api_fournisseur_detail, name="api_fournisseur_detail"),
    path("inventaire_stock/", api.api_inventaire_stock, name="api_inventaire_stock"),
    # 🔐 BRANCHEMENT SÉCURISÉ : On pointe vers la fonction API protégée par le JWT de l'Admin
    path("modifier-photo/<int:produit_id>/", api.api_modifier_photo_produit, name="api_modifier_photo_produit"),

    # --- 📄 IMPRESSIONS & EXPORTS SÉCURISÉS ---
    # Ces routes restent nécessaires car ton Next.js va ouvrir des fenêtres de téléchargement PDF
    path("facture-pdf/<int:commande_id>/", views.export_facture_pdf, name="export_facture_pdf"),
    path('export-pdf/rapport-stock/', views.export_rapport_stock, name='export_rapport_stock'),
    path('export-pdf/stocks/', views.export_alertes_pdf, name='export_alertes_pdf'),
    path('export-pdf/financier/', views.export_pdf_financier, name='export_pdf_financier'),
    path('ticket-caisse-guichet/<int:commande_id>/', views.ticket_caisse_guichet, name='ticket_caisse_guichet'),
    path('telecharger-facture-pdf/<int:commande_id>/', views.telecharger_facture_pdf, name='telecharger_facture_pdf'),
]